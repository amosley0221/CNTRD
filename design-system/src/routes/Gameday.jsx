import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, LiveDot } from '../components';
import { games as gamesApi } from '../api';
import { team, statusLabel, leader, isScheduled } from '../lib/games';

export default function Gameday() {
  const [games, setGames] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await gamesApi.all();
      setGames(data || { live: [], upcoming: [], recent: [] });
      // The endpoint answers 200 with an `error` key when the upstream
      // scoreboard is unreachable — surface that instead of rendering
      // an empty board as if nothing were on today.
      if (data?.error) setErr(data.error);
    } catch (e) {
      setErr(e.message || 'Could not reach the scoreboard.');
      setGames({ live: [], upcoming: [], recent: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !games) {
    return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>LOADING…</div>;
  }

  const live = games?.live || [];
  const upcoming = (games?.upcoming || []).slice(0, 12);

  return (
    <>
      <Eyebrow>Gameday · live rooms</Eyebrow>
      <h1 className="fraunces-soft" style={{ fontFamily: fonts.display, fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 300, letterSpacing: '-0.04em', marginBottom: 20 }}>
        Pick a game, <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>join the chat</em>.
      </h1>

      {err && <ScoreboardError message={err} onRetry={load} />}

      <SectionHead title="Live" italicWord="now" count={`${live.length}`} />
      {live.length === 0 && !err && (
        <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, marginBottom: 24 }}>
          No live games right now.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
        {live.map((g) => <GameTile key={g.id} game={g} />)}
      </div>

      <SectionHead title="Up" italicWord="next" count={`${upcoming.length}`} />
      {upcoming.length === 0 && !err && (
        <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft }}>
          Nothing scheduled in the next day and a half.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {upcoming.map((g) => <GameTile key={g.id} game={g} upcoming />)}
      </div>
    </>
  );
}

function ScoreboardError({ message, onRetry }) {
  return (
    <div
      className="flex items-center justify-between gap-4 mb-8 flex-wrap"
      style={{ padding: '14px 16px', border: `1px solid ${c.alert}`, background: c.surface }}
    >
      <div>
        <div style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.alert, textTransform: 'uppercase' }}>
          Scoreboard unavailable
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 14, color: c.inkSoft, marginTop: 4 }}>
          {message}
        </div>
      </div>
      <button
        onClick={onRetry}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 14px', border: `1px solid ${c.accent}`, background: 'transparent',
          color: c.accent, cursor: 'pointer',
          fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
        }}
      >
        <RefreshCw size={13} /> Retry
      </button>
    </div>
  );
}

function GameTile({ game, upcoming }) {
  const away = team(game, 'away');
  const home = team(game, 'home');
  const lead = leader(game);
  const scheduled = upcoming || isScheduled(game);

  return (
    <Link
      to={`/gameday/${encodeURIComponent(game.id)}`}
      state={{ game }}
      style={{
        position: 'relative', padding: 20,
        background: c.paper, border: `1px solid ${c.line}`,
        display: 'flex', flexDirection: 'column',
        color: 'inherit', textDecoration: 'none',
        minHeight: 180,
      }}
    >
      <span style={{
        position: 'absolute', top: -10, left: 18, background: c.paper, padding: '0 8px',
        fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.2em',
        color: scheduled ? c.inkDim : c.accent, textTransform: 'uppercase',
      }}>
        {scheduled ? 'UPCOMING' : 'JOIN CHAT'}
      </span>

      <div className="flex justify-between items-center mb-5">
        <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.inkDim }}>{game.league}</span>
        <span className="flex items-center gap-1.5" style={{ fontFamily: fonts.mono, fontSize: 10, color: scheduled ? c.inkDim : c.accent, letterSpacing: '0.15em' }}>
          {!scheduled && <LiveDot tone="accent" />}
          {statusLabel(game) || (scheduled ? 'SOON' : 'LIVE')}
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {[['away', away], ['home', home]].map(([sideKey, t]) => (
          <div key={sideKey} className="grid items-center gap-3" style={{ gridTemplateColumns: '26px 1fr auto' }}>
            <span style={{
              width: 26, height: 26, borderRadius: 2,
              background: t.color, color: c.paper,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: fonts.mono, fontSize: 10, fontWeight: 700,
            }}>{t.code}</span>
            <span style={{
              fontFamily: fonts.display, fontSize: 17, fontWeight: 500,
              color: lead === sideKey ? c.ink : c.inkDim,
            }}>
              {t.name}
            </span>
            <span style={{
              fontFamily: fonts.display, fontSize: scheduled ? 14 : 24,
              fontWeight: scheduled ? 400 : 300,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
              color: lead === sideKey ? c.accent : c.inkDim,
            }}>
              {scheduled ? (t.record || '') : t.score}
            </span>
          </div>
        ))}
      </div>
    </Link>
  );
}
