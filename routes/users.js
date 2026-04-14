const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Get user by username
router.get('/:username', optionalAuth, (req, res) => {
  const user = db.prepare(`
    SELECT id, username, display_name, bio, avatar, banner, team_tags,
           follower_count, following_count, post_count, created_at
    FROM users WHERE username = ?
  `).get(req.params.username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  user.team_tags = JSON.parse(user.team_tags || '[]');

  let is_following = false;
  if (req.user) {
    const follow = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, user.id);
    is_following = !!follow;
  }

  res.json({ ...user, is_following });
});

// Update profile
router.patch('/me/profile', requireAuth, (req, res) => {
  const { display_name, bio, team_tags } = req.body;

  const updates = [];
  const values = [];

  if (display_name !== undefined) {
    if (display_name.length > 50) return res.status(400).json({ error: 'Display name too long' });
    updates.push('display_name = ?');
    values.push(display_name);
  }
  if (bio !== undefined) {
    if (bio.length > 160) return res.status(400).json({ error: 'Bio must be 160 characters or fewer' });
    updates.push('bio = ?');
    values.push(bio);
  }
  if (team_tags !== undefined) {
    if (!Array.isArray(team_tags)) return res.status(400).json({ error: 'team_tags must be an array' });
    if (team_tags.length > 5) return res.status(400).json({ error: 'Maximum 5 team tags allowed' });
    updates.push('team_tags = ?');
    values.push(JSON.stringify(team_tags.map(t => String(t).trim().toUpperCase()).filter(Boolean)));
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT id, username, display_name, bio, avatar, banner, team_tags, follower_count, following_count, post_count FROM users WHERE id = ?').get(req.user.id);
  updated.team_tags = JSON.parse(updated.team_tags || '[]');
  res.json(updated);
});

// Follow / Unfollow
router.post('/:username/follow', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, target.id);

  if (existing) {
    // Unfollow
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
    db.prepare('UPDATE users SET follower_count = MAX(0, follower_count - 1) WHERE id = ?').run(target.id);
    db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(req.user.id);
    return res.json({ following: false });
  } else {
    // Follow
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target.id);
    db.prepare('UPDATE users SET follower_count = follower_count + 1 WHERE id = ?').run(target.id);
    db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(req.user.id);
    return res.json({ following: true });
  }
});

// Get followers
router.get('/:username/followers', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const followers = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.team_tags
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC
    LIMIT 50
  `).all(target.id);

  followers.forEach(u => { u.team_tags = JSON.parse(u.team_tags || '[]'); });
  res.json(followers);
});

// Get following
router.get('/:username/following', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const following = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.team_tags
    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC
    LIMIT 50
  `).all(target.id);

  following.forEach(u => { u.team_tags = JSON.parse(u.team_tags || '[]'); });
  res.json(following);
});

// Get user's posts
router.get('/:username/posts', optionalAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const cursor = req.query.cursor;
  let query = `
    SELECT p.*, u.username, u.display_name, u.avatar, u.team_tags
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? AND p.reply_to IS NULL
  `;
  const params = [target.id];

  if (cursor) {
    query += ' AND p.created_at < ?';
    params.push(cursor);
  }

  query += ' ORDER BY p.created_at DESC LIMIT 20';

  const posts = db.prepare(query).all(...params);

  posts.forEach(p => {
    p.team_tags = JSON.parse(p.team_tags || '[]');
    if (req.user) {
      p.liked = !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, p.id);
      p.reposted = !!db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(req.user.id, p.id);
    } else {
      p.liked = false;
      p.reposted = false;
    }
  });

  res.json(posts);
});

module.exports = router;
