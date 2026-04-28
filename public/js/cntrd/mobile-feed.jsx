// mobile-feed.jsx — home feed screen for CNTRD (mobile)
// Includes top header, Plays rail (stories), live games strip, feed.

function PlaysRail({ playsLabel = 'PLAYS', onPlay, onAdd, plays }) {
  const items = (plays && plays.length ? plays : PLAYS);
  return (
    <div style={{
      padding: '12px 16px 14px',
      borderBottom: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: 'var(--cn-font-display)',
          fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)',
          letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 14, color: 'var(--cn-text)',
        }}>{playsLabel}</span>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>
          {items.length} from people you follow
        </span>
      </div>
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {/* Add new play */}
        <PlayBubble add onClick={onAdd} />
        {items.map(p => <PlayBubble key={p.id} play={p} onClick={onPlay} />)}
      </div>
    </div>
  );
}

function PlayBubble({ play, add, onClick }) {
  if (add) {
    return (
      <div onClick={onClick} style={{ flexShrink: 0, width: 64, textAlign: 'center', cursor: onClick ? 'pointer' : 'default' }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          border: '1.5px dashed var(--cn-border-s)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--cn-text-dim)',
        }}>
          <Icon name="plus" size={20} />
        </div>
        <div style={{
          fontSize: 10, marginTop: 6,
          color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)',
        }}>Add</div>
      </div>
    );
  }
  const u = (typeof play.user === 'string') ? USERS[play.user] : play.user;
  if (!u) return null;
  const team = TEAMS[play.team] || { primary: '#666', accent: '#999' };
  return (
    <div onClick={() => onClick?.(play)} style={{ flexShrink: 0, width: 64, textAlign: 'center', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{
        position: 'relative',
        width: 60, height: 60, borderRadius: '50%',
        padding: 2,
        background: play.live
          ? `conic-gradient(from 0deg, var(--cn-live), ${team.primary}, var(--cn-live))`
          : `conic-gradient(from 0deg, ${team.primary}, ${team.accent}, ${team.primary})`,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: avatarBg(u.avatarHue),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 18,
          border: '2px solid var(--cn-bg)',
        }}>
          {avatarInitials(u.displayName)}
        </div>
        {play.live && (
          <div style={{
            position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--cn-live)', color: '#fff',
            fontSize: 8, fontWeight: 800, letterSpacing: 0.7,
            padding: '1.5px 6px', borderRadius: 3,
            fontFamily: 'var(--cn-font-mono)',
          }}>LIVE</div>
        )}
      </div>
      <div style={{
        fontSize: 10, marginTop: 6,
        color: 'var(--cn-text-dim)', fontFamily: 'var(--cn-font-mono)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{u.username}</div>
    </div>
  );
}

function _favSet(me) { return new Set(me?.teams || []); }
function _followedSet(me) { return new Set(me?.leagues || []); }

// League-aware match — Eagles (NFL:PHI) does not light up Flyers (NHL:PHI).
function _isFav(g, favSet) {
  if (!favSet || !favSet.size) return false;
  if (favSet.has(`${g.league}:${g.home}`)) return true;
  if (favSet.has(`${g.league}:${g.away}`)) return true;
  // Bare-code fallback for legacy data only.
  for (const f of favSet) {
    if (!String(f).includes(':') && (f === g.home || f === g.away)) return true;
  }
  return false;
}
function _filterFollowed(games, favSet, followed) {
  if (!games) return [];
  return games.filter(g => followed.has(g.league) || _isFav(g, favSet));
}
function _favoriteFirst(games, favSet) {
  if (!favSet || !favSet.size) return games;
  const fav = [], rest = [];
  for (const g of games) {
    if (_isFav(g, favSet)) fav.push(g);
    else rest.push(g);
  }
  return [...fav, ...rest];
}

function LiveGamesStrip({ onJoin, games, me, onOpenGame }) {
  const favSet = _favSet(me);
  const followed = _followedSet(me);
  const live = _favoriteFirst(_filterFollowed(games?.live, favSet, followed), favSet);
  const upcoming = _favoriteFirst(_filterFollowed(games?.upcoming, favSet, followed), favSet);
  const showing = live.length ? live : upcoming.slice(0, 3);
  if (!showing.length) return null;
  const empty = !live.length;
  return (
    <div style={{
      padding: '10px 16px 12px',
      borderBottom: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg-elev2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: empty ? 'var(--cn-text-mute)' : 'var(--cn-live)',
          animation: empty ? 'none' : 'cn-pulse 1.5s ease-in-out infinite',
        }} />
        <span style={{
          fontFamily: 'var(--cn-font-mono)', fontSize: 10,
          color: empty ? 'var(--cn-text-mute)' : 'var(--cn-live)',
          fontWeight: 700, letterSpacing: 0.7,
        }}>
          {empty ? 'NEXT UP' : 'LIVE NOW · TAP TO JOIN GAMEDAY CHAT'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {showing.map(g => (
          <LiveGameCard
            key={g.id}
            game={g}
            favorite={_isFav(g, favSet)}
            onClick={() => (empty ? onOpenGame?.(g) : (onOpenGame ? onOpenGame(g) : onJoin?.()))}
          />
        ))}
      </div>
    </div>
  );
}

function RecentGamesStrip({ games, me, onOpenGame }) {
  const favSet = _favSet(me);
  const followed = _followedSet(me);
  const recent = _favoriteFirst(_filterFollowed(games?.recent, favSet, followed), favSet);
  if (!recent.length) return null;
  return (
    <div style={{
      padding: '10px 16px 12px',
      borderBottom: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{
          fontFamily: 'var(--cn-font-mono)', fontSize: 10,
          color: 'var(--cn-text-mute)', fontWeight: 700, letterSpacing: 0.7,
        }}>RECENT FINALS</span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {recent.map(g => (
          <LiveGameCard
            key={g.id}
            game={g}
            favorite={_isFav(g, favSet)}
            onClick={() => onOpenGame?.(g)}
          />
        ))}
      </div>
    </div>
  );
}

function LiveGameCard({ game, onClick, favorite }) {
  const home = game.homeTeam || TEAMS[game.home] || { code: game.home, name: game.home, primary: '#666', accent: '#999' };
  const away = game.awayTeam || TEAMS[game.away] || { code: game.away, name: game.away, primary: '#666', accent: '#999' };
  return (
    <div onClick={onClick} style={{
      flexShrink: 0,
      minWidth: 184,
      padding: '10px 12px',
      background: 'var(--cn-bg-elev)',
      border: `0.5px solid ${favorite ? 'var(--cn-accent)' : 'var(--cn-border)'}`,
      borderRadius: 10,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 6 }}>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, color: 'var(--cn-text-mute)', letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {game.league} · {game.period}{game.clock ? ' ' + game.clock : ''}
        </span>
        {favorite && (
          <span title="Your team" style={{ color: 'var(--cn-accent)', fontSize: 11, lineHeight: 1, fontWeight: 800 }}>★</span>
        )}
      </div>
      <CompactScoreRow team={away} score={game.awayScore} />
      <CompactScoreRow team={home} score={game.homeScore} />
    </div>
  );
}

function CompactScoreRow({ team, score }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
      <div style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        background: team.primary, color: pickContrast(team.primary),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 800, letterSpacing: 0.3,
      }}>{team.code}</div>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{team.name}</span>
      <span style={{
        fontFamily: 'var(--cn-font-display)',
        fontSize: 18, fontWeight: 'var(--cn-display-weight)',
        fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right',
      }}>{score}</span>
    </div>
  );
}

// ─── HEADER ───────────────────────────────────────────────────
function FeedHeader({ playsLabel = 'PLAYS' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px 12px',
      borderBottom: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg)',
      position: 'sticky', top: 0, zIndex: 10,
      backdropFilter: 'blur(20px)',
    }}>
      <span style={{
        fontFamily: 'var(--cn-font-display)',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
        fontSize: 26,
        color: 'var(--cn-text)',
      }}>CNTRD</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button style={iconBtnStyle()}><Icon name="search" size={20} stroke="var(--cn-text)" /></button>
        <button style={iconBtnStyle()}><Icon name="bell" size={20} stroke="var(--cn-text)" /></button>
      </div>
    </div>
  );
}

// ─── EDITORIAL HEADER (alt home layout) ───────────────────────
function EditorialHeader() {
  return (
    <div style={{
      padding: '14px 16px 10px',
      borderBottom: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1.5 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={iconBtnStyle()}><Icon name="search" size={18} stroke="var(--cn-text)" /></button>
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--cn-font-display)',
        fontSize: 44, lineHeight: 0.95,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: 'var(--cn-text)',
        textTransform: 'uppercase',
      }}>CNTRD</div>
      <div style={{
        marginTop: 6, fontFamily: 'var(--cn-font-body)',
        fontSize: 11, color: 'var(--cn-text-dim)',
        borderTop: '0.5px solid var(--cn-border)',
        paddingTop: 8, fontStyle: 'italic',
      }}>
        Where the game gets loud. — Today's lead: Lakers @ Celtics, Q4
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────
function BottomNav({ active = 'home', onChange }) {
  const tabs = [
    { id: 'home',   icon: 'home',     label: 'Feed' },
    { id: 'search', icon: 'search',   label: 'Discover' },
    { id: 'compose',icon: 'plus',     label: '' },
    { id: 'chat',   icon: 'whistle',  label: 'Gameday' },
    { id: 'profile',icon: 'profile',  label: 'You' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 28,
      background: 'color-mix(in srgb, var(--cn-bg) 80%, transparent)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderTop: '0.5px solid var(--cn-border)',
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-around',
      paddingTop: 10,
      zIndex: 5,
    }}>
      {tabs.map(t => {
        const isCompose = t.id === 'compose';
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange?.(t.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: isActive ? 'var(--cn-text)' : 'var(--cn-text-mute)',
            padding: '4px 10px',
          }}>
            {isCompose ? (
              <div style={{
                width: 38, height: 30, borderRadius: 8,
                background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: -2,
              }}>
                <Icon name="plus" size={20} stroke="var(--cn-on-accent)" sw={2.4} />
              </div>
            ) : (
              <Icon name={t.icon} size={22} sw={1.7} />
            )}
            {t.label && (
              <span style={{
                fontFamily: 'var(--cn-font-mono)', fontSize: 9,
                letterSpacing: 0.4,
              }}>{t.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── FEED SCREEN ──────────────────────────────────────────────
function FeedScreen({ tweaks, onNav, posts, plays, games, me, onOpenGame }) {
  const editorial = tweaks.homeStyle === 'editorial';
  const items = (posts && posts.length ? posts : POSTS);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--cn-bg)',
      color: 'var(--cn-text)',
      fontFamily: 'var(--cn-font-body)',
      display: 'flex', flexDirection: 'column',
    }}>
      {editorial ? <EditorialHeader /> : <FeedHeader />}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>
        <PlaysRail
          playsLabel={tweaks.playsLabel || 'PLAYS'}
          plays={plays}
          onPlay={() => onNav?.('plays')}
          onAdd={() => onNav?.('playsCreator')}
        />
        {tweaks.showLiveStrip !== false && (
          <LiveGamesStrip
            games={games}
            me={me}
            onOpenGame={onOpenGame}
            onJoin={() => onNav?.('chat')}
          />
        )}
        <RecentGamesStrip games={games} me={me} onOpenGame={onOpenGame} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map(p => <Post key={p.id} post={p} />)}
        </div>
      </div>
      <BottomNav active="home" onChange={onNav} />
    </div>
  );
}

Object.assign(window, {
  FeedScreen, FeedHeader, EditorialHeader, PlaysRail, PlayBubble,
  LiveGamesStrip, RecentGamesStrip, LiveGameCard, CompactScoreRow, BottomNav,
});
