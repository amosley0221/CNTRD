import { useState, useEffect } from 'react';
import { Heart, Repeat2, MessageCircle, Bookmark, Share2, Bell, Menu, ChevronRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';

/* ============================================================
   COLOR TOKENS — the source of truth for the new palette
   Swap these and the whole system shifts.
   ============================================================ */
const c = {
  paper:    '#f4ede0',          // warm cream background
  surface:  '#ebe3d2',          // slightly deeper cream for cards
  ink:      '#1a1612',          // warm near-black text
  inkSoft:  'rgba(26, 22, 18, 0.7)',
  inkDim:   'rgba(26, 22, 18, 0.5)',
  inkFaint: 'rgba(26, 22, 18, 0.18)',
  line:     'rgba(26, 22, 18, 0.15)',
  accent:   '#c84c1e',          // terracotta — replaces the chartreuse
  alert:    '#8a1f2b',          // deep crimson — replaces the bright red
};

/* Font stacks used throughout */
const fonts = {
  display: '"Fraunces", Georgia, serif',
  body:    '"Instrument Sans", -apple-system, sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
};

/* ============================================================
   ATOMIC COMPONENTS — each one droppable into a real codebase
   ============================================================ */

/* Brand wordmark. Pass size via Tailwind text-* classes. */
export function Logo({ className = 'text-2xl' }) {
  return (
    <span className={className} style={{ fontFamily: fonts.display, fontWeight: 900, letterSpacing: '-0.04em' }}>
      cntrd<span style={{ color: c.accent }}>.</span>
    </span>
  );
}

/* The chartreuse-tinted kicker label. Now terracotta. */
export function Eyebrow({ children }) {
  return (
    <div className="flex items-center gap-3 mb-6" style={{ color: c.accent }}>
      <span className="block w-8 h-px" style={{ background: c.accent }} />
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
        {children}
      </span>
    </div>
  );
}

/* Section header: big serif title + small mono right-aligned label */
export function SectionHead({ title, italicWord, count }) {
  return (
    <div className="flex justify-between items-baseline mb-8">
      <h2 style={{ fontFamily: fonts.display, fontWeight: 400, fontSize: 'clamp(26px, 5.5vw, 40px)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {title}{' '}
        {italicWord && (
          <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>{italicWord}</em>
        )}
      </h2>
      {count && (
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.15em' }}>
          {count}
        </span>
      )}
    </div>
  );
}

/* Mono-cased pill button with optional primary variant */
export function Pill({ children, primary, onClick, active }) {
  const isActive = primary || active;
  return (
    <button
      onClick={onClick}
      className="transition-all duration-200 cursor-pointer"
      style={{
        fontFamily: fonts.mono,
        fontSize: 10,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        padding: '8px 14px',
        border: `1px solid ${isActive ? c.accent : c.inkFaint}`,
        color: isActive ? c.accent : c.ink,
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = c.accent;
        e.currentTarget.style.color = c.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isActive ? c.accent : c.inkFaint;
        e.currentTarget.style.color = isActive ? c.accent : c.ink;
      }}
    >
      {children}
    </button>
  );
}

/* Team identifier badge — colored square with team code */
export function TeamMark({ code, color, size = 26 }) {
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size,
        borderRadius: 2,
        background: color,
        color: c.paper,
        fontFamily: fonts.mono,
        fontSize: size < 30 ? 10 : 14,
        fontWeight: 700,
      }}
    >
      {code}
    </span>
  );
}

/* User avatar circle */
export function Avatar({ initial }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: 32, height: 32,
        background: c.surface,
        border: `1px solid ${c.line}`,
        fontFamily: fonts.display, fontWeight: 600, fontSize: 13,
        color: c.ink,
      }}
    >
      {initial}
    </div>
  );
}

/* Animated pulse dot — used for live status indicators */
export function LiveDot({ tone = 'accent' }) {
  const color = tone === 'alert' ? c.alert : c.accent;
  return (
    <>
      <span
        className="inline-block rounded-full"
        style={{
          width: 6, height: 6,
          background: color,
          animation: 'cntrd-pulse 1.6s infinite',
        }}
      />
      <style>{`
        @keyframes cntrd-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}

/* ============================================================
   GAME CARD — the central component, with state variants
   props.state: 'live' | 'final' | 'upcoming' | 'break'
   ============================================================ */
export function GameCard({ state, league, status, away, home, foot1, foot2 }) {
  const isLead = (team) => team.lead;
  const showOdds = state === 'upcoming';

  const statusColor = state === 'live' ? c.accent : state === 'break' ? c.alert : c.inkDim;

  return (
    <div
      className="relative p-5 flex flex-col transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: c.paper,
        border: `1px solid ${c.line}`,
        minHeight: 220,
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = c.inkFaint}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = c.line}
    >
      {/* state badge */}
      <span
        className="absolute"
        style={{
          top: -10, left: 18,
          background: c.paper,
          padding: '0 8px',
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: '0.2em',
          color: c.accent,
          textTransform: 'uppercase',
        }}
      >
        STATE · {state}
      </span>

      {/* header */}
      <div className="flex justify-between items-center mb-5">
        <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.inkDim }}>
          {league}
        </span>
        <span className="flex items-center gap-1.5" style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.15em', color: statusColor }}>
          {(state === 'live' || state === 'break') && <LiveDot tone={state === 'break' ? 'alert' : 'accent'} />}
          {status}
        </span>
      </div>

      {/* teams */}
      <div className="flex flex-col gap-3 flex-1">
        {[away, home].map((team, idx) => (
          <div key={idx} className="grid items-center gap-3" style={{ gridTemplateColumns: '26px 1fr auto' }}>
            <TeamMark code={team.code} color={team.color} />
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 17,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: isLead(team) ? c.ink : c.inkDim,
              }}
            >
              {team.name}
            </span>
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: showOdds ? 16 : 28,
                fontWeight: showOdds ? 400 : 300,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.04em',
                color: showOdds ? c.inkDim : (isLead(team) ? c.accent : c.inkDim),
              }}
            >
              {showOdds ? team.odds : team.score}
            </span>
          </div>
        ))}
      </div>

      {/* footer */}
      <div
        className="mt-4 pt-3 flex justify-between"
        style={{
          borderTop: `1px dashed ${c.line}`,
          fontFamily: fonts.mono,
          fontSize: 9.5,
          color: c.inkDim,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <span>{foot1}</span>
        <span>{foot2}</span>
      </div>
    </div>
  );
}

/* ============================================================
   STAT BLOCK — big number + label + delta
   ============================================================ */
export function StatBlock({ value, unit, label, delta, deltaDirection = 'up', animate = true }) {
  const [shown, setShown] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate) return;
    const target = parseFloat(value);
    const duration = 1400;
    const start = performance.now();
    let frame;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(eased * target);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);

  const display = Number.isInteger(parseFloat(value)) ? Math.round(shown) : shown.toFixed(1);
  const deltaColor = deltaDirection === 'down' ? c.alert : c.accent;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 200,
          fontSize: 'clamp(48px, 10vw, 72px)',
          lineHeight: 0.9,
          letterSpacing: '-0.04em',
          color: c.ink,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {display}
        {unit && <span style={{ fontSize: '0.4em', color: c.inkDim, marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.inkDim, textTransform: 'uppercase' }}>
        {label}
      </div>
      {delta && (
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: deltaColor, letterSpacing: '0.05em' }}>
          {deltaDirection === 'up' ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   POST — a single discourse entry
   ============================================================ */
export function Post({ author, handle, time, body, stats = { up: 0, repost: 0, reply: 0 } }) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="py-6 flex flex-col gap-3" style={{ borderBottom: `1px solid ${c.line}` }}>
      <div className="flex items-center gap-2.5">
        <Avatar initial={author[0]} />
        <div className="flex-1">
          <div style={{ fontWeight: 600, fontSize: 13, color: c.ink }}>{author}</div>
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim }}>{handle}</div>
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim }}>{time}</span>
      </div>

      <div style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 1.35, fontWeight: 300, color: c.ink }}>
        {body}
      </div>

      <div className="flex gap-6 mt-1" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.05em' }}>
        <button
          className="flex items-center gap-1.5 transition-colors duration-200"
          onClick={() => setLiked(!liked)}
          style={{ color: liked ? c.accent : c.inkDim }}
        >
          <Heart size={13} fill={liked ? c.accent : 'none'} />
          {(stats.up + (liked ? 1 : 0)).toLocaleString()}
        </button>
        <span className="flex items-center gap-1.5"><Repeat2 size={13} /> {stats.repost}</span>
        <span className="flex items-center gap-1.5"><MessageCircle size={13} /> {stats.reply}</span>
      </div>
    </article>
  );
}

/* ============================================================
   HEADER — sticky brand bar
   ============================================================ */
export function Header({ liveCount = 14 }) {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const time = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = clock.toLocaleDateString([], { weekday: 'short' }).toUpperCase();

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur"
      style={{ background: c.paper + 'd9', borderBottom: `1px solid ${c.line}` }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 md:px-12">
        <Logo />
        <div className="flex items-center gap-4" style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.1em' }}>
          <span className="flex items-center gap-1.5" style={{ color: c.alert, textTransform: 'uppercase' }}>
            <LiveDot tone="alert" />{liveCount} LIVE
          </span>
          <span>{day} · {time}</span>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   SEASON CHART — using recharts (engine-provided)
   ============================================================ */
const seasonData = [
  { g: 1, pts: 14 }, { g: 2, pts: 22 }, { g: 3, pts: 9 }, { g: 4, pts: 28 },
  { g: 5, pts: 24 }, { g: 6, pts: 33 }, { g: 7, pts: 20 }, { g: 8, pts: 38 },
  { g: 9, pts: 30 }, { g: 10, pts: 41 }, { g: 11, pts: 28 }, { g: 12, pts: 41 },
];

function SeasonChart() {
  return (
    <div className="p-5 mt-2" style={{ background: c.paper, border: `1px solid ${c.line}` }}>
      <div className="flex justify-between items-baseline mb-5">
        <span style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 500 }}>
          Points per game · last 12
        </span>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.1em' }}>
          SEASON HI · 41
        </span>
      </div>
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={seasonData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <ReferenceLine y={28.4} stroke={c.inkFaint} strokeDasharray="4 4" label={{ value: 'AVG 28.4', position: 'insideTopRight', fontSize: 9, fill: c.inkDim, fontFamily: fonts.mono }} />
            <Tooltip
              contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, fontFamily: fonts.mono, fontSize: 11 }}
              labelStyle={{ color: c.inkDim }}
              itemStyle={{ color: c.accent }}
              formatter={(v) => [`${v} pts`, '']}
              labelFormatter={(g) => `Game ${g}`}
            />
            <Line type="monotone" dataKey="pts" stroke={c.accent} strokeWidth={2} dot={{ r: 3, fill: c.accent, strokeWidth: 0 }} activeDot={{ r: 5, fill: c.paper, stroke: c.accent, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ============================================================
   DEMO PAGE — composition showing the components in context
   ============================================================ */
export default function CntrdDemo() {
  /* Inject Google Fonts once on mount */
  useEffect(() => {
    if (document.getElementById('cntrd-fonts')) return;
    const link = document.createElement('link');
    link.id = 'cntrd-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..900,0..100&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap';
    document.head.appendChild(link);
  }, []);

  /* Live ticker rotation — gives the page some breath */
  const tickerItems = [
    { tag: 'NBA', a: 'BOS', b: 'LAL', as: '87', bs: '91', live: 'Q3 4:22', lead: 'b' },
    { tag: 'NHL', a: 'NYR', b: 'EDM', as: '2', bs: '1', live: 'P2 12:08', lead: 'a' },
    { tag: 'EPL', a: 'MCI', b: 'ARS', as: '1', bs: '1', live: "67'", lead: null },
    { tag: 'MLB', a: 'NYY', b: 'BOS', as: '4', bs: '2', live: 'T7', lead: 'a' },
    { tag: 'WNBA', a: 'LV', b: 'NY', as: '78', bs: '82', live: 'FINAL', lead: 'b' },
    { tag: 'MLS', a: 'LAFC', b: 'INT', as: '2', bs: '3', live: "89'", lead: 'b' },
  ];

  /* Live game state — score ticks up for realism */
  const [lalScore, setLalScore] = useState(91);
  useEffect(() => {
    const i = setInterval(() => setLalScore((s) => s + (Math.random() < 0.3 ? 2 : 0)), 4000);
    return () => clearInterval(i);
  }, []);

  return (
    <div style={{ background: c.paper, color: c.ink, fontFamily: fonts.body, minHeight: '100vh' }}>
      <Header />

      {/* TICKER */}
      <div style={{ borderBottom: `1px solid ${c.line}`, overflow: 'hidden' }}>
        <div
          className="inline-flex gap-10 whitespace-nowrap py-2.5"
          style={{
            animation: 'cntrd-scroll 50s linear infinite',
            fontFamily: fonts.mono,
            fontSize: 12,
          }}
        >
          {[...tickerItems, ...tickerItems].map((g, i) => (
            <span key={i} className="inline-flex items-center gap-2.5">
              <span style={{ color: c.inkDim }}>{g.tag}</span>
              <span style={{ color: g.lead === 'a' ? c.accent : c.inkDim, fontWeight: g.lead === 'a' ? 700 : 400 }}>{g.a}</span>
              <span style={{ fontWeight: g.lead === 'a' ? 700 : 400, color: g.lead === 'a' ? c.accent : c.ink }}>{g.as}</span>
              <span style={{ color: c.inkDim }}>—</span>
              <span style={{ fontWeight: g.lead === 'b' ? 700 : 400, color: g.lead === 'b' ? c.accent : c.ink }}>{g.bs}</span>
              <span style={{ color: g.lead === 'b' ? c.accent : c.inkDim, fontWeight: g.lead === 'b' ? 700 : 400 }}>{g.b}</span>
              <span style={{ color: c.accent, fontSize: 9, letterSpacing: '0.2em' }}>{g.live}</span>
            </span>
          ))}
        </div>
        <style>{`
          @keyframes cntrd-scroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      {/* HERO */}
      <section className="px-5 md:px-12 pt-16 pb-12" style={{ borderBottom: `1px solid ${c.line}` }}>
        <Eyebrow>Long Read · NBA Playoffs</Eyebrow>
        <h1
          style={{
            fontFamily: fonts.display,
            fontWeight: 400,
            fontSize: 'clamp(44px, 11vw, 92px)',
            lineHeight: 0.92,
            letterSpacing: '-0.04em',
            marginBottom: 28,
          }}
        >
          Inside the{' '}
          <em style={{ fontStyle: 'italic', fontWeight: 300, color: c.accent }}>comeback</em>
          <br />
          that broke the series
        </h1>
        <p style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 1.4, fontWeight: 300, color: c.inkSoft, maxWidth: 560 }}>
          Down twenty-two with eleven to play, the bench rewrote what a playoff run is supposed to look like. We track every possession of the last quarter — and the one decision that changed everything.
        </p>
        <div className="flex gap-3 mt-6">
          <Pill primary>＋ FOLLOW STORY</Pill>
          <Pill>SHARE</Pill>
        </div>
      </section>

      {/* LIVE GAMES */}
      <section className="px-5 md:px-12 py-16" style={{ borderBottom: `1px solid ${c.line}` }}>
        <SectionHead title="Live" italicWord="now" count="04 OF 14" />
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <GameCard
            state="LIVE"
            league="NBA"
            status="Q3 · 4:22"
            away={{ code: 'BOS', color: '#007a33', name: 'Celtics', score: 87 }}
            home={{ code: 'LAL', color: '#fdb927', name: 'Lakers', score: lalScore, lead: true }}
            foot1="HALLIDAY · 32 PTS"
            foot2="WIN % · 71"
          />
          <GameCard
            state="FINAL"
            league="NHL"
            status="FINAL · OT"
            away={{ code: 'NYR', color: '#0033a0', name: 'Rangers', score: 3, lead: true }}
            home={{ code: 'EDM', color: '#fc4c02', name: 'Oilers', score: 2 }}
            foot1="SERIES · NYR 2-1"
            foot2="GWG · PANARIN"
          />
          <GameCard
            state="UPCOMING"
            league="EPL"
            status="TUE · 15:00"
            away={{ code: 'ARS', color: '#ef0107', name: 'Arsenal', odds: '+165' }}
            home={{ code: 'CHE', color: '#034694', name: 'Chelsea', odds: '+180' }}
            foot1="EMIRATES STADIUM"
            foot2="DRAW · +240"
          />
          <GameCard
            state="BREAK"
            league="MLS"
            status="HALFTIME"
            away={{ code: 'INT', color: '#d2c8a3', name: 'Inter Miami', score: 2, lead: true }}
            home={{ code: 'LAFC', color: '#c39e6d', name: 'LAFC', score: 1 }}
            foot1="SHOTS · 9-6"
            foot2="POSS · 58/42"
          />
        </div>
      </section>

      {/* STATS BANNER — featured player */}
      <section className="px-5 md:px-12 py-12" style={{ borderBottom: `1px solid ${c.line}` }}>
        <Eyebrow>Featured · Marcus Halliday</Eyebrow>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
          <StatBlock value={28.4} label="Points / G" delta="+4.1 YoY" />
          <StatBlock value={7.8} label="Rebounds / G" delta="+0.9 YoY" />
          <StatBlock value={6.2} label="Assists / G" delta="+1.4 YoY" />
          <StatBlock value={48.3} unit="%" label="FG %" delta="−0.6 YoY" deltaDirection="down" />
        </div>
      </section>

      {/* SEASON ARC */}
      <section className="px-5 md:px-12 py-16" style={{ borderBottom: `1px solid ${c.line}` }}>
        <SectionHead title="Season" italicWord="arc" count="PPG · LAST 12" />
        <SeasonChart />
      </section>

      {/* DISCOURSE */}
      <section className="px-5 md:px-12 py-16" style={{ borderBottom: `1px solid ${c.line}` }}>
        <SectionHead title="The" italicWord="discourse" count="FOLLOWING" />
        <div className="flex flex-col">
          <Post
            author="Marcus Reeve" handle="@reevehoops" time="2M"
            body={<>Whatever you think the ceiling for this Lakers bench was, throw it out. <strong style={{ color: c.accent, fontWeight: 500 }}>Five guys in double digits</strong> in the fourth, and not one of them is on a max deal. That's coaching.</>}
            stats={{ up: 2400, repost: 318, reply: 91 }}
          />
          <Post
            author="Lena Park" handle="@lenaparkwrites" time="11M"
            body={<>The play of the night isn't the dunk. It's the screen that freed the dunk. <strong style={{ color: c.accent, fontWeight: 500 }}>Watch the weak side.</strong></>}
            stats={{ up: 5100, repost: 1200, reply: 240 }}
          />
          <Post
            author="Devon Iverson" handle="@devon_iv" time="23M"
            body={<>Halliday has now scored 30+ in seven of the last nine. He's not having a hot stretch. He's playing like the guy you build a franchise around.</>}
            stats={{ up: 891, repost: 142, reply: 67 }}
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-5 md:px-12 py-16">
        <Logo className="text-5xl" />
        <div style={{ fontFamily: fonts.display, fontStyle: 'italic', fontWeight: 300, fontSize: 18, color: c.inkDim, marginTop: 10 }}>
          The center of the action.
        </div>
        <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${c.line}`, fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.1em' }}>
          <div style={{ color: c.ink, marginBottom: 6 }}>BUILT WITH · REACT · RECHARTS · LUCIDE-REACT</div>
          <div>9 REUSABLE COMPONENTS · ONE TOKEN FILE · DROPPABLE INTO ANY CODEBASE</div>
        </div>
      </footer>
    </div>
  );
}
