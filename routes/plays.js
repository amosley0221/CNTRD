const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { VALID_TEAM_CODES } = require('../data/teams');

const SELECT = `
  SELECT p.id, p.user_id, p.team_code, p.label, p.hue, p.live, p.created_at,
         u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
  FROM plays p JOIN users u ON u.id = p.user_id
`;

function hydrate(p) {
  if (!p) return p;
  let userTeams = [];
  try { userTeams = JSON.parse(p.team_tags || '[]'); } catch {}
  return {
    id: p.id,
    team: p.team_code,
    label: p.label,
    hue: p.hue ?? 200,
    live: !!p.live,
    created_at: p.created_at,
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

// List plays — public, recent first, capped at 30.
router.get('/', optionalAuth, (req, res) => {
  const rows = db.prepare(`${SELECT} ORDER BY p.created_at DESC LIMIT 30`).all();
  res.json(rows.map(hydrate));
});

// Create a play.
router.post('/', requireAuth, (req, res) => {
  const { team_code, label, hue, live } = req.body;

  if (!label || !label.trim()) return res.status(400).json({ error: 'label is required' });
  if (label.length > 80) return res.status(400).json({ error: 'label must be 80 characters or fewer' });

  let team = team_code ? String(team_code).trim().toUpperCase() : null;
  if (team && !VALID_TEAM_CODES.has(team)) team = null;

  const id = uuidv4();
  const h = Number.isFinite(+hue) ? Math.max(0, Math.min(360, +hue)) : 200;
  const liveFlag = live ? 1 : 0;

  db.prepare(`
    INSERT INTO plays (id, user_id, team_code, label, hue, live)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, team, label.trim(), h, liveFlag);

  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(id);
  res.status(201).json(hydrate(row));
});

// Delete a play (own only).
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_id FROM plays WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Play not found' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM plays WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
