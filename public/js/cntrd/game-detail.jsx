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

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('home')}>
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
              <DetailStatsTable home={data.home} away={data.away} />
              <DetailLeaders leaders={data.leaders} home={data.home} away={data.away} />
              {(data.headlines || []).length > 0 && <DetailHeadlines headlines={data.headlines} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
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

function DetailStatsTable({ home, away }) {
  // Match labels by intersecting both teams' stat lists.
  const homeMap = Object.fromEntries(home.stats || []);
  const awayMap = Object.fromEntries(away.stats || []);
  const labels = Array.from(new Set([...Object.keys(homeMap), ...Object.keys(awayMap)]));
  if (!labels.length) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <SectionHeading>Team stats</SectionHeading>
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

Object.assign(window, { GameDetailScreen });
