import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './routes/Layout';
import Login from './routes/Login';
import Register from './routes/Register';
import Feed from './routes/Feed';
import Profile from './routes/Profile';
import Plays from './routes/Plays';
import PlayCreator from './routes/PlayCreator';
import PlayViewer from './routes/PlayViewer';
import Composer from './routes/Composer';
import Messages from './routes/Messages';
import Thread from './routes/Thread';
import NewMessage from './routes/NewMessage';
import Gameday from './routes/Gameday';
import GamedayRoom from './routes/GamedayRoom';
import Notifications from './routes/Notifications';
import PostThread from './routes/PostThread';
import EditProfile from './routes/EditProfile';
import Search from './routes/Search';
import GameCenter from './routes/GameCenter';
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
            <Route path="compose"  element={<RequireAuth><Composer /></RequireAuth>} />
            <Route path="plays"           element={<Plays />} />
            <Route path="plays/new"       element={<RequireAuth><PlayCreator /></RequireAuth>} />
            <Route path="plays/:id"       element={<PlayViewer />} />

            <Route path="messages"         element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="messages/new"     element={<RequireAuth><NewMessage /></RequireAuth>} />
            <Route path="messages/:id"     element={<RequireAuth><Thread /></RequireAuth>} />
            <Route path="gameday"          element={<RequireAuth><Gameday /></RequireAuth>} />
            <Route path="gameday/:gameId"  element={<RequireAuth><GamedayRoom /></RequireAuth>} />
            <Route path="notifications"    element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="post/:id"         element={<PostThread />} />
            <Route path="me/edit"          element={<RequireAuth><EditProfile /></RequireAuth>} />
            <Route path="search"           element={<Search />} />
            <Route path="game/:league/:id" element={<GameCenter />} />

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
