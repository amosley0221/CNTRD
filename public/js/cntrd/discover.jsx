// discover.jsx — search + trending hub.
// Tapping the magnifying glass anywhere in the app lands here. Empty
// query renders trending tags + live games; typing 2+ chars debounces a
// /search request and groups results into "People" + "Posts".

function DiscoverScreen({ tweaks, onNav, me, onOpenGame, discoverQuery }) {
  // Honor an initial query when navigating in from the rail search bar.
  // Only seeded once on mount — typing is local from there on.
  const [q, setQ] = React.useState(discoverQuery || '');
  React.useEffect(() => {
    if (discoverQuery && discoverQuery !== q) setQ(discoverQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoverQuery]);
  const [trending, setTrending] = React.useState(null);  // null = loading
  const [results, setResults] = React.useState(null);    // null = idle / loading
  const [searching, setSearching] = React.useState(false);
  const [err, setErr] = React.useState(null);

  // Load trending on mount + every 60s while idle so the list reflects
  // recent posts (24h window) without requiring a full reload.
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await window.API.trending();
        if (!cancelled) setTrending(data?.trending || []);
      } catch {
        if (!cancelled) setTrending([]);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Debounced search: wait 250ms after the last keystroke before hitting
  // the API so we don't fire a request per character.
  React.useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults(null); setErr(null); return; }
    let cancelled = false;
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const data = await window.API.search(trimmed);
        if (!cancelled) {
          setResults(data || { users: [], posts: [] });
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) { setErr(e.message || 'Search failed'); setResults({ users: [], posts: [] }); }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [q]);

  const showingResults = q.trim().length >= 2;

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('home')} title="Back">
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <div style={{
          flex: 1,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--cn-bg-elev)',
          border: '0.5px solid var(--cn-border-s)',
          borderRadius: 999,
          padding: '8px 14px',
        }}>
          <Icon name="search" size={16} stroke="var(--cn-text-mute)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Search users, posts, teams…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--cn-text)', fontSize: 14, fontFamily: 'var(--cn-font-body)',
            }}
          />
          {q && (
            <button
              onClick={() => setQ('')}
              title="Clear"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--cn-text-mute)', display: 'flex', padding: 0,
              }}
            >
              <Icon name="x" size={14} sw={2} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>
        {showingResults
          ? <SearchResults q={q} results={results} loading={searching} err={err} onOpenGame={onOpenGame} />
          : <Trending items={trending} onOpenGame={onOpenGame} />}
      </div>
      <BottomNav active={null} onChange={onNav} />
    </div>
  );
}

function Trending({ items, onOpenGame }) {
  if (items === null) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-mute)' }}>
        Loading trending…
      </div>
    );
  }
  if (!items.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 22, marginBottom: 8,
        }}>Nothing trending at the moment</div>
        <div style={{ fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.5, fontFamily: 'var(--cn-font-body)' }}>
          When fans start posting and games kick off, we'll surface what people are talking about here.
        </div>
      </div>
    );
  }
  return (
    <div>
      <SectionLabel>TRENDING</SectionLabel>
      {items.map((item, i) => <TrendingRow key={i} item={item} rank={i + 1} onOpenGame={onOpenGame} />)}
    </div>
  );
}

function TrendingRow({ item, rank, onOpenGame }) {
  const onClick = () => {
    if (item.kind === 'tag') {
      window.dispatchEvent(new CustomEvent('cntrd:open-tag', { detail: item.tag }));
      return;
    }
    if (item.kind === 'game') {
      onOpenGame?.({ id: item.game_id, league: item.league });
    }
  };
  const isLive = item.kind === 'game';
  return (
    <button onClick={onClick} style={{
      width: '100%',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--cn-border)',
      background: 'transparent', border: 'none',
      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
      color: 'inherit', textAlign: 'left',
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      <span style={{
        fontFamily: 'var(--cn-font-mono)', fontSize: 11,
        color: 'var(--cn-text-mute)', minWidth: 18,
      }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 14, fontWeight: 700,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {isLive && (
            <span style={{
              padding: '1px 6px', borderRadius: 4,
              background: 'var(--cn-live)', color: '#fff',
              fontFamily: 'var(--cn-font-mono)', fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
            }}>LIVE</span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
        </div>
        <div style={{
          fontFamily: 'var(--cn-font-mono)', fontSize: 11,
          color: 'var(--cn-text-mute)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.sublabel}
          {item.score && ` · ${item.score}`}
        </div>
      </div>
      <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
    </button>
  );
}

function SearchResults({ q, results, loading, err, onOpenGame }) {
  if (loading && !results) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-mute)' }}>
        Searching…
      </div>
    );
  }
  if (err) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-danger)' }}>
        {err}
      </div>
    );
  }
  if (!results) return null;
  const empty = !results.users.length && !results.posts.length;
  if (empty) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 20, marginBottom: 6,
        }}>No matches for "{q}"</div>
        <div style={{ fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.5 }}>
          Try a different name, post keyword, or team.
        </div>
      </div>
    );
  }
  return (
    <div>
      {results.users.length > 0 && (
        <>
          <SectionLabel>PEOPLE</SectionLabel>
          {results.users.map(u => <UserRow key={u.id} user={u} />)}
        </>
      )}
      {results.posts.length > 0 && (
        <>
          <SectionLabel>POSTS</SectionLabel>
          {results.posts.map(p => <Post key={p.id} post={window.normalizePost(p)} />)}
        </>
      )}
    </div>
  );
}

function UserRow({ user }) {
  const open = () => {
    window.dispatchEvent(new CustomEvent('cntrd:open-user', { detail: { username: user.username } }));
  };
  return (
    <button onClick={open} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--cn-border)',
      background: 'transparent', border: 'none',
      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
      color: 'inherit', textAlign: 'left', cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      <Avatar user={user} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.displayName}
        </div>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
          @{user.username}
        </div>
      </div>
      <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      padding: '14px 16px 6px',
      fontFamily: 'var(--cn-font-mono)', fontSize: 10, letterSpacing: 1,
      color: 'var(--cn-text-mute)', fontWeight: 800,
    }}>{children}</div>
  );
}

Object.assign(window, { DiscoverScreen });
