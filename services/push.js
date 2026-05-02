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

  // VAPID keys live in app_settings so they survive Render container
  // restarts (ephemeral filesystem wipes any cache file). Env vars
  // win when present so production can pin keys explicitly.
  if (!pub || !priv) {
    const rows = db.prepare("SELECT key, value FROM app_settings WHERE key IN ('vapid_public', 'vapid_private')").all();
    const stored = Object.fromEntries(rows.map(r => [r.key, r.value]));
    pub  = pub  || stored.vapid_public  || '';
    priv = priv || stored.vapid_private || '';
  }

  if (!pub || !priv) {
    const generated = wp.generateVAPIDKeys();
    pub  = generated.publicKey;
    priv = generated.privateKey;
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('vapid_public', ?)").run(pub);
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('vapid_private', ?)").run(priv);
    console.log('[push] generated VAPID keys (persisted to app_settings).');
    console.log(`        VAPID_PUBLIC_KEY=${pub}`);
    // Don't log the private key in production.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`        VAPID_PRIVATE_KEY=${priv}`);
    }
  }

  // VAPID subject must be a real https:// URL or a mailto: with a
  // resolvable domain. Apple's WebPush server in particular rejects
  // anything else with `BadJwtToken`. Prefer (in order):
  //   1. VAPID_SUBJECT env var
  //   2. Render's RENDER_EXTERNAL_URL (auto-set on Render)
  //   3. APP_URL env var
  //   4. A safe public mailto fallback
  const subject = process.env.VAPID_SUBJECT
    || process.env.RENDER_EXTERNAL_URL
    || process.env.APP_URL
    || 'mailto:noreply@example.com';
  try {
    wp.setVapidDetails(subject, pub, priv);
  } catch (e) {
    // Bad subject format — fall back to a guaranteed-valid placeholder.
    console.warn('[push] VAPID subject rejected, falling back:', e.message);
    wp.setVapidDetails('mailto:noreply@example.com', pub, priv);
  }
  publicKey = pub;
  configured = true;

  // Drop subscriptions that were saved against a different public key —
  // they'd just bounce on every send. The very first launch with a
  // fresh DB has no subs so this is a no-op.
  try {
    const last = db.prepare("SELECT value FROM app_settings WHERE key = 'vapid_public_active'").get();
    if (last && last.value && last.value !== pub) {
      const dropped = db.prepare('DELETE FROM push_subscriptions').run();
      console.log(`[push] VAPID public key changed; cleared ${dropped.changes} stale subscription(s).`);
    }
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('vapid_public_active', ?)").run(pub);
  } catch { /* tolerate */ }

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
  // Helper for game-flavored notifs — pulls the matchup string + score.
  const matchupText = () => {
    const home = d.home_name || d.home || '';
    const away = d.away_name || d.away || '';
    return home && away ? `${away} @ ${home}` : (home || away || '');
  };
  const scoreText = () => {
    if (d.away_score == null || d.home_score == null) return '';
    return `${d.away_score}–${d.home_score}`;
  };
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
    case 'live_game': {
      const m = matchupText();
      return { title: m ? `${m} is live` : 'Game starting', body: d.period || '' };
    }
    case 'score': {
      const m = matchupText();
      const s = scoreText();
      return {
        title: m && s ? `${m} · ${s}` : (m || 'Score update'),
        body: [d.play_text, d.play_period].filter(Boolean).join(' · '),
      };
    }
    case 'period_end': {
      const m = matchupText();
      const s = scoreText();
      return {
        title: m && s ? `${m} · ${s}` : (m || 'Period over'),
        body: d.period || 'End of period',
      };
    }
    case 'final': {
      const m = matchupText();
      const s = scoreText();
      return {
        title: m && s ? `Final · ${m}` : 'Final score',
        body: s || (d.period || ''),
      };
    }
    case 'post':            return { title: `${who} posted`,  body: d.preview || '' };
    case 'report_new':      return { title: 'New report to review', body: d.preview || '' };
    case 'report_resolved': return { title: 'Report resolved' };
    case 'report_escalated':return { title: 'Report escalated to owner' };
    default:                return { title: 'CNTRD' };
  }
}

// Best-effort URL the SW opens when the user taps the notification.
// The client maps these query params to actual screens on boot.
function deeplinkUrl({ type, data }) {
  const d = data || {};
  const enc = (v) => encodeURIComponent(String(v));
  switch (type) {
    case 'message':
    case 'message_reply':
    case 'event_alert':
      return d.conversation_id ? `/?conv=${enc(d.conversation_id)}` : '/?messages=1';
    case 'mention':
      if (d.gameday && d.game_id) return `/?gameday=${enc(d.game_id)}`;
      if (d.conversation_id)      return `/?conv=${enc(d.conversation_id)}`;
      if (d.post_id)              return `/?post=${enc(d.post_id)}`;
      return '/';
    case 'reaction':
      return d.play_id ? `/?play=${enc(d.play_id)}` : '/';
    case 'live_game':
    case 'score':
    case 'period_end':
    case 'final':
      return d.league && d.game_id
        ? `/?game=${enc(d.league)}:${enc(d.game_id)}`
        : '/';
    case 'follow':
    case 'follow_accept':
      return actorRoute(d.actor_username) || '/';
    case 'follow_request':  return '/?notifs=requests';
    case 'group_invite':    return '/?messages=1';
    case 'post':            return d.post_id ? `/?post=${enc(d.post_id)}` : '/';
    case 'report_new':
    case 'report_resolved':
    case 'report_escalated':
      return '/?admin=reports';
    default:                return '/';
  }
}

function actorRoute(username) {
  if (!username) return null;
  return '/?user=' + encodeURIComponent(username);
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
  const errors = [];
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
      const msg = err?.body || err?.message || String(err);
      // 404/410 = subscription is dead; clean it up so we stop trying.
      if (status === 404 || status === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
        removed += 1;
        errors.push({ status, reason: 'gone' });
      } else {
        console.warn('[push] send failed', status || '', String(msg).slice(0, 200));
        errors.push({ status: status || null, reason: String(msg).slice(0, 200) });
      }
    }
  }));
  return { sent, removed, total: subs.length, errors };
}

module.exports = { ensureConfigured, getPublicKey, sendToUser };
