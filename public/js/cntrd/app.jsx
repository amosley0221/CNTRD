// app.jsx — CNTRD app entry. Wires the design components into a real SPA:
// theme persistence, screen routing, responsive mobile/desktop swap, and
// a real backend (auth, feed, profile, plays via /api/*).

const TWEAK_DEFAULTS = {
  dark: true,
  accent: '#D4FF3A',
  density: 'cozy',
  homeStyle: 'stadium',
  typePair: 'modern',
  playsLabel: 'Plays',
  showLiveStrip: true,
  showMarquee: false,
};

const STORAGE = {
  tweaks: 'cntrd:tweaks',
  screen: 'cntrd:screen',
};

function useTweaks(defaults) {
  const [t, setT] = React.useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE.tweaks);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch { return defaults; }
  });
  const setTweak = React.useCallback((key, value) => {
    setT(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(STORAGE.tweaks, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  // Replace the whole object at once (used when hydrating from the server
  // on login). Skips network/storage churn — caller writes back if needed.
  const replaceTweaks = React.useCallback((incoming) => {
    if (!incoming || typeof incoming !== 'object') return;
    setT(prev => {
      const next = { ...prev, ...incoming };
      try { localStorage.setItem(STORAGE.tweaks, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return [t, setTweak, replaceTweaks];
}

function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [match, setMatch] = React.useState(get);
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = e => setMatch(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, [query]);
  return match;
}

// Server user → design ME shape.
function normalizeMe(u) {
  if (!u) return null;
  let joined = '';
  if (u.created_at) {
    const d = new Date(u.created_at.replace(' ', 'T') + 'Z');
    if (!isNaN(d)) joined = 'Joined ' + d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    email: u.email,
    bio: u.bio || '',
    pronouns: u.pronouns || '',
    city: u.city || '',
    joined,
    teams:   Array.isArray(u.team_tags)        ? u.team_tags        : [],
    leagues: Array.isArray(u.followed_leagues) ? u.followed_leagues : [],
    followers: u.follower_count ?? 0,
    following: u.following_count ?? 0,
    posts: u.post_count ?? 0,
    avatar: u.avatar,
    avatarHue: u.avatar_hue ?? 200,
    is_private: !!u.is_private,
    is_admin: !!u.is_admin,
    is_owner: !!u.is_owner,
    is_official: !!u.is_official,
    is_verified: !!u.is_verified,
    hide_username: !!u.hide_username,
    banned: !!u.banned,
    notificationPrefs: u.notification_prefs || {},
    tweaks: u.tweaks || {},
  };
}

function CNTRDApp() {
  const [tweaks, setTweak, replaceTweaks] = useTweaks(TWEAK_DEFAULTS);
  const [me, setMe] = React.useState(null);
  const [bootstrapped, setBootstrapped] = React.useState(false);
  const [posts, setPosts] = React.useState([]);
  const [plays, setPlays] = React.useState([]);
  const [games, setGames] = React.useState({ live: [], upcoming: [], recent: [] });
  const [selectedGame, setSelectedGame] = React.useState(null);  // { id, league }
  const [scheduleTeam, setScheduleTeam] = React.useState(null);  // { league, teamId, name, primary, code, logo }
  const [viewUsername, setViewUsername] = React.useState(null);  // username being inspected on userProfile screen
  const [discoverQuery, setDiscoverQuery] = React.useState('');   // seeds the Discover screen's input
  const [threadPostId, setThreadPostId] = React.useState(null);   // post being viewed in the thread screen
  const [followListMode, setFollowListMode] = React.useState('followers');
  const [followListUsername, setFollowListUsername] = React.useState(null);
  const [selectedTag, setSelectedTag]   = React.useState(null);  // 'NFL:PHI' or 'PHI'
  const [selectedPlay, setSelectedPlay] = React.useState(null);  // play object when viewing a specific Play
  const [gamedayPick, setGamedayPick]   = React.useState(null);  // { id, league, ... } when entering chat for a specific game
  const [messageContext, setMessageContext] = React.useState({ mode: 'list' });
  const [accountSection, setAccountSection] = React.useState(null);  // 'avatar' | 'username' | 'email' | 'password' | null
  const [unreadMessages, setUnreadMessages] = React.useState(0);
  const [unreadNotifs, setUnreadNotifs]     = React.useState(0);
  const [pendingFeed, setPendingFeed] = React.useState([]);   // staged new posts; user taps to merge
  const [replyTo, setReplyTo] = React.useState(null);   // post being replied to in composer
  const [screen, setScreen] = React.useState('login');
  // Navigation history — every nav (other than 'back') pushes the
  // current screen onto this stack so a 'back' pops the most recent.
  // Falls back to 'home' when the stack is empty so the back arrow
  // never leaves the user stranded.
  const screenHistoryRef = React.useRef([]);

  const isWide = useMediaQuery('(min-width: 980px)');
  const rootRef = React.useRef(null);
  const authed = !!me;

  React.useLayoutEffect(() => {
    if (rootRef.current) applyTheme(rootRef.current, tweaks);
    applyTheme(document.documentElement, tweaks);
    // Body background fills the iOS safe areas (above the status bar /
    // Dynamic Island and below the home indicator in standalone mode).
    // We match the header / bottom-nav tone (elev2) instead of the
    // deeper page background, so the chrome reads as a continuous bar
    // edge-to-edge instead of a strip floating in a darker letterbox.
    document.body.style.background = 'var(--cn-bg-elev2)';
    document.body.style.color = 'var(--cn-text)';
    // Match theme-color to the body's elev2 tone so the iOS Safari /
    // Chrome URL bar in regular browser tabs blends with the app
    // chrome instead of the deeper page background.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tweaks.dark ? '#1B1B20' : '#FAF8F2');
  }, [tweaks]);

  // Reflect ME globally so design components that read window.ME pick it up.
  React.useEffect(() => { window.ME = me || (window.__originalME ||= window.ME); }, [me]);

  // When the user signs in (or /me lands on bootstrap), pull their saved
  // tweaks from the server so accent + dark/light follow them across
  // devices. Only runs when there's something to merge — first-time signups
  // start with the local defaults.
  const hydratedFromServerRef = React.useRef(false);
  React.useEffect(() => {
    if (!me || hydratedFromServerRef.current) return;
    if (me.tweaks && Object.keys(me.tweaks).length) {
      replaceTweaks(me.tweaks);
    }
    hydratedFromServerRef.current = true;
  }, [me, replaceTweaks]);
  // Reset the hydration flag so the next sign-in re-syncs.
  React.useEffect(() => {
    if (!me) hydratedFromServerRef.current = false;
  }, [me]);

  // Push tweak changes back to the server (debounced) once we've hydrated.
  // This is best-effort — if the request fails, the local copy still wins.
  React.useEffect(() => {
    if (!me || !hydratedFromServerRef.current) return;
    const id = setTimeout(() => {
      window.API?.saveTweaks?.(tweaks).catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [tweaks, me]);

  // Bootstrap: try existing token → /me; pick a sensible initial screen.
  // Also fetch the full league/team registry once and merge it into globals
  // so pickers + pills have real colors and names without re-asking later.
  React.useEffect(() => {
    let cancelled = false;
    async function boot() {
      window.__originalME = window.ME;
      const tasks = [];
      // Always try /me on boot — the server-set HttpOnly session cookie
      // can authenticate us even when client-side storage was wiped
      // (Safari ITP, private mode hand-off, etc.). 401 falls through to
      // the login screen as normal.
      tasks.push(API.me().catch((e) => {
        if (e?.status === 401) API.setToken(null);
        return null;
      }));
      tasks.push(API.allTeams().catch(() => null));
      tasks.push(API.leagueCatalog().catch(() => null));

      const [serverMe, byLeague, catalog] = await Promise.all(tasks);
      if (cancelled) return;
      if (catalog && catalog.length) window.LEAGUE_CATALOG = catalog;

      // Merge dynamic team registry into globals for the rest of the app.
      if (byLeague && Object.keys(byLeague).length) {
        window.TEAMS_BY_LEAGUE = byLeague;
        const flat = { ...(window.TEAMS || {}) };
        const byKey = { ...(window.TEAMS_BY_KEY || {}) };
        for (const list of Object.values(byLeague)) {
          for (const t of (list || [])) {
            flat[t.code] = flat[t.code] || t;          // legacy bare-code lookup
            const key = t.key || `${t.league}:${t.code}`;
            byKey[key] = t;                             // composite-key lookup
          }
        }
        window.TEAMS = flat;
        window.TEAMS_BY_KEY = byKey;
      }

      const user = serverMe ? normalizeMe(serverMe) : null;
      setMe(user);
      // Always land on the feed when the app is reopened — last-screen
      // restore felt like the app remembered "where I was inside" even
      // after I'd closed it. Login screen still wins when unauthed.
      setScreen(user ? 'home' : 'login');
      try { localStorage.removeItem(STORAGE.screen); } catch {}
      setBootstrapped(true);
    }
    boot();
    return () => { cancelled = true; };
  }, []);

  // Load feed + plays whenever auth state changes.
  React.useEffect(() => {
    if (!bootstrapped) return;
    let cancelled = false;
    (async () => {
      try {
        const [serverPosts, serverPlays] = await Promise.all([
          authed ? API.feed() : API.explore(),
          API.plays(),
        ]);
        if (cancelled) return;
        setPosts((serverPosts || []).map(normalizePost));
        setPlays((serverPlays || []).map(normalizePlay));
        setPendingFeed([]);
      } catch (e) {
        // Network/server hiccup — fall back to mock data already in window.POSTS/PLAYS.
        if (!cancelled) { setPosts([]); setPlays([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [authed, bootstrapped]);

  // Poll for new posts in the background. We don't merge them into `posts`
  // automatically — the user opts in by tapping the "X new posts" pill, so
  // they don't lose their scroll position.
  React.useEffect(() => {
    if (!bootstrapped) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await (authed ? API.feed() : API.explore());
        if (cancelled) return;
        const knownIds = new Set(posts.map(p => p.id));
        const additions = (fresh || [])
          .filter(p => p && p.id && !knownIds.has(p.id))
          .map(normalizePost);
        if (additions.length) setPendingFeed(additions);
      } catch { /* ignore */ }
    };
    const id = setInterval(tick, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [authed, bootstrapped, posts]);

  const handleRefreshFeed = React.useCallback(() => {
    if (!pendingFeed.length) return;
    setPosts(prev => {
      const seen = new Set(prev.map(p => p.id));
      const merge = pendingFeed.filter(p => !seen.has(p.id));
      return [...merge, ...prev];
    });
    setPendingFeed([]);
  }, [pendingFeed]);

  // Pull-to-refresh: replace the visible feed with the server's latest, and
  // clear any pending pill since those posts are now part of the main list.
  const handlePullRefreshFeed = React.useCallback(async () => {
    try {
      const fresh = await (authed ? API.feed() : API.explore());
      setPosts((fresh || []).map(normalizePost));
      setPendingFeed([]);
    } catch { /* leave existing posts in place */ }
  }, [authed]);

  // Poll live + recent games every 60s.
  React.useEffect(() => {
    if (!bootstrapped) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await API.games();
        if (!cancelled && data) setGames({
          live: data.live || [], upcoming: data.upcoming || [], recent: data.recent || [],
        });
      } catch { /* leave previous data alone */ }
    };
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [bootstrapped]);

  // Single source of truth for screen transitions: pushes the previous
  // screen onto the history stack (so 'back' returns here), then swaps in
  // the target. Both handleNav and the cntrd:open-* event handlers route
  // through this so navigating via a tap gesture and via the side rail
  // both contribute to the same back-history.
  const goTo = React.useCallback((target) => {
    if (!target) return;
    setScreen(prev => {
      if (prev !== target && prev !== 'login' && prev !== 'signup') {
        const stack = screenHistoryRef.current;
        if (stack[stack.length - 1] !== prev) stack.push(prev);
        if (stack.length > 50) stack.shift();
      }
      return target;
    });
  }, []);

  const handleNav = React.useCallback((next) => {
    if (next === 'logout') {
      API.logout();          // clears the HttpOnly session cookie server-side
      API.setToken(null);
      setMe(null);
      setScreen('login');
      screenHistoryRef.current = [];
      return;
    }
    // 'back' pops history; falls through to 'home' when empty so the
    // back arrow never leaves the user on a blank screen.
    if (next === 'back') {
      const stack = screenHistoryRef.current;
      const prev = stack.pop() || 'home';
      setScreen(prev);
      return;
    }
    const target = next === 'search' ? 'home' : next;
    goTo(target);
    // Sidebar / direct nav to Gameday (without picking a game) lands on the
    // list view. handleOpenGameday is the only path that sets gamedayPick.
    if (target === 'chat') setGamedayPick(null);
    // Leaving the composer (or going to plain compose) drops any pinned reply
    // target so the next session starts fresh.
    if (target !== 'compose') setReplyTo(null);
  }, [goTo]);

  const handleLogin = React.useCallback(async ({ login, password, persist = true }) => {
    const { token, user } = await API.login({ login, password, persist });
    API.setToken(token, { persist });
    setMe(normalizeMe(user));
  }, []);

  const handleSignup = React.useCallback(async ({ email, username, password, teams, leagues, avatar_hue }) => {
    const { token, user } = await API.register({
      email, username, password,
      display_name: username,
      teams, leagues, avatar_hue,
    });
    // New signups stick around — they're putting effort into the onboarding,
    // they don't want to be logged out as soon as they close the tab.
    API.setToken(token, { persist: true });
    setMe(normalizeMe(user));
  }, []);

  const handlePost = React.useCallback(async (payload) => {
    // Forward whatever the composer assembled — content/type/tags plus
    // optional image and extra (video_url, poll options, etc.) — so media
    // URLs and type-specific data make it to the server intact.
    const created = await API.createPost(payload);
    const norm = normalizePost(created);
    setPosts(prev => {
      // If this is a reply, bump the parent's reply_count locally so the
      // count under the post updates without a refetch.
      if (payload?.reply_to) {
        return prev.map(p => p.id === payload.reply_to
          ? { ...p, replies: (p.replies ?? 0) + 1 }
          : p);
      }
      return [norm, ...prev];
    });
    if (!payload?.reply_to) {
      setMe(prev => prev ? { ...prev, posts: (prev.posts ?? 0) + 1 } : prev);
    }
    setReplyTo(null);
  }, []);

  const handlePostUpdated = React.useCallback((updated) => {
    if (!updated?.id) return;
    setPosts(prev => prev.map(p => p.id === updated.id ? normalizePost(updated) : p));
  }, []);
  const handlePostDeleted = React.useCallback((id) => {
    if (!id) return;
    setPosts(prev => prev.filter(p => p.id !== id));
    setMe(prev => prev ? { ...prev, posts: Math.max(0, (prev.posts ?? 1) - 1) } : prev);
  }, []);
  const handleUserBlocked = React.useCallback((userId) => {
    if (!userId) return;
    setPosts(prev => prev.filter(p => p.user?.id !== userId));
  }, []);

  const handleCreatePlay = React.useCallback(async ({ team_code, label, hue }) => {
    const created = await API.createPlay({ team_code, label, hue });
    const norm = normalizePlay(created);
    setPlays(prev => [norm, ...prev]);
  }, []);

  // Profile updates (e.g. saving teams from TeamsEditorScreen) push the
  // freshest server snapshot back into ME so other screens reflect it.
  const handleMeUpdated = React.useCallback((updated) => {
    if (updated) setMe(prev => ({ ...(prev || {}), ...normalizeMe(updated) }));
  }, []);

  // Listen for global "open this team's tag feed" events fired from any
  // <TeamPill>. Any pill click anywhere in the app routes through here.
  React.useEffect(() => {
    const handler = (e) => {
      const code = e.detail;
      if (!code) return;
      setSelectedTag(code);
      goTo('tagFeed');
    };
    window.addEventListener('cntrd:open-tag', handler);
    return () => window.removeEventListener('cntrd:open-tag', handler);
  }, [goTo]);

  // Click a game card → load the detail screen.
  const handleOpenGame = React.useCallback((game) => {
    if (!game?.id || !game?.league) return;
    setSelectedGame({ id: game.id, league: game.league });
    goTo('gameDetail');
  }, [goTo]);

  // Pick a specific game's gameday chat (from a rail card's "Join the chat",
  // a live-game notification, or the gameday list view).
  const handleOpenGameday = React.useCallback((game) => {
    if (!game?.id || !game?.league) return;
    setGamedayPick(game);
    goTo('chat');
  }, [goTo]);

  // Open a specific Play in the full-screen viewer (from PlayBubble or the
  // profile plays grid). Falls back to the most recent play when none picked.
  const handleOpenPlay = React.useCallback((play) => {
    if (play && play.id) setSelectedPlay(play);
    else setSelectedPlay(null);
    goTo('plays');
  }, [goTo]);

  // "View latest Play" tap on a profile avatar fetches that user's plays
  // and opens the viewer focused on the most recent one.
  React.useEffect(() => {
    const handler = async (e) => {
      const username = e.detail?.username;
      if (!username) return;
      try {
        const list = await API.userPlays(username);
        const latest = (list || [])[0];
        if (latest) {
          setPlays(prev => {
            const merged = [...(prev || [])];
            for (const p of (list || [])) {
              const i = merged.findIndex(x => x.id === p.id);
              if (i < 0) merged.push(p);
              else merged[i] = p;
            }
            return merged;
          });
          setSelectedPlay(latest);
          goTo('plays');
        }
      } catch {}
    };
    window.addEventListener('cntrd:open-user-plays', handler);
    return () => window.removeEventListener('cntrd:open-user-plays', handler);
  }, [goTo]);

  const handleDeletePlay = React.useCallback(async (id) => {
    if (!id) return;
    await API.deletePlay(id);
    setPlays(prev => prev.filter(p => p.id !== id));
    setSelectedPlay(prev => prev?.id === id ? null : prev);
  }, []);

  // Poll the unread counts for the sidebar Messages + Notifications badges.
  React.useEffect(() => {
    if (!authed) { setUnreadMessages(0); setUnreadNotifs(0); return; }
    let cancelled = false;
    const tick = async () => {
      try {
        const [m, n] = await Promise.all([
          API.unreadCount().catch(() => null),
          API.notificationsUnread().catch(() => null),
        ]);
        if (cancelled) return;
        if (m) setUnreadMessages(m.unread || 0);
        if (n) setUnreadNotifs(n.unread || 0);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 15 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [authed]);

  // Poll /me every 30s so the profile's follower / following / post
  // counts reflect activity from other users (someone follows me,
  // unblocks me, etc.) without a manual refresh. Cheap — single row
  // lookup. Only runs when authed.
  React.useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await API.me();
        if (!cancelled && fresh) {
          setMe(prev => prev ? { ...prev, ...normalizeMe(fresh) } : prev);
        }
      } catch { /* token may have expired; auth flow will surface it elsewhere */ }
    };
    const id = setInterval(tick, 30 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [authed]);

  // Notifications-screen "open game" handler — reuses the existing game
  // detail flow so a live-game notification jumps straight into stats.
  React.useEffect(() => {
    const handler = (e) => {
      const g = e.detail;
      if (!g?.id || !g?.league) return;
      setSelectedGame({ id: g.id, league: g.league });
      goTo('gameDetail');
    };
    window.addEventListener('cntrd:open-game-from-notif', handler);
    return () => window.removeEventListener('cntrd:open-game-from-notif', handler);
  }, [goTo]);

  // GameDetailScreen fires this when the user taps "[Team] schedule →".
  React.useEffect(() => {
    const handler = (e) => {
      const t = e.detail;
      if (!t?.league || !t?.teamId) return;
      setScheduleTeam(t);
      goTo('teamSchedule');
    };
    window.addEventListener('cntrd:open-team-schedule', handler);
    return () => window.removeEventListener('cntrd:open-team-schedule', handler);
  }, [goTo]);

  // Tap a user's avatar / handle anywhere → open their profile.
  React.useEffect(() => {
    const handler = (e) => {
      const u = e.detail?.username;
      if (!u) return;
      // Tapping yourself routes to your own profile screen.
      if (me?.username && u === me.username) {
        goTo('profile');
        return;
      }
      setViewUsername(u);
      goTo('userProfile');
    };
    window.addEventListener('cntrd:open-user', handler);
    return () => window.removeEventListener('cntrd:open-user', handler);
  }, [me?.username, goTo]);

  // Tap a Followers / Following stat → open the list with the right
  // mode + username pre-filled.
  React.useEffect(() => {
    const handler = (e) => {
      const { username, mode } = e.detail || {};
      if (!username) return;
      setFollowListUsername(username);
      setFollowListMode(mode === 'following' ? 'following' : 'followers');
      goTo('followList');
    };
    window.addEventListener('cntrd:open-follow-list', handler);
    return () => window.removeEventListener('cntrd:open-follow-list', handler);
  }, [goTo]);

  // Tap a post body anywhere → open the thread (post + replies).
  React.useEffect(() => {
    const handler = (e) => {
      const id = e.detail?.postId;
      if (!id) return;
      setThreadPostId(id);
      goTo('postThread');
    };
    window.addEventListener('cntrd:open-post-thread', handler);
    return () => window.removeEventListener('cntrd:open-post-thread', handler);
  }, [goTo]);

  // Open a gameday chat by game id. Mention/reply notifications use this
  // to deep-link straight into the chat where you were tagged. If the
  // game isn't in the cached lists (very old finals), fall back to the
  // gameday list — the chat there is probably closed anyway.
  React.useEffect(() => {
    const handler = (e) => {
      const gameId = e.detail?.gameId;
      if (!gameId) return;
      const all = [
        ...((games?.live)     || []),
        ...((games?.upcoming) || []),
        ...((games?.recent)   || []),
      ];
      const game = all.find(g => String(g.id) === String(gameId));
      if (game) {
        setGamedayPick(game);
        goTo('chat');
      } else {
        setGamedayPick(null);
        goTo('chat');
      }
    };
    window.addEventListener('cntrd:open-gameday-by-id', handler);
    return () => window.removeEventListener('cntrd:open-gameday-by-id', handler);
  }, [games, goTo]);

  // Inline rail search → "See all results" / Enter routes to the
  // Discover screen with the query pre-filled.
  React.useEffect(() => {
    const handler = (e) => {
      const q = String(e.detail?.q || '').trim();
      setDiscoverQuery(q);
      goTo('discover');
    };
    window.addEventListener('cntrd:open-discover', handler);
    return () => window.removeEventListener('cntrd:open-discover', handler);
  }, [goTo]);

  // Optimistic me.following adjustment when the user follows /
  // unfollows someone. The 30s /me poll reconciles afterward.
  React.useEffect(() => {
    const handler = (e) => {
      const delta = Number(e.detail?.delta) || 0;
      if (!delta) return;
      setMe(prev => prev ? { ...prev, following: Math.max(0, (prev.following ?? 0) + delta) } : prev);
    };
    window.addEventListener('cntrd:me-follow-delta', handler);
    return () => window.removeEventListener('cntrd:me-follow-delta', handler);
  }, []);

  // Reply button on a post → open the composer with the source post pinned
  // at the top so the user can see what they're replying to.
  React.useEffect(() => {
    const handler = (e) => {
      const id = e.detail?.postId;
      if (!id) return;
      const target = posts.find(p => p.id === id) || null;
      setReplyTo(target || { id });
      goTo('compose');
    };
    window.addEventListener('cntrd:open-reply', handler);
    return () => window.removeEventListener('cntrd:open-reply', handler);
  }, [posts, goTo]);

  const screenMap = {
    home:         FeedScreen,
    profile:      ProfileScreen,
    editProfile:  EditProfileScreen,
    compose:      ComposerScreen,
    chat:         GamedayScreen,
    settings:     SettingsScreen,
    login:        LoginScreen,
    signup:       SignupScreen,
    plays:        PlaysViewerScreen,
    playsCreator: PlaysCreatorScreen,
    admin:        AdminScreen,
    teams:        TeamsEditorScreen,
    leagues:      LeaguesEditorScreen,
    blocks:       BlockedAccountsScreen,
    account:      AccountScreen,
    notificationPrefs: NotificationPrefsScreen,
    terms:        TermsScreen,
    privacy:      PrivacyScreen,
    about:        AboutScreen,
    gameDetail:   GameDetailScreen,
    teamSchedule: TeamScheduleScreen,
    userProfile:  UserProfileScreen,
    discover:     DiscoverScreen,
    postThread:   PostThreadScreen,
    followList:   FollowListScreen,
    tagFeed:      TagFeedScreen,
    messages:     MessagesRoot,
    notifications: NotificationsScreen,
  };
  const ScreenComp = screenMap[screen] || FeedScreen;
  const isAuthScreen = screen === 'login' || screen === 'signup';
  // Desktop shell wraps every authed screen, not just the feed. The shell
  // (sidebar + right rail) stays put; the *main column* swaps content based
  // on the current screen.
  const useDesktop = authed && isWide && !isAuthScreen;

  // Common props for every screen — extras are ignored where unused.
  const screenProps = {
    tweaks, setTweak, onNav: handleNav,
    me, posts, plays, games,
    selectedGame, selectedTag, selectedPlay,
    scheduleTeam,
    viewUsername,
    discoverQuery,
    threadPostId,
    followListMode, followListUsername,
    gamedayPick, setGamedayPick,
    onOpenGameday: handleOpenGameday,
    onOpenPlay: handleOpenPlay,
    onDeletePlay: handleDeletePlay,
    messageContext, setMessageContext,
    accountSection, setAccountSection,
    replyTo,
    feedPending: pendingFeed.length,
    onRefreshFeed: handleRefreshFeed,
    onPullRefreshFeed: handlePullRefreshFeed,
    unreadMessages, unreadNotifs,
    onUnread: setUnreadMessages,
    onUnreadNotifs: setUnreadNotifs,
    onLogin:     handleLogin,
    onSignup:    handleSignup,
    onPost:      handlePost,
    onCreate:    handleCreatePlay,
    onMeUpdated: handleMeUpdated,
    onOpenGame:  handleOpenGame,
  };

  const postActionsValue = React.useMemo(() => ({
    currentUserId: me?.id || null,
    onPostUpdated: handlePostUpdated,
    onPostDeleted: handlePostDeleted,
    onUserBlocked: handleUserBlocked,
  }), [me?.id, handlePostUpdated, handlePostDeleted, handleUserBlocked]);

  const themedShell = (children) => (
    <div ref={rootRef} className="cn-themed" style={{
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
    }}>
      <PostActionsContext.Provider value={postActionsValue}>
        {children}
      </PostActionsContext.Provider>
      {/* Branded replacement for native confirm() — see theme.jsx. */}
      <ConfirmHost />
    </div>
  );

  if (!bootstrapped) {
    return themedShell(
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cn-bg)', color: 'var(--cn-text-mute)',
        fontFamily: 'var(--cn-font-mono)', fontSize: 12, letterSpacing: 1,
      }}>WARMING UP</div>
    );
  }

  if (useDesktop) {
    return themedShell(
      <DesktopApp {...screenProps} screen={screen} />
    );
  }

  const showFrame = isWide;
  return themedShell(
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      background: showFrame
        ? (tweaks.dark
            ? 'radial-gradient(ellipse at 50% 0%, #1b1b22 0%, #0A0A0B 60%)'
            : 'radial-gradient(ellipse at 50% 0%, #ffffff 0%, #d9d6d0 60%)')
        : 'var(--cn-bg)',
      padding: showFrame ? '24px 16px' : 0,
    }}>
      <div style={{
        width: '100%', maxWidth: showFrame ? 460 : '100%',
        height: '100%', position: 'relative', overflow: 'hidden',
        background: 'var(--cn-bg)',
        borderRadius: showFrame ? 28 : 0,
        boxShadow: showFrame ? '0 40px 100px rgba(0,0,0,0.45), 0 0 0 0.5px var(--cn-border-s)' : 'none',
      }}>
        <ScreenComp {...screenProps} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CNTRDApp />);
