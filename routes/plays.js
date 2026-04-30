const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { isValidTeamCode } = require('../data/teams');

const SELECT = `
  SELECT p.id, p.user_id, p.team_code, p.label, p.hue, p.live,
         p.media_url, p.media_kind, p.caption, p.score_sticker, p.created_at,
         u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
  FROM plays p JOIN users u ON u.id = p.user_id
`;

function hydrate(p) {
  if (!p) return p;
  let userTeams = [];
  try { userTeams = JSON.parse(p.team_tags || '[]'); } catch {}
  let scoreSticker = null;
  if (p.score_sticker) {
    try { scoreSticker = JSON.parse(p.score_sticker); } catch {}
  }
  return {
    id: p.id,
    team: p.team_code,
    label: p.label,
    caption: p.caption || '',
    score_sticker: scoreSticker,
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

// Build the WHERE-clause fragment + bind params that excludes plays the
// viewer shouldn't see: banned authors, private accounts they don't
// follow, anyone they've blocked or who has blocked them.
function visibilityClause(viewerId) {
  if (!viewerId) {
    return { sql: 'u.banned = 0 AND u.is_private = 0', params: [] };
  }
  return {
    sql: `u.banned = 0
      AND (u.is_private = 0 OR u.id = ? OR u.id IN (SELECT following_id FROM follows WHERE follower_id = ?))
      AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
      AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)`,
    params: [viewerId, viewerId, viewerId, viewerId],
  };
}

// List plays — public, recent first, capped at 30.
router.get('/', optionalAuth, (req, res) => {
  const v = visibilityClause(req.user?.id);
  const rows = db.prepare(`${SELECT} WHERE ${v.sql} ORDER BY p.created_at DESC LIMIT 30`)
    .all(...v.params);
  res.json(rows.map(hydrate));
});

// Plays from a specific user. Same visibility rules — if the viewer is
// blocked, the response is empty.
router.get('/user/:username', optionalAuth, (req, res) => {
  const owner = db.prepare('SELECT id, is_private FROM users WHERE username = ? AND banned = 0').get(req.params.username);
  if (!owner) return res.json([]);
  const viewerId = req.user?.id || null;
  if (viewerId !== owner.id) {
    if (viewerId) {
      const blocked = db.prepare(`SELECT 1 FROM blocks WHERE
        (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`)
        .get(owner.id, viewerId, viewerId, owner.id);
      if (blocked) return res.json([]);
    }
    if (owner.is_private) {
      const follows = viewerId
        ? db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(viewerId, owner.id)
        : null;
      if (!follows) return res.json([]);
    }
  }
  const rows = db.prepare(`${SELECT} WHERE p.user_id = ? AND u.banned = 0 ORDER BY p.created_at DESC LIMIT 30`)
    .all(owner.id);
  res.json(rows.map(hydrate));
});

// Create a play. Optional media (photo or short clip ≤30s) — duration is
// enforced client-side at upload time; we just store whatever URL was
// returned by /api/upload/media.
router.post('/', requireAuth, (req, res) => {
  const { team_code, label, hue, live, media_url, media_kind, caption, score_sticker } = req.body;

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

  // Caption — short free-form text the user adds to the play.
  let cap = null;
  if (typeof caption === 'string') {
    const trimmed = caption.trim();
    if (trimmed.length > 280) return res.status(400).json({ error: 'caption must be 280 characters or fewer' });
    if (trimmed.length > 0) cap = trimmed;
  }

  // Score sticker snapshot — frozen at publish time so the play renders
  // its scoreboard even after the game ends.
  let stickerJson = null;
  if (score_sticker && typeof score_sticker === 'object') {
    const s = {
      game_id: String(score_sticker.game_id || score_sticker.id || '').slice(0, 80),
      league:  String(score_sticker.league || '').slice(0, 16),
      home:    String(score_sticker.home || '').slice(0, 8),
      away:    String(score_sticker.away || '').slice(0, 8),
      home_score: Number.isFinite(+score_sticker.home_score) ? +score_sticker.home_score : null,
      away_score: Number.isFinite(+score_sticker.away_score) ? +score_sticker.away_score : null,
      period: String(score_sticker.period || '').slice(0, 32),
    };
    if (s.game_id || (s.home && s.away)) stickerJson = JSON.stringify(s);
  }

  db.prepare(`
    INSERT INTO plays (id, user_id, team_code, label, hue, live, media_url, media_kind, caption, score_sticker)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, team, label.trim(), h, liveFlag, url, kind, cap, stickerJson);

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
