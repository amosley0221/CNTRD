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
  // Returns each member with their last_read_at so the client can derive
  // per-message read receipts (a message is read by member X if X's
  // last_read_at >= the message's created_at).
  return db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags,
           m.last_read_at, m.typing_until
    FROM conversation_members m JOIN users u ON u.id = m.user_id
    WHERE m.conversation_id = ?
  `).all(convId).map(r => ({
    ...hydrateUser(r),
    last_read_at: r.last_read_at,
  }));
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
  const r = db.prepare(`
    SELECT id, user_id, content, created_at, deleted_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(convId);
  if (!r) return null;
  return {
    id: r.id, user_id: r.user_id,
    content: r.deleted_at ? null : r.content,
    deleted: !!r.deleted_at,
    created_at: r.created_at,
  };
}

function hydrateConversation(conv, viewerId) {
  const members = membersOf(conv.id);
  const last = lastMessage(conv.id);
  // Pull anyone whose typing_until is still in the future (excluding
  // the viewer themselves — no self-typing indicator).
  const typingRows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM conversation_members m JOIN users u ON u.id = m.user_id
    WHERE m.conversation_id = ? AND m.user_id != ?
      AND m.typing_until IS NOT NULL AND m.typing_until > datetime('now')
  `).all(conv.id, viewerId);
  return {
    id: conv.id,
    name: conv.name,
    is_group: !!conv.is_group,
    game_id: conv.game_id || null,
    closes_at: conv.closes_at || null,
    created_at: conv.created_at,
    last_message_at: conv.last_message_at,
    members,
    other: !conv.is_group ? members.find(m => m.id !== viewerId) || null : null,
    last_message: last,
    unread: unreadCount(conv.id, viewerId),
    typing_users: typingRows.map(hydrateUser),
  };
}

// ── routes ──────────────────────────────────────────────────────────

// List my conversations (recent first). Excludes gameday rooms — those
// are accessed only through the gameday screen, not the DMs inbox.
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.is_group, c.created_at, c.last_message_at
    FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE m.user_id = ? AND c.game_id IS NULL
    ORDER BY c.last_message_at DESC
    LIMIT 100
  `).all(req.user.id);
  res.json(rows.map(c => hydrateConversation(c, req.user.id)));
});

// Total unread (used by the sidebar badge). Gameday rooms don't count.
router.get('/unread', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE m.user_id = ? AND c.game_id IS NULL
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
    // Creator is always an immediate member.
    db.prepare(`INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, datetime('now'))`).run(convId, req.user.id);
    if (!isGroup) {
      // 1:1 DMs: the recipient is auto-added — we treat opening a thread
      // as implicit consent (otherwise a one-message DM would never deliver).
      db.prepare(`INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, '1970-01-01 00:00:00')`)
        .run(convId, validIds[0]);
    } else {
      // Groups: every other recipient becomes a pending invite. They
      // appear as members + see the chat only after accepting.
      const insertInvite = db.prepare(`INSERT OR IGNORE INTO conversation_invites (conversation_id, user_id, invited_by) VALUES (?, ?, ?)`);
      for (const uid of validIds) insertInvite.run(convId, uid, req.user.id);
    }
  });
  tx();

  // Fan out group_invite notifications outside the txn (notifier writes).
  if (isGroup) {
    for (const uid of validIds) {
      notify({
        userId: uid, type: 'group_invite', actorId: req.user.id,
        data: { conversation_id: convId, name: name || '' },
        dedupeKey: `invite:${convId}:${uid}`,
      });
    }
  }

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
  res.status(201).json(hydrateConversation(conv, req.user.id));
});

// List my pending group invites.
router.get('/invites', (req, res) => {
  const rows = db.prepare(`
    SELECT i.conversation_id, i.created_at, i.invited_by,
           c.name, c.is_group,
           u.username AS inviter_username, u.display_name AS inviter_display_name,
           u.avatar AS inviter_avatar, u.avatar_hue AS inviter_avatar_hue,
           (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) AS member_count
    FROM conversation_invites i
    JOIN conversations c ON c.id = i.conversation_id
    JOIN users u ON u.id = i.invited_by
    WHERE i.user_id = ? AND c.is_group = 1
    ORDER BY i.created_at DESC
  `).all(req.user.id);
  res.json(rows.map(r => ({
    conversation_id: r.conversation_id,
    name: r.name,
    member_count: r.member_count,
    created_at: r.created_at,
    invited_by: {
      id: r.invited_by,
      username: r.inviter_username,
      displayName: r.inviter_display_name || r.inviter_username,
      avatar: r.inviter_avatar,
      avatarHue: r.inviter_avatar_hue ?? 200,
    },
  })));
});

// Accept a pending invite — moves caller from invites → members.
router.post('/invites/:convId/accept', (req, res) => {
  const inv = db.prepare('SELECT 1 FROM conversation_invites WHERE conversation_id = ? AND user_id = ?')
    .get(req.params.convId, req.user.id);
  if (!inv) return res.status(404).json({ error: 'Invite not found' });
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  let systemMsgId;
  db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
                VALUES (?, ?, '1970-01-01 00:00:00')`).run(conv.id, req.user.id);
    db.prepare('DELETE FROM conversation_invites WHERE conversation_id = ? AND user_id = ?')
      .run(conv.id, req.user.id);
    systemMsgId = uuidv4();
    db.prepare(`INSERT INTO messages (id, conversation_id, user_id, content, is_system) VALUES (?, ?, ?, ?, 1)`)
      .run(systemMsgId, conv.id, req.user.id, `${req.user.username} joined the group`);
    db.prepare(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`).run(conv.id);
  })();

  res.json(hydrateConversation(conv, req.user.id));
});

// Reject a pending invite.
router.post('/invites/:convId/reject', (req, res) => {
  const result = db.prepare('DELETE FROM conversation_invites WHERE conversation_id = ? AND user_id = ?')
    .run(req.params.convId, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Invite not found' });
  res.json({ ok: true });
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
// Posts a system message announcing the change so every member sees who
// renamed it, when, and what the new name is.
router.patch('/:id', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  if (!conv.is_group) return res.status(400).json({ error: 'Only groups can be renamed' });
  const name = String(req.body?.name || '').trim().slice(0, 80) || null;
  if (name === conv.name) {
    return res.json(hydrateConversation(conv, req.user.id));
  }

  db.transaction(() => {
    db.prepare('UPDATE conversations SET name = ? WHERE id = ?').run(name, conv.id);
    const announcement = name
      ? `${req.user.username} renamed the group to "${name}"`
      : `${req.user.username} cleared the group name`;
    db.prepare(`INSERT INTO messages (id, conversation_id, user_id, content, is_system) VALUES (?, ?, ?, ?, 1)`)
      .run(uuidv4(), conv.id, req.user.id, announcement);
    db.prepare(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`).run(conv.id);
  })();

  res.json(hydrateConversation({ ...conv, name }, req.user.id));
});

// Invite a user to a group. They receive a group_invite notification and
// only become a member once they accept.
router.post('/:id/members', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv || !conv.is_group) return res.status(404).json({ error: 'Group not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  const userId = String(req.body?.user_id || '');
  const target = db.prepare('SELECT id FROM users WHERE id = ? AND banned = 0').get(userId);
  if (!target) return res.status(400).json({ error: 'Invalid user' });
  // Already a member? No-op.
  const already = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, userId);
  if (already) return res.json(hydrateConversation(conv, req.user.id));

  const result = db.prepare(`
    INSERT OR IGNORE INTO conversation_invites (conversation_id, user_id, invited_by)
    VALUES (?, ?, ?)
  `).run(conv.id, userId, req.user.id);
  if (result.changes > 0) {
    notify({
      userId, type: 'group_invite', actorId: req.user.id,
      data: { conversation_id: conv.id, name: conv.name || '' },
      dedupeKey: `invite:${conv.id}:${userId}`,
    });
  }
  res.json(hydrateConversation(conv, req.user.id));
});

// Leave a conversation.
router.delete('/:id/members/me', (req, res) => {
  db.prepare('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ left: true });
});

// Hydrate a message row plus its (optional) reply target.
// Soft-deleted messages return null content + a deleted flag so the
// client can render a tombstone.
function hydrateMessageRow(r) {
  const isDeleted = !!r.deleted_at;
  const out = {
    id: r.id,
    content: isDeleted ? null : r.content,
    created_at: r.created_at,
    edited_at: r.edited_at || null,
    deleted: isDeleted,
    is_system: !!r.is_system,
    user: {
      id: r.user_id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatar: r.avatar,
      avatarHue: r.avatar_hue ?? 200,
      teams: JSON.parse(r.team_tags || '[]'),
    },
    reply_to: null,
  };
  if (r.reply_to_id) {
    const parent = db.prepare(`
      SELECT m.id, m.user_id, m.content, m.created_at, m.deleted_at,
             u.username, u.display_name
      FROM messages m JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(r.reply_to_id);
    if (parent) {
      out.reply_to = {
        id: parent.id,
        content: parent.deleted_at ? null : parent.content,
        deleted: !!parent.deleted_at,
        created_at: parent.created_at,
        user: {
          id: parent.user_id,
          username: parent.username,
          displayName: parent.display_name || parent.username,
        },
      };
    }
  }
  return out;
}

// Bidirectional mute filter for gameday rooms: hide messages from anyone
// the viewer has muted AND from anyone who has muted the viewer. Returns
// the SQL fragment plus the params to bind for it.
const GAMEDAY_MUTE_WHERE = `AND m.user_id NOT IN (
  SELECT muted_id FROM mutes WHERE muter_id = ?
  UNION
  SELECT muter_id FROM mutes WHERE muted_id = ?
)`;

// SQLite stores datetimes as "YYYY-MM-DD HH:MM:SS" UTC. Convert to ms.
function sqliteToMs(s) {
  if (!s) return null;
  const t = Date.parse(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return Number.isFinite(t) ? t : null;
}
function msToSqlite(ms) {
  return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

// Compute when a gameday chat should close: 24 h after the game ends.
// The game's end is unknown to us, so we estimate it as start_date + 3 h
// (covers most sports; OT runs a little long but the 24 h grace absorbs
// the slop). If state==='final' we know it ended recently, so just use
// now + 24 h. Returns ms or null if we can't reasonably bound it.
function calcCloseMs({ state, date }) {
  const nowMs = Date.now();
  if (state === 'final') return nowMs + 24 * 3600 * 1000;
  if (date) {
    const startMs = Date.parse(date);
    if (Number.isFinite(startMs)) {
      const candidate = startMs + 27 * 3600 * 1000;
      // Reject "ancient" dates that would put the chat closed-on-arrival —
      // the client probably passed a bad value; treat as no-info.
      if (candidate > nowMs - 24 * 3600 * 1000) return candidate;
    }
  }
  return null;
}

// Find-or-create the shared gameday chat room for a game. Auto-joins caller
// unless the chat has already closed (24 h after game end).
// Must be defined before GET /:id so Express doesn't treat "gameday" as an id.
router.get('/gameday/:gameId', (req, res) => {
  const gameId = String(req.params.gameId || '').trim().slice(0, 80);
  if (!gameId) return res.status(400).json({ error: 'Invalid game ID' });

  const state = String(req.query.state || '').trim().toLowerCase();
  const date  = String(req.query.date || '').trim();

  const result = db.transaction(() => {
    let conv = db.prepare('SELECT id, closes_at FROM conversations WHERE game_id = ?').get(gameId);
    if (!conv) {
      const newId = uuidv4();
      const closeMs = calcCloseMs({ state, date });
      const closesAt = closeMs ? msToSqlite(closeMs) : null;
      db.prepare(`INSERT INTO conversations (id, name, is_group, created_by, game_id, closes_at) VALUES (?, ?, 1, ?, ?, ?)`)
        .run(newId, `gameday:${gameId}`, req.user.id, gameId, closesAt);
      conv = { id: newId, closes_at: closesAt };
    } else if (!conv.closes_at) {
      // First time we have enough info to set the close time.
      const closeMs = calcCloseMs({ state, date });
      if (closeMs) {
        const closesAt = msToSqlite(closeMs);
        db.prepare('UPDATE conversations SET closes_at = ? WHERE id = ? AND closes_at IS NULL')
          .run(closesAt, conv.id);
        conv.closes_at = closesAt;
      }
    }

    const closedMs = sqliteToMs(conv.closes_at);
    const closed = !!closedMs && closedMs < Date.now();
    const isMember = !!db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);

    // Closed chat: existing members get read-only access; new joiners are blocked.
    if (closed && !isMember) {
      return { closed: true, closes_at: conv.closes_at };
    }

    if (!closed) {
      db.prepare(`INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
                  VALUES (?, ?, datetime('now'))`).run(conv.id, req.user.id);
      db.prepare(`UPDATE conversation_members SET last_read_at = datetime('now')
                  WHERE conversation_id = ? AND user_id = ?`).run(conv.id, req.user.id);
    }
    return { convId: conv.id, closes_at: conv.closes_at, closed };
  })();

  if (result.closed && !result.convId) {
    return res.status(410).json({ closed: true, closes_at: result.closes_at });
  }

  const rows = db.prepare(`
    SELECT m.id, m.user_id, m.content, m.created_at, m.reply_to_id, m.edited_at, m.deleted_at, m.is_system,
           u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.conversation_id = ?
    ${GAMEDAY_MUTE_WHERE}
    ORDER BY m.created_at DESC LIMIT 50
  `).all(result.convId, req.user.id, req.user.id);

  const now = db.prepare("SELECT datetime('now') AS t").get().t;

  res.json({
    convId: result.convId,
    now,
    closes_at: result.closes_at,
    closed: result.closed,
    messages: rows.reverse().map(hydrateMessageRow),
  });
});

// List messages (most recent first, paginated by `before` cursor or `after` for polling).
router.get('/:id/messages', (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });

  const conv = db.prepare('SELECT game_id FROM conversations WHERE id = ?').get(req.params.id);
  const isGameday = !!conv?.game_id;

  const before = req.query.before;
  const after  = req.query.after;
  const params = [req.params.id];
  let q = `SELECT m.id, m.user_id, m.content, m.created_at, m.reply_to_id, m.edited_at, m.deleted_at, m.is_system,
                  u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
           FROM messages m JOIN users u ON u.id = m.user_id
           WHERE m.conversation_id = ?`;
  if (before) { q += ' AND m.created_at < ?'; params.push(before); }
  if (after)  { q += ' AND m.created_at > ?'; params.push(after); }
  if (isGameday) {
    q += ' ' + GAMEDAY_MUTE_WHERE;
    params.push(req.user.id, req.user.id);
  }
  q += ' ORDER BY m.created_at DESC LIMIT 50';
  const rows = db.prepare(q).all(...params);

  db.prepare(`
    UPDATE conversation_members SET last_read_at = datetime('now')
    WHERE conversation_id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  res.json(rows.map(hydrateMessageRow).reverse());
});

// Send a message. Optionally reply_to_id (must be a message in the same conversation).
router.post('/:id/messages', (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });

  // Reject sends after a gameday room's grace window has expired.
  const conv = db.prepare('SELECT game_id, closes_at FROM conversations WHERE id = ?').get(req.params.id);
  const isGameday = !!conv?.game_id;
  if (isGameday && conv.closes_at) {
    const closesMs = sqliteToMs(conv.closes_at);
    if (closesMs && closesMs < Date.now()) {
      return res.status(410).json({ error: 'Gameday chat closed', closed: true, closes_at: conv.closes_at });
    }
  }

  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Message cannot be empty' });
  if (content.length > 2000) return res.status(400).json({ error: 'Message too long' });

  let replyToId = null;
  if (req.body?.reply_to_id) {
    const parent = db.prepare('SELECT id FROM messages WHERE id = ? AND conversation_id = ?')
      .get(String(req.body.reply_to_id), req.params.id);
    if (parent) replyToId = parent.id;
  }

  const id = uuidv4();
  db.prepare('INSERT INTO messages (id, conversation_id, user_id, content, reply_to_id) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.id, req.user.id, content, replyToId);
  db.prepare(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`).run(req.params.id);
  db.prepare(`UPDATE conversation_members SET last_read_at = datetime('now'), typing_until = NULL
              WHERE conversation_id = ? AND user_id = ?`).run(req.params.id, req.user.id);

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

  // @-mention notifications. Parse @username tokens out of the body and
  // notify each mentioned user once. In gameday rooms the mentioned user
  // is auto-joined so they can read context. Skip if recipient muted sender.
  const mentionMatches = content.match(/@([a-zA-Z0-9_]{3,20})/g) || [];
  if (mentionMatches.length) {
    const handles = [...new Set(mentionMatches.map(m => m.slice(1).toLowerCase()))];
    const users = db.prepare(`
      SELECT id, username FROM users
      WHERE banned = 0 AND lower(username) IN (${handles.map(() => '?').join(',')})
    `).all(...handles);
    for (const u of users) {
      if (u.id === req.user.id) continue;
      const muted = db.prepare('SELECT 1 FROM mutes WHERE muter_id = ? AND muted_id = ?').get(u.id, req.user.id);
      if (muted) continue;
      if (isGameday) {
        db.prepare(`INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
                    VALUES (?, ?, '1970-01-01 00:00:00')`).run(req.params.id, u.id);
      }
      notify({
        userId: u.id, type: 'mention', actorId: req.user.id,
        data: {
          conversation_id: req.params.id,
          preview: content.slice(0, 140),
          gameday: isGameday,
          game_id: isGameday ? conv.game_id : undefined,
          message_id: id,
        },
        dedupeKey: `mention:${id}:${u.id}`,
      });
    }
  }

  // Reply notification: ping the parent author if not the sender / not muted.
  if (replyToId) {
    const parent = db.prepare('SELECT user_id FROM messages WHERE id = ?').get(replyToId);
    if (parent && parent.user_id !== req.user.id) {
      const muted = db.prepare('SELECT 1 FROM mutes WHERE muter_id = ? AND muted_id = ?')
        .get(parent.user_id, req.user.id);
      if (!muted) {
        notify({
          userId: parent.user_id, type: 'message_reply', actorId: req.user.id,
          data: {
            conversation_id: req.params.id,
            message_id: id,
            preview: content.slice(0, 140),
            gameday: isGameday,
            game_id: isGameday ? conv.game_id : undefined,
          },
          dedupeKey: `reply:${id}`,
        });
      }
    }
  }

  const row = db.prepare(`
    SELECT m.id, m.user_id, m.content, m.created_at, m.reply_to_id, m.edited_at, m.deleted_at, m.is_system,
           u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(id);

  res.status(201).json(hydrateMessageRow(row));
});

// Edit a message — only the sender can edit, and only if not already deleted.
router.patch('/:id/messages/:msgId', (req, res) => {
  const conv = db.prepare('SELECT id, game_id, closes_at FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });

  // Closed gameday rooms are read-only.
  if (conv.game_id && conv.closes_at) {
    const closesMs = sqliteToMs(conv.closes_at);
    if (closesMs && closesMs < Date.now()) return res.status(410).json({ error: 'Gameday chat closed' });
  }

  const msg = db.prepare('SELECT id, user_id, deleted_at FROM messages WHERE id = ? AND conversation_id = ?')
    .get(req.params.msgId, conv.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own messages' });
  if (msg.deleted_at) return res.status(400).json({ error: 'Message has been deleted' });

  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Message cannot be empty' });
  if (content.length > 2000) return res.status(400).json({ error: 'Message too long' });

  db.prepare(`UPDATE messages SET content = ?, edited_at = datetime('now') WHERE id = ?`)
    .run(content, msg.id);

  const row = db.prepare(`
    SELECT m.id, m.user_id, m.content, m.created_at, m.reply_to_id, m.edited_at, m.deleted_at, m.is_system,
           u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(msg.id);
  res.json(hydrateMessageRow(row));
});

// Soft-delete a message — only the sender can delete.
router.delete('/:id/messages/:msgId', (req, res) => {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });

  const msg = db.prepare('SELECT id, user_id, deleted_at FROM messages WHERE id = ? AND conversation_id = ?')
    .get(req.params.msgId, conv.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own messages' });
  if (msg.deleted_at) return res.json({ deleted: true });

  db.prepare(`UPDATE messages SET deleted_at = datetime('now') WHERE id = ?`).run(msg.id);
  res.json({ deleted: true, id: msg.id });
});

// Pulse the typing indicator. Caller's typing_until is bumped to now+5s
// so other members see them as "typing…" in the conversation polling.
router.post('/:id/typing', (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });
  // Don't pulse typing in closed gameday rooms (or non-DM contexts).
  const conv = db.prepare('SELECT game_id, closes_at FROM conversations WHERE id = ?').get(req.params.id);
  if (conv?.game_id && conv.closes_at) {
    const closesMs = sqliteToMs(conv.closes_at);
    if (closesMs && closesMs < Date.now()) return res.json({ ok: false, closed: true });
  }
  db.prepare(`UPDATE conversation_members SET typing_until = datetime('now', '+5 seconds')
              WHERE conversation_id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Clear typing immediately (e.g. after the user sends).
router.delete('/:id/typing', (req, res) => {
  db.prepare(`UPDATE conversation_members SET typing_until = NULL
              WHERE conversation_id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Search room participants for @-mention autocomplete. Excludes muted-out users.
router.get('/:id/participants', (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Conversation not found' });
  const q = String(req.query.q || '').trim().toLowerCase();
  const conv = db.prepare('SELECT game_id FROM conversations WHERE id = ?').get(req.params.id);
  // For gameday rooms allow searching all users (global mention pool); for
  // DMs/groups limit to room members.
  let rows;
  if (conv?.game_id) {
    if (!q) return res.json([]);
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT id, username, display_name, avatar, avatar_hue
      FROM users
      WHERE banned = 0 AND id != ?
        AND id NOT IN (SELECT muter_id FROM mutes WHERE muted_id = ?)
        AND id NOT IN (SELECT muted_id FROM mutes WHERE muter_id = ?)
        AND (lower(username) LIKE ? OR lower(display_name) LIKE ?)
      ORDER BY username
      LIMIT 8
    `).all(req.user.id, req.user.id, req.user.id, like, like);
  } else {
    rows = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue
      FROM conversation_members m JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = ? AND u.id != ? AND u.banned = 0
      ${q ? 'AND (lower(u.username) LIKE ? OR lower(u.display_name) LIKE ?)' : ''}
      ORDER BY u.username
      LIMIT 8
    `).all(...(q ? [req.params.id, req.user.id, `%${q}%`, `%${q}%`] : [req.params.id, req.user.id]));
  }
  res.json(rows.map(r => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name || r.username,
    avatar: r.avatar,
    avatarHue: r.avatar_hue ?? 200,
  })));
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
