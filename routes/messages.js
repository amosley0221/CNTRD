const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { notify } = require('../services/notifier');

router.use(requireAuth);

// ── helpers ─────────────────────────────────────────────────────────
const SELECT_USER = `id, username, display_name, avatar, avatar_hue, team_tags`;

function hydrateUser(u) {
  if (!u) return u;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    avatar: u.avatar,
    avatarHue: u.avatar_hue ?? 200,
    teams: JSON.parse(u.team_tags || '[]'),
  };
}

function membersOf(convId) {
  return db.prepare(`
    SELECT u.${SELECT_USER.split(', ').join(', u.')}
    FROM conversation_members m JOIN users u ON u.id = m.user_id
    WHERE m.conversation_id = ?
  `).all(convId).map(hydrateUser);
}

function unreadCount(convId, userId) {
  const last = db.prepare('SELECT last_read_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(convId, userId);
  if (!last) return 0;
  return db.prepare(`
    SELECT COUNT(*) AS n FROM messages
    WHERE conversation_id = ? AND user_id != ? AND created_at > ?
  `).get(convId, userId, last.last_read_at).n;
}

function lastMessage(convId) {
  return db.prepare(`
    SELECT id, user_id, content, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(convId);
}

function hydrateConversation(conv, viewerId) {
  const members = membersOf(conv.id);
  const last = lastMessage(conv.id);
  return {
    id: conv.id,
    name: conv.name,
    is_group: !!conv.is_group,
    created_at: conv.created_at,
    last_message_at: conv.last_message_at,
    members,
    other: !conv.is_group ? members.find(m => m.id !== viewerId) || null : null,
    last_message: last ? {
      id: last.id, user_id: last.user_id, content: last.content, created_at: last.created_at,
    } : null,
    unread: unreadCount(conv.id, viewerId),
  };
}

// ── routes ──────────────────────────────────────────────────────────

// List my conversations (recent first).
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.is_group, c.created_at, c.last_message_at
    FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE m.user_id = ?
    ORDER BY c.last_message_at DESC
    LIMIT 100
  `).all(req.user.id);
  res.json(rows.map(c => hydrateConversation(c, req.user.id)));
});

// Total unread (used by the sidebar badge).
router.get('/unread', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE m.user_id = ?
  `).all(req.user.id);
  let total = 0;
  for (const r of rows) total += unreadCount(r.id, req.user.id);
  res.json({ unread: total });
});

// Search users for picking participants. Excludes the caller and banned.
router.get('/users/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const rows = db.prepare(`
    SELECT ${SELECT_USER}
    FROM users
    WHERE banned = 0 AND id != ?
      AND id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
      AND id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)
      AND (username LIKE ? OR display_name LIKE ?)
    ORDER BY username
    LIMIT 25
  `).all(req.user.id, req.user.id, req.user.id, like, like);
  res.json(rows.map(hydrateUser));
});

// Create a conversation. Pass user_ids[] (other participants) and optional
// name/is_group. For 1:1 DMs we dedupe to an existing conversation if one
// already exists between exactly these two users.
router.post('/', (req, res) => {
  const userIds = Array.isArray(req.body?.user_ids) ? req.body.user_ids.filter(Boolean) : [];
  let isGroup = !!req.body?.is_group || userIds.length > 1;
  const name = isGroup
    ? String(req.body?.name || '').trim().slice(0, 80) || null
    : null;

  if (userIds.length < 1) return res.status(400).json({ error: 'At least one other user is required' });
  if (userIds.length > 24) return res.status(400).json({ error: 'Group conversations are capped at 25 participants' });
  // Validate user ids exist + not banned + not the caller's own id.
  const validRows = db.prepare(`
    SELECT id FROM users WHERE banned = 0 AND id IN (${userIds.map(() => '?').join(',')})
  `).all(...userIds);
  // Drop anyone the caller has blocked or who has blocked the caller.
  const blockRows = db.prepare(`
    SELECT blocked_id AS id FROM blocks WHERE blocker_id = ?
    UNION
    SELECT blocker_id AS id FROM blocks WHERE blocked_id = ?
  `).all(req.user.id, req.user.id);
  const blocked = new Set(blockRows.map(r => r.id));
  const validIds = validRows
    .map(r => r.id)
    .filter(id => id !== req.user.id && !blocked.has(id));
  if (!validIds.length) return res.status(400).json({ error: 'No valid recipients' });

  if (!isGroup && validIds.length === 1) {
    // DM dedup: look for an existing 1:1 conversation between these two.
    const existing = db.prepare(`
      SELECT c.id
      FROM conversations c
      JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
      JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
      WHERE c.is_group = 0
        AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
      LIMIT 1
    `).get(req.user.id, validIds[0]);
    if (existing) {
      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(existing.id);
      return res.json(hydrateConversation(conv, req.user.id));
    }
  }

  const convId = uuidv4();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO conversations (id, name, is_group, created_by) VALUES (?, ?, ?, ?)
    `).run(convId, name, isGroup ? 1 : 0, req.user.id);
    // Creator gets last_read_at = now (they've seen everything so far).
    // Other members start at the epoch so any later message is unread.
    db.prepare(`INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, datetime('now'))`).run(convId, req.user.id);
    const insertOther = db.prepare(`INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, '1970-01-01 00:00:00')`);
    for (const uid of validIds) insertOther.run(convId, uid);
  });
  tx();

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
  res.status(201).json(hydrateConversation(conv, req.user.id));
});

// Single conversation detail.
router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  res.json(hydrateConversation(conv, req.user.id));
});

// Rename a group (only group conversations and only members can rename).
router.patch('/:id', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  if (!conv.is_group) return res.status(400).json({ error: 'Only groups can be renamed' });
  const name = String(req.body?.name || '').trim().slice(0, 80) || null;
  db.prepare('UPDATE conversations SET name = ? WHERE id = ?').run(name, conv.id);
  res.json(hydrateConversation({ ...conv, name }, req.user.id));
});

// Add a member to a group.
router.post('/:id/members', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv || !conv.is_group) return res.status(404).json({ error: 'Group not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  const userId = String(req.body?.user_id || '');
  const target = db.prepare('SELECT id FROM users WHERE id = ? AND banned = 0').get(userId);
  if (!target) return res.status(400).json({ error: 'Invalid user' });
  db.prepare(`
    INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
    VALUES (?, ?, '1970-01-01 00:00:00')
  `).run(conv.id, userId);
  res.json(hydrateConversation(conv, req.user.id));
});

// Leave a conversation.
router.delete('/:id/members/me', (req, res) => {
  db.prepare('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ left: true });
});

// Find-or-create the shared gameday chat room for a game. Auto-joins caller.
// Must be defined before GET /:id so Express doesn't treat "gameday" as an id.
router.get('/gameday/:gameId', (req, res) => {
  const gameId = String(req.params.gameId || '').trim().slice(0, 80);
  if (!gameId) return res.status(400).json({ error: 'Invalid game ID' });

  const convId = db.transaction(() => {
    let conv = db.prepare('SELECT id FROM conversations WHERE game_id = ?').get(gameId);
    if (!conv) {
      const newId = uuidv4();
      db.prepare(`INSERT INTO conversations (id, name, is_group, created_by, game_id) VALUES (?, ?, 1, ?, ?)`)
        .run(newId, `gameday:${gameId}`, req.user.id, gameId);
      conv = { id: newId };
    }
    // Auto-join caller as member (idempotent).
    db.prepare(`INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
                VALUES (?, ?, datetime('now'))`).run(conv.id, req.user.id);
    db.prepare(`UPDATE conversation_members SET last_read_at = datetime('now')
                WHERE conversation_id = ? AND user_id = ?`).run(conv.id, req.user.id);
    return conv.id;
  })();

  const rows = db.prepare(`
    SELECT m.id, m.user_id, m.content, m.created_at,
           u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at DESC LIMIT 50
  `).all(convId);

  res.json({
    convId,
    messages: rows.reverse().map(r => ({
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      user: {
        id: r.user_id,
        username: r.username,
        displayName: r.display_name || r.username,
        avatar: r.avatar,
        avatarHue: r.avatar_hue ?? 200,
        teams: JSON.parse(r.team_tags || '[]'),
      },
    })),
  });
});

// List messages (most recent first, paginated by `before` cursor or `after` for polling).
router.get('/:id/messages', (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });

  const before = req.query.before;
  const after  = req.query.after;
  const params = [req.params.id];
  let q = `SELECT m.id, m.user_id, m.content, m.created_at,
                  u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
           FROM messages m JOIN users u ON u.id = m.user_id
           WHERE m.conversation_id = ?`;
  if (before) { q += ' AND m.created_at < ?'; params.push(before); }
  if (after)  { q += ' AND m.created_at > ?'; params.push(after); }
  q += ' ORDER BY m.created_at DESC LIMIT 50';
  const rows = db.prepare(q).all(...params);

  // Mark conversation read for this user.
  db.prepare(`
    UPDATE conversation_members SET last_read_at = datetime('now')
    WHERE conversation_id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  res.json(rows.map(r => ({
    id: r.id,
    content: r.content,
    created_at: r.created_at,
    user: {
      id: r.user_id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatar: r.avatar,
      avatarHue: r.avatar_hue ?? 200,
      teams: JSON.parse(r.team_tags || '[]'),
    },
  })).reverse());   // chronological for display
});

// Send a message.
router.post('/:id/messages', (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });

  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Message cannot be empty' });
  if (content.length > 2000) return res.status(400).json({ error: 'Message too long' });

  const id = uuidv4();
  db.prepare('INSERT INTO messages (id, conversation_id, user_id, content) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, req.user.id, content);
  db.prepare(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`).run(req.params.id);
  // Sender has read everything they just sent.
  db.prepare(`UPDATE conversation_members SET last_read_at = datetime('now')
              WHERE conversation_id = ? AND user_id = ?`).run(req.params.id, req.user.id);

  // Skip per-member notifications for gameday rooms to avoid inbox spam.
  const isGameday = !!db.prepare('SELECT game_id FROM conversations WHERE id = ? AND game_id IS NOT NULL').get(req.params.id);
  if (!isGameday) {
    const others = db.prepare(`
      SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?
    `).all(req.params.id, req.user.id);
    for (const o of others) {
      notify({
        userId: o.user_id, type: 'message', actorId: req.user.id,
        data: { conversation_id: req.params.id, preview: content.slice(0, 140) },
        dedupeKey: `msg:${req.params.id}`,
      });
    }
  }

  const row = db.prepare(`
    SELECT m.id, m.user_id, m.content, m.created_at,
           u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(id);

  res.status(201).json({
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    user: {
      id: row.user_id, username: row.username, displayName: row.display_name || row.username,
      avatar: row.avatar, avatarHue: row.avatar_hue ?? 200,
      teams: JSON.parse(row.team_tags || '[]'),
    },
  });
});

// ─── Group events ─────────────────────────────────────────────
// Events live inside a group conversation. Any member can schedule one
// and any member can dismiss it. The notifier fires a single
// "event_alert" 15 minutes before start (per recipient).

function hydrateEvent(row) {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    title: row.title,
    description: row.description || '',
    start_at: row.start_at,
    created_by: row.created_by,
    created_at: row.created_at,
    pre_alert_sent: !!row.pre_alert_sent,
  };
}

router.get('/:id/events', (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });
  const rows = db.prepare(`
    SELECT * FROM events
    WHERE conversation_id = ?
    ORDER BY start_at ASC
  `).all(req.params.id);
  res.json(rows.map(hydrateEvent));
});

router.post('/:id/events', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (!conv.is_group) return res.status(400).json({ error: 'Events are only for groups' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const title = String(req.body?.title || '').trim().slice(0, 120);
  const description = String(req.body?.description || '').trim().slice(0, 500);
  const start = new Date(String(req.body?.start_at || ''));
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid start time' });
  // Allow scheduling from "now" onwards. Past times don't make sense for
  // a heads-up notification.
  if (start.getTime() < Date.now() - 60_000) return res.status(400).json({ error: 'Event start must be in the future' });

  const id = uuidv4();
  // Store as ISO UTC so the notifier's `datetime('now')` comparisons line up.
  const startIso = start.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  db.prepare(`
    INSERT INTO events (id, conversation_id, title, description, start_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, conv.id, title, description, startIso, req.user.id);

  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.status(201).json(hydrateEvent(row));
});

router.delete('/:id/events/:eventId', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND conversation_id = ?')
    .get(req.params.eventId, req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(ev.conversation_id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  // Creator can always cancel; other members can also dismiss for the
  // group since membership is implicit trust.
  db.prepare('DELETE FROM events WHERE id = ?').run(ev.id);
  res.json({ deleted: true });
});

module.exports = router;
