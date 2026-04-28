const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Hydrate a notification row + actor user info if present.
function hydrate(n) {
  let data = {};
  try { data = JSON.parse(n.data || '{}'); } catch {}
  let actor = null;
  if (n.actor_id && n.actor_username) {
    actor = {
      id: n.actor_id,
      username: n.actor_username,
      displayName: n.actor_display_name || n.actor_username,
      avatar: n.actor_avatar,
      avatarHue: n.actor_avatar_hue ?? 200,
    };
  }
  return {
    id: n.id,
    type: n.type,
    actor,
    data,
    read: !!n.read_at,
    created_at: n.created_at,
  };
}

const SELECT = `
  SELECT n.id, n.type, n.actor_id, n.data, n.read_at, n.created_at,
         u.username AS actor_username,
         u.display_name AS actor_display_name,
         u.avatar AS actor_avatar,
         u.avatar_hue AS actor_avatar_hue
  FROM notifications n
  LEFT JOIN users u ON u.id = n.actor_id
`;

// List my notifications, newest first. Cap 50.
router.get('/', (req, res) => {
  const rows = db.prepare(`
    ${SELECT}
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(rows.map(hydrate));
});

// Lightweight unread count for the sidebar badge.
router.get('/unread', (req, res) => {
  const r = db.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`).get(req.user.id);
  res.json({ unread: r.n });
});

// Mark all read.
router.post('/read-all', (req, res) => {
  db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`).run(req.user.id);
  res.json({ success: true });
});

// Mark one read.
router.post('/:id/read', (req, res) => {
  db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Dismiss one (permanent delete).
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Dismiss all read (clears the activity log of stuff already seen).
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE user_id = ? AND read_at IS NOT NULL').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
