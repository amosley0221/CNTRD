// mobile-feed.jsx — home feed screen for CNTRD (mobile)
// Includes top header, Plays rail (stories), live games strip, feed.

function PlaysRail({ playsLabel = 'PLAYS', onPlay, onAdd, plays }) {
  const items = (plays && plays.length ? plays : PLAYS);
  // Group plays by author so the rail shows one bubble per user
  // (Instagram-style "story" pattern). Pick the most recent play
  // per user as the bubble's lead, but keep the full set so a tap
  // can open the viewer on the right starting play.
  const grouped = React.useMemo(() => {
    const byUser = new Map();
    for (const p of items) {
      const uid = (typeof p.user === 'string' ? p.user : p.user?.id) || p.user_id || 'anon';
      const existing = byUser.get(uid);
      if (!existing || (p.created_at || '') > (existing.lead.created_at || '')) {
        byUser.set(uid, { lead: p, plays: [...(existing?.plays || []), p] });
      } else {
        existing.plays.push(p);
        byUser.set(uid, existing);
      }
    }
    // Order: any group with a live play first, then by most recent activity.
    return Array.from(byUser.values()).sort((a, b) => {
      const aLive = a.plays.some(p => p.live) ? 1 : 0;
      const bLive = b.plays.some(p => p.live) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return (b.lead.created_at || '').localeCompare(a.lead.created_at || '');
    });
  }, [items]);
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
          {grouped.length} from people you follow
        </span>
      </div>
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {/* Add new play */}
        <PlayBubble add onClick={onAdd} />
        {grouped.map(g => (
          <PlayBubble
            key={g.lead.id}
            play={g.lead}
            unwatched={g.plays.some(p => p.viewed === false)}
            onClick={onPlay}
          />
        ))}
      </div>
    </div>
  );
}

function PlayBubble({ play, add, unwatched = true, onClick }) {
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
        // Live keeps the red pulse ring; otherwise use the user's
        // accent color when there's an unwatched play, dimmed gray
        // once everything in the rail has been viewed.
        background: play.live
          ? `conic-gradient(from 0deg, var(--cn-live), var(--cn-accent), var(--cn-live))`
          : (unwatched ? 'var(--cn-accent)' : 'var(--cn-text-mute)'),
        opacity: unwatched || play.live ? 1 : 0.55,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: 'var(--cn-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 2,
        }}>
          <Avatar user={u} size={52} />
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
      }}>{u.hide_username ? (u.displayName || '') : u.username}</div>
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

function LiveGamesStrip({ onJoin, games, me, onOpenGame, onOpenGameday }) {
  const favSet = _favSet(me);
  const followed = _followedSet(me);
  const live = _favoriteFirst(_filterFollowed(games?.live, favSet, followed), favSet);
  const upcoming = _favoriteFirst(_filterFollowed(games?.upcoming, favSet, followed), favSet);
  const showing = live.length ? live : upcoming.slice(0, 3);
  if (!showing.length) return null;
  const empty = !live.length;
  // Live header in this strip says "TAP TO JOIN GAMEDAY CHAT" so live taps
  // jump into the chat for that specific game; upcoming taps open stats.
  const cardClick = (g) => empty
    ? onOpenGame?.(g)
    : (onOpenGameday ? onOpenGameday(g) : onJoin?.());
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
            onClick={() => cardClick(g)}
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

  // Build a one-line series / aggregate footer that lives BELOW the score
  // rows, so cards with this metadata stay the same shape as cards
  // without. For soccer two-leg ties we name the team that's ahead on
  // aggregate (or "level" when tied) instead of just printing both
  // numbers.
  // Gate the playoff-series tag on actual postseason — ESPN ships a
  // `series` payload on regular-season MLB games (3-game sets) too.
  const isPostseason = Number(game.season_type) === 3;
  let footer = null;
  if (isPostseason && game.series && (game.series.summary || game.series.bestOf)) {
    footer = `SERIES ${game.series.summary || ''}${game.series.bestOf ? ` · BEST OF ${game.series.bestOf}` : ''}`.trim();
  } else if (game.aggregate) {
    const a = Number(game.aggregate.away);
    const h = Number(game.aggregate.home);
    if (Number.isFinite(a) && Number.isFinite(h)) {
      if (a === h) {
        footer = `LEVEL ON AGG ${a}–${h}`;
      } else if (a > h) {
        footer = `${(away.code || away.name || 'AWAY').toUpperCase()} LEAD AGG ${a}–${h}`;
      } else {
        footer = `${(home.code || home.name || 'HOME').toUpperCase()} LEAD AGG ${h}–${a}`;
      }
    }
  }

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
      <CompactScoreRow team={away} score={game.awayScore} record={game.awayRecord} league={game.league} />
      <CompactScoreRow team={home} score={game.homeScore} record={game.homeRecord} league={game.league} />
      {footer && (
        <div style={{
          marginTop: 6,
          fontFamily: 'var(--cn-font-mono)', fontSize: 9,
          color: 'var(--cn-accent)', letterSpacing: 0.5,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{footer}</div>
      )}
    </div>
  );
}

function CompactScoreRow({ team, score, record, league }) {
  // Two-column layout: left side (logo + name + record) flexes; the score
  // sits in a fixed right-aligned column so scores in the same card line
  // up vertically regardless of name + record width.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <TeamLogo team={team} size={18} radius={4} />
        <TeamName team={team} league={league} fontSize={12} weight={600} color="var(--cn-text)" />
        {record && (
          <span style={{
            fontFamily: 'var(--cn-font-mono)', fontSize: 9,
            color: 'var(--cn-text-mute)', flexShrink: 0,
          }}>{record}</span>
        )}
      </div>
      <span style={{
        fontFamily: 'var(--cn-font-display)',
        fontSize: 18, fontWeight: 'var(--cn-display-weight)',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 28, textAlign: 'right', flexShrink: 0,
      }}>{score}</span>
    </div>
  );
}

// ─── HEADER ───────────────────────────────────────────────────
function FeedHeader({ playsLabel = 'PLAYS', onNav, unreadNotifs = 0 }) {
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
        <button onClick={() => onNav?.('discover')} style={iconBtnStyle()} aria-label="Discover">
          <Icon name="search" size={20} stroke="var(--cn-text)" />
        </button>
        <button onClick={() => onNav?.('notifications')} style={{ ...iconBtnStyle(), position: 'relative' }} aria-label="Notifications">
          <Icon name="bell" size={20} stroke="var(--cn-text)" />
          {unreadNotifs > 0 && (
            <span aria-hidden style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--cn-accent)',
              boxShadow: '0 0 0 1.5px var(--cn-bg)',
            }} />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── EDITORIAL HEADER (alt home layout) ───────────────────────
function EditorialHeader({ onNav } = {}) {
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
          <button onClick={() => onNav?.('discover')} style={iconBtnStyle()} aria-label="Discover">
            <Icon name="search" size={18} stroke="var(--cn-text)" />
          </button>
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
function BottomNav({ active = 'home', onChange, unreadMessages = 0 }) {
  const tabs = [
    { id: 'home',     icon: 'home',     label: 'Feed' },
    // Replaces the old "Discover" tab — that was a stub. Messages opens
    // DMs + group chats and shows an accent dot when there's unread.
    { id: 'messages', icon: 'chat',     label: 'Messages', badge: unreadMessages },
    { id: 'compose',  icon: 'plus',     label: '' },
    { id: 'chat',     icon: 'whistle',  label: 'Gameday' },
    { id: 'profile',  icon: 'profile',  label: 'You' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      // Pad only by the iOS home-indicator inset (no extra spacing) so
      // the bar reads flush with the bottom edge in standalone mode.
      // Falls back to a small comfort gap in regular browser tabs.
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      background: 'color-mix(in srgb, var(--cn-bg-elev2) 90%, transparent)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderTop: '0.5px solid var(--cn-border)',
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-around',
      paddingTop: 8,
      zIndex: 5,
    }}>
      {tabs.map(t => {
        const isCompose = t.id === 'compose';
        const isActive = t.id === active;
        const showBadge = !!t.badge && t.badge > 0;
        return (
          <button key={t.id} onClick={() => onChange?.(t.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: isActive ? 'var(--cn-text)' : 'var(--cn-text-mute)',
            padding: '4px 10px',
            position: 'relative',
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
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon name={t.icon} size={22} sw={1.7} />
                {showBadge && (
                  <span style={{
                    position: 'absolute', top: -2, right: -4,
                    minWidth: 14, height: 14, padding: '0 4px',
                    borderRadius: 999,
                    background: 'var(--cn-accent)',
                    color: 'var(--cn-on-accent)',
                    fontFamily: 'var(--cn-font-mono)', fontSize: 9, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 0 1.5px var(--cn-bg)',
                  }}>{t.badge > 99 ? '99+' : t.badge}</span>
                )}
              </span>
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
function FeedScreen({ tweaks, onNav, posts, plays, games, me, onOpenGame, onOpenGameday, onOpenPlay, unreadNotifs, unreadMessages = 0, feedPending = 0, onRefreshFeed, onPullRefreshFeed }) {
  const editorial = tweaks.homeStyle === 'editorial';
  const items = (posts && posts.length ? posts : POSTS);
  const scrollerRef = React.useRef(null);
  const refresh = () => {
    onRefreshFeed?.();
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  };
  const { distance, refreshing } = usePullToRefresh(scrollerRef, onPullRefreshFeed);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--cn-bg)',
      color: 'var(--cn-text)',
      fontFamily: 'var(--cn-font-body)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {editorial ? <EditorialHeader onNav={onNav} /> : <FeedHeader onNav={onNav} unreadNotifs={unreadNotifs} />}
      {feedPending > 0 && (
        <button onClick={refresh} style={{
          position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
          zIndex: 5,
          padding: '7px 16px', borderRadius: 999,
          background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
          border: 'none', cursor: 'pointer',
          fontFamily: 'var(--cn-font-body)', fontWeight: 700, fontSize: 12,
          boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>↑</span>
          {feedPending} new {feedPending === 1 ? 'post' : 'posts'}
        </button>
      )}
      <div ref={scrollerRef} style={{ flex: 1, overflowY: 'auto', paddingBottom: 96, overscrollBehaviorY: 'contain' }}>
        <PullIndicator distance={distance} refreshing={refreshing} />
        <PlaysRail
          playsLabel={tweaks.playsLabel || 'PLAYS'}
          plays={plays}
          onPlay={(p) => (onOpenPlay ? onOpenPlay(p) : onNav?.('plays'))}
          onAdd={() => onNav?.('playsCreator')}
        />
        {tweaks.showLiveStrip !== false && (
          <LiveGamesStrip
            games={games}
            me={me}
            onOpenGame={onOpenGame}
            onOpenGameday={onOpenGameday}
            onJoin={() => onNav?.('chat')}
          />
        )}
        <RecentGamesStrip games={games} me={me} onOpenGame={onOpenGame} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map(p => <Post key={p.id} post={p} />)}
        </div>
      </div>
      <BottomNav active="home" onChange={onNav} unreadMessages={unreadMessages} />
    </div>
  );
}

Object.assign(window, {
  FeedScreen, FeedHeader, EditorialHeader, PlaysRail, PlayBubble,
  LiveGamesStrip, RecentGamesStrip, LiveGameCard, CompactScoreRow, BottomNav,
});
