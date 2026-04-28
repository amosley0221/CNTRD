// desktop.jsx — desktop web app for CNTRD
// Three-column layout: left nav, center feed, right rail (gameday + trends)

function DesktopApp({ tweaks, setTweak, onNav, me, posts, plays, games }) {
  const [query, setQuery] = React.useState('');
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--cn-bg)',
      color: 'var(--cn-text)',
      fontFamily: 'var(--cn-font-body)',
      display: 'grid',
      gridTemplateColumns: '232px 1fr 360px',
      overflow: 'hidden',
    }}>
      <DesktopNav onNav={onNav} me={me} />
      <DesktopMain tweaks={tweaks} onNav={onNav} posts={posts} plays={plays} query={query} />
      <DesktopRail tweaks={tweaks} onNav={onNav} games={games} query={query} setQuery={setQuery} />
    </div>
  );
}

function DesktopNav({ onNav, me }) {
  const meUser = me || ME;
  // Each item routes via onNav to a real screen. `screen` is the screen-key
  // app.jsx uses; multiple labels can share a screen (e.g. Discover/Feed).
  const items = [
    { screen: 'home',         icon: 'home',     label: 'Feed' },
    { screen: 'home',         icon: 'search',   label: 'Discover',     key: 'discover' },
    { screen: 'chat',         icon: 'whistle',  label: 'Gameday',      badge: 'LIVE' },
    { screen: 'playsCreator', icon: 'video',    label: 'Plays' },
    { screen: 'profile',      icon: 'profile',  label: 'You' },
    { screen: 'settings',     icon: 'settings', label: 'Settings' },
    ...(meUser?.is_admin ? [{ screen: 'admin', icon: 'whistle', label: 'Admin', accent: true }] : []),
  ];
  // Active highlight is based on the screen the app is currently on.
  // Falls back via the global STORAGE.screen because app.jsx already persists it.
  let currentScreen = 'home';
  try { currentScreen = localStorage.getItem('cntrd:screen') || 'home'; } catch {}

  return (
    <nav style={{
      borderRight: '0.5px solid var(--cn-border)',
      padding: '20px 14px',
      display: 'flex', flexDirection: 'column',
      background: 'var(--cn-bg)',
    }}>
      <div style={{
        fontFamily: 'var(--cn-font-display)',
        fontWeight: 800, fontSize: 28,
        letterSpacing: '-0.03em', textTransform: 'uppercase',
        padding: '0 8px 24px',
      }}>CNTRD</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(it => {
          const active = !it.accent && currentScreen === it.screen && !it.key;
          return (
            <button key={it.key || it.screen} onClick={() => onNav?.(it.screen)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10,
              background: active ? 'var(--cn-bg-elev)' : 'transparent',
              border: 'none', cursor: 'pointer',
              color: it.accent ? 'var(--cn-accent)' : (active ? 'var(--cn-text)' : 'var(--cn-text-dim)'),
              fontSize: 14, fontWeight: active || it.accent ? 600 : 500,
              textAlign: 'left',
              fontFamily: 'var(--cn-font-body)',
            }}>
              <Icon name={it.icon} size={18} sw={1.7} />
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  fontFamily: 'var(--cn-font-mono)',
                  fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                  background: 'var(--cn-live)', color: '#fff',
                  padding: '2px 5px', borderRadius: 3,
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <button onClick={() => onNav?.('compose')} style={{
        margin: '20px 4px 24px',
        padding: '11px 14px', borderRadius: 10,
        background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
        border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: 14,
        fontFamily: 'var(--cn-font-body)',
      }}>+ New post</button>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderTop: '0.5px solid var(--cn-border)' }}>
        <Avatar user={meUser} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{meUser.displayName}</div>
          <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>@{meUser.username}</div>
        </div>
        <button onClick={() => onNav?.('logout')} title="Sign out" style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--cn-text-mute)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="logout" size={16} />
        </button>
      </div>
    </nav>
  );
}

function DesktopMain({ tweaks, onNav, posts, plays, query }) {
  const allItems = (posts && posts.length ? posts : POSTS);
  const playList = (plays && plays.length ? plays : PLAYS);
  const q = (query || '').trim().toLowerCase();
  const items = q
    ? allItems.filter(p => {
        const text = (p.text || p.content || '').toLowerCase();
        const user = (p.user?.username || (typeof p.user === 'string' ? p.user : '')).toLowerCase();
        const name = (p.user?.displayName || '').toLowerCase();
        const tags = (p.tags || []).join(' ').toLowerCase();
        return text.includes(q) || user.includes(q) || name.includes(q) || tags.includes(q);
      })
    : allItems;
  return (
    <main style={{ overflowY: 'auto', borderRight: '0.5px solid var(--cn-border)' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        padding: '14px 28px',
        background: 'color-mix(in srgb, var(--cn-bg) 80%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid var(--cn-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--cn-font-display)',
          fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)',
          letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 18,
        }}>{q ? `RESULTS · "${query}"` : 'YOUR FEED'}</span>
        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 8, background: 'var(--cn-bg-elev)' }}>
          {['For you', 'Following', 'Live'].map((t, i) => (
            <button key={t} style={{
              padding: '5px 12px', borderRadius: 6,
              background: i === 0 ? 'var(--cn-bg)' : 'transparent',
              color: i === 0 ? 'var(--cn-text)' : 'var(--cn-text-mute)',
              border: 'none', fontWeight: 600, fontSize: 12,
              cursor: 'pointer', fontFamily: 'var(--cn-font-body)',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Plays rail at top */}
      <div style={{ padding: '18px 28px', borderBottom: '0.5px solid var(--cn-border)' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 13 }}>{(tweaks.playsLabel || 'PLAYS').toUpperCase()}</span>
          <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>From people you follow →</span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <PlayBubble add onClick={() => onNav?.('playsCreator')} />
          {playList.map(p => <PlayBubble key={p.id} play={p} onClick={() => onNav?.('plays')} />)}
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 620 }}>
        {items.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>
            {q ? `No posts match "${query}".` : 'Nothing in your feed yet — follow people, or post something.'}
          </div>
        )}
        {items.map(p => <Post key={p.id} post={p} />)}
      </div>
    </main>
  );
}

function DesktopRail({ tweaks, onNav, games, query, setQuery }) {
  const live = games?.live || [];
  const upcoming = games?.upcoming || [];
  const recent = games?.recent || [];
  const featured = live[0] || upcoming[0] || null;
  const featuredIsLive = featured && live.length > 0;
  const otherLive = live.slice(1);
  const teamFor = (g, side) => g[side + 'Team'] || TEAMS[g[side]] || { code: g[side], name: g[side], primary: '#666', accent: '#999' };
  return (
    <aside style={{ overflowY: 'auto', padding: '20px 22px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Search */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', borderRadius: 10,
        background: 'var(--cn-bg-elev)',
        border: '0.5px solid var(--cn-border)',
      }}>
        <Icon name="search" size={16} stroke="var(--cn-text-mute)" />
        <input
          value={query || ''}
          onChange={e => setQuery?.(e.target.value)}
          placeholder="Search posts, users, teams"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--cn-text)', fontSize: 13,
            fontFamily: 'var(--cn-font-body)',
          }}
        />
        {query && (
          <button onClick={() => setQuery?.('')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--cn-text-mute)', padding: 0, display: 'flex',
          }}>
            <Icon name="x" size={14} />
          </button>
        )}
      </label>

      {/* Featured (live > upcoming) */}
      {featured ? (
        <div style={{
          borderRadius: 14, overflow: 'hidden',
          border: '0.5px solid var(--cn-border)',
          background: 'var(--cn-bg-elev)',
        }}>
          <div style={{
            padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--cn-bg-elev2)',
            borderBottom: '0.5px solid var(--cn-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: featuredIsLive ? 'var(--cn-live)' : 'var(--cn-text-mute)', animation: featuredIsLive ? 'cn-pulse 1.5s ease-in-out infinite' : 'none' }} />
              <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: featuredIsLive ? 'var(--cn-live)' : 'var(--cn-text-mute)', fontWeight: 800, letterSpacing: 0.7 }}>
                {featuredIsLive ? 'GAMEDAY · LIVE' : 'NEXT UP'}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>{featured.period}{featured.clock ? ' ' + featured.clock : ''}</span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <ScoreRow team={teamFor(featured, 'away')} score={featured.awayScore} winner={Number(featured.awayScore) > Number(featured.homeScore)} />
            <div style={{ height: 6 }} />
            <ScoreRow team={teamFor(featured, 'home')} score={featured.homeScore} winner={Number(featured.homeScore) > Number(featured.awayScore)} />
          </div>
          {featuredIsLive && (
            <div style={{ borderTop: '0.5px solid var(--cn-border)', padding: '10px 14px', background: 'var(--cn-bg-elev2)' }}>
              <button onClick={() => onNav?.('chat')} style={{
                width: '100%', padding: '7px', borderRadius: 8,
                background: 'var(--cn-text)', color: 'var(--cn-bg)',
                border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 12, fontFamily: 'var(--cn-font-body)',
              }}>Join the chat →</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '14px 16px', borderRadius: 14, border: '0.5px solid var(--cn-border)', background: 'var(--cn-bg-elev)', fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
          No live or upcoming games right now.
        </div>
      )}

      {/* Other live games */}
      {otherLive.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Also live</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {otherLive.map(g => (
              <div key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 10,
                background: 'var(--cn-bg-elev)',
                border: '0.5px solid var(--cn-border)',
              }}>
                <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, padding: '2px 5px', background: 'var(--cn-bg-elev2)', borderRadius: 3, color: 'var(--cn-text-mute)' }}>{g.league}</span>
                <CompactScoreRow team={teamFor(g, 'away')} score={g.awayScore} />
                <span style={{ color: 'var(--cn-text-mute)', fontSize: 10 }}>·</span>
                <CompactScoreRow team={teamFor(g, 'home')} score={g.homeScore} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent finals */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Recent finals</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.slice(0, 8).map(g => (
              <div key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 10,
                background: 'var(--cn-bg-elev)',
                border: '0.5px solid var(--cn-border)',
              }}>
                <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, padding: '2px 5px', background: 'var(--cn-bg-elev2)', borderRadius: 3, color: 'var(--cn-text-mute)' }}>{g.league}</span>
                <CompactScoreRow team={teamFor(g, 'away')} score={g.awayScore} />
                <span style={{ color: 'var(--cn-text-mute)', fontSize: 10 }}>·</span>
                <CompactScoreRow team={teamFor(g, 'home')} score={g.homeScore} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending tags */}
      <div>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Trending in your sports</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { tag: '#TatumMVP', cat: 'NBA · Trending', count: '24.1k' },
            { tag: '#LakersIn7', cat: 'NBA', count: '18.4k' },
            { tag: '#ImolaGP', cat: 'F1 · Tomorrow', count: '12.9k' },
            { tag: '#NorthLondonDerby', cat: 'EPL · Sunday', count: '9.2k' },
          ].map(t => (
            <div key={t.tag} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>
              <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>{t.cat}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{t.tag}</div>
              <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>{t.count} posts</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', lineHeight: 1.5, paddingTop: 8, borderTop: '0.5px solid var(--cn-border)' }}>
        CNTRD · 2026 · Where the game gets loud.<br />
        Terms · Privacy · About
      </div>
    </aside>
  );
}

Object.assign(window, { DesktopApp });
