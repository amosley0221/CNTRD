const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// List page slugs (public — used by the admin index, but cheap to expose).
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT slug, title, updated_at FROM pages ORDER BY slug').all();
  res.json(rows);
});

// Read a page by slug.
router.get('/:slug', (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const page = db.prepare('SELECT slug, title, content, updated_at FROM pages WHERE slug = ?').get(slug);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json(page);
});

// Update a page (admin-only). Slug must already exist — we don't create new
// pages from the API to keep the surface area small.
router.put('/:slug', requireAuth, requireAdmin, (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const { title, content } = req.body || {};

  if (typeof content !== 'string' || content.length > 50_000) {
    return res.status(400).json({ error: 'Content is required and must be ≤ 50000 chars' });
  }
  if (title !== undefined && (typeof title !== 'string' || title.length > 120)) {
    return res.status(400).json({ error: 'Title must be ≤ 120 chars' });
  }

  const existing = db.prepare('SELECT slug FROM pages WHERE slug = ?').get(slug);
  if (!existing) return res.status(404).json({ error: 'Page not found' });

  const newTitle = title !== undefined ? title : null;
  if (newTitle !== null) {
    db.prepare(`UPDATE pages SET title = ?, content = ?, updated_at = datetime('now') WHERE slug = ?`)
      .run(newTitle, content, slug);
  } else {
    db.prepare(`UPDATE pages SET content = ?, updated_at = datetime('now') WHERE slug = ?`)
      .run(content, slug);
  }
  res.json(db.prepare('SELECT slug, title, content, updated_at FROM pages WHERE slug = ?').get(slug));
});

module.exports = router;
