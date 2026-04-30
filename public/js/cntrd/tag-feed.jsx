// tag-feed.jsx — feed of posts tagged with a single team.
// Reachable when the user clicks any TeamPill anywhere in the app.

function TagFeedScreen({ tweaks, onNav, selectedTag }) {
  const code = selectedTag;
  const team = code ? resolveTeam(code) : null;
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    if (!code) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setErr(null);
    API.postsByTag(code)
      .then(list => { if (!cancelled) { setPosts((list || []).map(normalizePost)); setLoading(false); } })
      .catch(e => { if (!cancelled) { setErr(e.message || 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [code]);

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
        <span style={{
          fontFamily: 'var(--cn-font-display)',
          fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)',
          letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 14,
        }}>{team ? team.name.toUpperCase() : 'TAG'}</span>
        <span style={{ width: 32 }} />
      </div>

      {/* Header strip in the team's primary color */}
      {team && (
        <div style={{
          padding: '14px 18px',
          background: team.primary,
          color: pickContrast(team.primary),
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: pickContrast(team.primary) === '#000' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
            border: `0.5px solid ${team.accent}55`,
          }}>{team.code}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--cn-font-display)',
              fontWeight: 'var(--cn-display-weight)',
              textTransform: 'var(--cn-display-case)',
              letterSpacing: 'var(--cn-display-spacing)',
              fontSize: 22, lineHeight: 1.05,
            }}>{team.name}</div>
            <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, opacity: 0.75 }}>
              {team.league || ''}{team.fullName && team.fullName !== team.name ? ' · ' + team.fullName : ''}
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Empty>Loading…</Empty>
        ) : err ? (
          <Empty danger>{err}</Empty>
        ) : posts.length === 0 ? (
          <Empty>No posts tagged {team ? team.name : code} yet. Be the first.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {posts.map(p => <Post key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </div>
  );

  function Empty({ children, danger }) {
    return (
      <div style={{
        padding: 32, textAlign: 'center',
        color: danger ? 'var(--cn-danger)' : 'var(--cn-text-mute)',
        fontFamily: 'var(--cn-font-mono)', fontSize: 12,
      }}>{children}</div>
    );
  }
}

Object.assign(window, { TagFeedScreen });
