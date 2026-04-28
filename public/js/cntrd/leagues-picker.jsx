// leagues-picker.jsx — pick which leagues you want to follow.
// A flat list grouped by sport. Each row toggles a code in/out of `picks`.
// Used by signup step 4 and Settings → My leagues.

function LeaguesPicker({ picks, onTogglePick, catalog }) {
  const list = catalog && catalog.length ? catalog : (window.LEAGUE_CATALOG || []);
  if (!list.length) {
    return (
      <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)', padding: '8px 0' }}>
        Loading leagues…
      </div>
    );
  }

  // Group by sport, preserve sport order from the catalog.
  const groupOrder = [];
  const groups = {};
  for (const l of list) {
    if (!groups[l.sport]) { groups[l.sport] = []; groupOrder.push(l.sport); }
    groups[l.sport].push(l);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groupOrder.map(sport => (
        <div key={sport}>
          <div style={{
            fontFamily: 'var(--cn-font-mono)', fontSize: 10,
            color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase',
            marginBottom: 6,
          }}>{sport}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {groups[sport].map(l => {
              const selected = picks.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => onTogglePick(l.code)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: selected ? 'color-mix(in srgb, var(--cn-accent) 14%, var(--cn-bg-elev))' : 'var(--cn-bg-elev)',
                    border: `0.5px solid ${selected ? 'var(--cn-accent)' : 'var(--cn-border-s)'}`,
                    color: 'var(--cn-text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--cn-font-body)',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${selected ? 'var(--cn-accent)' : 'var(--cn-border-s)'}`,
                    background: selected ? 'var(--cn-accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: selected ? 'var(--cn-on-accent)' : 'transparent',
                    flexShrink: 0,
                  }}>
                    {selected && <Icon name="check" size={12} stroke="var(--cn-on-accent)" sw={3} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{l.label}</span>
                  {!l.hasTeams && (
                    <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, color: 'var(--cn-text-mute)', letterSpacing: 0.5 }}>
                      no teams
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── LeaguesEditorScreen ──────────────────────────────────────────────
// Reachable from Settings → "My leagues". Mirrors the picker but loads
// the user's current followed_leagues and saves via PATCH /me/profile.
function LeaguesEditorScreen({ tweaks, onNav, me, onMeUpdated }) {
  const meUser = me || ME;
  const [picks, setPicks] = React.useState(meUser.leagues || []);
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState(null);
  const [catalog, setCatalog] = React.useState(window.LEAGUE_CATALOG || []);

  React.useEffect(() => {
    if (catalog.length) return;
    API.leagueCatalog().then(c => {
      window.LEAGUE_CATALOG = c;
      setCatalog(c);
    }).catch(() => {});
  }, [catalog.length]);

  const togglePick = code =>
    setPicks(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

  const save = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const updated = await API.updateMe({ followed_leagues: picks });
      onMeUpdated?.(updated);
      onNav?.('settings');
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
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 16 }}>MY LEAGUES</span>
        <button onClick={save} disabled={busy} style={{
          padding: '6px 12px', borderRadius: 999,
          background: busy ? 'var(--cn-bg-elev2)' : 'var(--cn-accent)',
          color: busy ? 'var(--cn-text-mute)' : 'var(--cn-on-accent)',
          border: 'none', fontWeight: 700, fontSize: 12,
          cursor: busy ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--cn-font-body)',
        }}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.5 }}>
          {picks.length === 0
            ? 'Pick the leagues you want to follow. Their games show in Next Up + Recent Finals, and you can post about them.'
            : `${picks.length} league${picks.length === 1 ? '' : 's'} selected.`}
        </div>
        {err && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)' }}>
            {err}
          </div>
        )}
        <LeaguesPicker picks={picks} onTogglePick={togglePick} catalog={catalog} />
      </div>
    </div>
  );
}

Object.assign(window, { LeaguesPicker, LeaguesEditorScreen });
