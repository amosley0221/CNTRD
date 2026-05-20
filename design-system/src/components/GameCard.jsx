import { c, fonts } from '../tokens';
import TeamMark from './TeamMark';
import LiveDot from './LiveDot';

export default function GameCard({ state, league, status, away, home, foot1, foot2 }) {
  const showOdds = state === 'UPCOMING';
  const statusColor = state === 'LIVE' ? c.accent : state === 'BREAK' ? c.alert : c.inkDim;

  return (
    <div
      className="relative p-5 flex flex-col transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: c.paper, border: `1px solid ${c.line}`, minHeight: 220 }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.inkFaint)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = c.line)}
    >
      <span
        className="absolute"
        style={{
          top: -10, left: 18, background: c.paper, padding: '0 8px',
          fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.2em',
          color: c.accent, textTransform: 'uppercase',
        }}
      >
        STATE · {state}
      </span>

      <div className="flex justify-between items-center mb-5">
        <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.inkDim }}>{league}</span>
        <span className="flex items-center gap-1.5" style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.15em', color: statusColor }}>
          {(state === 'LIVE' || state === 'BREAK') && <LiveDot tone={state === 'BREAK' ? 'alert' : 'accent'} />}
          {status}
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {[away, home].map((team, idx) => (
          <div key={idx} className="grid items-center gap-3" style={{ gridTemplateColumns: '26px 1fr auto' }}>
            <TeamMark code={team.code} color={team.color} />
            <span style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em', color: team.lead ? c.ink : c.inkDim }}>
              {team.name}
            </span>
            <span style={{
              fontFamily: fonts.display,
              fontSize: showOdds ? 16 : 28,
              fontWeight: showOdds ? 400 : 300,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.04em',
              color: showOdds ? c.inkDim : (team.lead ? c.accent : c.inkDim),
            }}>
              {showOdds ? team.odds : team.score}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 flex justify-between"
        style={{ borderTop: `1px dashed ${c.line}`, fontFamily: fonts.mono, fontSize: 9.5, color: c.inkDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        <span>{foot1}</span>
        <span>{foot2}</span>
      </div>
    </div>
  );
}
