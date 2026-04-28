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
      { key: 'follow',          label: 'New followers',       sub: 'Someone followed you' },
      { key: 'follow_request',  label: 'Follow requests',     sub: 'Someone wants to follow your private account' },
      { key: 'follow_accept',   label: 'Follow accepted',     sub: 'Someone accepted your request' },
      { key: 'message',         label: 'New messages',        sub: 'Someone sent you a DM' },
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
        <button style={iconBtnStyle()} onClick={() => onNav?.('settings')}>
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

Object.assign(window, { NotificationPrefsScreen });
