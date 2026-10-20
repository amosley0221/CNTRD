// Single source of truth for reading the /api/games shape.
//
// The server normalizes ESPN events in services/espn.js → normalizeEvent():
//
//   { id, league,
//     state: 'live' | 'final' | 'scheduled' | 'unknown',
//     date,
//     home, away,                                  // team CODES ('BOS')
//     homeTeam: { id, code, name, primary, accent, logo },
//     awayTeam: { ... },
//     homeScore, awayScore,                        // number, or '–' when scheduled
//     homeRecord, awayRecord,
//     period,                                      // "Q4 4:21" / "Final" / "7:30 PM EDT"
//     venue, series, aggregate, season_type, completed }
//
// Every game surface reads through here so the field names can't drift
// out of sync with the server again.

const LEAGUE_FALLBACK_COLORS = {
  NFL: '#013369', NBA: '#c8102e', MLB: '#002d72', NHL: '#111111',
  EPL: '#37003c', MLS: '#001e62', NCAAF: '#a32035', NCAAM: '#a32035',
  UCL: '#0a1a3c', LaLiga: '#ee8707', Bundesliga: '#d20515', SerieA: '#008fd7',
};

export const isLive      = (g) => g?.state === 'live';
export const isFinal     = (g) => g?.state === 'final';
export const isScheduled = (g) => g?.state === 'scheduled';

/** Pull one side of a matchup into a flat shape the UI can render. */
export function team(g, which /* 'home' | 'away' */) {
  const t = (which === 'home' ? g?.homeTeam : g?.awayTeam) || {};
  const codeFallback = which === 'home' ? g?.home : g?.away;
  const rawScore = which === 'home' ? g?.homeScore : g?.awayScore;
  const score = rawScore === '–' || rawScore == null ? '–' : rawScore;
  return {
    code:   t.code || codeFallback || '—',
    name:   t.name || codeFallback || '—',
    color:  t.primary || LEAGUE_FALLBACK_COLORS[g?.league] || '#444',
    logo:   t.logo || '',
    score,
    record: (which === 'home' ? g?.homeRecord : g?.awayRecord) || '',
  };
}

/** Numeric score, or null when the game hasn't started. */
export function numericScore(g, which) {
  const raw = which === 'home' ? g?.homeScore : g?.awayScore;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 'home' | 'away' | null — who's ahead right now. */
export function leader(g) {
  const h = numericScore(g, 'home');
  const a = numericScore(g, 'away');
  if (h == null || a == null || h === a) return null;
  return h > a ? 'home' : 'away';
}

/** Human status line. ESPN's shortDetail already reads well. */
export function statusLabel(g) {
  if (g?.period) return g.period;
  if (isFinal(g)) return 'FINAL';
  if (isLive(g))  return 'LIVE';
  return '';
}

/** Uppercase state token the <GameCard> component switches on. */
export function cardState(g) {
  if (isLive(g))      return 'LIVE';
  if (isFinal(g))     return 'FINAL';
  if (isScheduled(g)) return 'UPCOMING';
  return 'UPCOMING';
}

/** Map a game into the <GameCard> prop shape. */
export function toCardProps(g) {
  const lead = leader(g);
  const home = team(g, 'home');
  const away = team(g, 'away');
  const scheduled = isScheduled(g);
  return {
    state:  cardState(g),
    league: g?.league || '',
    status: statusLabel(g),
    away: {
      code: away.code, color: away.color, name: away.name,
      score: scheduled ? '' : String(away.score),
      odds: away.record,          // no odds feed; show the record in that slot
      lead: lead === 'away',
    },
    home: {
      code: home.code, color: home.color, name: home.name,
      score: scheduled ? '' : String(home.score),
      odds: home.record,
      lead: lead === 'home',
    },
    foot1: g?.venue || '',
    foot2: [away.record, home.record].filter(Boolean).join(' · '),
  };
}

/** Route path for a game's detail page. */
export function gamePath(g) {
  return `/game/${encodeURIComponent(g?.league || '')}/${encodeURIComponent(g?.id || '')}`;
}
