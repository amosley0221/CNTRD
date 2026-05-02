// Web Push delivery — wraps web-push and the push_subscriptions table.
//
// VAPID keys come from VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY env vars.
// If they're missing we generate a pair on first call, cache it, and log
// the values so the operator can stash them as env vars in production.
// (In dev they're regenerated on every restart, which is fine — clients
// re-subscribe automatically when getSubscription's applicationServerKey
// no longer matches.)
//
// notify() in services/notifier.js calls sendToUser() after writing the
// in-app notification row, so any notification that lands in the inbox
// also fans out as a system push to every device the user has subscribed.

const fs = require('fs');
const path = require('path');
const db = require('../database/db');

let webpush = null;
let configured = false;
let publicKey = null;

function loadWebPush() {
  if (webpush) return webpush;
  try {
    webpush = require('web-push');
    return webpush;
  } catch (e) {
    // Package not installed yet — fall through and treat pushes as
    // disabled. The server still runs, just without system pushes.
    console.warn('[push] web-push not installed; system pushes disabled. Run `npm install`.');
    return null;
  }
}

function ensureConfigured() {
  if (configured) return webpush;
  const wp = loadWebPush();
  if (!wp) return null;

  let pub = process.env.VAPID_PUBLIC_KEY || '';
  let priv = process.env.VAPID_PRIVATE_KEY || '';

  // Persist a generated pair to a local file in dev so restarts don't
  // invalidate active subscriptions. The file is gitignored.
  const cachePath = path.join(__dirname, '..', '.vapid.json');
  if ((!pub || !priv) && fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (cached.publicKey && cached.privateKey) {
        pub  = pub  || cached.publicKey;
        priv = priv || cached.privateKey;
      }
    } catch { /* ignore */ }
  }
  if (!pub || !priv) {
    const generated = wp.generateVAPIDKeys();
    pub  = generated.publicKey;
    priv = generated.privateKey;
    try {
      fs.writeFileSync(cachePath, JSON.stringify(generated, null, 2));
    } catch { /* read-only filesystem on some hosts; tolerate */ }
    console.log('[push] generated VAPID keys; set as env vars to make them stable:');
    console.log(`  VAPID_PUBLIC_KEY=${pub}`);
    console.log(`  VAPID_PRIVATE_KEY=${priv}`);
  }

  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@cntrd.local';
  wp.setVapidDetails(subject, pub, priv);
  publicKey = pub;
  configured = true;
  return wp;
}

function getPublicKey() {
  ensureConfigured();
  return publicKey || '';
}

// Per-type push payload. Title + body are derived from the same fields
// the client uses to render the in-app row, so the system notification
// matches what the user will see when they open the app.
function summarize({ type, actor, data }) {
  const who = actor?.displayName || actor?.username || 'Someone';
  const d = data || {};
  switch (type) {
    case 'follow':          return { title: `${who} started following you` };
    case 'follow_request':  return { title: `${who} requested to follow you`, body: 'Open Requests to respond' };
    case 'follow_accept':   return { title: `${who} accepted your follow request` };
    case 'message':         return { title: `${who} sent you a message`, body: d.preview || '' };
    case 'message_reply':   return { title: `${who} replied to your message`, body: d.preview || '' };
    case 'mention':         return { title: `${who} mentioned you`, body: d.preview || '' };
    case 'reaction':        return { title: `${who} reacted ${d.emoji || ''} to your Play` };
    case 'group_invite':    return { title: `${who} invited you to a group`, body: d.name ? `"${d.name}"` : '' };
    case 'event_alert':     return { title: 'Group event starting soon', body: d.title || '' };
    case 'live_game':       return { title: 'Game starting',  body: d.matchup || '' };
    case 'score':           return { title: 'Score update',   body: d.matchup ? `${d.matchup}${d.score ? ' · ' + d.score : ''}` : '' };
    case 'period_end':      return { title: 'Period over',    body: d.matchup || '' };
    case 'final':           return { title: 'Final score',    body: d.matchup ? `${d.matchup}${d.score ? ' · ' + d.score : ''}` : '' };
    case 'post':            return { title: `${who} posted`,  body: d.preview || '' };
    case 'report_new':      return { title: 'New report to review', body: d.preview || '' };
    case 'report_resolved': return { title: 'Report resolved' };
    case 'report_escalated':return { title: 'Report escalated to owner' };
    default:                return { title: 'CNTRD' };
  }
}

// Best-effort URL the SW should open when the user taps the notification.
// The client-side notif click handler already routes by type, so we
// just route to the Notifications screen — the existing handler picks
// up from there when the app loads.
function deeplinkUrl({ type, data }) {
  // Anchor on / so the SPA boots, then `#notif=…` lets a future hand-off
  // grab the type if needed. For now we just open the app.
  return '/?n=' + encodeURIComponent(type || '');
}

function listSubscriptions(userId) {
  return db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId);
}

async function sendToUser(userId, { type, actor, data }) {
  const wp = ensureConfigured();
  if (!wp) return { sent: 0, removed: 0 };

  const subs = listSubscriptions(userId);
  if (!subs.length) return { sent: 0, removed: 0 };

  const summary = summarize({ type, actor, data });
  const payload = JSON.stringify({
    title: summary.title || 'CNTRD',
    body:  summary.body || '',
    url:   deeplinkUrl({ type, data }),
    type,
  });

  let sent = 0;
  let removed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await wp.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 }   // hold for an hour if device is offline
      );
      db.prepare('UPDATE push_subscriptions SET last_push_at = datetime(\'now\') WHERE id = ?').run(s.id);
      sent += 1;
    } catch (err) {
      const status = err?.statusCode || err?.status;
      // 404/410 = subscription is dead; clean it up so we stop trying.
      if (status === 404 || status === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
        removed += 1;
      } else {
        console.warn('[push] send failed', s.endpoint?.slice(0, 40), status || err.message);
      }
    }
  }));
  return { sent, removed };
}

module.exports = { ensureConfigured, getPublicKey, sendToUser };
