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
  return [t, setTweak];
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
    teams: Array.isArray(u.team_tags) ? u.team_tags : [],
    followers: u.follower_count ?? 0,
    following: u.following_count ?? 0,
    posts: u.post_count ?? 0,
    avatar: u.avatar,
    avatarHue: u.avatar_hue ?? 200,
  };
}

function CNTRDApp() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [me, setMe] = React.useState(null);
  const [bootstrapped, setBootstrapped] = React.useState(false);
  const [posts, setPosts] = React.useState([]);
  const [plays, setPlays] = React.useState([]);
  const [screen, setScreen] = React.useState('login');

  const isWide = useMediaQuery('(min-width: 980px)');
  const rootRef = React.useRef(null);
  const authed = !!me;

  React.useLayoutEffect(() => {
    if (rootRef.current) applyTheme(rootRef.current, tweaks);
    applyTheme(document.documentElement, tweaks);
    document.body.style.background = 'var(--cn-bg)';
    document.body.style.color = 'var(--cn-text)';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tweaks.dark ? '#0A0A0B' : '#F4F1EA');
  }, [tweaks]);

  // Reflect ME globally so design components that read window.ME pick it up.
  React.useEffect(() => { window.ME = me || (window.__originalME ||= window.ME); }, [me]);

  // Bootstrap: try existing token → /me; pick a sensible initial screen.
  React.useEffect(() => {
    let cancelled = false;
    async function boot() {
      window.__originalME = window.ME;
      let user = null;
      if (API.hasToken()) {
        try { user = normalizeMe(await API.me()); }
        catch { API.setToken(null); }
      }
      if (cancelled) return;
      setMe(user);
      try {
        const stored = localStorage.getItem(STORAGE.screen);
        setScreen(user ? (stored || 'home') : 'login');
      } catch { setScreen(user ? 'home' : 'login'); }
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
      } catch (e) {
        // Network/server hiccup — fall back to mock data already in window.POSTS/PLAYS.
        if (!cancelled) { setPosts([]); setPlays([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [authed, bootstrapped]);

  const handleNav = React.useCallback((next) => {
    if (next === 'logout') {
      API.setToken(null);
      setMe(null);
      setScreen('login');
      try { localStorage.setItem(STORAGE.screen, 'login'); } catch {}
      return;
    }
    const target = next === 'search' ? 'home' : next;
    setScreen(target);
    try { localStorage.setItem(STORAGE.screen, target); } catch {}
  }, []);

  const handleLogin = React.useCallback(async ({ login, password }) => {
    const { token, user } = await API.login({ login, password });
    API.setToken(token);
    setMe(normalizeMe(user));
  }, []);

  const handleSignup = React.useCallback(async ({ email, username, password, teams, avatar_hue }) => {
    const { token, user } = await API.register({
      email, username, password,
      display_name: username,
      teams, avatar_hue,
    });
    API.setToken(token);
    setMe(normalizeMe(user));
  }, []);

  const handlePost = React.useCallback(async ({ content, type, tags }) => {
    const created = await API.createPost({ content, type, tags });
    const norm = normalizePost(created);
    setPosts(prev => [norm, ...prev]);
    setMe(prev => prev ? { ...prev, posts: (prev.posts ?? 0) + 1 } : prev);
  }, []);

  const handleCreatePlay = React.useCallback(async ({ team_code, label, hue }) => {
    const created = await API.createPlay({ team_code, label, hue });
    const norm = normalizePlay(created);
    setPlays(prev => [norm, ...prev]);
  }, []);

  const screenMap = {
    home:         FeedScreen,
    profile:      ProfileScreen,
    compose:      ComposerScreen,
    chat:         GamedayScreen,
    settings:     SettingsScreen,
    login:        LoginScreen,
    signup:       SignupScreen,
    plays:        PlaysViewerScreen,
    playsCreator: PlaysCreatorScreen,
  };
  const ScreenComp = screenMap[screen] || FeedScreen;
  const isAuthScreen = screen === 'login' || screen === 'signup';
  const useDesktop = authed && isWide && !isAuthScreen;

  // Common props for every screen — extras are ignored where unused.
  const screenProps = {
    tweaks, setTweak, onNav: handleNav,
    me, posts, plays,
    onLogin:  handleLogin,
    onSignup: handleSignup,
    onPost:   handlePost,
    onCreate: handleCreatePlay,
  };

  const themedShell = (children) => (
    <div ref={rootRef} className="cn-themed" style={{
      width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative',
    }}>
      {children}
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
      <DesktopApp {...screenProps} />
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
