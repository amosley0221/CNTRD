const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { isValidTeamCode } = require('../data/teams');

const SELECT = `
  SELECT p.id, p.user_id, p.team_code, p.label, p.hue, p.live,
         p.media_url, p.media_kind, p.created_at,
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
    media_url: p.media_url || null,
    media_kind: p.media_kind || null,    // 'image' | 'video' | null
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

// List plays — public, recent first, capped at 30 (banned authors hidden).
router.get('/', optionalAuth, (req, res) => {
  const rows = db.prepare(`${SELECT} WHERE u.banned = 0 ORDER BY p.created_at DESC LIMIT 30`).all();
  res.json(rows.map(hydrate));
});

// Create a play. Optional media (photo or short clip ≤30s) — duration is
// enforced client-side at upload time; we just store whatever URL was
// returned by /api/upload/media.
router.post('/', requireAuth, (req, res) => {
  const { team_code, label, hue, live, media_url, media_kind } = req.body;

  if (!label || !label.trim()) return res.status(400).json({ error: 'label is required' });
  if (label.length > 80) return res.status(400).json({ error: 'label must be 80 characters or fewer' });

  let team = team_code ? String(team_code).trim().toUpperCase() : null;
  if (team && !isValidTeamCode(team)) team = null;

  const id = uuidv4();
  const h = Number.isFinite(+hue) ? Math.max(0, Math.min(360, +hue)) : 200;
  const liveFlag = live ? 1 : 0;

  // Validate media URL is one of ours (a relative /uploads/ path).
  let url = null, kind = null;
  if (typeof media_url === 'string' && /^\/uploads\/[^?]+$/.test(media_url)) {
    url = media_url;
    kind = (media_kind === 'video' ? 'video' : (media_kind === 'image' ? 'image' : null));
  }

  db.prepare(`
    INSERT INTO plays (id, user_id, team_code, label, hue, live, media_url, media_kind)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, team, label.trim(), h, liveFlag, url, kind);

  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(id);
  res.status(201).json(hydrate(row));
});

// Delete a play (own only). Also tries to remove the underlying file from
// disk; failure to unlink is non-fatal.
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_id, media_url FROM plays WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Play not found' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM plays WHERE id = ?').run(req.params.id);
  // Best-effort cleanup of the uploaded file.
  if (row.media_url) {
    try {
      const path = require('path');
      const fs = require('fs');
      const uploadRouter = require('./upload');
      const file = path.join(uploadRouter.uploadDir, path.basename(row.media_url));
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {}
  }
  res.json({ success: true });
});

module.exports = router;
