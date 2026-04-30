const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { isValidTeamCode } = require('../data/teams');
const { rollupPostNotif, notify } = require('../services/notifier');

const VALID_TYPES = new Set(['take', 'photo', 'score', 'poll', 'clip', 'box', 'rumor']);

// 1-minute window after creation in which the author can still edit.
const EDIT_WINDOW_MS = 60 * 1000;

const SELECT_POST = `
  SELECT p.id, p.user_id, p.content, p.image, p.like_count, p.repost_count,
         p.reply_count, p.reply_to, p.created_at, p.edited_at,
         p.type, p.tags, p.extra,
         u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags,
         u.is_admin AS author_is_admin, u.is_owner AS author_is_owner,
         u.is_official AS author_is_official, u.is_verified AS author_is_verified
  FROM posts p
  JOIN users u ON u.id = p.user_id
`;

// Build the SQL fragment that hides authors blocked-by or blocking the
// viewer, plus authors the viewer has muted. Returns { fragment, params }
// that you splice into a WHERE clause.
function blockFilter(viewerId) {
  if (!viewerId) return { fragment: '', params: [] };
  return {
    fragment: `
      AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
      AND p.user_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)
      AND p.user_id NOT IN (SELECT muted_id   FROM mutes  WHERE muter_id   = ?)
    `,
    params: [viewerId, viewerId, viewerId],
  };
}

function hydrate(p) {
  if (!p) return p;
  let extra = {};
  try { extra = JSON.parse(p.extra || '{}') || {}; } catch {}
  let tags = [];
  try { tags = JSON.parse(p.tags || '[]') || []; } catch {}
  let userTeams = [];
  try { userTeams = JSON.parse(p.team_tags || '[]') || []; } catch {}
  return {
    id: p.id,
    type: p.type || 'take',
    content: p.content,
    text: p.content,                // alias for design components
    image: p.image,
    tags,
    extra,
    ...extra,                       // spread type-specific fields onto top level
    likes: p.like_count,
    reposts: p.repost_count,
    replies: p.reply_count,
    reply_to: p.reply_to,
    created_at: p.created_at,
    edited_at: p.edited_at,
    liked: !!p.liked,
    reposted: !!p.reposted,
    bookmarked: !!p.bookmarked,
    user: {
      id: p.user_id,
      username: p.username,
      displayName: p.display_name,
      avatar: p.avatar,
      avatarHue: p.avatar_hue ?? 200,
      teams: userTeams,
      is_admin:    !!p.author_is_admin || !!p.author_is_owner,
      is_owner:    !!p.author_is_owner,
      is_official: !!p.author_is_official,
      is_verified: !!p.author_is_verified,
    },
  };
}

function normalizeTags(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const code = String(raw).trim().toUpperCase();
    if (!isValidTeamCode(code) || seen.has(code)) continue;
    seen.add(code); out.push(code);
    if (out.length >= 5) break;
  }
  return out;
}

function attachInteraction(p, userId) {
  if (!userId) { p.liked = 0; p.reposted = 0; p.bookmarked = 0; return; }
  p.liked      = db.prepare('SELECT 1 FROM likes     WHERE user_id = ? AND post_id = ?').get(userId, p.id) ? 1 : 0;
  p.reposted   = db.prepare('SELECT 1 FROM reposts   WHERE user_id = ? AND post_id = ?').get(userId, p.id) ? 1 : 0;
  p.bookmarked = db.prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?').get(userId, p.id) ? 1 : 0;
}

// Create post
router.post('/', requireAuth, (req, res) => {
  const { content, reply_to, type, tags, extra, image } = req.body;

  const trimmed = (content || '').trim();
  // For media types you can post without a caption; everything else still
  // requires text.
  const hasMedia = !!image || !!(extra && typeof extra === 'object' && extra.video_url);
  if (!trimmed && !hasMedia) {
    return res.status(400).json({ error: 'Add some text or attach a photo / clip' });
  }
  if (trimmed.length > 280) {
    return res.status(400).json({ error: 'Post must be 280 characters or fewer' });
  }
  const postType = VALID_TYPES.has(type) ? type : 'take';
  const tagsJson = JSON.stringify(normalizeTags(tags));
  let extraJson = '{}';
  if (extra && typeof extra === 'object') {
    try { extraJson = JSON.stringify(extra).slice(0, 4000); } catch {}
  }

  if (reply_to) {
    const parent = db.prepare('SELECT id FROM posts WHERE id = ?').get(reply_to);
    if (!parent) return res.status(404).json({ error: 'Post not found' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO posts (id, user_id, content, image, reply_to, type, tags, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, trimmed, image || null, reply_to || null, postType, tagsJson, extraJson);

  db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').run(req.user.id);
  if (reply_to) {
    db.prepare('UPDATE posts SET reply_count = reply_count + 1 WHERE id = ?').run(reply_to);
  }

  // Fan out a roll-up "@author posted" notification to every follower (only
  // for top-level posts, not replies). Each recipient gets one row per
  // author per UTC day; further posts the same day bump count + preview
  // on the existing row. Blocked relationships exclude both directions.
  if (!reply_to) {
    const author = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(req.user.id);
    const followers = db.prepare(`
      SELECT f.follower_id AS id
      FROM follows f
      WHERE f.following_id = ?
        AND f.follower_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
        AND f.follower_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)
    `).all(author.id, author.id, author.id);
    const fanOut = db.transaction((rows) => {
      for (const r of rows) {
        rollupPostNotif({
          followerId: r.id,
          author: { id: author.id, username: author.username, displayName: author.display_name },
          post: { id, content: trimmed || '', type: postType },
        });
      }
    });
    fanOut(followers);
  }

  // Mention notifications. Scan the post body for @username tokens and
  // notify each unique mentioned user (skip self-mentions, the author's
  // followers — those already get the rolled-up post notif — would have
  // a separate row, but for clarity we send mention notifs to every
  // mentioned user regardless). Blocked relationships still drop them.
  const mentionMatches = [...trimmed.matchAll(/(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,20})\b/g)];
  const mentionedHandles = [...new Set(mentionMatches.map(m => m[2].toLowerCase()))];
  if (mentionedHandles.length) {
    const placeholders = mentionedHandles.map(() => '?').join(',');
    const targets = db.prepare(`
      SELECT id, username FROM users
      WHERE LOWER(username) IN (${placeholders}) AND banned = 0 AND id != ?
        AND id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
        AND id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)
    `).all(...mentionedHandles, req.user.id, req.user.id, req.user.id);
    for (const t of targets) {
      notify({
        userId: t.id, type: 'mention', actorId: req.user.id,
        data: {
          post_id: id,
          preview: trimmed.slice(0, 140),
        },
        // One mention notif per (recipient, post) — re-mentioning the
        // same user in an edit doesn't double up.
        dedupeKey: `mention:${id}:${t.id}`,
        bumpOnDedupe: false,
      });
    }
  }

  const row = db.prepare(`${SELECT_POST} WHERE p.id = ?`).get(id);
  attachInteraction(row, req.user.id);
  res.status(201).json(hydrate(row));
});

// Following + own (banned + blocked authors hidden)
router.get('/feed', requireAuth, (req, res) => {
  const cursor = req.query.cursor;
  const block = blockFilter(req.user.id);
  const params = [req.user.id, req.user.id, ...block.params];
  let query = `${SELECT_POST}
    WHERE p.reply_to IS NULL
      AND u.banned = 0
      AND (
        p.user_id = ?
        OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
      )
      ${block.fragment}`;
  if (cursor) { query += ' AND p.created_at < ?'; params.push(cursor); }
  query += ' ORDER BY p.created_at DESC LIMIT 30';

  const rows = db.prepare(query).all(...params);
  rows.forEach(r => attachInteraction(r, req.user.id));
  res.json(rows.map(hydrate));
});

// Public global feed (banned + blocked authors hidden)
router.get('/explore', optionalAuth, (req, res) => {
  const cursor = req.query.cursor;
  const block = blockFilter(req.user?.id);
  const params = [...block.params];
  let query = `${SELECT_POST} WHERE p.reply_to IS NULL AND u.banned = 0 ${block.fragment}`;
  if (cursor) { query += ' AND p.created_at < ?'; params.push(cursor); }
  query += ' ORDER BY p.created_at DESC LIMIT 30';

  const rows = db.prepare(query).all(...params);
  rows.forEach(r => attachInteraction(r, req.user?.id));
  res.json(rows.map(hydrate));
});

// Posts tagged with a specific team (composite "NFL:PHI" or bare "PHI").
// Banned authors hidden. Public — anyone can view a team's tag feed.
router.get('/by-tag/:code', optionalAuth, (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!isValidTeamCode(code)) return res.status(400).json({ error: 'Invalid tag' });

  const cursor = req.query.cursor;
  const block = blockFilter(req.user?.id);
  // SQLite has no JSON_CONTAINS; tags are stored as a JSON-array string,
  // so a LIKE on the quoted code is the cheapest predicate. The pattern
  // matches "NFL:PHI" or "PHI" because we surround with `"` quotes.
  const params = [`%"${code}"%`, ...block.params];
  let query = `${SELECT_POST}
    WHERE p.reply_to IS NULL
      AND u.banned = 0
      AND p.tags LIKE ?
      ${block.fragment}`;
  if (cursor) { query += ' AND p.created_at < ?'; params.push(cursor); }
  query += ' ORDER BY p.created_at DESC LIMIT 50';

  const rows = db.prepare(query).all(...params);
  rows.forEach(r => attachInteraction(r, req.user?.id));
  res.json(rows.map(hydrate));
});

// Single post + replies
router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`${SELECT_POST} WHERE p.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Post not found' });
  attachInteraction(row, req.user?.id);

  const replies = db.prepare(`${SELECT_POST}
    WHERE p.reply_to = ?
    ORDER BY p.created_at ASC
    LIMIT 50`).all(req.params.id);
  replies.forEach(r => attachInteraction(r, req.user?.id));

  res.json({ post: hydrate(row), replies: replies.map(hydrate) });
});

// Edit own post (text only, 30-second window).
router.patch('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id, user_id, created_at FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not your post' });

  const created = Date.parse(post.created_at.replace(' ', 'T') + 'Z');
  if (Number.isFinite(created) && Date.now() - created > EDIT_WINDOW_MS) {
    return res.status(403).json({ error: 'Edit window has passed (1 minute)' });
  }

  const trimmed = String(req.body?.content || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Content cannot be empty' });
  if (trimmed.length > 280) return res.status(400).json({ error: 'Post must be 280 characters or fewer' });

  db.prepare(`UPDATE posts SET content = ?, edited_at = datetime('now') WHERE id = ?`)
    .run(trimmed, post.id);
  const row = db.prepare(`${SELECT_POST} WHERE p.id = ?`).get(post.id);
  attachInteraction(row, req.user.id);
  res.json(hydrate(row));
});

// Like / Unlike
router.post('/:id/like', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
    db.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT like_count FROM posts WHERE id = ?').get(req.params.id);
    return res.json({ liked: false, like_count: updated.like_count });
  } else {
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT like_count FROM posts WHERE id = ?').get(req.params.id);
    return res.json({ liked: true, like_count: updated.like_count });
  }
});

// Toggle bookmark.
router.post('/:id/bookmark', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const existing = db.prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id);
  if (existing) {
    db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
    return res.json({ bookmarked: false });
  }
  db.prepare('INSERT INTO bookmarks (user_id, post_id) VALUES (?, ?)').run(req.user.id, req.params.id);
  return res.json({ bookmarked: true });
});

// List my bookmarks (most-recent first).
router.get('/me/bookmarks', requireAuth, (req, res) => {
  const rows = db.prepare(`
    ${SELECT_POST}
    JOIN bookmarks b ON b.post_id = p.id
    WHERE b.user_id = ?
      AND u.banned = 0
    ORDER BY b.created_at DESC
    LIMIT 50
  `).all(req.user.id);
  rows.forEach(r => attachInteraction(r, req.user.id));
  res.json(rows.map(hydrate));
});

// Repost / Unrepost
router.post('/:id/repost', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id);

  if (existing) {
    db.prepare('DELETE FROM reposts WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
    db.prepare('UPDATE posts SET repost_count = MAX(0, repost_count - 1) WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT repost_count FROM posts WHERE id = ?').get(req.params.id);
    return res.json({ reposted: false, repost_count: updated.repost_count });
  } else {
    db.prepare('INSERT INTO reposts (user_id, post_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    db.prepare('UPDATE posts SET repost_count = repost_count + 1 WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT repost_count FROM posts WHERE id = ?').get(req.params.id);
    return res.json({ reposted: true, repost_count: updated.repost_count });
  }
});

// Delete post. Authors can always delete their own. Admins can delete
// other users' posts via this endpoint too (the admin console hits it
// directly), subject to the same protection ladder as
// /api/admin/posts/:id — admins can't touch owner or fellow-admin
// posts; only the owner can.
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const post = db.prepare(`
      SELECT p.id, p.user_id, p.reply_to,
             u.is_admin AS author_is_admin, u.is_owner AS author_is_owner
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const isAuthor = post.user_id === req.user.id;
    if (!isAuthor) {
      if (!req.user.is_admin) return res.status(403).json({ error: 'Not authorized' });
      if (post.author_is_owner && !req.user.is_owner) {
        return res.status(403).json({ error: "Can't delete the owner's posts" });
      }
      if (post.author_is_admin && !req.user.is_owner) {
        return res.status(403).json({ error: "Only the owner can delete another admin's posts" });
      }
    }

    // Recursively delete the post + every reply hanging off it. The
    // posts.reply_to FK has no ON DELETE clause, so a parent with
    // replies fails to delete unless we walk the tree first. likes /
    // reposts / bookmarks have to come down per-post since their FKs
    // also lack cascade. Wrapping in a transaction keeps a partial
    // failure from leaving the tree half-deleted.
    const cascade = db.transaction((rootId) => {
      const childPosts = (id) => db.prepare('SELECT id FROM posts WHERE reply_to = ?').all(id);
      const removeOne = (id) => {
        for (const c of childPosts(id)) removeOne(c.id);
        const row = db.prepare('SELECT user_id, reply_to FROM posts WHERE id = ?').get(id);
        if (!row) return;
        db.prepare('DELETE FROM likes     WHERE post_id = ?').run(id);
        db.prepare('DELETE FROM reposts   WHERE post_id = ?').run(id);
        db.prepare('DELETE FROM bookmarks WHERE post_id = ?').run(id);
        db.prepare('DELETE FROM posts     WHERE id = ?').run(id);
        db.prepare('UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?').run(row.user_id);
        // Only decrement the parent's reply_count if the parent is
        // still around (i.e. we're removing a child mid-walk, not the
        // parent itself which we'll delete after).
        if (row.reply_to && row.reply_to !== rootId) {
          db.prepare('UPDATE posts SET reply_count = MAX(0, reply_count - 1) WHERE id = ?').run(row.reply_to);
        }
      };
      removeOne(rootId);
      // If the deleted post was itself a reply, keep its parent's
      // reply count honest.
      if (post.reply_to) {
        db.prepare('UPDATE posts SET reply_count = MAX(0, reply_count - 1) WHERE id = ?').run(post.reply_to);
      }
    });
    cascade(req.params.id);

    res.json({ success: true });
  } catch (e) {
    console.error('post delete error:', e?.message || e);
    res.status(500).json({ error: e?.message || 'Delete failed' });
  }
});

module.exports = router;
