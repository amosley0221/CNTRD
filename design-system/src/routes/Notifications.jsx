import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, Trash2, Check } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, Avatar } from '../components';
import { notifications as notifApi, push as pushApi } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function Notifications() {
  const { me } = useAuth();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const [pushState, setPushState] = useState(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await notifApi.list();
        if (!cancel) setItems(data || []);
        notifApi.readAll().catch(() => {});
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [me?.id]);

  const togglePush = async () => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      setPushState('unsupported');
      return;
    }
    try {
      if (Notification.permission === 'denied') {
        alert('Push is blocked in this browser. Re-enable it from system settings.');
        return;
      }
      const perm = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      setPushState(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await pushApi.vapidPublic();
      if (!publicKey) throw new Error('Push not configured on the server.');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await pushApi.subscribe(sub.toJSON());
    } catch (e) {
      setErr(e.message);
    }
  };

  const sendTest = async () => {
    try { await pushApi.test(); } catch (e) { setErr(e.message); }
  };

  const clearAll = async () => {
    if (!confirm('Clear every notification?')) return;
    try { await notifApi.clear(); setItems([]); } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <Eyebrow>Bell</Eyebrow>

      <div className="flex items-baseline justify-between mb-6 gap-3 flex-wrap">
        <SectionHead title="Recent" italicWord="activity" count={items ? `${items.length}` : '…'} />
        <div className="flex items-center gap-3" style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.1em' }}>
          {pushState === 'granted' ? (
            <button onClick={sendTest} style={btn(c.accent, c.paper)}><Bell size={13} /> TEST PUSH</button>
          ) : pushState === 'denied' ? (
            <span style={{ color: c.alert }}><BellOff size={13} style={{ verticalAlign: -2 }} /> PUSH BLOCKED</span>
          ) : pushState === 'unsupported' ? (
            <span style={{ color: c.inkDim }}>PUSH UNSUPPORTED</span>
          ) : (
            <button onClick={togglePush} style={btn('transparent', c.accent, { border: `1px solid ${c.accent}` })}><Bell size={13} /> ENABLE PUSH</button>
          )}
          {items?.length > 0 && (
            <button onClick={clearAll} style={btn('transparent', c.inkDim, { border: `1px solid ${c.inkFaint}` })}><Trash2 size={13} /> CLEAR</button>
          )}
        </div>
      </div>

      {err && <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, marginBottom: 12 }}>{err}</div>}
      {!items && !err && <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>LOADING…</div>}
      {items?.length === 0 && (
        <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, padding: '12px 0' }}>
          Nothing here yet. Push toggles above.
        </div>
      )}

      <div style={{ maxWidth: 640 }}>
        {items?.map((n) => <NotifRow key={n.id} n={n} />)}
      </div>
    </>
  );
}

function NotifRow({ n }) {
  const actor = n.actor;
  const initial = (actor?.displayName?.[0] || actor?.username?.[0] || '·').toUpperCase();
  const verb = verbFor(n.type);
  const target = targetLink(n);
  const time = relTime(n.created_at);

  const body = (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${c.line}` }}>
      <Avatar initial={initial} />
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 400, color: c.ink, lineHeight: 1.35 }}>
          {actor ? (
            <Link to={`/u/${actor.username}`} style={{ color: c.accent, fontWeight: 600 }}>@{actor.username}</Link>
          ) : (
            <span style={{ color: c.inkDim }}>CNTRD</span>
          )}{' '}
          {verb}
        </div>
        {n.data?.preview && (
          <div style={{ fontFamily: fonts.body, fontSize: 14, color: c.inkDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.data.preview}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim }}>{time}</span>
        {!n.read && <span style={{ width: 6, height: 6, borderRadius: 999, background: c.accent }} />}
      </div>
    </div>
  );

  return target ? <Link to={target} style={{ color: 'inherit', textDecoration: 'none' }}>{body}</Link> : body;
}

function verbFor(type) {
  switch (type) {
    case 'follow':         return 'started following you.';
    case 'like':           return 'liked your post.';
    case 'reply':          return 'replied to you.';
    case 'mention':        return 'mentioned you.';
    case 'message':        return 'sent you a message.';
    case 'message_reply':  return 'replied in a thread.';
    case 'post':           return 'posted.';
    case 'live_game':      return 'game is live.';
    case 'event':          return 'event coming up.';
    default:               return type;
  }
}

function targetLink(n) {
  const d = n.data || {};
  if (d.conversation_id) return `/messages/${d.conversation_id}`;
  if (d.post_id)         return `/post/${d.post_id}`;
  if (d.game_id)         return `/gameday/${d.game_id}`;
  if (n.actor)           return `/u/${n.actor.username}`;
  return null;
}

function btn(bg, color, extra) {
  return {
    background: bg, color, border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px',
    fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
    ...(extra || {}),
  };
}

function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)  return 'now';
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
