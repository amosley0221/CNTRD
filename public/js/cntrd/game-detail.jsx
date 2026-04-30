// game-detail.jsx — fetches /api/games/:league/:id and renders box +
// leaders for any team. Reachable by clicking a game card in the rail.

function GameDetailScreen({ tweaks, onNav, selectedGame }) {
  const [data, setData]       = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr]         = React.useState(null);

  const league = selectedGame?.league;
  const id     = selectedGame?.id;

  React.useEffect(() => {
    if (!league || !id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setErr(null);
    API.gameDetail(league, id)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setErr(e.message || 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [league, id]);

  const openSchedule = (team) => {
    if (!team?.id || !data?.league) return;
    window.dispatchEvent(new CustomEvent('cntrd:open-team-schedule', {
      detail: { league: data.league, teamId: team.id, name: team.name, primary: team.primary, code: team.code, logo: team.logo },
    }));
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('back')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 14 }}>
          {league || 'GAME'}
        </span>
        <span style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 80px' }}>
          {loading ? (
            <Empty>Loading game…</Empty>
          ) : err ? (
            <Empty danger>{err}</Empty>
          ) : !data ? (
            <Empty>No game selected.</Empty>
          ) : (
            <>
              <DetailHeader data={data} />
              <DetailScoreCard data={data} />
              <DetailContextBanner data={data} />
              {(data.home?.id || data.away?.id) && (
                <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {data.away?.id && (
                    <button onClick={() => openSchedule(data.away)} style={scheduleBtnStyle()}>
                      {data.away.name} schedule →
                    </button>
                  )}
                  {data.home?.id && (
                    <button onClick={() => openSchedule(data.home)} style={scheduleBtnStyle()}>
                      {data.home.name} schedule →
                    </button>
                  )}
                </div>
              )}
              <DetailStatsBlock home={data.home} away={data.away} />
              <DetailLeaders leaders={data.leaders} home={data.home} away={data.away} />
              {(data.headlines || []).length > 0 && <DetailHeadlines headlines={data.headlines} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Picks a single banner under the score card based on what extra context
// the game has. Soccer ties use aggregate (UCL/UEL knockouts); US-style
// playoff series stay on best-of-N. Skips entirely when neither applies.
const _SOCCER_LEAGUES = new Set(['MLS', 'EPL', 'LaLiga', 'Bundesliga', 'SerieA', 'UCL']);
function DetailContextBanner({ data }) {
  const isSoccer = _SOCCER_LEAGUES.has(data?.league);
  // Aggregate first for soccer — even when ESPN also returns a series
  // payload, "best of 1" / "best of 2" doesn't fit two-leg ties.
  if (isSoccer && data.aggregate) {
    const a = Number(data.aggregate.away);
    const h = Number(data.aggregate.home);
    let label = 'Aggregate';
    let value = `${data.away.code || 'A'} ${a} – ${h} ${data.home.code || 'H'}`;
    if (Number.isFinite(a) && Number.isFinite(h)) {
      if (a === h) {
        label = 'Aggregate · level';
      } else {
        const leader = a > h ? data.away : data.home;
        const top = Math.max(a, h);
        const bot = Math.min(a, h);
        label = `${leader.name || leader.code || 'Team'} lead aggregate`;
        value = `${top}–${bot}`;
      }
    }
    return (
      <div style={{
        marginTop: 10, padding: '10px 14px',
        border: '0.5px solid var(--cn-accent)',
        borderRadius: 10,
        background: 'color-mix(in srgb, var(--cn-accent) 8%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
        fontFamily: 'var(--cn-font-mono)', fontSize: 11,
        color: 'var(--cn-accent)', letterSpacing: 0.6, textTransform: 'uppercase',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ color: 'var(--cn-text)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
    );
  }
  // Non-soccer playoffs — best-of-N series with a running tally. Only
  // surface the banner when the game is actually postseason; regular
  // season series rows (e.g. "Game 2 of MLB Mets-Phillies series") are
  // not playoffs and shouldn't read "Playoff series".
  const isPostseason = Number(data?.season_type) === 3;
  if (isPostseason && data.series && (data.series.summary || data.series.bestOf)) {
    // Compose a "BOS leads series 3-2" line from homeWins/awayWins +
    // team codes when ESPN's raw summary is empty. Falls back to the
    // raw summary string when one is provided.
    const hw = Number(data.series.homeWins);
    const aw = Number(data.series.awayWins);
    const homeCode = (data.home?.code || '').toUpperCase();
    const awayCode = (data.away?.code || '').toUpperCase();
    let standing = data.series.summary || '';
    if (!standing && Number.isFinite(hw) && Number.isFinite(aw) && (hw + aw) > 0) {
      const winsToClinch = data.series.bestOf ? Math.ceil(data.series.bestOf / 2) : Infinity;
      if (hw >= winsToClinch) {
        standing = `${homeCode || 'Home'} wins series ${hw}-${aw}`;
      } else if (aw >= winsToClinch) {
        standing = `${awayCode || 'Away'} wins series ${aw}-${hw}`;
      } else if (hw > aw) {
        standing = `${homeCode || 'Home'} leads series ${hw}-${aw}`;
      } else if (aw > hw) {
        standing = `${awayCode || 'Away'} leads series ${aw}-${hw}`;
      } else {
        standing = `Tied ${hw}-${aw}`;
      }
    }
    return (
      <div style={{
        marginTop: 10, padding: '10px 14px',
        border: '0.5px solid var(--cn-accent)',
        borderRadius: 10,
        background: 'color-mix(in srgb, var(--cn-accent) 8%, transparent)',
        fontFamily: 'var(--cn-font-mono)', fontSize: 11,
        color: 'var(--cn-accent)', letterSpacing: 0.6, textTransform: 'uppercase',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      }}>
        <span>Playoff series</span>
        <span style={{ color: 'var(--cn-text)', fontWeight: 800 }}>
          {standing}
          {standing && data.series.bestOf ? ' · ' : ''}
          {data.series.bestOf ? `best of ${data.series.bestOf}` : ''}
        </span>
      </div>
    );
  }
  return null;
}

function scheduleBtnStyle() {
  return {
    padding: '7px 14px', borderRadius: 999,
    background: 'var(--cn-bg-elev)',
    border: '0.5px solid var(--cn-border-s)',
    color: 'var(--cn-text-dim)',
    fontSize: 12, fontWeight: 600, fontFamily: 'var(--cn-font-body)',
    cursor: 'pointer',
  };
}

function Empty({ children, danger }) {
  return (
    <div style={{
      padding: 32, textAlign: 'center',
      color: danger ? 'var(--cn-danger)' : 'var(--cn-text-mute)',
      fontFamily: 'var(--cn-font-mono)', fontSize: 12,
    }}>{children}</div>
  );
}

function DetailHeader({ data }) {
  const isLive = data.state === 'live';
  const isFinal = data.state === 'final';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      {isLive && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cn-live)', animation: 'cn-pulse 1.5s ease-in-out infinite' }} />}
      <span style={{
        fontFamily: 'var(--cn-font-mono)', fontSize: 11, letterSpacing: 0.7,
        color: isLive ? 'var(--cn-live)' : 'var(--cn-text-mute)', fontWeight: 800,
      }}>
        {isLive ? `LIVE · ${data.period}` : isFinal ? `FINAL · ${data.period}` : (data.period || 'SCHEDULED')}
      </span>
      {data.venue && <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>· {data.venue}</span>}
    </div>
  );
}

function DetailScoreCard({ data }) {
  const isFinal = data.state === 'final';
  const winnerSide = isFinal
    ? (Number(data.home.score) > Number(data.away.score) ? 'home' :
       Number(data.away.score) > Number(data.home.score) ? 'away' : null)
    : null;
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg-elev)',
    }}>
      <DetailTeamRow team={data.away} score={data.away.score} winner={winnerSide === 'away'} />
      <div style={{ borderTop: '0.5px solid var(--cn-border)' }} />
      <DetailTeamRow team={data.home} score={data.home.score} winner={winnerSide === 'home'} />
    </div>
  );
}

function DetailTeamRow({ team, score, winner }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
      {team.logo ? (
        <img src={team.logo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: team.primary, color: pickContrast(team.primary),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, flexShrink: 0,
        }}>{team.code}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: winner ? 700 : 600 }}>{team.name}</div>
        {team.record && <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)', marginTop: 2 }}>{team.record}</div>}
      </div>
      <div style={{
        fontFamily: 'var(--cn-font-display)',
        fontSize: 38,
        fontWeight: 'var(--cn-display-weight)',
        letterSpacing: 'var(--cn-display-spacing)',
        opacity: winner === false ? 0.5 : 1,
        fontVariantNumeric: 'tabular-nums',
      }}>{score}</div>
    </div>
  );
}

// Toggle-able stats card. "Team" shows the side-by-side team table that
// already existed; "Player" pivots to per-player boxscore rows pulled from
// ESPN's summary.players block. Picked tab is darker; the other is muted.
function DetailStatsBlock({ home, away }) {
  const teamHasStats = !!((home.stats?.length || 0) + (away.stats?.length || 0));
  const playerHasStats = !!((home.players?.length || 0) + (away.players?.length || 0));
  const initial = teamHasStats ? 'team' : (playerHasStats ? 'player' : null);
  const [tab, setTab] = React.useState(initial);

  if (!teamHasStats && !playerHasStats) return null;

  const segBtn = (id, label, disabled) => {
    const active = tab === id;
    return (
      <button
        key={id}
        onClick={() => !disabled && setTab(id)}
        disabled={disabled}
        style={{
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--cn-font-mono)', fontSize: 10,
          letterSpacing: 1, textTransform: 'uppercase',
          color: disabled ? 'var(--cn-text-mute)' : (active ? 'var(--cn-text)' : 'var(--cn-text-dim)'),
          fontWeight: active ? 800 : 600,
          opacity: disabled ? 0.4 : 1,
        }}
      >{label}</button>
    );
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        {segBtn('team',   'Team stats',   !teamHasStats)}
        {segBtn('player', 'Player stats', !playerHasStats)}
      </div>
      {tab === 'team'
        ? <DetailStatsTable home={home} away={away} hideHeading />
        : <DetailPlayerTable home={home} away={away} />}
    </div>
  );
}

// Per-team boxscore. Shows ONE team at a time with a small toggle at the
// top so column widths have room. Selected team gets the dark/strong
// styling; the other is muted.
function DetailPlayerTable({ home, away }) {
  const sides = [
    { key: 'away', team: away, cats: away.players || [] },
    { key: 'home', team: home, cats: home.players || [] },
  ].filter(s => s.cats.length);

  if (!sides.length) {
    return (
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        border: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev)',
        fontFamily: 'var(--cn-font-mono)', fontSize: 11,
        color: 'var(--cn-text-mute)',
      }}>
        Per-player stats aren't available for this game yet.
      </div>
    );
  }

  const [pick, setPick] = React.useState(sides[0].key);
  React.useEffect(() => {
    // If the selected side disappears (e.g., away has no boxscore), fall
    // back to whatever's available.
    if (!sides.some(s => s.key === pick)) setPick(sides[0].key);
  }, [sides.length, pick]);

  const active = sides.find(s => s.key === pick) || sides[0];

  return (
    <div>
      {/* Team toggle: same vibe as the Team / Player segmented control. */}
      <div style={{
        display: 'flex', gap: 4, padding: 3,
        background: 'var(--cn-bg-elev)',
        border: '0.5px solid var(--cn-border)',
        borderRadius: 10, marginBottom: 10,
        width: 'fit-content',
      }}>
        {sides.map(s => {
          const sel = s.key === pick;
          return (
            <button key={s.key} onClick={() => setPick(s.key)} style={{
              padding: '6px 14px', borderRadius: 8,
              background: sel ? 'var(--cn-text)' : 'transparent',
              color:      sel ? 'var(--cn-bg)'   : 'var(--cn-text-dim)',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--cn-font-body)',
              fontSize: 12, fontWeight: sel ? 700 : 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 4,
                background: s.team.primary, color: pickContrast(s.team.primary),
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
              }}>{s.team.code}</span>
              {s.team.name}
            </button>
          );
        })}
      </div>

      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev)',
      }}>
        {active.cats.map((cat, i) => <PlayerCategory key={i} cat={cat} />)}
      </div>
    </div>
  );
}

function PlayerCategory({ cat }) {
  const labels = (cat.labels && cat.labels.length ? cat.labels : cat.keys) || [];
  const COLS_MAX = 8;
  const cols = labels.slice(0, COLS_MAX);
  // First column flexes to fit names; each stat gets a fixed track wide
  // enough for short ESPN labels like "FG", "3PT", "+/-", "MIN".
  const grid = `minmax(140px, 1.6fr) repeat(${cols.length}, minmax(46px, 1fr))`;
  const showCatLabel = cat.label && cat.label.toLowerCase() !== 'starters';
  return (
    <div style={{ borderTop: '0.5px solid var(--cn-border)' }}>
      {showCatLabel && (
        <div style={{
          padding: '6px 14px', background: 'var(--cn-bg)',
          fontFamily: 'var(--cn-font-mono)', fontSize: 10,
          letterSpacing: 1, textTransform: 'uppercase',
          color: 'var(--cn-text-mute)',
        }}>{cat.label}</div>
      )}
      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: grid,
        padding: '8px 14px',
        background: 'var(--cn-bg-elev2)',
        fontFamily: 'var(--cn-font-mono)', fontSize: 10, letterSpacing: 0.5,
        color: 'var(--cn-text-mute)', textTransform: 'uppercase',
        gap: 8,
      }}>
        <span>Player</span>
        {cols.map((c, i) => <span key={i} style={{ textAlign: 'right' }}>{c}</span>)}
      </div>
      {(cat.athletes || []).map((a, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: grid,
          padding: '8px 14px',
          borderTop: '0.5px solid var(--cn-border)',
          alignItems: 'center', gap: 8,
          fontSize: 13,
          background: a.starter ? 'var(--cn-bg-elev)' : 'transparent',
        }}>
          <span style={{
            display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
            {a.position && (
              <span style={{
                fontFamily: 'var(--cn-font-mono)', fontSize: 9,
                color: 'var(--cn-text-mute)', flexShrink: 0,
              }}>{a.position}</span>
            )}
          </span>
          {cols.map((_, j) => (
            <span key={j} style={{
              textAlign: 'right',
              fontFamily: 'var(--cn-font-mono)',
              fontVariantNumeric: 'tabular-nums',
              color: a.didNotPlay ? 'var(--cn-text-mute)' : 'var(--cn-text)',
            }}>{(a.stats?.[j] ?? '') || (a.didNotPlay ? '—' : '')}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function DetailStatsTable({ home, away, hideHeading }) {
  // Match labels by intersecting both teams' stat lists.
  const homeMap = Object.fromEntries(home.stats || []);
  const awayMap = Object.fromEntries(away.stats || []);
  const labels = Array.from(new Set([...Object.keys(homeMap), ...Object.keys(awayMap)]));
  if (!labels.length) return null;
  return (
    <div>
      {!hideHeading && <SectionHeading>Team stats</SectionHeading>}
      <div style={{ borderRadius: 12, border: '0.5px solid var(--cn-border)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 90px 90px',
          padding: '8px 14px', background: 'var(--cn-bg-elev2)',
          fontFamily: 'var(--cn-font-mono)', fontSize: 10, letterSpacing: 0.7, color: 'var(--cn-text-mute)',
          textTransform: 'uppercase',
        }}>
          <span></span>
          <span style={{ textAlign: 'right' }}>{away.code}</span>
          <span style={{ textAlign: 'right' }}>{home.code}</span>
        </div>
        {labels.map((label, i) => (
          <div key={label} style={{
            display: 'grid', gridTemplateColumns: '1fr 90px 90px',
            padding: '8px 14px', borderTop: i ? '0.5px solid var(--cn-border)' : 'none',
            fontSize: 13, alignItems: 'center',
            background: 'var(--cn-bg-elev)',
          }}>
            <span style={{ color: 'var(--cn-text-dim)' }}>{label}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--cn-font-mono)', fontVariantNumeric: 'tabular-nums' }}>{awayMap[label] ?? '—'}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--cn-font-mono)', fontVariantNumeric: 'tabular-nums' }}>{homeMap[label] ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailLeaders({ leaders, home, away }) {
  if (!leaders || !leaders.length) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <SectionHeading>Leaders</SectionHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {leaders.map((l, i) => {
          const team = l.side === 'home' ? home : away;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--cn-bg-elev)',
              border: '0.5px solid var(--cn-border)',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 4,
                background: team.primary, color: pickContrast(team.primary),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, flexShrink: 0,
              }}>{team.code}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</div>
                <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>{l.category}</div>
              </div>
              <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {l.stat}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailHeadlines({ headlines }) {
  return (
    <div style={{ marginTop: 22 }}>
      <SectionHeading>Headlines</SectionHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {headlines.map((h, i) => (
          <div key={i} style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--cn-bg-elev)',
            border: '0.5px solid var(--cn-border)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{h.title}</div>
            {h.description && <div style={{ fontSize: 12, color: 'var(--cn-text-dim)', marginTop: 4, lineHeight: 1.45 }}>{h.description}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--cn-font-mono)', fontSize: 10,
      color: 'var(--cn-text-mute)', letterSpacing: 1,
      textTransform: 'uppercase', marginBottom: 8,
    }}>{children}</div>
  );
}

// ─── TEAM SCHEDULE ──────────────────────────────────────────────
// Full season schedule for one team. Reachable from the GameDetail "schedule"
// buttons. The selected team is held in screen state (`scheduleTeam`); a
// season dropdown picks current vs previous years.
function TeamScheduleScreen({ tweaks, onNav, scheduleTeam, onOpenGame }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [season, setSeason] = React.useState(null);    // null = current

  const league = scheduleTeam?.league;
  const teamId = scheduleTeam?.teamId;

  React.useEffect(() => {
    if (!league || !teamId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setErr(null);
    window.API.teamSchedule(league, teamId, season || undefined)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setErr(e.message || 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [league, teamId, season]);

  // Use the seed info from the click (logo/primary/name) until the API
  // payload arrives.
  const team = data?.team || {
    id: teamId, name: scheduleTeam?.name, abbreviation: scheduleTeam?.code,
    logo: scheduleTeam?.logo, primary: scheduleTeam?.primary,
  };

  const seasons = (data?.seasons || []).slice().sort((a, b) => (b.year || 0) - (a.year || 0));
  const seasonValue = season || data?.season || '';

  const games = data?.games || [];

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('back')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 14 }}>
          SCHEDULE
        </span>
        <span style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            {team.logo ? (
              <img src={team.logo} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            ) : (
              <div style={{
                width: 44, height: 44, borderRadius: 8,
                background: team.primary || '#666', color: pickContrast(team.primary || '#666'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800,
              }}>{team.abbreviation || team.code || '??'}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{team.name || '—'}</div>
              {team.record && <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)', marginTop: 2 }}>{team.record}</div>}
            </div>
            {seasons.length > 0 && (
              <select
                value={seasonValue}
                onChange={(e) => setSeason(Number(e.target.value) || null)}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  background: 'var(--cn-bg-elev)', color: 'var(--cn-text)',
                  border: '0.5px solid var(--cn-border-s)',
                  fontFamily: 'var(--cn-font-mono)', fontSize: 12,
                }}
              >
                {seasons.map(s => (
                  <option key={s.year} value={s.year}>{s.displayName || s.year}</option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <Empty>Loading schedule…</Empty>
          ) : err ? (
            <Empty danger>{err}</Empty>
          ) : games.length === 0 ? (
            <Empty>No games for this season yet.</Empty>
          ) : (
            <ScheduleSections games={games} onOpenGame={onOpenGame} />
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleRow({ g, first, onClick, showRound }) {
  const opp = g.isHome ? g.awayTeam : g.homeTeam;
  const oppName = opp?.name || (g.isHome ? g.away : g.home) || '—';
  const date = g.date ? new Date(g.date) : null;
  const dateLabel = date && !isNaN(date)
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const isFinal = g.state === 'final';
  const isLive = g.state === 'live';
  const round = showRound && g.round ? g.round : '';
  const resultColor = g.result === 'W' ? 'var(--cn-success)'
                    : g.result === 'L' ? 'var(--cn-danger)'
                    : 'var(--cn-text-mute)';
  // Render '–' for missing/null scores — happens for scheduled games and
  // any final ESPN didn't ship a numeric score for.
  const fmt = (v) => (Number.isFinite(Number(v)) ? Number(v) : '–');
  const myScore  = g.isHome ? fmt(g.homeScore) : fmt(g.awayScore);
  const oppScore = g.isHome ? fmt(g.awayScore) : fmt(g.homeScore);
  const scoreText = `${myScore}–${oppScore}`;
  const hasScores = myScore !== '–' || oppScore !== '–';
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderTop: first ? 'none' : '0.5px solid var(--cn-border)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{
        width: 44, fontFamily: 'var(--cn-font-mono)', fontSize: 11,
        color: 'var(--cn-text-mute)', flexShrink: 0,
      }}>{dateLabel}</div>
      <TeamLogo team={opp} size={22} radius={5} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {g.isHome ? 'vs ' : '@ '}{oppName}
        </div>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isLive ? 'LIVE' : (isFinal ? 'FINAL' : (g.period || 'Scheduled'))}
          {round && <span style={{ color: 'var(--cn-accent)' }}> · {round}</span>}
        </div>
      </div>
      {isFinal ? (
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--cn-font-mono)', fontSize: 11, fontWeight: 800,
            color: resultColor, letterSpacing: 0.5,
          }}>{g.result || '—'}</div>
          {hasScores && (
            <div style={{
              fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
              fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--cn-text-dim)',
            }}>{scoreText}</div>
          )}
        </div>
      ) : isLive && hasScores ? (
        <div style={{ fontFamily: 'var(--cn-font-display)', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
          {scoreText}
        </div>
      ) : null}
    </div>
  );
}

// Splits a flat schedule into Preseason / Regular Season / Playoffs (and
// any leftover bucket ESPN sometimes ships, like "All-Star"). Each
// section renders its own card; playoff rows surface the round label
// (Wild Card, Sweet 16, Cotton Bowl, etc.) under the matchup line.
const _SEASON_TYPE_LABELS = {
  1: 'Preseason',
  2: 'Regular Season',
  3: 'Playoffs',
  4: 'Off-season',
};
function ScheduleSections({ games, onOpenGame }) {
  // Group preserving original order. Anything without a season_type or
  // with an unknown id falls into "Other" so we don't drop games.
  const groups = React.useMemo(() => {
    const map = new Map();
    const order = [];
    for (const g of games) {
      const id = Number(g.season_type) || 0;
      const key = _SEASON_TYPE_LABELS[id]
        || g.season_type_name
        || (id === 0 ? 'Schedule' : `Season type ${id}`);
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key).push(g);
    }
    // Show in chronological-life order: Preseason → Regular Season →
    // Playoffs → Other. Sort the keys we know; preserve unknown order.
    const known = ['Preseason', 'Regular Season', 'Playoffs', 'Off-season'];
    const sorted = [
      ...known.filter(k => map.has(k)),
      ...order.filter(k => !known.includes(k)),
    ];
    return sorted.map(label => ({ label, items: map.get(label) }));
  }, [games]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(g => (
        <div key={g.label}>
          <div style={{
            padding: '0 4px 6px',
            fontFamily: 'var(--cn-font-mono)', fontSize: 10, letterSpacing: 1,
            color: 'var(--cn-text-mute)', fontWeight: 800, textTransform: 'uppercase',
          }}>{g.label}</div>
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            border: '0.5px solid var(--cn-border)',
            background: 'var(--cn-bg-elev)',
          }}>
            {g.items.map((row, i) => (
              <ScheduleRow
                key={row.id || i}
                g={row}
                first={i === 0}
                showRound={g.label === 'Playoffs' || !!row.round}
                onClick={() => onOpenGame?.(row)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { GameDetailScreen, TeamScheduleScreen });
