import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './routes/Layout';
import Login from './routes/Login';
import Register from './routes/Register';
import Feed from './routes/Feed';
import Profile from './routes/Profile';
import ComingSoon from './routes/ComingSoon';
import Showcase from './Showcase';
import { c, fonts } from './tokens';

function RequireAuth({ children }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.paper, fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>
        WARMING UP
      </div>
    );
  }
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter basename="/v2">
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/feed" replace />} />
            <Route path="login"    element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="_showcase" element={<Showcase />} />
            <Route path="feed"     element={<RequireAuth><Feed /></RequireAuth>} />
            <Route path="me"       element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="u/:username" element={<Profile />} />

            <Route path="plays" element={<ComingSoon
              title="Plays" italicWord="creator"
              blurb="Camera capture, 30-second clips, in-app stickers and team-color overlays. Wiring the existing /api/plays endpoints into the new editor surface — back here next."
              legacyPath="/?screen=playsCreator" />}
            />
            <Route path="messages" element={<ComingSoon
              title="Messages" italicWord="inbox"
              blurb="DMs and group chats with read receipts, port from the live SQLite messages table. Coming in the next slice."
              legacyPath="/?screen=messages" />}
            />
            <Route path="gameday" element={<ComingSoon
              title="Gameday" italicWord="chat"
              blurb="The big-game live chat with score-pinned events and team-color sidebars."
              legacyPath="/?screen=chat" />}
            />
            <Route path="notifications" element={<ComingSoon
              title="Bell" italicWord="notifications"
              blurb="Push toggles, in-app feed, dedupe. Push subscriptions table is already wired server-side."
              legacyPath="/?screen=notifications" />}
            />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div style={{ paddingTop: 80, textAlign: 'center' }}>
      <h1 style={{ fontFamily: fonts.display, fontSize: 72, fontWeight: 300, color: c.accent, letterSpacing: '-0.04em' }}>404</h1>
      <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>NOT FOUND</div>
    </div>
  );
}
