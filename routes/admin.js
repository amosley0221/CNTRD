const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireAdmin, requireOwner } = require('../middleware/auth');

// All admin endpoints require auth + admin role. Routes that can affect
// other admins/owner additionally check requireOwner inline.
router.use(requireAuth, requireAdmin);

const ADMIN_USER_COLS =
  'id, username, email, display_name, avatar, avatar_hue, ' +
  'team_tags, is_admin, is_owner, is_official, is_verified, banned, banned_until, post_count, follower_count, ' +
  'following_count, created_at, last_login_at';

function hydrateUser(u) {
  if (!u) return u;
  u.team_tags = JSON.parse(u.team_tags || '[]');
  u.is_admin    = !!u.is_admin || !!u.is_owner;
  u.is_owner    = !!u.is_owner;
  u.is_official = !!u.is_official;
  u.is_verified = !!u.is_verified;
  u.banned      = !!u.banned;
  return u;
}

// Owner trumps admin trumps regular user. Returns the truthy reason if
// the actor isn't allowed to act on the target. Used by ban / unban /
// delete-post / role-change so the rules stay in one place.
function rejectIfProtected(actor, target, { adminOnlyForOwner = false } = {}) {
  if (!target) return 'User not found';
  if (target.id === actor.id) return "Can't do that to yourself";
  if (target.is_owner) return 'The owner is protected';
  if (target.is_admin && !actor.is_owner) return 'Only the owner can act on admins';
  if (adminOnlyForOwner && !actor.is_owner) return 'Owner only';
  return null;
}

// List all users.
// Owner-only — admins manage reports, owner manages user roles + bans.
router.get('/users', requireOwner, (req, res) => {
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
  const verified  = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_verified = 1 OR is_official = 1').get().n;
  const posts     = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
  const plays     = db.prepare('SELECT COUNT(*) AS n FROM plays').get().n;
  const recent    = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now','-7 days')`).get().n;
  res.json({ users: total, banned, admins, verified, posts, plays, signups_last_7d: recent });
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

// Ban / unban a user.
router.post('/users/:id/ban', (req, res) => {
  const target = db.prepare('SELECT id, is_admin, is_owner FROM users WHERE id = ?').get(req.params.id);
  const why = rejectIfProtected(req.user, target);
  if (why) return res.status(target ? 403 : 404).json({ error: why });
  db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(target.id);
  res.json({ banned: true });
});

router.post('/users/:id/unban', (req, res) => {
  const target = db.prepare('SELECT id, is_admin, is_owner FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.is_admin && !req.user.is_owner) return res.status(403).json({ error: 'Only the owner can act on admins' });
  db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(target.id);
  res.json({ banned: false });
});

// Delete any post. Admins can't delete posts authored by another admin
// or by the owner — only the owner can.
router.delete('/posts/:id', (req, res) => {
  const post = db.prepare(`
    SELECT p.id, p.user_id, p.reply_to, u.is_admin, u.is_owner
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.is_owner && !req.user.is_owner) return res.status(403).json({ error: "Can't delete the owner's posts" });
  if (post.is_admin && !req.user.is_owner && post.user_id !== req.user.id) {
    return res.status(403).json({ error: "Only the owner can delete another admin's posts" });
  }

  db.prepare('DELETE FROM likes   WHERE post_id = ?').run(post.id);
  db.prepare('DELETE FROM reposts WHERE post_id = ?').run(post.id);
  db.prepare('DELETE FROM posts   WHERE id = ?').run(post.id);
  db.prepare('UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?').run(post.user_id);
  if (post.reply_to) {
    db.prepare('UPDATE posts SET reply_count = MAX(0, reply_count - 1) WHERE id = ?').run(post.reply_to);
  }
  res.json({ success: true });
});

// Delete any play. Same protection as posts.
router.delete('/plays/:id', (req, res) => {
  const play = db.prepare(`
    SELECT p.id, p.user_id, u.is_admin, u.is_owner
    FROM plays p JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!play) return res.status(404).json({ error: 'Play not found' });
  if (play.is_owner && !req.user.is_owner) return res.status(403).json({ error: "Can't delete the owner's plays" });
  if (play.is_admin && !req.user.is_owner && play.user_id !== req.user.id) {
    return res.status(403).json({ error: "Only the owner can delete another admin's plays" });
  }
  db.prepare('DELETE FROM plays WHERE id = ?').run(play.id);
  res.json({ success: true });
});

// ─── Role / badge toggles ───────────────────────────────────────────
// Toggle the admin flag — owner only, can't demote the owner.
router.post('/users/:id/admin', requireOwner, (req, res) => {
  const target = db.prepare('SELECT id, is_admin, is_owner FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.is_owner) return res.status(400).json({ error: 'The owner is always admin' });
  const next = target.is_admin ? 0 : 1;
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(next, target.id);
  res.json({ is_admin: !!next });
});

// Toggle the verified badge — any admin (incl. owner).
router.post('/users/:id/verified', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const cur = db.prepare('SELECT is_verified FROM users WHERE id = ?').get(target.id);
  const next = cur.is_verified ? 0 : 1;
  db.prepare('UPDATE users SET is_verified = ? WHERE id = ?').run(next, target.id);
  res.json({ is_verified: !!next });
});

// Toggle the official badge — for organizational accounts. Any admin.
router.post('/users/:id/official', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const cur = db.prepare('SELECT is_official FROM users WHERE id = ?').get(target.id);
  const next = cur.is_official ? 0 : 1;
  db.prepare('UPDATE users SET is_official = ? WHERE id = ?').run(next, target.id);
  res.json({ is_official: !!next });
});

// Owner-managed watchword list. Posts and plays whose body matches one
// of these words trip an auto-flag review notification to the owner.
const { v4: uuidv4 } = require('uuid');

router.get('/watchwords', (req, res) => {
  const rows = db.prepare(`
    SELECT w.id, w.word, w.created_at,
           u.username AS created_by_username
    FROM watch_words w
    LEFT JOIN users u ON u.id = w.created_by
    ORDER BY w.created_at DESC
  `).all();
  res.json(rows);
});

router.post('/watchwords', requireOwner, (req, res) => {
  const word = String(req.body?.word || '').trim();
  if (!word) return res.status(400).json({ error: 'Word is required' });
  if (word.length > 60) return res.status(400).json({ error: 'Word must be 60 characters or fewer' });
  const id = uuidv4();
  try {
    db.prepare('INSERT INTO watch_words (id, word, created_by) VALUES (?, ?, ?)').run(id, word, req.user.id);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'That word is already on the list' });
    throw e;
  }
  res.status(201).json({ id, word });
});

router.delete('/watchwords/:id', requireOwner, (req, res) => {
  const r = db.prepare('DELETE FROM watch_words WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
