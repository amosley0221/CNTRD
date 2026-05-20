import { useState } from 'react';
import { c, fonts } from './tokens';
import {
  Logo, Eyebrow, SectionHead, Pill, TeamMark, Avatar, LiveDot,
  GameCard, StatBlock, Post, Header,
} from './components';

const SAMPLE_GAMES = [
  {
    state: 'LIVE', league: 'NBA · CONF FINALS · G3', status: "Q3 · 7:42",
    away: { code: 'BOS', color: '#007a3d', name: 'Celtics', score: '82', lead: true },
    home: { code: 'NYK', color: '#f58426', name: 'Knicks', score: '78' },
    foot1: 'TD GARDEN', foot2: 'TNT · 47.2K WATCHING',
  },
  {
    state: 'BREAK', league: 'NFL · WEEK 14', status: "HALFTIME",
    away: { code: 'PHI', color: '#004c54', name: 'Eagles', score: '24', lead: true },
    home: { code: 'DAL', color: '#003594', name: 'Cowboys', score: '17' },
    foot1: 'AT&T STADIUM', foot2: 'FOX · 31.7K WATCHING',
  },
  {
    state: 'FINAL', league: 'MLB · ALCS · G7', status: "FT",
    away: { code: 'NYY', color: '#003087', name: 'Yankees', score: '6', lead: true },
    home: { code: 'HOU', color: '#002d62', name: 'Astros', score: '3' },
    foot1: 'YANKEE STADIUM', foot2: 'FS1 · ENDED 23:14 ET',
  },
  {
    state: 'UPCOMING', league: 'PREMIER LEAGUE', status: "TOMORROW · 12:30",
    away: { code: 'LIV', color: '#c8102e', name: 'Liverpool', odds: '+115' },
    home: { code: 'MCI', color: '#6cabdd', name: 'Man City', odds: '−130' },
    foot1: 'ANFIELD', foot2: 'USA · 86°F · CLEAR',
  },
];

const SAMPLE_POSTS = [
  {
    author: 'Maya Petros', handle: '@mayapetros', time: '7m',
    body: '"Defense wins championships" is the most overused, least examined line in sports. The Celtics have the best offensive rating in NBA history and they’re up 2–1. Let’s update the cliche.',
    stats: { up: 2418, repost: 312, reply: 89 },
  },
  {
    author: 'Jordan Vance', handle: '@jvance_hoops', time: '14m',
    body: 'Tatum is shooting 41% from three on contested shots in the playoffs. That’s not regression, that’s evolution.',
    stats: { up: 891, repost: 67, reply: 23 },
  },
  {
    author: 'Lina Okafor', handle: '@lina_okafor', time: '1h',
    body: 'Knicks fans in the comments — yes, the foul on Brunson was soft. Yes, the refs missed the travel. No, that’s not why you’re down 2–1.',
    stats: { up: 1547, repost: 188, reply: 412 },
  },
];

const FILTERS = ['ALL', 'LIVE', 'TODAY', 'FAVORITES', 'NBA', 'NFL', 'MLB', 'EPL'];

export default function Showcase() {
  const [filter, setFilter] = useState('ALL');

  return (
    <div style={{ background: c.paper, color: c.ink, fontFamily: fonts.body, minHeight: '100vh' }}>
      <Header liveCount={14} />

      <main className="px-5 md:px-12 pt-10 pb-24" style={{ maxWidth: 1320, margin: '0 auto' }}>
        <Eyebrow>Design System v2 · Showcase</Eyebrow>
        <h1
          style={{
            fontFamily: fonts.display,
            fontSize: 'clamp(40px, 7vw, 72px)',
            fontWeight: 300,
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            maxWidth: 880,
            marginBottom: 36,
          }}
        >
          A token-driven design system for{' '}
          <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>cntrd</em>.
        </h1>

        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 17,
            lineHeight: 1.55,
            color: c.inkSoft,
            maxWidth: 640,
            marginBottom: 56,
          }}
        >
          Eleven reusable components built from a single token file. Editorial mood, warm cream
          paper, terracotta accent. Tap the heart on a post to verify the accent interaction.
        </p>

        <section className="mb-20">
          <SectionHead title="Live and" italicWord="upcoming" count={`${SAMPLE_GAMES.length} CARDS`} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {SAMPLE_GAMES.map((game, idx) => (
              <GameCard key={idx} {...game} />
            ))}
          </div>
        </section>

        <section className="mb-20">
          <SectionHead title="Filter" italicWord="pills" count="STATEFUL" />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f}
              </Pill>
            ))}
          </div>
          <div className="mt-4" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.1em' }}>
            CURRENT · {filter}
          </div>
        </section>

        <section className="mb-20">
          <SectionHead title="Numbers that" italicWord="count up" count="ANIMATED" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <StatBlock value="82" label="POINTS" delta="+9 vs Q2" deltaDirection="up" />
            <StatBlock value="14.6" unit="%" label="3PT EDGE" delta="−2.1 vs avg" deltaDirection="down" />
            <StatBlock value="47" unit="K" label="WATCHING" delta="+11K in 5m" deltaDirection="up" />
            <StatBlock value="2.4" label="PACE" delta="series high" deltaDirection="up" />
          </div>
        </section>

        <section className="mb-20">
          <SectionHead title="Recent" italicWord="takes" count={`${SAMPLE_POSTS.length} POSTS`} />
          <div style={{ maxWidth: 640 }}>
            {SAMPLE_POSTS.map((p, idx) => (
              <Post key={idx} {...p} />
            ))}
          </div>
        </section>

        <section className="mb-20">
          <SectionHead title="Atoms" italicWord="reference" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 12 }}>
                TEAM MARKS
              </div>
              <div className="flex gap-3">
                <TeamMark code="BOS" color="#007a3d" />
                <TeamMark code="LAL" color="#552583" />
                <TeamMark code="GSW" color="#1d428a" />
                <TeamMark code="MIA" color="#98002e" />
                <TeamMark code="PHI" color="#006bb6" />
              </div>
            </div>
            <div>
              <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 12 }}>
                AVATARS
              </div>
              <div className="flex gap-3">
                {['M', 'J', 'L', 'A', 'K'].map((i) => (
                  <Avatar key={i} initial={i} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 12 }}>
                LIVE DOT · ACCENT
              </div>
              <div className="flex items-center gap-2"><LiveDot tone="accent" /><span style={{ fontFamily: fonts.mono, fontSize: 11 }}>LIVE</span></div>
            </div>
            <div>
              <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 12 }}>
                LIVE DOT · ALERT
              </div>
              <div className="flex items-center gap-2"><LiveDot tone="alert" /><span style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert }}>HALFTIME</span></div>
            </div>
            <div>
              <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 12 }}>
                LOGO
              </div>
              <Logo />
            </div>
          </div>
        </section>

        <footer
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            color: c.inkDim,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            borderTop: `1px solid ${c.line}`,
            paddingTop: 24,
          }}
        >
          DESIGN SYSTEM V2 · INTEGRATION SHOWCASE · /design
        </footer>
      </main>
    </div>
  );
}
