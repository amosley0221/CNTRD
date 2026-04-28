const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { VALID_TEAM_CODES } = require('../data/teams');

const VALID_TYPES = new Set(['take', 'photo', 'score', 'poll', 'clip', 'box', 'rumor']);

const SELECT_POST = `
  SELECT p.id, p.user_id, p.content, p.image, p.like_count, p.repost_count,
         p.reply_count, p.reply_to, p.created_at, p.type, p.tags, p.extra,
         u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
  FROM posts p
  JOIN users u ON u.id = p.user_id
`;

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
    liked: !!p.liked,
    reposted: !!p.reposted,
    user: {
      id: p.user_id,
      username: p.username,
      displayName: p.display_name,
      avatar: p.avatar,
      avatarHue: p.avatar_hue ?? 200,
      teams: userTeams,
    },
  };
}

function normalizeTags(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map(t => String(t).trim().toUpperCase())
    .filter(t => VALID_TEAM_CODES.has(t))
    .slice(0, 5);
}

function attachInteraction(p, userId) {
  if (!userId) { p.liked = 0; p.reposted = 0; return; }
  p.liked    = db.prepare('SELECT 1 FROM likes   WHERE user_id = ? AND post_id = ?').get(userId, p.id) ? 1 : 0;
  p.reposted = db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(userId, p.id) ? 1 : 0;
}

// Create post
router.post('/', requireAuth, (req, res) => {
  const { content, reply_to, type, tags, extra, image } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  if (content.length > 280) {
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
  `).run(id, req.user.id, content.trim(), image || null, reply_to || null, postType, tagsJson, extraJson);

  db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').run(req.user.id);
  if (reply_to) {
    db.prepare('UPDATE posts SET reply_count = reply_count + 1 WHERE id = ?').run(reply_to);
  }

  const row = db.prepare(`${SELECT_POST} WHERE p.id = ?`).get(id);
  attachInteraction(row, req.user.id);
  res.status(201).json(hydrate(row));
});

// Following + own (banned authors hidden)
router.get('/feed', requireAuth, (req, res) => {
  const cursor = req.query.cursor;
  const params = [req.user.id, req.user.id];
  let query = `${SELECT_POST}
    WHERE p.reply_to IS NULL
      AND u.banned = 0
      AND (
        p.user_id = ?
        OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
      )`;
  if (cursor) { query += ' AND p.created_at < ?'; params.push(cursor); }
  query += ' ORDER BY p.created_at DESC LIMIT 30';

  const rows = db.prepare(query).all(...params);
  rows.forEach(r => attachInteraction(r, req.user.id));
  res.json(rows.map(hydrate));
});

// Public global feed (banned authors hidden)
router.get('/explore', optionalAuth, (req, res) => {
  const cursor = req.query.cursor;
  const params = [];
  let query = `${SELECT_POST} WHERE p.reply_to IS NULL AND u.banned = 0`;
  if (cursor) { query += ' AND p.created_at < ?'; params.push(cursor); }
  query += ' ORDER BY p.created_at DESC LIMIT 30';

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

// Delete post
router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id, user_id, reply_to FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

  db.prepare('DELETE FROM likes   WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM reposts WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts   WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?').run(req.user.id);
  if (post.reply_to) {
    db.prepare('UPDATE posts SET reply_count = MAX(0, reply_count - 1) WHERE id = ?').run(post.reply_to);
  }

  res.json({ success: true });
});

module.exports = router;
