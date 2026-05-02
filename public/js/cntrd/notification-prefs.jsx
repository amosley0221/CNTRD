// notification-prefs.jsx — Settings → Notifications.
// Lets users toggle which notification types they want to receive. Server
// silently drops notifications whose type was disabled by the recipient.

const NOTIF_PREF_GROUPS = [
  {
    title: 'Game alerts',
    items: [
      { key: 'live_game',   label: 'Game tip-off',           sub: 'When a game involving your teams or followed leagues starts' },
      { key: 'score',       label: 'Scoring updates',         sub: 'When a team scores. Basketball is excluded by default.' },
      { key: 'period_end',  label: 'Quarter / halftime',      sub: 'End-of-period and halftime updates' },
      { key: 'final',       label: 'Final scores',            sub: 'When a game ends' },
    ],
  },
  {
    title: 'Social',
    items: [
      { key: 'post',            label: 'Posts from people you follow', sub: 'Rolled up to one notification per person per day' },
      { key: 'follow',          label: 'New followers',       sub: 'Someone followed you' },
      { key: 'follow_request',  label: 'Follow requests',     sub: 'Someone wants to follow your private account' },
      { key: 'follow_accept',   label: 'Follow accepted',     sub: 'Someone accepted your request' },
      { key: 'message',         label: 'New messages',        sub: 'Someone sent you a DM' },
      { key: 'mention',         label: 'Mentions',            sub: 'Someone @ed you in a post' },
      { key: 'reaction',        label: 'Reactions',           sub: 'Someone reacted to your Play or post' },
      { key: 'group_invite',    label: 'Group invites',       sub: 'Someone added you to a group chat' },
      { key: 'event_alert',     label: 'Group events',        sub: '15-minute heads-up before a group event starts' },
    ],
  },
];

function NotificationPrefsScreen({ tweaks, onNav, me, onMeUpdated }) {
  const meUser = me || ME;
  const initial = meUser.notificationPrefs || {};
  const [prefs, setPrefs] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  const [ok, setOk]     = React.useState(null);

  // Reset local draft when ME changes (e.g., after save).
  React.useEffect(() => { setPrefs(meUser.notificationPrefs || {}); }, [meUser.id]);

  const isOn = (key) => prefs[key] !== false;     // missing = on by default
  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !isOn(key) }));

  // Detect any difference vs the saved snapshot for the Save button.
  const dirty = (() => {
    const allKeys = NOTIF_PREF_GROUPS.flatMap(g => g.items.map(i => i.key));
    for (const k of allKeys) {
      const cur = prefs[k] !== false;
      const old = initial[k] !== false;
      if (cur !== old) return true;
    }
    return false;
  })();

  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true); setErr(null); setOk(null);
    try {
      const updated = await API.updateMe({ notification_prefs: prefs });
      onMeUpdated?.(updated);
      setOk('Saved.');
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg-elev2)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('back')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 16 }}>NOTIFICATIONS</span>
        <button onClick={save} disabled={!dirty || busy} style={{
          padding: '6px 12px', borderRadius: 999,
          background: dirty && !busy ? 'var(--cn-accent)' : 'var(--cn-bg-elev2)',
          color:      dirty && !busy ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)',
          border: 'none', fontWeight: 700, fontSize: 12,
          cursor: dirty && !busy ? 'pointer' : 'not-allowed',
          fontFamily: 'var(--cn-font-body)',
        }}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0 60px' }}>
        <div style={{ padding: '0 16px 14px', fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.5 }}>
          You only get game alerts for leagues you follow or teams you favorite.
          Turn off any type below to stop receiving it. Basketball never sends
          per-score notifications — only quarter-end and final.
        </div>
        {err && <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)' }}>{err}</div>}
        {ok  && <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--cn-success)', fontFamily: 'var(--cn-font-mono)' }}>{ok}</div>}

        <PushSection />

        {NOTIF_PREF_GROUPS.map(group => (
          <div key={group.title} style={{ marginTop: 14 }}>
            <div style={{
              padding: '0 16px 6px',
              fontFamily: 'var(--cn-font-mono)', fontSize: 10,
              letterSpacing: 1, textTransform: 'uppercase',
              color: 'var(--cn-text-mute)',
            }}>{group.title}</div>
            <div style={{
              background: 'var(--cn-bg-elev)',
              borderTop: '0.5px solid var(--cn-border)',
              borderBottom: '0.5px solid var(--cn-border)',
            }}>
              {group.items.map((it, i) => (
                <PrefRow key={it.key}
                  label={it.label} sub={it.sub}
                  on={isOn(it.key)} onChange={() => toggle(it.key)}
                  last={i === group.items.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrefRow({ label, sub, on, onChange, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 16px',
      borderBottom: last ? 'none' : '0.5px solid var(--cn-border)',
      minHeight: 56,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--cn-text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange()} style={{
        position: 'relative', width: 44, height: 26, border: 'none',
        borderRadius: 999, background: on ? 'var(--cn-accent)' : 'var(--cn-border-s)',
        cursor: 'pointer', padding: 0, flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.18s', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

// System push notifications. Walks the user through enabling them — on
// iOS this only works when CNTRD is launched from the home screen, so
// the section nudges them to install first.
function PushSection() {
  const [permission, setPermission] = React.useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [subscribed, setSubscribed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [info, setInfo] = React.useState(null);

  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const iosNeedsInstall = isIOS && !isStandalone;

  // On mount, see if this browser already has a live subscription so the
  // toggle reflects reality (rather than just the OS permission state).
  React.useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [supported]);

  const enable = async () => {
    if (!supported || busy) return;
    setBusy(true); setErr(null); setInfo(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') throw new Error('Permission was not granted.');

      const { publicKey } = await API.pushVapidPublic();
      if (!publicKey) throw new Error('Server is missing VAPID keys.');
      const wantedKey = urlBase64ToUint8Array(publicKey);

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      // If an existing subscription was created against a different VAPID
      // public key (e.g. after a Render restart regenerated keys), the
      // push service will reject every send. Tear it down and re-subscribe
      // with the current key.
      if (sub) {
        const currentKey = sub.options?.applicationServerKey;
        if (!currentKey || !arrayBufferEquals(currentKey, wantedKey.buffer)) {
          try { await sub.unsubscribe(); } catch { /* ignore */ }
          sub = null;
        }
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: wantedKey,
        });
      }
      await API.pushSubscribe(sub.toJSON());
      setSubscribed(true);
      setInfo('System notifications enabled on this device.');
    } catch (e) {
      setErr(e.message || 'Could not enable');
    } finally {
      setBusy(false);
    }
  };

  // Equal-bytes check between two ArrayBuffer-likes.
  function arrayBufferEquals(a, b) {
    const ua = a instanceof ArrayBuffer ? new Uint8Array(a) : new Uint8Array(a.buffer || a);
    const ub = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer || b);
    if (ua.length !== ub.length) return false;
    for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false;
    return true;
  }

  const disable = async () => {
    if (!supported || busy) return;
    setBusy(true); setErr(null); setInfo(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try { await API.pushUnsubscribe(sub.endpoint); } catch { /* keep going */ }
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setInfo('System notifications turned off on this device.');
    } catch (e) {
      setErr(e.message || 'Could not disable');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true); setErr(null); setInfo(null);
    try {
      const r = await API.pushTest();
      const sent = Number(r?.sent || 0);
      const total = Number(r?.subscriptions || r?.total || 0);
      const removed = Number(r?.removed || 0);
      if (sent > 0) {
        setInfo(`Test sent to ${sent} device${sent === 1 ? '' : 's'} — should appear in a few seconds.`);
      } else if (removed > 0) {
        setErr(`The push service rejected ${removed} dead subscription${removed === 1 ? '' : 's'}. Toggle notifications off and back on to refresh.`);
      } else if (Array.isArray(r?.errors) && r.errors.length) {
        const first = r.errors[0];
        setErr(`Push service replied ${first.status || 'error'}: ${first.reason || 'unknown'}`);
      } else if (total === 0) {
        setErr('No subscriptions registered for this account.');
      } else {
        setErr('Test request returned no result.');
      }
    } catch (e) {
      setErr(e.message || 'Test failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        padding: '0 16px 6px',
        fontFamily: 'var(--cn-font-mono)', fontSize: 10,
        letterSpacing: 1, textTransform: 'uppercase',
        color: 'var(--cn-text-mute)',
      }}>System notifications</div>
      <div style={{
        margin: '0 16px', padding: 14, borderRadius: 12,
        background: 'var(--cn-bg-elev)',
        border: '0.5px solid var(--cn-border)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {!supported ? (
          <div style={{ fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.45 }}>
            This browser doesn't support web push notifications. Try Chrome, Firefox, Edge, or Safari (iOS 16.4+).
          </div>
        ) : iosNeedsInstall ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.45 }}>
              On iPhone, system notifications only work when CNTRD is installed to your home screen.
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--cn-text)', lineHeight: 1.6 }}>
              <li>Tap the <strong>Share</strong> icon in Safari</li>
              <li>Choose <strong>Add to Home Screen</strong></li>
              <li>Open CNTRD from the new icon, then come back here</li>
            </ol>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.45 }}>
              Get a system notification on this device when someone messages you, mentions you, or your team scores. Pushes follow the per-type toggles below — turn one off and it stops both in-app and on the lock screen.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {subscribed ? (
                <>
                  <button onClick={disable} disabled={busy} style={pushBtn('var(--cn-text-dim)')}>
                    {busy ? '…' : 'Turn off on this device'}
                  </button>
                  <button onClick={sendTest} disabled={busy} style={pushBtn('var(--cn-accent)')}>
                    Send test push
                  </button>
                </>
              ) : (
                <button onClick={enable} disabled={busy || permission === 'denied'} style={pushBtn(permission === 'denied' ? 'var(--cn-text-mute)' : 'var(--cn-accent)')}>
                  {busy ? '…' : permission === 'denied' ? 'Permission blocked' : 'Turn on system notifications'}
                </button>
              )}
            </div>
            {permission === 'denied' && (
              <div style={{ fontSize: 12, color: 'var(--cn-text-mute)', lineHeight: 1.4 }}>
                Notifications are blocked at the browser level. Re-enable them from your browser's site settings, then come back.
              </div>
            )}
          </>
        )}
        {err  && <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-danger)' }}>{err}</div>}
        {info && <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-success)' }}>{info}</div>}
      </div>
    </div>
  );
}

function pushBtn(color) {
  return {
    padding: '8px 14px', borderRadius: 999,
    background: 'transparent', color,
    border: `0.5px solid ${color}`,
    cursor: 'pointer',
    fontWeight: 700, fontSize: 12, fontFamily: 'var(--cn-font-body)',
  };
}

// Convert the server's VAPID public key (base64url) to the Uint8Array
// pushManager.subscribe expects.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

Object.assign(window, { NotificationPrefsScreen });
