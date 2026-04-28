// desktop.jsx — desktop web app for CNTRD
// Three-column layout: left nav, center feed, right rail (gameday + trends)

function DesktopApp({ tweaks, setTweak, onNav, me, posts, plays, games, screen, onOpenGame, unreadMessages, ...rest }) {
  const [query, setQuery] = React.useState('');
  const screenProps = { tweaks, setTweak, onNav, me, posts, plays, games, onOpenGame, unreadMessages, ...rest };
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
      <DesktopNav onNav={onNav} me={me} screen={screen} unreadMessages={unreadMessages} />
      <div style={{
        position: 'relative',          // anchors absolutely-positioned children
        overflow: 'hidden',
        borderRight: '0.5px solid var(--cn-border)',
      }}>
        <DesktopMainContent screen={screen} query={query} {...screenProps} />
      </div>
      <DesktopRail tweaks={tweaks} onNav={onNav} games={games} me={me} onOpenGame={onOpenGame} query={query} setQuery={setQuery} />
    </div>
  );
}

// User-team identifiers may be composite ("NFL:PHI") or legacy bare ("PHI").
// To check whether a game involves a favorite team, build a Set of the user's
// raw picks and try both league-prefixed forms — never just the bare code,
// which would over-match across leagues (Eagles + Flyers + Phillies = bug).
function favoriteSetFromMe(me) {
  return new Set(me?.teams || []);
}

function gameTouchesFavorite(game, favSet) {
  if (!favSet || !favSet.size) return false;
  const homeKey = `${game.league}:${game.home}`;
  const awayKey = `${game.league}:${game.away}`;
  if (favSet.has(homeKey) || favSet.has(awayKey)) return true;
  // Legacy bare-code support: only matches when the user actually saved a
  // bare code (no colon). Composite picks never silently match other leagues.
  if (favSet.has(game.home) && !String(game.home).includes(':')) {
    for (const f of favSet) if (!String(f).includes(':') && f === game.home) return true;
  }
  if (favSet.has(game.away) && !String(game.away).includes(':')) {
    for (const f of favSet) if (!String(f).includes(':') && f === game.away) return true;
  }
  return false;
}

// Move favorite-touching games to the top, keep relative order otherwise.
function favoriteFirst(games, favSet) {
  if (!favSet || !favSet.size) return games;
  const fav = [], rest = [];
  for (const g of games) {
    if (gameTouchesFavorite(g, favSet)) fav.push(g);
    else rest.push(g);
  }
  return [...fav, ...rest];
}

// Picks what fills the main column based on the current route.
function DesktopMainContent({ screen, ...props }) {
  if (screen === 'home' || !screen) return <DesktopFeed {...props} />;
  const map = {
    profile:      ProfileScreen,
    compose:      ComposerScreen,
    chat:         GamedayScreen,
    settings:     SettingsScreen,
    plays:        PlaysViewerScreen,
    playsCreator: PlaysCreatorScreen,
    admin:        AdminScreen,
    teams:        TeamsEditorScreen,
    leagues:      LeaguesEditorScreen,
    terms:        TermsScreen,
    privacy:      PrivacyScreen,
    about:        AboutScreen,
    gameDetail:   GameDetailScreen,
    tagFeed:      TagFeedScreen,
    messages:     MessagesRoot,
  };
  const Comp = map[screen] || DesktopFeed;
  return <Comp {...props} />;
}

function DesktopNav({ onNav, me, screen, unreadMessages }) {
  const meUser = me || ME;
  const items = [
    { screen: 'home',         icon: 'home',     label: 'Feed' },
    { screen: 'home',         icon: 'search',   label: 'Discover',     key: 'discover' },
    { screen: 'messages',     icon: 'chat',     label: 'Messages',     count: unreadMessages || 0 },
    { screen: 'chat',         icon: 'whistle',  label: 'Gameday',      badge: 'LIVE' },
    { screen: 'playsCreator', icon: 'video',    label: 'Plays' },
    { screen: 'profile',      icon: 'profile',  label: 'You' },
    { screen: 'settings',     icon: 'settings', label: 'Settings' },
    ...(meUser?.is_admin ? [{ screen: 'admin', icon: 'whistle', label: 'Admin', accent: true }] : []),
  ];
  const currentScreen = screen || 'home';

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
              {it.count > 0 && (
                <span style={{
                  fontFamily: 'var(--cn-font-mono)',
                  fontSize: 10, fontWeight: 800,
                  background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
                  padding: '1px 7px', borderRadius: 999, minWidth: 18,
                  textAlign: 'center',
                }}>{it.count > 99 ? '99+' : it.count}</span>
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

function DesktopFeed({ tweaks, onNav, posts, plays, query }) {
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

function DesktopRail({ tweaks, onNav, games, me, onOpenGame, query, setQuery }) {
  const favSet = React.useMemo(() => favoriteSetFromMe(me), [me]);
  const followed = React.useMemo(() => new Set(me?.leagues || []), [me]);

  // Show a game only if its league is followed, or one of its teams is a
  // favorite (league-aware match — Eagles ≠ Flyers).
  const includeGame = (g) => followed.has(g.league) || gameTouchesFavorite(g, favSet);

  const live     = favoriteFirst((games?.live     || []).filter(includeGame), favSet).slice(0, 3);
  const upcoming = favoriteFirst((games?.upcoming || []).filter(includeGame), favSet).slice(0, 5);
  const recent   = favoriteFirst((games?.recent   || []).filter(includeGame), favSet).slice(0, 8);
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

      {/* Live now */}
      {live.length > 0 && (
        <RailGameSection
          label="GAMEDAY · LIVE"
          live
          games={live}
          favSet={favSet}
          teamFor={teamFor}
          onOpenGame={onOpenGame}
          onJoin={() => onNav?.('chat')}
        />
      )}

      {/* Next up */}
      {upcoming.length > 0 && (
        <RailGameSection
          label="NEXT UP"
          games={upcoming.slice(0, 3)}
          favSet={favSet}
          teamFor={teamFor}
          onOpenGame={onOpenGame}
        />
      )}

      {/* Recent finals */}
      {recent.length > 0 && (
        <RailGameSection
          label="RECENT FINALS"
          games={recent}
          favSet={favSet}
          teamFor={teamFor}
          onOpenGame={onOpenGame}
          finals
        />
      )}

      {(live.length === 0 && upcoming.length === 0 && recent.length === 0) && (
        <div style={{ padding: '14px 16px', borderRadius: 14, border: '0.5px solid var(--cn-border)', background: 'var(--cn-bg-elev)', fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
          No games to show right now.
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

      <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', lineHeight: 1.6, paddingTop: 8, borderTop: '0.5px solid var(--cn-border)' }}>
        CNTRD · 2026 · Where the game gets loud.<br />
        <a onClick={() => onNav?.('terms')}   style={footerLinkStyle}>Terms</a>
        {' · '}
        <a onClick={() => onNav?.('privacy')} style={footerLinkStyle}>Privacy</a>
        {' · '}
        <a onClick={() => onNav?.('about')}   style={footerLinkStyle}>About</a>
      </div>
    </aside>
  );
}

function RailGameSection({ label, live, finals, games, favSet, teamFor, onOpenGame, onJoin }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
      }}>
        {live && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cn-live)', animation: 'cn-pulse 1.5s ease-in-out infinite' }} />}
        <span style={{
          fontFamily: 'var(--cn-font-mono)', fontSize: 10,
          color: live ? 'var(--cn-live)' : 'var(--cn-text-mute)',
          fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {games.map(g => (
          <RailGameCard
            key={g.id}
            game={g}
            favorite={gameTouchesFavorite(g, favSet)}
            teamFor={teamFor}
            live={live}
            finals={finals}
            onOpenGame={onOpenGame}
            onJoin={onJoin}
          />
        ))}
      </div>
    </div>
  );
}

function RailGameCard({ game, favorite, teamFor, live, finals, onOpenGame, onJoin }) {
  const home = teamFor(game, 'home');
  const away = teamFor(game, 'away');
  const onClick = () => onOpenGame?.(game);
  return (
    <div style={{
      borderRadius: 10,
      background: 'var(--cn-bg-elev)',
      border: '0.5px solid var(--cn-border)',
      overflow: 'hidden',
      cursor: onOpenGame ? 'pointer' : 'default',
      transition: 'border-color 0.15s, transform 0.05s',
    }}
      onClick={onClick}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.995)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px',
        background: 'var(--cn-bg-elev2)',
        borderBottom: '0.5px solid var(--cn-border)',
      }}>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, padding: '1px 5px', background: 'var(--cn-bg-elev)', borderRadius: 3, color: 'var(--cn-text-mute)', fontWeight: 700, letterSpacing: 0.5 }}>{game.league}</span>
        <span style={{ flex: 1, fontFamily: 'var(--cn-font-mono)', fontSize: 9, color: 'var(--cn-text-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {game.period}{game.clock ? ' ' + game.clock : ''}
        </span>
        {favorite && (
          <span title="Your team" style={{
            color: 'var(--cn-accent)', fontSize: 12, lineHeight: 1, fontWeight: 800,
          }}>★</span>
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <CompactScoreRow team={away} score={game.awayScore} />
        <CompactScoreRow team={home} score={game.homeScore} />
      </div>
      {live && onJoin && (
        <button onClick={e => { e.stopPropagation(); onJoin(); }} style={{
          width: '100%', padding: '7px',
          background: 'var(--cn-text)', color: 'var(--cn-bg)',
          border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: 11,
          fontFamily: 'var(--cn-font-body)',
          borderTop: '0.5px solid var(--cn-border)',
        }}>Join the chat →</button>
      )}
    </div>
  );
}

const footerLinkStyle = {
  color: 'var(--cn-text-dim)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};

Object.assign(window, { DesktopApp });
