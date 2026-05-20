import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, PlusSquare, Trophy, User, LogOut } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Logo, LiveDot } from '../components';
import { useAuth } from '../auth/AuthContext';

const TABS = [
  { to: '/feed',          icon: Home,          label: 'Feed' },
  { to: '/messages',      icon: MessageCircle, label: 'Messages' },
  { to: '/plays',         icon: PlusSquare,    label: 'Plays', accent: true },
  { to: '/gameday',       icon: Trophy,        label: 'Gameday' },
  { to: '/me',            icon: User,          label: 'You' },
];

export default function Layout() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const showNav = !!me && !loc.pathname.startsWith('/login') && !loc.pathname.startsWith('/register');

  return (
    <div style={{ background: c.paper, color: c.ink, fontFamily: fonts.body, minHeight: '100vh', paddingBottom: showNav ? 96 : 0 }}>
      <header
        className="sticky top-0 z-50 backdrop-blur"
        style={{ background: c.paper + 'd9', borderBottom: `1px solid ${c.line}` }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 md:px-8" style={{ maxWidth: 980, margin: '0 auto' }}>
          <NavLink to="/feed"><Logo /></NavLink>
          <div className="flex items-center gap-4" style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.1em' }}>
            {me ? (
              <>
                <span className="flex items-center gap-1.5" style={{ color: c.alert, textTransform: 'uppercase' }}>
                  <LiveDot tone="alert" />LIVE
                </span>
                <button
                  onClick={async () => { await logout(); nav('/login', { replace: true }); }}
                  className="flex items-center gap-1.5"
                  style={{ color: c.inkDim, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em' }}
                  aria-label="Log out"
                >
                  <LogOut size={13} /> SIGN OUT
                </button>
              </>
            ) : (
              <NavLink to="/login" style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.15em', color: c.accent }}>
                SIGN IN
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px 8px' }}>
        <Outlet />
      </main>

      {showNav && (
        <nav
          className="fixed left-0 right-0 backdrop-blur"
          style={{
            bottom: 0,
            paddingBottom: 6,
            paddingTop: 8,
            background: c.paper + 'ee',
            borderTop: `1px solid ${c.line}`,
            zIndex: 40,
          }}
        >
          <div className="flex items-stretch justify-around" style={{ maxWidth: 720, margin: '0 auto' }}>
            {TABS.map(({ to, icon: Icon, label, accent }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '4px 10px',
                  color: isActive ? c.accent : c.inkDim,
                  fontFamily: fonts.mono,
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                })}
              >
                {({ isActive }) =>
                  accent ? (
                    <div style={{
                      width: 38, height: 30, borderRadius: 6,
                      background: c.accent, color: c.paper,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={20} strokeWidth={2.2} />
                    </div>
                  ) : (
                    <>
                      <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                      <span>{label.toUpperCase()}</span>
                    </>
                  )
                }
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
