import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, LiveDot, GameCard } from '../components';
import { games as gamesApi } from '../api';

const LEAGUE_COLORS = {
  NFL: '#013369', NBA: '#c8102e', MLB: '#002d72', NHL: '#000000',
  EPL: '#37003c', MLS: '#001e62', NCAAF: '#a32035', NCAAB: '#a32035',
};

export default function Gameday() {
  const [games, setGames] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await gamesApi.all();
        if (!cancel) setGames(data || { live: [], upcoming: [], recent: [] });
      } catch {
        if (!cancel) setGames({ live: [], upcoming: [], recent: [] });
      }
    })();
    return () => { cancel = true; };
  }, []);

  if (!games) {
    return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>LOADING…</div>;
  }

  const live = games.live || [];
  const upcoming = (games.upcoming || []).slice(0, 8);

  return (
    <>
      <Eyebrow>Gameday · live rooms</Eyebrow>
      <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 300, letterSpacing: '-0.04em', marginBottom: 20 }}>
        Pick a game, <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>join the chat</em>.
      </h1>

      <SectionHead title="Live" italicWord="now" count={`${live.length}`} />
      {live.length === 0 && (
        <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, marginBottom: 24 }}>
          No live games right now.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
        {live.map((g) => <GameTile key={g.id} game={g} />)}
      </div>

      <SectionHead title="Up" italicWord="next" count={`${upcoming.length}`} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {upcoming.map((g) => <GameTile key={g.id} game={g} upcoming />)}
      </div>
    </>
  );
}

function GameTile({ game, upcoming }) {
  const away = teamPair(game, 'away');
  const home = teamPair(game, 'home');
  return (
    <Link
      to={`/gameday/${game.id}`}
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
        color: upcoming ? c.inkDim : c.accent, textTransform: 'uppercase',
      }}>
        {upcoming ? 'UPCOMING' : 'JOIN CHAT'}
      </span>

      <div className="flex justify-between items-center mb-5">
        <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.inkDim }}>{game.league}</span>
        <span className="flex items-center gap-1.5" style={{ fontFamily: fonts.mono, fontSize: 10, color: upcoming ? c.inkDim : c.accent, letterSpacing: '0.15em' }}>
          {!upcoming && <LiveDot tone="accent" />}
          {game.status_detail || game.detail || (upcoming ? (game.kickoff_label || 'SOON') : 'LIVE')}
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {[away, home].map((t, i) => (
          <div key={i} className="grid items-center gap-3" style={{ gridTemplateColumns: '26px 1fr auto' }}>
            <span style={{
              width: 26, height: 26, borderRadius: 2,
              background: t.color, color: c.paper,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: fonts.mono, fontSize: 10, fontWeight: 700,
            }}>{t.code}</span>
            <span style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 500, color: c.ink }}>{t.name}</span>
            {!upcoming && (
              <span style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', color: c.ink }}>
                {t.score}
              </span>
            )}
          </div>
        ))}
      </div>
    </Link>
  );
}

function teamPair(g, side) {
  const name = side === 'home' ? (g.home_name || g.home || '') : (g.away_name || g.away || '');
  const code = (side === 'home' ? g.home_abbr : g.away_abbr) || name.slice(0, 3).toUpperCase();
  const color = (side === 'home' ? g.home_color : g.away_color) || LEAGUE_COLORS[g.league] || '#444';
  const score = side === 'home' ? g.home_score : g.away_score;
  return { code, color, name, score: score ?? '—' };
}
