// routes/search.js — site-wide search + trending feed.
//   GET /api/search?q=...  → users + posts that match the query
//   GET /api/trending      → top tags from recent posts + live games

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { optionalAuth } = require('../middleware/auth');

let espn;
function getEspn() { if (!espn) espn = require('../services/espn'); return espn; }

// ── Helpers ───────────────────────────────────────────────────────────
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, m => '\\' + m);
}

function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatar: row.avatar,
    avatarHue: row.avatar_hue ?? 200,
    is_admin: !!row.is_admin,
  };
}

function hydratePost(row, viewerId) {
  if (!row) return null;
  let extra = {}; try { extra = JSON.parse(row.extra || '{}'); } catch {}
  let tags  = []; try { tags  = JSON.parse(row.tags  || '[]'); } catch {}
  return {
    id: row.id,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name || row.username,
      avatar: row.avatar,
      avatarHue: row.avatar_hue ?? 200,
    },
    content: row.content,
    text: row.content,
    image: row.image,
    type: row.type,
    tags,
    likes: row.like_count,
    replies: row.reply_count,
    reposts: row.repost_count,
    created_at: row.created_at,
    edited_at: row.edited_at,
    ...extra,
    liked: !!row.liked,
    reposted: !!row.reposted,
    bookmarked: !!row.bookmarked,
  };
}

// ── Search ────────────────────────────────────────────────────────────
// Matches users by username/display_name and posts by content. Cap each
// list short so the response stays small. Banned users + their posts are
// dropped server-side.
router.get('/', optionalAuth, (req, res) => {
  const raw = String(req.query.q || '').trim();
  if (raw.length < 2) return res.json({ users: [], posts: [] });
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
  const like = `%${escapeLike(raw)}%`;
  const viewerId = req.user?.id || null;

  const users = db.prepare(`
    SELECT id, username, display_name, avatar, avatar_hue, is_admin
    FROM users
    WHERE banned = 0
      AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
    ORDER BY
      CASE WHEN LOWER(username) = LOWER(?) THEN 0 ELSE 1 END,
      follower_count DESC
    LIMIT ?
  `).all(like, like, raw, limit).map(safeUser);

  const posts = db.prepare(`
    SELECT p.id, p.user_id, p.content, p.image, p.type, p.tags, p.extra,
           p.like_count, p.reply_count, p.repost_count, p.created_at, p.edited_at,
           u.username, u.display_name, u.avatar, u.avatar_hue,
           ${viewerId ? '(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked,' : '0 AS liked,'}
           ${viewerId ? '(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = ?) AS reposted,' : '0 AS reposted,'}
           ${viewerId ? '(SELECT 1 FROM bookmarks WHERE post_id = p.id AND user_id = ?) AS bookmarked' : '0 AS bookmarked'}
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE u.banned = 0
      AND p.reply_to IS NULL
      AND p.content LIKE ? ESCAPE '\\'
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(...(viewerId ? [viewerId, viewerId, viewerId] : []), like, limit)
    .map(r => hydratePost(r));

  res.json({ users, posts });
});

// ── Trending ──────────────────────────────────────────────────────────
// Aggregates the top tags from posts in the last 24 hours and adds live
// games. Returns an empty list when nothing's been posted recently and
// nothing is live, so the client can render the "nothing trending"
// state honestly.
router.get('/trending', async (req, res) => {
  const items = [];

  // 1) Tag counts from posts in the last 24h. Tags are stored as a JSON
  //    array of strings per post — flatten by walking every recent post.
  try {
    const recent = db.prepare(`
      SELECT tags
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE u.banned = 0
        AND datetime(p.created_at) >= datetime('now', '-1 day')
        AND p.tags IS NOT NULL AND p.tags <> '[]'
    `).all();
    const counts = new Map();
    for (const row of recent) {
      let arr = []; try { arr = JSON.parse(row.tags || '[]'); } catch {}
      for (const t of arr) {
        const key = String(t).trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [tag, count] of top) {
      items.push({
        kind: 'tag',
        tag,
        label: `#${tag.includes(':') ? tag.split(':').pop() : tag}`,
        sublabel: `${count} ${count === 1 ? 'post' : 'posts'} today`,
        rank: count,
      });
    }
  } catch (e) {
    console.error('trending tag scan error:', e.message);
  }

  // 2) Live games — surface up to 4 currently in progress. These give
  //    the trending feed a reason to exist when posts are sparse.
  try {
    const data = await getEspn().getAll();
    const live = (data?.live || []).slice(0, 4);
    for (const g of live) {
      items.push({
        kind: 'game',
        game_id: g.id,
        league: g.league,
        label: `${g.awayTeam?.name || g.away} @ ${g.homeTeam?.name || g.home}`,
        sublabel: `${g.league} · ${g.period || 'LIVE'}`,
        score: `${g.awayScore}–${g.homeScore}`,
      });
    }
  } catch { /* swallow — trending stays as just tags */ }

  res.set('Cache-Control', 'public, max-age=30');
  res.json({ trending: items });
});

module.exports = router;
