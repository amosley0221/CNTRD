import { useEffect, useState } from 'react';
import { Navigate, useParams, useLocation } from 'react-router-dom';
import { c, fonts } from '../tokens';
import { Eyebrow } from '../components';
import { messages as msgsApi } from '../api';

// Resolve the gameday conversation for a game, then redirect to the
// normal thread route so all the polling + send logic lives in one
// place (Thread.jsx).
export default function GamedayRoom() {
  const { gameId } = useParams();
  const loc = useLocation();
  const game = loc.state?.game;
  const [err, setErr] = useState(null);
  const [redirectTo, setRedirectTo] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const conv = await msgsApi.gameday(gameId, game?.status, game?.start_date || game?.kickoff);
        if (!cancel) setRedirectTo(`/messages/${conv.id}`);
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [gameId]); // eslint-disable-line

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <>
      <Eyebrow>Joining gameday room</Eyebrow>
      <div style={{ fontFamily: fonts.mono, fontSize: 11, color: err ? c.alert : c.inkDim, letterSpacing: '0.2em' }}>
        {err || 'CONNECTING…'}
      </div>
    </>
  );
}
