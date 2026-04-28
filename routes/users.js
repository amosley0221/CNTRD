const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { isValidTeamCode } = require('../data/teams');

const PUBLIC_USER_COLS =
  'id, username, display_name, bio, avatar, banner, team_tags, ' +
  'avatar_hue, pronouns, city, follower_count, following_count, post_count, created_at';

function hydrate(u) {
  if (!u) return u;
  u.team_tags = JSON.parse(u.team_tags || '[]');
  return u;
}

// Get user by username
router.get('/:username', optionalAuth, (req, res) => {
  const user = hydrate(db.prepare(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE username = ?`).get(req.params.username));
  if (!user) return res.status(404).json({ error: 'User not found' });

  let is_following = false;
  if (req.user) {
    is_following = !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, user.id);
  }

  res.json({ ...user, is_following });
});

// Update profile
router.patch('/me/profile', requireAuth, (req, res) => {
  const { display_name, bio, team_tags, avatar_hue, pronouns, city } = req.body;

  const updates = [];
  const values = [];

  if (display_name !== undefined) {
    if (display_name.length > 50) return res.status(400).json({ error: 'Display name too long' });
    updates.push('display_name = ?'); values.push(display_name);
  }
  if (bio !== undefined) {
    if (bio.length > 160) return res.status(400).json({ error: 'Bio must be 160 characters or fewer' });
    updates.push('bio = ?'); values.push(bio);
  }
  if (team_tags !== undefined) {
    if (!Array.isArray(team_tags)) return res.status(400).json({ error: 'team_tags must be an array' });
    if (team_tags.length > 30) return res.status(400).json({ error: 'Maximum 30 team tags allowed' });
    const seen = new Set();
    const cleaned = [];
    for (const raw of team_tags) {
      const code = String(raw).trim().toUpperCase();
      if (!isValidTeamCode(code) || seen.has(code)) continue;
      seen.add(code); cleaned.push(code);
    }
    updates.push('team_tags = ?'); values.push(JSON.stringify(cleaned));
  }
  if (avatar_hue !== undefined) {
    const h = Math.max(0, Math.min(360, +avatar_hue || 0));
    updates.push('avatar_hue = ?'); values.push(h);
  }
  if (pronouns !== undefined) { updates.push('pronouns = ?'); values.push(String(pronouns).slice(0, 30)); }
  if (city     !== undefined) { updates.push('city = ?');     values.push(String(city).slice(0, 80)); }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = hydrate(db.prepare(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id = ?`).get(req.user.id));
  res.json(updated);
});

// Follow / Unfollow
router.post('/:username/follow', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, target.id);

  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
    db.prepare('UPDATE users SET follower_count  = MAX(0, follower_count  - 1) WHERE id = ?').run(target.id);
    db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(req.user.id);
    return res.json({ following: false });
  } else {
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target.id);
    db.prepare('UPDATE users SET follower_count  = follower_count  + 1 WHERE id = ?').run(target.id);
    db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(req.user.id);
    return res.json({ following: true });
  }
});

// Followers / Following / Posts (delegated to posts route via username) ---------

router.get('/:username/followers', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const followers = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM follows f JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC LIMIT 50
  `).all(target.id);
  followers.forEach(u => { u.team_tags = JSON.parse(u.team_tags || '[]'); });
  res.json(followers);
});

router.get('/:username/following', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const following = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM follows f JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC LIMIT 50
  `).all(target.id);
  following.forEach(u => { u.team_tags = JSON.parse(u.team_tags || '[]'); });
  res.json(following);
});

// Get user's posts
router.get('/:username/posts', optionalAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const cursor = req.query.cursor;
  const params = [target.id];
  let query = `
    SELECT p.id, p.user_id, p.content, p.image, p.like_count, p.repost_count,
           p.reply_count, p.reply_to, p.created_at, p.type, p.tags, p.extra,
           u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? AND p.reply_to IS NULL
  `;
  if (cursor) { query += ' AND p.created_at < ?'; params.push(cursor); }
  query += ' ORDER BY p.created_at DESC LIMIT 30';

  const rows = db.prepare(query).all(...params);
  const userId = req.user?.id;
  const out = rows.map(p => {
    let extra = {}; try { extra = JSON.parse(p.extra || '{}'); } catch {}
    let tags  = []; try { tags  = JSON.parse(p.tags  || '[]'); } catch {}
    let userTeams = []; try { userTeams = JSON.parse(p.team_tags || '[]'); } catch {}
    const liked    = userId ? !!db.prepare('SELECT 1 FROM likes   WHERE user_id = ? AND post_id = ?').get(userId, p.id) : false;
    const reposted = userId ? !!db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(userId, p.id) : false;
    return {
      id: p.id, type: p.type || 'take', content: p.content, text: p.content,
      image: p.image, tags, extra, ...extra,
      likes: p.like_count, reposts: p.repost_count, replies: p.reply_count,
      reply_to: p.reply_to, created_at: p.created_at,
      liked, reposted,
      user: { id: p.user_id, username: p.username, displayName: p.display_name, avatar: p.avatar, avatarHue: p.avatar_hue ?? 200, teams: userTeams },
    };
  });
  res.json(out);
});

module.exports = router;
