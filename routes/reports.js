const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notify } = require('../services/notifier');

const TARGET_TYPES = new Set(['post', 'message', 'user']);
const RESOLUTIONS  = new Set(['dismiss', 'remove_content', 'temp_ban', 'escalate']);

// Snapshot the text of the reported entity at the time of the report so
// review still has context if the author edits or deletes after.
function captureSnapshot(targetType, targetId) {
  if (targetType === 'post') {
    const p = db.prepare('SELECT user_id, content FROM posts WHERE id = ?').get(targetId);
    return { authorId: p?.user_id || null, snapshot: p?.content || null };
  }
  if (targetType === 'message') {
    const m = db.prepare('SELECT user_id, content FROM messages WHERE id = ?').get(targetId);
    return { authorId: m?.user_id || null, snapshot: m?.content || null };
  }
  if (targetType === 'user') {
    const u = db.prepare('SELECT id, bio FROM users WHERE id = ?').get(targetId);
    return { authorId: u?.id || null, snapshot: u?.bio || null };
  }
  return { authorId: null, snapshot: null };
}

function adminAndOwnerIds(excludeUserId) {
  const rows = db.prepare(`
    SELECT id FROM users WHERE banned = 0 AND (is_admin = 1 OR is_owner = 1)
  `).all();
  return rows.map(r => r.id).filter(id => id !== excludeUserId);
}

function ownerIds() {
  return db.prepare('SELECT id FROM users WHERE banned = 0 AND is_owner = 1').all().map(r => r.id);
}

function hydrateReport(r) {
  if (!r) return r;
  const reporter = r.reporter_id
    ? db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(r.reporter_id)
    : null;
  const targetUser = r.target_user_id
    ? db.prepare('SELECT id, username, display_name, banned, banned_until FROM users WHERE id = ?').get(r.target_user_id)
    : null;
  const resolver = r.resolved_by
    ? db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(r.resolved_by)
    : null;
  return {
    id: r.id,
    target_type: r.target_type,
    target_id: r.target_id,
    reason: r.reason || '',
    content_snapshot: r.content_snapshot || '',
    status: r.status,
    resolution: r.resolution || null,
    resolution_note: r.resolution_note || '',
    ban_until: r.ban_until || null,
    resolved_at: r.resolved_at || null,
    created_at: r.created_at,
    reporter: reporter ? {
      id: reporter.id, username: reporter.username,
      displayName: reporter.display_name || reporter.username,
    } : null,
    target_user: targetUser ? {
      id: targetUser.id, username: targetUser.username,
      displayName: targetUser.display_name || targetUser.username,
      banned: !!targetUser.banned, banned_until: targetUser.banned_until || null,
    } : null,
    resolver: resolver ? {
      id: resolver.id, username: resolver.username,
      displayName: resolver.display_name || resolver.username,
    } : null,
  };
}

// File a report. Any signed-in user can report.
router.post('/', requireAuth, (req, res) => {
  const targetType = String(req.body?.target_type || '').toLowerCase();
  const targetId   = String(req.body?.target_id || '').trim();
  const reason     = String(req.body?.reason || '').trim().slice(0, 500);
  if (!TARGET_TYPES.has(targetType)) return res.status(400).json({ error: 'Invalid target_type' });
  if (!targetId) return res.status(400).json({ error: 'target_id is required' });

  const { authorId, snapshot } = captureSnapshot(targetType, targetId);
  // Don't capture the report if the author is the reporter themselves.
  if (authorId && authorId === req.user.id) {
    return res.status(400).json({ error: 'You can\'t report your own content' });
  }

  // Block dupes — a user reporting the same target while a previous
  // report is still pending just bumps the existing row's reason if
  // the new one is longer (otherwise no-op).
  const existing = db.prepare(`
    SELECT id, reason FROM reports
    WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'pending'
    LIMIT 1
  `).get(req.user.id, targetType, targetId);
  if (existing) {
    if (reason && reason.length > (existing.reason || '').length) {
      db.prepare('UPDATE reports SET reason = ? WHERE id = ?').run(reason, existing.id);
    }
    return res.status(200).json({ ok: true, deduped: true, id: existing.id });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO reports (id, reporter_id, target_type, target_id, target_user_id, reason, content_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, targetType, targetId, authorId, reason || null, snapshot || null);

  // Fan out to every admin + owner. dedupeKey collapses repeat
  // notifications for the same review queue per recipient per day.
  const recipients = adminAndOwnerIds(req.user.id);
  const dayKey = new Date().toISOString().slice(0, 10);
  for (const uid of recipients) {
    notify({
      userId: uid, type: 'report_new', actorId: req.user.id,
      data: {
        report_id: id,
        target_type: targetType,
        target_id: targetId,
        preview: (snapshot || '').slice(0, 140),
      },
      dedupeKey: `report-queue:${uid}:${dayKey}`,
    });
  }

  res.status(201).json({ ok: true, id });
});

// Admin / owner queue.
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const status = String(req.query.status || 'pending');
  const valid = new Set(['pending', 'resolved', 'escalated', 'all']);
  const filter = valid.has(status) ? status : 'pending';
  let rows;
  if (filter === 'all') {
    rows = db.prepare(`SELECT * FROM reports ORDER BY created_at DESC LIMIT 200`).all();
  } else {
    rows = db.prepare(`SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC LIMIT 200`).all(filter);
  }
  res.json(rows.map(hydrateReport));
});

// Counts for the admin badge.
router.get('/counts', requireAuth, requireAdmin, (req, res) => {
  const pending    = db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'pending'").get().n;
  const escalated  = db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'escalated'").get().n;
  res.json({ pending, escalated });
});

// Single report detail.
router.get('/:id', requireAuth, requireAdmin, (req, res) => {
  const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Report not found' });
  res.json(hydrateReport(r));
});

// Resolve a report. Admins can dismiss, remove content, apply a temporary
// ban, or escalate to the owner. Owners can do everything plus act on
// already-escalated reports.
router.post('/:id/resolve', requireAuth, requireAdmin, (req, res) => {
  const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Report not found' });

  const action = String(req.body?.action || '').toLowerCase();
  if (!RESOLUTIONS.has(action)) return res.status(400).json({ error: 'Invalid action' });
  const note = String(req.body?.note || '').trim().slice(0, 500);
  // Owner can always act; admins can act on pending only (escalated cases
  // are owner-only).
  if (r.status === 'escalated' && !req.user.is_owner) {
    return res.status(403).json({ error: 'Escalated reports are owner-only' });
  }

  let banUntil = null;
  if (action === 'temp_ban') {
    const days = Number.isFinite(+req.body?.days) ? +req.body.days : 3;
    const clamped = Math.max(1, Math.min(30, Math.floor(days)));
    banUntil = new Date(Date.now() + clamped * 86400 * 1000)
      .toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  }

  const nowSql = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  db.transaction(() => {
    if (action === 'remove_content') {
      if (r.target_type === 'post') {
        db.prepare('DELETE FROM posts WHERE id = ?').run(r.target_id);
      } else if (r.target_type === 'message') {
        db.prepare(`UPDATE messages SET deleted_at = datetime('now') WHERE id = ?`).run(r.target_id);
      } else if (r.target_type === 'user') {
        // Removing a "user" report means clearing their bio (the most
        // common abusive surface on a profile). Heavier action requires
        // a temp ban or escalation.
        if (r.target_user_id) db.prepare(`UPDATE users SET bio = '' WHERE id = ?`).run(r.target_user_id);
      }
    } else if (action === 'temp_ban') {
      if (r.target_user_id) {
        db.prepare('UPDATE users SET banned = 1, banned_until = ? WHERE id = ?')
          .run(banUntil, r.target_user_id);
      }
    }

    const newStatus = action === 'escalate' ? 'escalated' : 'resolved';
    db.prepare(`
      UPDATE reports SET
        status = ?, resolution = ?, resolution_note = ?, ban_until = ?,
        resolved_by = ?, resolved_at = ?
      WHERE id = ?
    `).run(newStatus, action, note || null, banUntil, req.user.id, nowSql, r.id);
  })();

  // Tell the owner what happened. Escalated reports go to every owner
  // with a "needs your call" note; resolved ones get a recap.
  const targets = action === 'escalate' ? ownerIds() : ownerIds();
  for (const uid of targets) {
    if (uid === req.user.id) continue;
    notify({
      userId: uid,
      type: action === 'escalate' ? 'report_escalated' : 'report_resolved',
      actorId: req.user.id,
      data: {
        report_id: r.id,
        action,
        target_type: r.target_type,
        target_user_id: r.target_user_id,
        ban_until: banUntil,
      },
      dedupeKey: `report-result:${r.id}`,
    });
  }

  const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(r.id);
  res.json(hydrateReport(updated));
});

module.exports = router;
