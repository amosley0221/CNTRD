// app.jsx — CNTRD app entry. Wires the design components into a real SPA:
// theme persistence, screen routing, and a responsive mobile/desktop swap.

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
  authed: 'cntrd:authed',
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

function CNTRDApp() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [authed, setAuthed] = React.useState(() => {
    try { return localStorage.getItem(STORAGE.authed) === '1'; } catch { return false; }
  });
  const [screen, setScreen] = React.useState(() => {
    try {
      const s = localStorage.getItem(STORAGE.screen);
      if (s) return s;
    } catch {}
    return authed ? 'home' : 'login';
  });

  const isWide = useMediaQuery('(min-width: 980px)');
  const rootRef = React.useRef(null);

  React.useLayoutEffect(() => {
    if (rootRef.current) applyTheme(rootRef.current, tweaks);
    applyTheme(document.documentElement, tweaks);
    document.body.style.background = 'var(--cn-bg)';
    document.body.style.color = 'var(--cn-text)';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tweaks.dark ? '#0A0A0B' : '#F4F1EA');
  }, [tweaks]);

  const handleNav = React.useCallback((next) => {
    if (next === 'logout') {
      try { localStorage.removeItem(STORAGE.authed); } catch {}
      setAuthed(false);
      setScreen('login');
      try { localStorage.setItem(STORAGE.screen, 'login'); } catch {}
      return;
    }
    if (next === 'home' || next === 'profile' || next === 'compose' || next === 'chat'
        || next === 'settings' || next === 'plays' || next === 'playsCreator' || next === 'search') {
      if (!authed) {
        try { localStorage.setItem(STORAGE.authed, '1'); } catch {}
        setAuthed(true);
      }
    }
    const target = next === 'search' ? 'home' : next;
    setScreen(target);
    try { localStorage.setItem(STORAGE.screen, target); } catch {}
  }, [authed]);

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

  const themedShell = (children) => (
    <div ref={rootRef} className="cn-themed" style={{
      width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative',
    }}>
      {children}
    </div>
  );

  if (useDesktop) {
    return themedShell(
      <DesktopApp tweaks={tweaks} setTweak={setTweak} onNav={handleNav} />
    );
  }

  // Mobile-style screen: phone-width column centered on wider viewports.
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
        <ScreenComp tweaks={tweaks} setTweak={setTweak} onNav={handleNav} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CNTRDApp />);
