const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All admin endpoints require auth + admin role.
router.use(requireAuth, requireAdmin);

const ADMIN_USER_COLS =
  'id, username, email, display_name, avatar, avatar_hue, ' +
  'team_tags, is_admin, banned, post_count, follower_count, ' +
  'following_count, created_at';

function hydrateUser(u) {
  if (!u) return u;
  u.team_tags = JSON.parse(u.team_tags || '[]');
  u.is_admin = !!u.is_admin;
  u.banned   = !!u.banned;
  return u;
}

// List all users.
router.get('/users', (req, res) => {
  const q = (req.query.q || '').trim();
  let users;
  if (q) {
    const like = `%${q}%`;
    users = db.prepare(`
      SELECT ${ADMIN_USER_COLS} FROM users
      WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ?
      ORDER BY created_at DESC
      LIMIT 200
    `).all(like, like, like);
  } else {
    users = db.prepare(`SELECT ${ADMIN_USER_COLS} FROM users ORDER BY created_at DESC LIMIT 200`).all();
  }
  res.json(users.map(hydrateUser));
});

// Quick stats for the admin dashboard.
router.get('/stats', (req, res) => {
  const total     = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const banned    = db.prepare('SELECT COUNT(*) AS n FROM users WHERE banned = 1').get().n;
  const admins    = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get().n;
  const posts     = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
  const plays     = db.prepare('SELECT COUNT(*) AS n FROM plays').get().n;
  const recent    = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now','-7 days')`).get().n;
  res.json({ users: total, banned, admins, posts, plays, signups_last_7d: recent });
});

// A user's posts (so admins can review before deleting).
router.get('/users/:id/posts', (req, res) => {
  const rows = db.prepare(`
    SELECT id, content, type, tags, image, like_count, repost_count,
           reply_count, reply_to, created_at
    FROM posts WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(req.params.id);
  res.json(rows);
});

// Ban / unban a user. Admins can't ban themselves or each other.
router.post('/users/:id/ban', (req, res) => {
  const target = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.is_admin) return res.status(400).json({ error: "Can't ban another admin" });
  if (target.id === req.user.id) return res.status(400).json({ error: "Can't ban yourself" });
  db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(target.id);
  res.json({ banned: true });
});

router.post('/users/:id/unban', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(target.id);
  res.json({ banned: false });
});

// Delete any post.
router.delete('/posts/:id', (req, res) => {
  const post = db.prepare('SELECT id, user_id, reply_to FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.prepare('DELETE FROM likes   WHERE post_id = ?').run(post.id);
  db.prepare('DELETE FROM reposts WHERE post_id = ?').run(post.id);
  db.prepare('DELETE FROM posts   WHERE id = ?').run(post.id);
  db.prepare('UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?').run(post.user_id);
  if (post.reply_to) {
    db.prepare('UPDATE posts SET reply_count = MAX(0, reply_count - 1) WHERE id = ?').run(post.reply_to);
  }
  res.json({ success: true });
});

// Delete any play.
router.delete('/plays/:id', (req, res) => {
  const play = db.prepare('SELECT id FROM plays WHERE id = ?').get(req.params.id);
  if (!play) return res.status(404).json({ error: 'Play not found' });
  db.prepare('DELETE FROM plays WHERE id = ?').run(play.id);
  res.json({ success: true });
});

module.exports = router;
