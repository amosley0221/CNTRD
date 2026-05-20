// Routes for external sports articles: store metadata, host comments
// and reactions. We never republish the article body — clicking
// "View original" sends the user to the source URL. CNTRD owns the
// discussion.
const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const REACTION_KINDS = new Set(['like', 'repost', 'bookmark']);

// Deterministic article id from canonical URL. 16 hex chars of SHA-256
// keeps the id short, sharable, and stable so the same article always
// resolves to the same row.
function articleIdFor(url) {
  return crypto.createHash('sha256').update(String(url || '').trim()).digest('hex').slice(0, 16);
}

function hydrateArticle(row, viewerId) {
  if (!row) return null;
  const counts = countsFor(row.id);
  const mine = viewerId ? mineFor(row.id, viewerId) : { like: false, repost: false, bookmark: false };
  return {
    id: row.id,
    url: row.url,
    league: row.league || '',
    title: row.title,
    description: row.description || '',
    image: row.image || '',
    published_at: row.published_at || null,
    created_at: row.created_at,
    comments: countComments(row.id),
    reactions: counts,
    my_reactions: mine,
  };
}

function countComments(articleId) {
  return db.prepare('SELECT COUNT(*) AS n FROM article_comments WHERE article_id = ?').get(articleId).n;
}
function countsFor(articleId) {
  const rows = db.prepare(
    `SELECT kind, COUNT(*) AS n FROM article_reactions WHERE article_id = ? GROUP BY kind`
  ).all(articleId);
  const out = { like: 0, repost: 0, bookmark: 0 };
  for (const r of rows) if (r.kind in out) out[r.kind] = r.n;
  return out;
}
function mineFor(articleId, userId) {
  const rows = db.prepare(
    `SELECT kind FROM article_reactions WHERE article_id = ? AND user_id = ?`
  ).all(articleId, userId);
  const out = { like: false, repost: false, bookmark: false };
  for (const r of rows) if (r.kind in out) out[r.kind] = true;
  return out;
}

// Resolve a URL to an article row (creates one on first use). Idempotent;
// the deterministic id means concurrent inserts for the same URL collide
// on PRIMARY KEY and we just keep the existing row.
router.post('/resolve', optionalAuth, (req, res) => {
  const { url, league, title, description, image, published } = req.body || {};
  if (!url || typeof url !== 'string')   return res.status(400).json({ error: 'url is required' });
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });
  if (url.length > 1000) return res.status(400).json({ error: 'url too long' });
  if (title.length > 500) return res.status(400).json({ error: 'title too long' });

  const id = articleIdFor(url);
  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  if (!existing) {
    try {
      db.prepare(
        `INSERT INTO articles (id, url, league, title, description, image, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id, url, String(league || '').slice(0, 40), title.slice(0, 500),
        String(description || '').slice(0, 2000),
        String(image || '').slice(0, 1000),
        published || null
      );
    } catch (e) {
      // Race condition: another request inserted it between SELECT and
      // INSERT. The row exists now — fall through to the read.
      if (!String(e.message).includes('UNIQUE')) throw e;
    }
  }
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  res.json(hydrateArticle(row, req.user?.id));
});

router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Article not found' });
  res.json(hydrateArticle(row, req.user?.id));
});

router.get('/:id/comments', optionalAuth, (req, res) => {
  const exists = db.prepare('SELECT 1 FROM articles WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Article not found' });
  const rows = db.prepare(`
    SELECT c.id, c.content, c.created_at, c.user_id,
           u.username, u.display_name, u.avatar_hue
    FROM article_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.article_id = ? AND u.banned = 0
    ORDER BY c.created_at ASC
    LIMIT 200
  `).all(req.params.id);
  res.json(rows.map((r) => ({
    id: r.id,
    content: r.content,
    created_at: r.created_at,
    user: {
      id: r.user_id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatarHue: r.avatar_hue ?? 200,
    },
  })));
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const exists = db.prepare('SELECT 1 FROM articles WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Article not found' });
  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (content.length > 1000) return res.status(400).json({ error: 'Comment too long (1000 max)' });

  const id = uuidv4();
  db.prepare(
    `INSERT INTO article_comments (id, article_id, user_id, content) VALUES (?, ?, ?, ?)`
  ).run(id, req.params.id, req.user.id, content);
  const row = db.prepare(`
    SELECT c.id, c.content, c.created_at, c.user_id,
           u.username, u.display_name, u.avatar_hue
    FROM article_comments c JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(id);
  res.status(201).json({
    id: row.id, content: row.content, created_at: row.created_at,
    user: {
      id: row.user_id, username: row.username,
      displayName: row.display_name || row.username,
      avatarHue: row.avatar_hue ?? 200,
    },
  });
});

router.post('/:id/react', requireAuth, (req, res) => {
  const exists = db.prepare('SELECT 1 FROM articles WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Article not found' });
  const kind = String(req.body?.kind || '').toLowerCase();
  if (!REACTION_KINDS.has(kind)) return res.status(400).json({ error: 'Invalid reaction kind' });

  // Toggle: delete if it exists, insert otherwise.
  const hit = db.prepare(
    `SELECT 1 FROM article_reactions WHERE article_id = ? AND user_id = ? AND kind = ?`
  ).get(req.params.id, req.user.id, kind);
  if (hit) {
    db.prepare(
      `DELETE FROM article_reactions WHERE article_id = ? AND user_id = ? AND kind = ?`
    ).run(req.params.id, req.user.id, kind);
  } else {
    db.prepare(
      `INSERT INTO article_reactions (article_id, user_id, kind) VALUES (?, ?, ?)`
    ).run(req.params.id, req.user.id, kind);
  }
  res.json({
    kind,
    active: !hit,
    reactions: countsFor(req.params.id),
    my_reactions: mineFor(req.params.id, req.user.id),
  });
});

module.exports = router;
module.exports.articleIdFor = articleIdFor;
