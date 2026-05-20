import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageCircle } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, LiveDot } from '../components';
import { games as gamesApi } from '../api';
import { Reveal, CountUp } from '../hooks/useReveal';

export default function GameCenter() {
  const { league, id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancel = false;
    let timer = null;
    const load = async () => {
      try {
        const d = await gamesApi.detail(league, id);
        if (!cancel) setData(d);
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    };
    load();
    timer = setInterval(load, 20000);   // refresh every 20s while open
    return () => { cancel = true; if (timer) clearInterval(timer); };
  }, [league, id]);

  if (err) return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert }}>{err}</div>;
  if (!data) return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>LOADING…</div>;

  const isLive  = data.state === 'live';
  const isFinal = data.state === 'final';

  const away = data.away;
  const home = data.home;
  const periods = Math.max(away.line?.length || 0, home.line?.length || 0);
  const hasLine = periods > 0;
  const homeLead = Number(home.score) > Number(away.score);
  const awayLead = Number(away.score) > Number(home.score);

  return (
    <>
      <button
        onClick={() => nav(-1)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: c.inkDim, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12, padding: 0 }}
      >
        <ChevronLeft size={18} /> <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em' }}>BACK</span>
      </button>

      <Reveal>
        <div className="flex items-center gap-3 mb-8" style={{ color: c.accent, fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          <span className="block" style={{ width: 30, height: 1, background: c.accent }} />
          {data.league} · {isFinal ? 'FINAL' : isLive ? 'LIVE' : 'UPCOMING'}
          {isLive && <span className="inline-flex items-center gap-1"><LiveDot tone="accent" /></span>}
        </div>
      </Reveal>

      {/* HERO MATCHUP */}
      <Reveal>
        <div
          className="mb-10 grid items-center"
          style={{ gridTemplateColumns: '1fr auto 1fr', gap: 18, paddingBottom: 28, borderBottom: `1px solid ${c.line}` }}
        >
          <TeamHero side="away" team={away} lead={awayLead} />
          <div className="text-center">
            <div className="flex items-baseline gap-3 justify-center fraunces-soft" style={{ fontFamily: fonts.display, fontWeight: 200, fontSize: 'clamp(56px, 14vw, 96px)', lineHeight: 0.85, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: awayLead ? c.accent : c.inkDim }}>{away.score}</span>
              <span style={{ color: c.inkFaint, fontWeight: 100 }}>—</span>
              <span style={{ color: homeLead ? c.accent : c.inkDim }}>{home.score}</span>
            </div>
            <div className="mt-4" style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', color: c.ink }}>
              {data.period?.toUpperCase() || (isFinal ? 'FINAL' : '')}
            </div>
          </div>
          <TeamHero side="home" team={home} lead={homeLead} />
        </div>
      </Reveal>

      {/* JOIN GAMEDAY CHAT */}
      <Reveal>
        <Link
          to={`/gameday/${data.id}`}
          state={{ game: { id: data.id, league: data.league, status: data.state, kickoff: data.date } }}
          className="flex items-center justify-between mb-10"
          style={{
            padding: '14px 18px', background: c.surface, border: `1px solid ${c.line}`,
            color: c.ink, textDecoration: 'none',
            fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
          }}
        >
          <span className="flex items-center gap-2"><MessageCircle size={14} color={c.accent} /> Join Gameday chat</span>
          <span style={{ color: c.accent }}>OPEN →</span>
        </Link>
      </Reveal>

      {/* BY PERIOD */}
      {hasLine && (
        <Reveal>
          <section className="mb-10">
            <SectionHead title="By" italicWord="period" count={`${periods}`} />
            <div style={{ border: `1px solid ${c.line}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: fonts.mono, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th(c)}>TEAM</th>
                    {Array.from({ length: periods }, (_, i) => (
                      <th key={i} style={th(c)}>{periodLabel(data.league, i)}</th>
                    ))}
                    <th style={{ ...th(c), color: c.accent }}>T</th>
                  </tr>
                </thead>
                <tbody>
                  {[away, home].map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ ...td(c), textAlign: 'left', fontFamily: fonts.display, fontSize: 14, fontWeight: 500 }}>{t.name}</td>
                      {Array.from({ length: periods }, (_, i) => (
                        <td key={i} style={td(c)}>{t.line?.[i] ?? '–'}</td>
                      ))}
                      <td style={{ ...td(c), color: c.accent, fontWeight: 700, background: c.surface }}>
                        {t.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </Reveal>
      )}

      {/* LEADERS */}
      {data.leaders?.length > 0 && (
        <Reveal>
          <section className="mb-10">
            <SectionHead title="Game" italicWord="leaders" count={`${data.leaders.length}`} />
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {data.leaders.slice(0, 6).map((l, i) => (
                <div key={i} style={{ padding: 14, border: `1px solid ${c.line}`, background: c.paper }}>
                  <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                    {l.category || l.name}
                  </div>
                  <div style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 500, color: c.ink, marginTop: 4, letterSpacing: '-0.02em' }}>
                    {l.athlete || l.player || ''}
                  </div>
                  <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.accent, letterSpacing: '0.05em', marginTop: 2 }}>
                    {l.stat || l.display || ''}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* PLAY-BY-PLAY */}
      {data.plays?.length > 0 && (
        <Reveal>
          <section className="mb-10">
            <SectionHead title="Play-by-" italicWord="play" count={`${Math.min(40, data.plays.length)}`} />
            <div>
              {data.plays.slice(-40).reverse().map((p, i) => {
                const key = p.scoringPlay;
                return (
                  <div
                    key={p.id || i}
                    className="grid"
                    style={{
                      gridTemplateColumns: '64px 1fr auto', gap: 14, alignItems: 'center',
                      padding: '12px 12px', margin: '0 -12px',
                      borderBottom: `1px dashed ${c.line}`,
                      background: key ? `linear-gradient(90deg, ${c.surface}, transparent)` : 'transparent',
                    }}
                  >
                    <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.05em' }}>
                      {p.clock} {p.period ? `· ${periodShort(data.league, p.period - 1)}` : ''}
                    </div>
                    <div style={{ fontFamily: fonts.display, fontSize: 15, lineHeight: 1.35, fontWeight: key ? 500 : 400, color: c.ink }}>
                      {p.text}
                    </div>
                    <div style={{ fontFamily: fonts.mono, fontSize: 11, color: key ? c.accent : c.inkDim, fontWeight: key ? 700 : 400, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em' }}>
                      {Number.isFinite(p.awayScore) ? `${p.awayScore}–${p.homeScore}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </Reveal>
      )}

      {/* HEADLINES */}
      {data.headlines?.length > 0 && (
        <Reveal>
          <section className="mb-10">
            <SectionHead title="On" italicWord="the wire" count={`${data.headlines.length}`} />
            <div className="flex flex-col gap-3" style={{ maxWidth: 640 }}>
              {data.headlines.map((h, i) => (
                <div key={i} style={{ padding: '14px 0', borderBottom: `1px solid ${c.line}` }}>
                  <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 500, lineHeight: 1.3, color: c.ink, letterSpacing: '-0.01em' }}>
                    {h.title}
                  </div>
                  {h.description && (
                    <div style={{ fontFamily: fonts.body, fontSize: 14, color: c.inkSoft, marginTop: 6, lineHeight: 1.45 }}>
                      {h.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </>
  );
}

function TeamHero({ side, team, lead }) {
  return (
    <div className="flex flex-col" style={{ alignItems: side === 'home' ? 'flex-end' : 'flex-start', gap: 6 }}>
      <span
        style={{
          width: 48, height: 48, borderRadius: 4,
          background: team.primary || '#444', color: c.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: fonts.mono, fontSize: 14, fontWeight: 700,
        }}
      >
        {team.code}
      </span>
      <div style={{ fontFamily: fonts.display, fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 500, letterSpacing: '-0.02em', color: lead ? c.ink : c.inkDim, textAlign: side === 'home' ? 'right' : 'left', marginTop: 4 }}>
        {team.name}
      </div>
      {team.record && (
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.1em' }}>{team.record}</div>
      )}
    </div>
  );
}

function periodLabel(league, i) {
  if (/NHL/i.test(league)) return ['P1', 'P2', 'P3', 'OT', 'SO'][i] || `P${i + 1}`;
  if (/MLB/i.test(league)) return String(i + 1);
  if (/MLS|EPL|UCL|LaLiga|Bundesliga|SerieA/i.test(league)) return ['1H', '2H', 'ET', 'PK'][i] || `P${i + 1}`;
  return `Q${i + 1}`;
}
function periodShort(league, i) {
  return periodLabel(league, i);
}

const th = (c) => ({
  padding: '10px 12px', background: c.surface, color: c.inkDim, fontWeight: 600,
  letterSpacing: '0.15em', fontSize: 9, borderBottom: `1px solid ${c.line}`,
  textAlign: 'center',
});
const td = (c) => ({
  padding: '10px 12px', textAlign: 'center', color: c.ink,
  borderBottom: `1px solid ${c.line}`, fontVariantNumeric: 'tabular-nums',
});
