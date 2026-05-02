const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const push = require('../services/push');

// Public VAPID key for the client to feed into pushManager.subscribe().
// Anyone can read this; it's the public half of the keypair.
router.get('/vapid-public', (req, res) => {
  const key = push.getPublicKey();
  if (!key) return res.status(503).json({ error: 'Push not configured' });
  res.json({ publicKey: key });
});

// Persist a subscription for the current user. Idempotent on endpoint —
// the same browser re-subscribing just refreshes the keys.
router.post('/subscribe', requireAuth, (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription payload' });
  }
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(sub.endpoint);
  if (existing) {
    db.prepare(`
      UPDATE push_subscriptions
      SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?
      WHERE id = ?
    `).run(req.user.id, sub.keys.p256dh, sub.keys.auth, ua, existing.id);
    return res.json({ ok: true, id: existing.id, refreshed: true });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, ua);
  res.status(201).json({ ok: true, id });
});

// Drop a subscription (browser unsubscribed, or user toggled off in
// Settings). Either body.endpoint or query.endpoint is accepted.
router.post('/unsubscribe', requireAuth, (req, res) => {
  const endpoint = (req.body?.endpoint || req.query?.endpoint || '').toString();
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  const r = db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .run(req.user.id, endpoint);
  res.json({ ok: true, removed: r.changes });
});

// Lightweight self-test for the user — fires a push to all of their
// subscribed devices so they can verify it works end-to-end. Returns
// diagnostic info (sub count, sends attempted, removed) so the UI can
// surface the actual result instead of silently optimistic.
router.post('/test', requireAuth, async (req, res) => {
  try {
    const publicKey = push.getPublicKey();
    if (!publicKey) {
      return res.status(503).json({ error: 'Push not configured (VAPID keys missing)' });
    }
    const subs = db.prepare('SELECT id, endpoint FROM push_subscriptions WHERE user_id = ?').all(req.user.id);
    if (!subs.length) {
      return res.status(400).json({ error: 'No subscriptions on this account. Toggle notifications back on, then try again.' });
    }
    const result = await push.sendToUser(req.user.id, {
      type: 'message',
      actor: { id: 'system', username: 'cntrd', displayName: 'CNTRD' },
      data: { preview: 'Test push delivered ✅' },
    });
    res.json({ ok: true, subscriptions: subs.length, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Push test failed' });
  }
});

module.exports = router;
