// theme.jsx — shared theme tokens and atoms (TeamPill, Avatar, Icons)
// Owns CSS variables for dark/light + accent + density + typography.

const THEMES = {
  dark: {
    bg:        '#0A0A0B',
    bgElev:    '#131316',
    bgElev2:   '#1B1B20',
    bgInput:   '#17171B',
    border:    'rgba(255,255,255,0.08)',
    borderS:   'rgba(255,255,255,0.14)',
    text:      '#F4F1EA',
    textDim:   'rgba(244,241,234,0.62)',
    textMute:  'rgba(244,241,234,0.38)',
    danger:    '#FF4D4F',
    live:      '#FF3B30',
    success:   '#22C55E',
  },
  light: {
    bg:        '#F4F1EA',
    bgElev:    '#FFFFFF',
    bgElev2:   '#FAF8F2',
    bgInput:   '#FFFFFF',
    border:    'rgba(10,10,11,0.08)',
    borderS:   'rgba(10,10,11,0.18)',
    text:      '#0A0A0B',
    textDim:   'rgba(10,10,11,0.62)',
    textMute:  'rgba(10,10,11,0.42)',
    danger:    '#E11D48',
    live:      '#DC2626',
    success:   '#15803D',
  },
};

const TYPE_PAIRS = {
  stadium:  {
    display: '"Anton", "Oswald", system-ui, sans-serif',
    body:    '"Inter Tight", "Inter", system-ui, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, monospace',
    displayWeight: 400,
    displayCase: 'uppercase',
    displaySpacing: '-0.01em',
  },
  editorial:  {
    display: '"Fraunces", Georgia, serif',
    body:    '"Inter Tight", system-ui, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, monospace',
    displayWeight: 600,
    displayCase: 'none',
    displaySpacing: '-0.025em',
  },
  modern: {
    display: '"Space Grotesk", system-ui, sans-serif',
    body:    '"Inter Tight", system-ui, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, monospace',
    displayWeight: 600,
    displayCase: 'none',
    displaySpacing: '-0.02em',
  },
};

const DENSITY = {
  cozy:    { feedGap: 0,  postPadV: 18, postPadH: 18, fontBody: 15 },
  compact: { feedGap: 0,  postPadV: 12, postPadH: 16, fontBody: 14 },
};

// Apply tweaks → CSS variables on a target element (so it cascades into shadowed iframes too).
function applyTheme(target, tweaks) {
  const t = THEMES[tweaks.dark ? 'dark' : 'light'];
  const tp = TYPE_PAIRS[tweaks.typePair || 'stadium'];
  const d = DENSITY[tweaks.density || 'cozy'];
  const accent = tweaks.accent || '#D4FF3A';
  const onAccent = pickContrast(accent);

  const vars = {
    '--cn-bg': t.bg,
    '--cn-bg-elev': t.bgElev,
    '--cn-bg-elev2': t.bgElev2,
    '--cn-bg-input': t.bgInput,
    '--cn-border': t.border,
    '--cn-border-s': t.borderS,
    '--cn-text': t.text,
    '--cn-text-dim': t.textDim,
    '--cn-text-mute': t.textMute,
    '--cn-danger': t.danger,
    '--cn-live': t.live,
    '--cn-success': t.success,
    '--cn-accent': accent,
    '--cn-on-accent': onAccent,
    '--cn-font-display': tp.display,
    '--cn-font-body': tp.body,
    '--cn-font-mono': tp.mono,
    '--cn-display-weight': tp.displayWeight,
    '--cn-display-case': tp.displayCase,
    '--cn-display-spacing': tp.displaySpacing,
    '--cn-feed-gap': d.feedGap + 'px',
    '--cn-post-pad-v': d.postPadV + 'px',
    '--cn-post-pad-h': d.postPadH + 'px',
    '--cn-font-body-size': d.fontBody + 'px',
  };
  Object.entries(vars).forEach(([k, v]) => target.style.setProperty(k, v));
}

function pickContrast(hex) {
  // crude luminance check
  const c = hex.replace('#', '');
  if (c.length < 6) return '#000';
  const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.55 ? '#000' : '#fff';
}

// Resolve a stored team identifier (composite "NFL:PHI" or bare "PHI")
// to a team record from the dynamic registry, falling back to the static map.
function resolveTeam(idOrCode) {
  if (!idOrCode) return null;
  const s = String(idOrCode).trim().toUpperCase();
  if (window.TEAMS_BY_KEY && window.TEAMS_BY_KEY[s]) return window.TEAMS_BY_KEY[s];
  if (TEAMS[s]) return TEAMS[s];
  if (s.includes(':')) {
    const bare = s.split(':').pop();
    return TEAMS[bare] || null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// TeamPill — colored pill with team code (option 0 from designs)
// ─────────────────────────────────────────────────────────────
function TeamPill({ code, size = 'sm', onClick, noLink }) {
  const team = resolveTeam(code);
  if (!team) return null;
  const sizes = {
    xs: { h: 14, fs: 9,  px: 5 },
    sm: { h: 16, fs: 9.5,px: 6 },
    md: { h: 20, fs: 11, px: 8 },
    lg: { h: 26, fs: 13, px: 10 },
  };
  const s = sizes[size] || sizes.sm;
  const textCol = pickContrast(team.primary);
  // By default any pill is a link to that team's tag feed. Anywhere that
  // shouldn't navigate (e.g. inside the team-picker) passes `noLink`.
  const handleClick = onClick || (noLink ? undefined : (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cntrd:open-tag', { detail: code }));
    }
  });
  const isClickable = !!handleClick;
  return (
    <span
      role={isClickable ? 'button' : undefined}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: s.h,
        padding: `0 ${s.px}px`,
        background: team.primary,
        color: textCol,
        borderRadius: 999,
        fontSize: s.fs,
        fontWeight: 800,
        letterSpacing: 0.4,
        fontFamily: 'var(--cn-font-body)',
        cursor: isClickable ? 'pointer' : 'default',
        boxShadow: `inset 0 0 0 1.5px ${team.accent}55`,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {team.code}
    </span>
  );
}

function TeamTagsRow({ codes, size = 'sm' }) {
  if (!codes || !codes.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {codes.map(c => <TeamPill key={c} code={c} size={size} />)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Avatar — gradient + initials (no real images needed)
// ─────────────────────────────────────────────────────────────
function Avatar({ user, size = 32, ring = false, ringColor = 'var(--cn-accent)' }) {
  const u = (typeof user === 'string') ? USERS[user] : user;
  if (!u) return null;
  const fs = Math.max(10, Math.round(size * 0.36));
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarBg(u.avatarHue ?? 200),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.95)',
      fontFamily: 'var(--cn-font-body)',
      fontWeight: 700, fontSize: fs, letterSpacing: 0.5,
      flexShrink: 0,
      boxShadow: ring
        ? `0 0 0 2px var(--cn-bg), 0 0 0 ${2 + 2}px ${ringColor}`
        : 'inset 0 0 0 0.5px rgba(255,255,255,0.1)',
    }}>
      {avatarInitials(u.displayName)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons — minimal set, stroked
// ─────────────────────────────────────────────────────────────
function Icon({ name, size = 20, stroke = 'currentColor', fill = 'none', sw = 1.75 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill, stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home':       return <svg {...p}><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z"/></svg>;
    case 'home-fill':  return <svg {...p} fill={stroke}><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z"/></svg>;
    case 'search':     return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'plus':       return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'bell':       return <svg {...p}><path d="M6 8a6 6 0 0112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 004 0"/></svg>;
    case 'profile':    return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case 'heart':      return <svg {...p}><path d="M12 21s-7-4.5-9.5-9A5 5 0 0112 7.5 5 5 0 0121.5 12C19 16.5 12 21 12 21z"/></svg>;
    case 'heart-fill': return <svg {...p} fill={stroke} stroke="none"><path d="M12 21s-7-4.5-9.5-9A5 5 0 0112 7.5 5 5 0 0121.5 12C19 16.5 12 21 12 21z"/></svg>;
    case 'reply':      return <svg {...p}><path d="M21 12a8 8 0 01-11.4 7.3L3 21l1.7-6.6A8 8 0 1121 12z"/></svg>;
    case 'repost':     return <svg {...p}><path d="M17 2l4 4-4 4"/><path d="M21 6H7a4 4 0 00-4 4v2"/><path d="M7 22l-4-4 4-4"/><path d="M3 18h14a4 4 0 004-4v-2"/></svg>;
    case 'share':      return <svg {...p}><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>;
    case 'bookmark':   return <svg {...p}><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>;
    case 'verified':   return <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke}><path d="M12 1l2.4 2.5 3.4-.4.4 3.4L21 8.6l-1.5 3.1 1.5 3.1-2.8 2.1-.4 3.4-3.4-.4L12 23l-2.4-2.5-3.4.4-.4-3.4L3 15.4l1.5-2.8L3 9.6l2.8-2.1.4-3.4 3.4.4z"/><path d="M8 12l3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case 'live-dot':   return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="var(--cn-live)"/></svg>;
    case 'lightning':  return <svg {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>;
    case 'flame':      return <svg {...p}><path d="M12 2c1 4 5 5 5 10a5 5 0 11-10 0c0-3 2-4 2-7 1 1 3 2 3-3z"/></svg>;
    case 'mic':        return <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>;
    case 'image':      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
    case 'video':      return <svg {...p}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2"/></svg>;
    case 'poll':       return <svg {...p}><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7"/><rect x="12" y="7" width="3" height="11"/><rect x="17" y="14" width="3" height="4"/></svg>;
    case 'chat':       return <svg {...p}><path d="M21 12a8 8 0 01-11.4 7.3L3 21l1.7-3.6A8 8 0 1121 12z"/></svg>;
    case 'eye':        return <svg {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'settings':   return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>;
    case 'logout':     return <svg {...p}><path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>;
    case 'check':      return <svg {...p}><path d="M5 12l5 5L20 7"/></svg>;
    case 'x':          return <svg {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'chevron-l':  return <svg {...p}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'chevron-r':  return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case 'send':       return <svg {...p}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>;
    case 'flash':      return <svg {...p}><path d="M5 8a7 7 0 0114 0v4M3 12h18M7 16h10"/></svg>;
    case 'sticker':    return <svg {...p}><path d="M15 3h-9a3 3 0 00-3 3v12a3 3 0 003 3h9l6-6V6a3 3 0 00-3-3z"/><path d="M15 21v-6h6"/></svg>;
    case 'text':       return <svg {...p}><path d="M5 5h14M12 5v14M9 19h6"/></svg>;
    case 'whistle':    return <svg {...p}><circle cx="9" cy="13" r="6"/><path d="M9 7l11-4-2 5"/></svg>;
    default: return null;
  }
}

// usePullToRefresh — touch-only pull-to-refresh for any vertical scroller.
// Pass a ref to the scrollable element and a refresh callback. The hook
// returns { distance, refreshing, complete } so the caller can render its
// own indicator. Triggering only fires when the scroller is already at the
// top so a normal swipe doesn't intercept the gesture.
function usePullToRefresh(ref, onRefresh, { threshold = 64, max = 110 } = {}) {
  const [distance, setDistance] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const startY = React.useRef(0);
  const tracking = React.useRef(false);

  React.useEffect(() => {
    const el = ref?.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (refreshing) return;
      if (el.scrollTop > 0) return;     // not at the top — let native scroll win
      const t = e.touches && e.touches[0];
      if (!t) return;
      startY.current = t.clientY;
      tracking.current = true;
    };
    const onTouchMove = (e) => {
      if (!tracking.current || refreshing) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      if (dy <= 0) {
        setDistance(0);
        return;
      }
      // Resistance — pull feels heavier the further you go.
      const eased = Math.min(max, dy * 0.55);
      setDistance(eased);
      // Only intercept the touch once we're actively pulling. Calling
      // preventDefault keeps the page from rubber-banding on iOS.
      if (e.cancelable && eased > 8) e.preventDefault();
    };
    const onTouchEnd = async () => {
      if (!tracking.current) return;
      tracking.current = false;
      const triggered = distance >= threshold;
      if (!triggered) {
        setDistance(0);
        return;
      }
      setRefreshing(true);
      setDistance(threshold);
      try { await onRefresh?.(); }
      catch { /* swallow — caller surfaces errors however it wants */ }
      finally {
        setRefreshing(false);
        setDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [ref, onRefresh, refreshing, distance, threshold, max]);

  return { distance, refreshing };
}

// Small indicator that pairs with usePullToRefresh. Render it as the first
// child of the scroller; it occupies whatever vertical space the user has
// pulled.
function PullIndicator({ distance, refreshing, threshold = 64 }) {
  const visible = refreshing || distance > 4;
  const ready = !refreshing && distance >= threshold;
  return (
    <div aria-hidden style={{
      height: refreshing ? threshold : distance,
      transition: refreshing ? 'height 180ms ease' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      color: 'var(--cn-text-mute)',
      fontFamily: 'var(--cn-font-mono)', fontSize: 11, letterSpacing: 0.5,
    }}>
      {visible && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          color: ready || refreshing ? 'var(--cn-accent)' : 'var(--cn-text-mute)',
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '1.5px solid currentColor',
            borderTopColor: refreshing ? 'transparent' : 'currentColor',
            animation: refreshing ? 'cn-spin 0.8s linear infinite' : 'none',
          }} />
          {refreshing ? 'REFRESHING' : ready ? 'RELEASE TO REFRESH' : 'PULL TO REFRESH'}
        </span>
      )}
    </div>
  );
}

Object.assign(window, {
  THEMES, TYPE_PAIRS, DENSITY, applyTheme, pickContrast, resolveTeam,
  TeamPill, TeamTagsRow, Avatar, Icon,
  usePullToRefresh, PullIndicator,
});
