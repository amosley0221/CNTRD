const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { isValidTeamCode } = require('../data/teams');

const SELECT = `
  SELECT p.id, p.user_id, p.team_code, p.label, p.hue, p.live,
         p.media_url, p.media_kind, p.caption, p.score_sticker, p.filter, p.created_at,
         u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags, u.hide_username
  FROM plays p JOIN users u ON u.id = p.user_id
`;

const ALLOWED_FILTERS = new Set(['none', 'mono', 'warm', 'cool', 'fade', 'vivid']);

function hydrate(p, viewerId) {
  if (!p) return p;
  let userTeams = [];
  try { userTeams = JSON.parse(p.team_tags || '[]'); } catch {}
  let scoreSticker = null;
  if (p.score_sticker) {
    try { scoreSticker = JSON.parse(p.score_sticker); } catch {}
  }
  let viewed = false;
  if (viewerId) {
    if (viewerId === p.user_id) {
      viewed = true;  // your own plays are always "watched"
    } else {
      viewed = !!db.prepare('SELECT 1 FROM play_views WHERE user_id = ? AND play_id = ?')
        .get(viewerId, p.id);
    }
  }
  // Reaction tally per emoji + which ones the viewer has tapped.
  const counts = {};
  const rxRows = db.prepare(`SELECT emoji, COUNT(*) AS n FROM play_reactions WHERE play_id = ? GROUP BY emoji`).all(p.id);
  for (const r of rxRows) counts[r.emoji] = r.n;
  let mine = [];
  if (viewerId) {
    mine = db.prepare(`SELECT emoji FROM play_reactions WHERE play_id = ? AND user_id = ?`).all(p.id, viewerId).map(r => r.emoji);
  }
  return {
    id: p.id,
    team: p.team_code,
    label: p.label,
    caption: p.caption || '',
    score_sticker: scoreSticker,
    filter: p.filter && ALLOWED_FILTERS.has(p.filter) ? p.filter : 'none',
    hue: p.hue ?? 200,
    live: !!p.live,
    media_url: p.media_url || null,
    media_kind: p.media_kind || null,    // 'image' | 'video' | null
    created_at: p.created_at,
    viewed,
    reactions: counts,
    my_reactions: mine,
    user: {
      id: p.user_id,
      username: p.username,
      displayName: p.display_name,
      avatar: p.avatar,
      avatarHue: p.avatar_hue ?? 200,
      teams: userTeams,
      hide_username: !!p.hide_username,
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

// List plays for the feed rail. Signed-in users only see plays from
// people they follow + their own. Unauthenticated viewers fall back
// to the same public visibility filter used elsewhere (banned/private
// excluded).
router.get('/', optionalAuth, (req, res) => {
  const viewerId = req.user?.id || null;
  const v = visibilityClause(viewerId);
  let sql = `${SELECT} WHERE ${v.sql}`;
  const params = [...v.params];
  if (viewerId) {
    sql += ` AND (p.user_id = ? OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))`;
    params.push(viewerId, viewerId);
  }
  sql += ` ORDER BY p.created_at DESC LIMIT 30`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(p => hydrate(p, viewerId)));
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
  res.json(rows.map(p => hydrate(p, viewerId)));
});

// Mark a play as viewed by the caller. Idempotent (PRIMARY KEY collision
// just keeps the original viewed_at). Used to flip the avatar ring from
// "unwatched" to "all watched".
router.post('/:id/view', requireAuth, (req, res) => {
  const exists = db.prepare('SELECT 1 FROM plays WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Play not found' });
  db.prepare(`INSERT OR IGNORE INTO play_views (user_id, play_id) VALUES (?, ?)`)
    .run(req.user.id, req.params.id);
  res.json({ ok: true });
});

// Create a play. Optional media (photo or short clip ≤30s) — duration is
// enforced client-side at upload time; we just store whatever URL was
// returned by /api/upload/media.
router.post('/', requireAuth, (req, res) => {
  const { team_code, label, hue, live, media_url, media_kind, caption, score_sticker, filter } = req.body;

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

  // Filter token — must be one of the allowed presets, otherwise null.
  const filterToken = (typeof filter === 'string' && ALLOWED_FILTERS.has(filter) && filter !== 'none')
    ? filter : null;

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
    INSERT INTO plays (id, user_id, team_code, label, hue, live, media_url, media_kind, caption, score_sticker, filter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, team, label.trim(), h, liveFlag, url, kind, cap, stickerJson, filterToken);

  // Owner watchword scan — flag the play for owner review when its
  // caption (or label) trips the filter. Best-effort.
  try {
    const { autoFlag } = require('../services/watchwords');
    const haystack = [cap, label.trim()].filter(Boolean).join('\n');
    autoFlag({
      targetType: 'play',
      targetId: id,
      authorId: req.user.id,
      content: haystack,
      mediaUrl: url,
    });
  } catch { /* don't fail the play on flag errors */ }

  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(id);
  res.status(201).json(hydrate(row, req.user.id));
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

// Toggle a reaction emoji on a play. Idempotent — second tap removes
// the reaction. The play author gets a 'reaction' notification on the
// add direction (deduped per play+actor+day).
router.post('/:id/reactions', requireAuth, (req, res) => {
  const emoji = String(req.body?.emoji || '').trim();
  if (!emoji || emoji.length > 8) return res.status(400).json({ error: 'Invalid emoji' });
  const play = db.prepare('SELECT id, user_id FROM plays WHERE id = ?').get(req.params.id);
  if (!play) return res.status(404).json({ error: 'Play not found' });

  const existing = db.prepare(
    'SELECT 1 FROM play_reactions WHERE play_id = ? AND user_id = ? AND emoji = ?'
  ).get(play.id, req.user.id, emoji);

  let added = false;
  if (existing) {
    db.prepare('DELETE FROM play_reactions WHERE play_id = ? AND user_id = ? AND emoji = ?')
      .run(play.id, req.user.id, emoji);
  } else {
    db.prepare('INSERT INTO play_reactions (play_id, user_id, emoji) VALUES (?, ?, ?)')
      .run(play.id, req.user.id, emoji);
    added = true;
  }

  if (added && play.user_id !== req.user.id) {
    const { notify } = require('../services/notifier');
    const dayKey = new Date().toISOString().slice(0, 10);
    notify({
      userId: play.user_id, type: 'reaction', actorId: req.user.id,
      data: { play_id: play.id, emoji },
      dedupeKey: `react:${play.id}:${req.user.id}:${dayKey}`,
    });
  }

  // Return fresh counts + my list.
  const counts = {};
  for (const r of db.prepare(`SELECT emoji, COUNT(*) AS n FROM play_reactions WHERE play_id = ? GROUP BY emoji`).all(play.id)) {
    counts[r.emoji] = r.n;
  }
  const mine = db.prepare(`SELECT emoji FROM play_reactions WHERE play_id = ? AND user_id = ?`).all(play.id, req.user.id).map(r => r.emoji);
  res.json({ reactions: counts, my_reactions: mine });
});

module.exports = router;
