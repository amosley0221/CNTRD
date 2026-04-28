// desktop.jsx — desktop web app for CNTRD
// Three-column layout: left nav, center feed, right rail (gameday + trends)

function DesktopApp({ tweaks, setTweak, onNav }) {
  const [view, setView] = React.useState('feed');
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
      <DesktopNav view={view} setView={setView} onNav={onNav} />
      <DesktopMain view={view} tweaks={tweaks} onNav={onNav} />
      <DesktopRail tweaks={tweaks} onNav={onNav} />
    </div>
  );
}

function DesktopNav({ view, setView, onNav }) {
  const items = [
    { id: 'feed',     icon: 'home',     label: 'Feed' },
    { id: 'discover', icon: 'search',   label: 'Discover' },
    { id: 'gameday',  icon: 'whistle',  label: 'Gameday', badge: 'LIVE' },
    { id: 'plays',    icon: 'video',    label: 'Plays' },
    { id: 'rumors',   icon: 'flame',    label: 'Rumor mill' },
    { id: 'notifs',   icon: 'bell',     label: 'Notifications', count: 7 },
    { id: 'profile',  icon: 'profile',  label: 'You' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];
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
          const active = view === it.id;
          return (
            <button key={it.id} onClick={() => setView(it.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10,
              background: active ? 'var(--cn-bg-elev)' : 'transparent',
              border: 'none', cursor: 'pointer',
              color: active ? 'var(--cn-text)' : 'var(--cn-text-dim)',
              fontSize: 14, fontWeight: active ? 600 : 500,
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
              {it.count != null && (
                <span style={{
                  fontFamily: 'var(--cn-font-mono)',
                  fontSize: 10, fontWeight: 700,
                  background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
                  padding: '1px 6px', borderRadius: 999, minWidth: 18,
                  textAlign: 'center',
                }}>{it.count}</span>
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
        <Avatar user={ME} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{ME.displayName}</div>
          <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>@{ME.username}</div>
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

function DesktopMain({ view, tweaks, onNav }) {
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
        }}>{view === 'feed' ? 'YOUR FEED' : view.toUpperCase()}</span>
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
          {PLAYS.map(p => <PlayBubble key={p.id} play={p} onClick={() => onNav?.('plays')} />)}
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 620 }}>
        {POSTS.map(p => <Post key={p.id} post={p} />)}
      </div>
    </main>
  );
}

function DesktopRail({ tweaks, onNav }) {
  const game = LIVE_GAMES[0];
  return (
    <aside style={{ overflowY: 'auto', padding: '20px 22px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        background: 'var(--cn-bg-elev)',
        border: '0.5px solid var(--cn-border)',
      }}>
        <Icon name="search" size={16} stroke="var(--cn-text-mute)" />
        <span style={{ fontSize: 13, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-body)' }}>Search teams, players, fans</span>
      </div>

      {/* Live gameday card */}
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
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cn-live)', animation: 'cn-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-live)', fontWeight: 800, letterSpacing: 0.7 }}>GAMEDAY · {game.viewers.toLocaleString()} HERE</span>
          </div>
          <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>{game.period} {game.clock}</span>
        </div>
        <div style={{ padding: '12px 14px' }}>
          <ScoreRow team={TEAMS[game.away]} score={game.awayScore} winner={game.awayScore > game.homeScore} />
          <div style={{ height: 6 }} />
          <ScoreRow team={TEAMS[game.home]} score={game.homeScore} winner={game.homeScore > game.awayScore} />
        </div>
        {/* mini chat preview */}
        <div style={{ borderTop: '0.5px solid var(--cn-border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--cn-bg-elev2)' }}>
          {CHAT_MESSAGES.slice(0, 3).map(m => {
            const u = USERS[m.user]; const team = m.side ? TEAMS[m.side] : null;
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: team ? team.primary : 'var(--cn-text)' }}>@{u.username}</span>
                <span style={{ flex: 1, color: 'var(--cn-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text}</span>
              </div>
            );
          })}
          <button onClick={() => onNav?.('chat')} style={{
            marginTop: 4, padding: '7px', borderRadius: 8,
            background: 'var(--cn-text)', color: 'var(--cn-bg)',
            border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12, fontFamily: 'var(--cn-font-body)',
          }}>Join the chat →</button>
        </div>
      </div>

      {/* Other live games */}
      <div>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Also Live</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LIVE_GAMES.slice(1).map(g => (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10,
              background: 'var(--cn-bg-elev)',
              border: '0.5px solid var(--cn-border)',
            }}>
              <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, padding: '2px 5px', background: 'var(--cn-bg-elev2)', borderRadius: 3, color: 'var(--cn-text-mute)' }}>{g.league}</span>
              <CompactScoreRow team={TEAMS[g.away]} score={g.awayScore} />
              <span style={{ color: 'var(--cn-text-mute)', fontSize: 10 }}>·</span>
              <CompactScoreRow team={TEAMS[g.home]} score={g.homeScore} />
            </div>
          ))}
        </div>
      </div>

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
