// teams-picker.jsx — reusable team picker used by signup + Settings.
// Renders a collapsible accordion of leagues, each with a search box and
// pickable team pills. Works against the dynamic registry loaded at boot
// (window.TEAMS_BY_LEAGUE) and falls back to grouping the static window.TEAMS.

// Pretty labels for the league codes that come back from /api/teams/all.
const LEAGUE_LABELS = {
  NFL: 'NFL · Football',
  NBA: 'NBA · Basketball',
  MLB: 'MLB · Baseball',
  NHL: 'NHL · Hockey',
  MLS: 'MLS · Soccer',
  EPL: 'EPL · Premier League',
  LaLiga: 'La Liga · Spain',
  Bundesliga: 'Bundesliga · Germany',
  SerieA: 'Serie A · Italy',
  NCAAF: 'NCAA Football',
  NCAAM: "NCAA Men's Basketball",
};

// The order users see leagues in. Anything else gets appended alphabetically.
const LEAGUE_ORDER = ['NFL', 'NBA', 'MLB', 'NHL', 'MLS', 'EPL', 'LaLiga', 'Bundesliga', 'SerieA', 'NCAAF', 'NCAAM'];

function getTeamsByLeague() {
  if (window.TEAMS_BY_LEAGUE && Object.keys(window.TEAMS_BY_LEAGUE).length) {
    return window.TEAMS_BY_LEAGUE;
  }
  // Static fallback: group the small static TEAMS map by league.
  const out = {};
  for (const t of Object.values(TEAMS || {})) {
    (out[t.league] = out[t.league] || []).push({ ...t, fullName: t.fullName || t.name });
  }
  return out;
}

function sortedLeagueEntries(byLeague) {
  const known = LEAGUE_ORDER.filter(k => byLeague[k]);
  const extras = Object.keys(byLeague).filter(k => !LEAGUE_ORDER.includes(k)).sort();
  return [...known, ...extras].map(k => [k, byLeague[k]]);
}

function TeamPickButton({ team, selected, onClick }) {
  const tx = selected ? pickContrast(team.primary) : 'var(--cn-text)';
  return (
    <button onClick={onClick} type="button" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 11px', borderRadius: 999,
      background: selected ? team.primary : 'var(--cn-bg-elev)',
      border: `0.5px solid ${selected ? team.primary : 'var(--cn-border-s)'}`,
      color: tx,
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
      fontFamily: 'var(--cn-font-body)',
      lineHeight: 1.2,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: selected ? team.accent : team.primary,
        flexShrink: 0,
      }} />
      <span style={{ whiteSpace: 'nowrap' }}>{team.name}</span>
      {selected && <Icon name="check" size={11} stroke={tx} sw={2.5} />}
    </button>
  );
}

function LeagueSection({ leagueCode, teams, picks, onToggle, defaultOpen }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const [q, setQ] = React.useState('');
  const selectedCount = teams.filter(t => picks.includes(t.code)).length;
  const filtered = q
    ? teams.filter(t => {
        const q2 = q.toLowerCase();
        return (t.name || '').toLowerCase().includes(q2)
          || (t.fullName || '').toLowerCase().includes(q2)
          || (t.location || '').toLowerCase().includes(q2)
          || (t.code || '').toLowerCase().includes(q2);
      })
    : teams;
  return (
    <div style={{
      border: '0.5px solid var(--cn-border)',
      borderRadius: 12,
      background: 'var(--cn-bg-elev)',
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      <button type="button" onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--cn-text)', textAlign: 'left',
        fontFamily: 'var(--cn-font-body)',
      }}>
        <span style={{
          flex: 1,
          fontFamily: 'var(--cn-font-display)',
          fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)',
          letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 14,
        }}>{LEAGUE_LABELS[leagueCode] || leagueCode}</span>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>
          {selectedCount > 0 ? `${selectedCount}/${teams.length}` : `${teams.length} teams`}
        </span>
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'flex' }}>
          <Icon name="chevron-r" size={16} stroke="var(--cn-text-mute)" />
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          {teams.length > 25 && (
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Filter teams…"
              style={{
                width: '100%', padding: '8px 10px',
                marginBottom: 10, borderRadius: 8,
                background: 'var(--cn-bg)',
                border: '0.5px solid var(--cn-border-s)',
                color: 'var(--cn-text)', fontSize: 12,
                outline: 'none', fontFamily: 'var(--cn-font-body)',
              }}
            />
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)', padding: '4px 0' }}>
                No matches.
              </div>
            ) : filtered.map(t => (
              <TeamPickButton
                key={t.code + '-' + (t.fullName || t.name)}
                team={t}
                selected={picks.includes(t.code)}
                onClick={() => onToggle(t.code)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeaguePicker({ picks, onTogglePick }) {
  const byLeague = getTeamsByLeague();
  const entries = sortedLeagueEntries(byLeague);
  if (!entries.length) {
    return (
      <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)', padding: '8px 0' }}>
        Loading teams…
      </div>
    );
  }
  return (
    <div>
      {entries.map(([league, teams]) => (
        <LeagueSection
          key={league}
          leagueCode={league}
          teams={teams}
          picks={picks}
          onToggle={onTogglePick}
        />
      ))}
    </div>
  );
}

// ─── TeamsEditorScreen ───────────────────────────────────────────────
// Reachable from Settings → "My teams". Mirrors the signup picker but
// pre-loads the user's current teams and saves via PATCH /users/me/profile.
function TeamsEditorScreen({ tweaks, onNav, me, onMeUpdated }) {
  const meUser = me || ME;
  const [picks, setPicks] = React.useState(meUser.teams || []);
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState(null);
  const togglePick = code =>
    setPicks(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

  const save = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const updated = await API.updateMe({ team_tags: picks });
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
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 16 }}>MY TEAMS</span>
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
            ? 'Pick the teams you root for. They show next to your username and tune your feed.'
            : `${picks.length} team${picks.length === 1 ? '' : 's'} selected.`}
        </div>
        {err && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)' }}>
            {err}
          </div>
        )}
        <LeaguePicker picks={picks} onTogglePick={togglePick} />
      </div>
    </div>
  );
}

Object.assign(window, { LeaguePicker, LeagueSection, TeamsEditorScreen, LEAGUE_LABELS });
