// services/espn.js — fetch + normalize live/recent/upcoming games from
// ESPN's public scoreboard endpoints. Unofficial API; we cache to be a
// good citizen and survive brief outages.

const fs = require('fs');

const LEAGUES = [
  // Team sports — full home/away scoreboards + rosters.
  { code: 'NFL',         path: 'football/nfl',                          label: 'NFL',                    sport: 'Football',   hasTeams: true  },
  { code: 'NCAAF',       path: 'football/college-football',             label: 'NCAA Football',          sport: 'Football',   hasTeams: true  },
  { code: 'NBA',         path: 'basketball/nba',                        label: 'NBA',                    sport: 'Basketball', hasTeams: true  },
  { code: 'WNBA',        path: 'basketball/wnba',                       label: 'WNBA',                   sport: 'Basketball', hasTeams: true  },
  { code: 'NCAAM',       path: 'basketball/mens-college-basketball',    label: "NCAA Men's Basketball",  sport: 'Basketball', hasTeams: true  },
  { code: 'MLB',         path: 'baseball/mlb',                          label: 'MLB',                    sport: 'Baseball',   hasTeams: true  },
  { code: 'NHL',         path: 'hockey/nhl',                            label: 'NHL',                    sport: 'Hockey',     hasTeams: true  },
  { code: 'MLS',         path: 'soccer/usa.1',                          label: 'MLS',                    sport: 'Soccer',     hasTeams: true  },
  { code: 'EPL',         path: 'soccer/eng.1',                          label: 'Premier League',         sport: 'Soccer',     hasTeams: true  },
  { code: 'LaLiga',      path: 'soccer/esp.1',                          label: 'La Liga',                sport: 'Soccer',     hasTeams: true  },
  { code: 'Bundesliga',  path: 'soccer/ger.1',                          label: 'Bundesliga',             sport: 'Soccer',     hasTeams: true  },
  { code: 'SerieA',      path: 'soccer/ita.1',                          label: 'Serie A',                sport: 'Soccer',     hasTeams: true  },
  { code: 'UCL',         path: 'soccer/uefa.champions',                 label: 'Champions League',       sport: 'Soccer',     hasTeams: true  },
  // Individual / combat — fights or matches are 2-competitor events; no rosters.
  { code: 'UFC',         path: 'mma/ufc',                               label: 'UFC',                    sport: 'MMA',        hasTeams: false },
  { code: 'Boxing',      path: 'boxing',                                label: 'Boxing',                 sport: 'Boxing',     hasTeams: false },
  { code: 'ATP',         path: 'tennis/atp',                            label: 'ATP Tennis',             sport: 'Tennis',     hasTeams: false },
  { code: 'WTA',         path: 'tennis/wta',                            label: 'WTA Tennis',             sport: 'Tennis',     hasTeams: false },
  // Tournament-style — no home/away. Scoreboard yields events; we surface
  // them as single cards (no head-to-head score).
  { code: 'PGA',         path: 'golf/pga',                              label: 'PGA Tour',               sport: 'Golf',       hasTeams: false },
  { code: 'LPGA',        path: 'golf/lpga',                             label: 'LPGA Tour',              sport: 'Golf',       hasTeams: false },
  { code: 'F1',          path: 'racing/f1',                             label: 'Formula 1',              sport: 'Racing',     hasTeams: false },
  { code: 'NASCAR',      path: 'racing/nascar-cup',                     label: 'NASCAR Cup',             sport: 'Racing',     hasTeams: false },
];

const TTL_OK_MS  = 30 * 1000;       // 30s while requests are succeeding
const TTL_ERR_MS = 10 * 1000;       // back off 10s after an error
const RECENT_DAYS = 3;              // how far back "recent finals" looks

const cache = new Map();            // league.code → { ts, data, err }
const inflight = new Map();         // league.code → Promise

function colorHex(c) {
  if (!c || typeof c !== 'string') return '#666';
  const v = c.replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(v) ? '#' + v : '#666';
}

// ESPN's `/teams` list endpoint sometimes omits the logos array. Build a
// deterministic fallback URL so the fan card / pickers don't fall back to
// initial badges. The team-id pattern is the most reliable across leagues
// (it works for NCAA where abbreviations collide). We try id first, then
// abbreviation for soccer and US pro leagues that accept both.
const LOGO_SLUG_BY_LEAGUE = {
  NFL:        'nfl',
  NBA:        'nba',
  WNBA:       'wnba',
  MLB:        'mlb',
  NHL:        'nhl',
  NCAAF:      'ncaa',
  NCAAM:      'ncaa',
  MLS:        'soccer',
  EPL:        'soccer',
  LaLiga:     'soccer',
  Bundesliga: 'soccer',
  SerieA:     'soccer',
  UCL:        'soccer',
};
const SOCCER_LEAGUES = new Set(['MLS', 'EPL', 'LaLiga', 'Bundesliga', 'SerieA', 'UCL']);
function fallbackTeamLogoUrl(leagueCode, espnId, abbreviation) {
  const code = String(leagueCode || '');
  const slug = LOGO_SLUG_BY_LEAGUE[code];
  if (!slug) return '';
  // ESPN's CDN reliably serves logos by team id under the sport slug
  // (e.g. /i/teamlogos/nba/500/13.png is the Lakers). Soccer team logos
  // also follow the same pattern under /soccer/500/{teamId}.png.
  if (espnId) return `https://a.espncdn.com/i/teamlogos/${slug}/500/${espnId}.png`;
  // Without an id, fall back to abbreviation for US pro leagues. Soccer
  // and NCAA basically always need an id, so we give up there.
  if (slug !== 'soccer' && slug !== 'ncaa') {
    const abbr = String(abbreviation || '').toLowerCase();
    if (abbr) return `https://a.espncdn.com/i/teamlogos/${slug}/500/${abbr}.png`;
  }
  return '';
}

function teamFromCompetitor(comp) {
  const t = comp?.team || {};
  // Pick the largest non-default logo ESPN ships. The summary endpoint
  // gives us a list of variants; the scoreboard ships either a `logo` URL
  // or a `logos[]` array — handle both.
  const logo = t.logo
    || (Array.isArray(t.logos) && t.logos.find(l => l?.href)?.href)
    || '';
  return {
    id: t.id ? String(t.id) : null,
    code: t.abbreviation || (t.shortDisplayName || t.displayName || '???').slice(0, 4).toUpperCase(),
    name: t.shortDisplayName || t.name || t.displayName || '',
    primary: colorHex(t.color),
    accent:  colorHex(t.alternateColor),
    logo,
  };
}

// ESPN ships competitor scores in three different shapes depending on the
// endpoint: a bare number, a string, or `{ value, displayValue }`. Coerce
// to a finite number, or return null when there's nothing to show. (Older
// code did `Number(score)` on the object form, which produced NaN — and
// JSON serialization turned that into "null" on the wire, which is why
// the schedule ever rendered "null-null".)
function readScore(comp) {
  if (!comp) return null;
  const s = comp.score;
  if (s == null) return null;
  if (typeof s === 'object') {
    const v = s.value ?? s.displayValue;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pickRecord(records) {
  if (!Array.isArray(records)) return '';
  // ESPN tags one entry as "total" — fall back to the first if absent.
  const total = records.find(r => r?.type === 'total' || r?.name === 'overall');
  return (total || records[0])?.summary || '';
}

function normalizeSeries(comp) {
  // Playoff series live on `competitions[0].series` (NBA/NHL/MLB) — short
  // record like "0-2" or "Best of 7". We surface both.
  const s = comp?.series || comp?.headToHeadGames;
  if (!s) return null;
  const homeWins = Number(s.competitors?.[0]?.wins ?? s.summary?.split('-')?.[0] ?? NaN);
  const awayWins = Number(s.competitors?.[1]?.wins ?? s.summary?.split('-')?.[1] ?? NaN);
  const length   = Number(s.totalCompetitions || s.length || 0);
  const summary  = s.summary || s.description || '';
  return {
    summary,
    bestOf: length > 0 ? length : null,
    homeWins: Number.isFinite(homeWins) ? homeWins : null,
    awayWins: Number.isFinite(awayWins) ? awayWins : null,
  };
}

function normalizeAggregate(home, away) {
  // Soccer two-leg ties (UCL knockouts) ship per-side aggregate scores.
  const h = home?.aggregateScore ?? home?.aggregate;
  const a = away?.aggregateScore ?? away?.aggregate;
  if (h == null || a == null) return null;
  const hn = Number(h), an = Number(a);
  if (!Number.isFinite(hn) || !Number.isFinite(an)) return null;
  return { home: hn, away: an };
}

function normalizeEvent(ev, leagueCode) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const home = comp.competitors?.find(c => c.homeAway === 'home');
  const away = comp.competitors?.find(c => c.homeAway === 'away');
  if (!home || !away) return null;
  const status = ev.status?.type || {};
  const state =
    status.state === 'in'   ? 'live' :
    status.state === 'post' ? 'final' :
    status.state === 'pre'  ? 'scheduled' :
    'unknown';

  // The header line ("Q4 4:21", "Top 5th", "Final", "7:30 PM EDT") is already
  // human-friendly in ESPN's shortDetail — use it directly as `period`.
  const period = status.shortDetail || status.detail || status.description || '';
  const clock  = ''; // contained within `period`

  const homeTeam = teamFromCompetitor(home);
  const awayTeam = teamFromCompetitor(away);

  // 1 preseason · 2 regular · 3 postseason. Drives whether we render
  // a "Playoff series" tag on rail cards — ESPN ships `series` on
  // regular-season games too (game 2 of a 3-game set, etc.) and we
  // should only treat it as a playoff hint when season_type === 3.
  const stRaw = ev.seasonType || ev.season?.type || comp.seasonType || null;
  const seasonTypeId = Number(stRaw?.id ?? stRaw?.type ?? stRaw) || null;

  return {
    id: String(ev.id),
    league: leagueCode,
    state,
    date: ev.date,
    home: homeTeam.code,
    away: awayTeam.code,
    homeTeam,
    awayTeam,
    homeScore: state === 'scheduled' ? '–' : (readScore(home) ?? 0),
    awayScore: state === 'scheduled' ? '–' : (readScore(away) ?? 0),
    homeRecord: pickRecord(home.records),
    awayRecord: pickRecord(away.records),
    series: normalizeSeries(comp),
    aggregate: normalizeAggregate(home, away),
    season_type: seasonTypeId,
    period,
    clock,
    venue: comp.venue?.fullName || '',
    completed: !!status.completed,
  };
}

async function fetchOne(league, dates) {
  const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`);
  if (dates) url.searchParams.set('dates', dates);
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json', 'User-Agent': 'cntrd/1.0' },
  });
  if (!res.ok) throw new Error(`ESPN ${league.code} HTTP ${res.status}`);
  const json = await res.json();
  const events = Array.isArray(json.events) ? json.events : [];
  return events.map(e => normalizeEvent(e, league.code)).filter(Boolean);
}

function cacheKey(league, dates) { return `${league.code}|${dates || 'today'}`; }

async function getLeague(league, dates) {
  const key = cacheKey(league, dates);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached) {
    const ttl = cached.err ? TTL_ERR_MS : TTL_OK_MS;
    if (now - cached.ts < ttl) {
      if (cached.err) throw cached.err;
      return cached.data;
    }
  }
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const data = await fetchOne(league, dates);
      cache.set(key, { ts: Date.now(), data });
      return data;
    } catch (err) {
      cache.set(key, { ts: Date.now(), err });
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function ymd(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

// ESPN's scoreboard is keyed by Eastern Time — a "Tuesday slate" rolls
// over at midnight ET, not midnight UTC. Build a YYYYMMDD anchored to
// America/New_York so we always ask for the right day's games.
function ymdET(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${y}${m}${day}`;
}

function dateRange(daysBack) {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return `${ymd(start)}-${ymd(end)}`;
}

function settled(promises) {
  return Promise.allSettled(promises).then(results =>
    results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  );
}

async function getAll() {
  // Default scoreboard (no dates) is "current" per ESPN, which is fuzzy
  // — it can lag by a day on quiet mornings. Pinning the date to today
  // (Eastern Time) plus tomorrow guarantees we surface tonight's NBA /
  // NHL / MLB games even when called before tipoff.
  const today = ymdET();
  const tomorrow = ymdET(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const todayRange = `${today}-${tomorrow}`;
  const cutoffMs = new Date(`${today.slice(0,4)}-${today.slice(4,6)}-${today.slice(6,8)}T23:59:59-04:00`).getTime() + 24 * 3600_000;

  const [todayLists, recentLists] = await Promise.all([
    settled(LEAGUES.map(l => getLeague(l, todayRange))),
    settled(LEAGUES.map(l => getLeague(l, dateRange(RECENT_DAYS)))),
  ]);

  const live = [];
  const upcoming = [];
  for (const g of todayLists) {
    if (g.state === 'live') live.push(g);
    else if (g.state === 'scheduled') {
      // Cap upcoming to "starts within the next ~36h" so soccer leagues
      // (which return weeks of fixtures) don't flood the list.
      const startMs = Date.parse(g.date || '');
      if (!Number.isFinite(startMs) || startMs <= cutoffMs) upcoming.push(g);
    }
  }
  // Recent: finals only, dedupe by id, sorted by date desc, capped.
  const recentMap = new Map();
  for (const g of recentLists) if (g.state === 'final') recentMap.set(g.id, g);
  const recent = Array.from(recentMap.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Sort upcoming by start time and cap to a reasonable number for display.
  upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    live: live.slice(0, 24),
    upcoming: upcoming.slice(0, 24),
    recent: recent.slice(0, 24),
  };
}

// ── League team rosters ──────────────────────────────────────────────────
const TEAMS_TTL_MS = 24 * 60 * 60 * 1000;   // 24h
let teamsCache = null;
let teamsCachedAt = 0;
let teamsInflight = null;

async function fetchLeagueTeams(league) {
  // ESPN paginates large leagues (e.g. NCAA basketball ~360 teams). Walk
  // pages until we've collected everything.
  const out = [];
  let page = 1;
  while (true) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${league.path}/teams?limit=200&page=${page}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'cntrd/1.0' } });
    if (!res.ok) throw new Error(`ESPN ${league.code} teams HTTP ${res.status}`);
    const json = await res.json();
    const wrap = json.sports?.[0]?.leagues?.[0] || {};
    const list = wrap.teams || [];
    for (const item of list) {
      const t = item.team || {};
      const code = (t.abbreviation || (t.shortDisplayName || t.displayName || '???').slice(0, 4)).toUpperCase();
      // Try the most common logo paths. Light variant (`href`) is what
      // ESPN ships first; if missing, fall back to the bare `logo` URL,
      // and finally synthesize the canonical ESPN CDN path so the UI
      // never has to fall back to a colored initial badge.
      const direct = (Array.isArray(t.logos) && t.logos.find(l => l?.href)?.href) || t.logo || '';
      const logo = direct || fallbackTeamLogoUrl(league.code, t.id, t.abbreviation);
      out.push({
        code,
        key: `${league.code}:${code}`,           // disambiguates across leagues (NFL:PHI vs NBA:PHI)
        name: t.shortDisplayName || t.name || t.displayName || '',
        fullName: t.displayName || t.name || '',
        location: t.location || '',
        league: league.code,
        primary: colorHex(t.color),
        accent:  colorHex(t.alternateColor),
        id: t.id ? String(t.id) : null,
        espnId: t.id,
        logo,
      });
    }
    if (!list.length || list.length < 200) break;     // last page
    page += 1;
    if (page > 5) break;                                // safety stop ~1000 teams
  }
  // Drop dupes that share an abbreviation (rare in pro leagues, common in NCAA).
  const seen = new Set();
  return out.filter(t => {
    const key = t.code + '|' + t.fullName;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Per-game summary (box / leaders) ────────────────────────────────────
const DETAIL_TTL_LIVE_MS  = 20 * 1000;       // live games update fast
const DETAIL_TTL_FINAL_MS = 60 * 60 * 1000;  // finals don't move
const detailCache = new Map();   // `${league}|${id}` → { ts, data }

function leagueByCode(code) {
  const c = String(code || '').toUpperCase();
  return LEAGUES.find(l => l.code.toUpperCase() === c);
}

function pickStatRow(stats, candidates) {
  if (!Array.isArray(stats)) return null;
  const cand = candidates.map(s => s.toLowerCase());
  for (const s of stats) {
    const name = String(s.name || s.abbreviation || '').toLowerCase();
    if (cand.includes(name)) return s.displayValue ?? s.value ?? '';
  }
  return null;
}

// Return per-player boxscore rows for a team. ESPN ships them grouped by
// stat *category* (basketball has one; football has rushing/passing/etc).
// We pass everything through and let the client lay it out — that keeps
// the helper sport-agnostic.
function extractPlayers(boxscore, teamId) {
  if (!teamId) return [];
  const block = (boxscore?.players || []).find(b => b?.team?.id === teamId);
  if (!block) return [];
  const out = [];
  for (const cat of (block.statistics || [])) {
    const keys   = Array.isArray(cat.keys)   ? cat.keys   : [];
    // ESPN ships pretty short labels in `labels` (MIN, FG, 3PT, +/-).
    // Fall back to keys when labels are missing — uppercased so the
    // header row stays terse even if ESPN gives us long camelCase.
    const rawLabels = Array.isArray(cat.labels) ? cat.labels : keys;
    const labels = rawLabels.map(l => String(l || '').toUpperCase());
    const athletes = (cat.athletes || []).map(a => ({
      id: a.athlete?.id ? String(a.athlete.id) : '',
      // Prefer the full display name; shortName comes back as "P. Cox"
      // which the user explicitly asked us not to surface.
      name: a.athlete?.displayName || a.athlete?.shortName || '',
      shortName: a.athlete?.shortName || '',
      position: a.athlete?.position?.abbreviation || '',
      starter: !!a.starter,
      didNotPlay: !!a.didNotPlay,
      stats: Array.isArray(a.stats) ? a.stats.map(v => v == null ? '' : String(v)) : [],
    })).filter(a => a.name);
    if (!athletes.length) continue;
    out.push({
      name: cat.name || cat.text || '',
      label: cat.text || cat.name || '',
      keys,
      labels,
      athletes,
    });
  }
  return out;
}

function summarizeTeamStats(team) {
  // ESPN stats vary per sport. Try the most useful candidates.
  const stats = team?.statistics || [];
  return [
    ['PTS / R',     pickStatRow(stats, ['points', 'runs', 'goals', 'pts'])],
    ['Field goal', pickStatRow(stats, ['fieldGoalPct', 'fieldGoalsMade-fieldGoalsAttempted', 'fieldGoals', 'fg'])],
    ['3PT',         pickStatRow(stats, ['threePointPct', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted'])],
    ['Rebounds',    pickStatRow(stats, ['rebounds', 'totalRebounds'])],
    ['Assists',     pickStatRow(stats, ['assists'])],
    ['Hits',        pickStatRow(stats, ['hits'])],
    ['Errors',      pickStatRow(stats, ['errors'])],
    ['Yards',       pickStatRow(stats, ['totalYards', 'netTotalYards'])],
    ['1st downs',   pickStatRow(stats, ['firstDowns'])],
    ['Turnovers',   pickStatRow(stats, ['turnovers', 'totalTurnovers'])],
    ['Shots',       pickStatRow(stats, ['shotsOnGoal', 'totalShots'])],
    ['Possession',  pickStatRow(stats, ['possessionTime', 'possession'])],
    ['Fouls',       pickStatRow(stats, ['totalFouls', 'fouls'])],
  ].filter(([_, v]) => v !== null && v !== undefined && v !== '');
}

function normalizeLeaders(leaders) {
  if (!Array.isArray(leaders)) return [];
  const out = [];
  for (const cat of leaders) {
    const top = (cat.leaders || [])[0];
    if (!top) continue;
    const a = top.athlete || {};
    out.push({
      category: cat.displayName || cat.name || '',
      name: a.shortName || a.displayName || a.fullName || '',
      stat: top.displayValue || top.value || '',
      teamId: top.team?.id || a.team?.id || null,
    });
  }
  return out.slice(0, 6);
}

async function getGameDetail(leagueCode, eventId) {
  const league = leagueByCode(leagueCode);
  if (!league) throw new Error('Unknown league');
  const id = String(eventId).replace(/[^0-9]/g, '');
  if (!id) throw new Error('Invalid event id');

  const key = `${league.code}|${id}`;
  const now = Date.now();
  const cached = detailCache.get(key);
  if (cached) {
    const ttl = cached.data?.state === 'live' ? DETAIL_TTL_LIVE_MS : DETAIL_TTL_FINAL_MS;
    if (now - cached.ts < ttl) return cached.data;
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/${league.path}/summary?event=${id}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'cntrd/1.0' } });
  if (!res.ok) throw new Error(`ESPN summary HTTP ${res.status}`);
  const json = await res.json();

  const header = json.header || {};
  const comp   = header.competitions?.[0] || {};
  const status = comp.status?.type || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};

  const state =
    status.state === 'in'   ? 'live' :
    status.state === 'post' ? 'final' :
    status.state === 'pre'  ? 'scheduled' :
    'unknown';

  const detail = {
    id,
    league: league.code,
    state,
    period: status.shortDetail || status.detail || '',
    venue: comp.venue?.fullName || '',
    date: header.competitions?.[0]?.date || '',
    // 1 preseason · 2 regular · 3 postseason · 4 offseason. Drives the
    // "Playoff series" banner — regular-season series rows from ESPN
    // (e.g. game 2 of a 3-game MLB set) shouldn't read "Playoff series".
    season_type: (() => {
      const stRaw = header.season?.type || comp.seasonType || header.seasonType || null;
      return Number(stRaw?.id ?? stRaw?.type ?? stRaw) || null;
    })(),
    series: normalizeSeries(comp),
    aggregate: normalizeAggregate(home, away),
    home: {
      id: home.team?.id ? String(home.team.id) : null,
      code: (home.team?.abbreviation || '').toUpperCase(),
      name: home.team?.shortDisplayName || home.team?.displayName || '',
      logo: (home.team?.logos?.[0]?.href) || home.team?.logo || '',
      primary: colorHex(home.team?.color),
      score: state === 'scheduled' ? '–' : (readScore(home) ?? 0),
      record: pickRecord(home.records),
      stats: summarizeTeamStats((json.boxscore?.teams || []).find(t => t?.team?.id === home.team?.id)),
      players: extractPlayers(json.boxscore, home.team?.id),
    },
    away: {
      id: away.team?.id ? String(away.team.id) : null,
      code: (away.team?.abbreviation || '').toUpperCase(),
      name: away.team?.shortDisplayName || away.team?.displayName || '',
      logo: (away.team?.logos?.[0]?.href) || away.team?.logo || '',
      primary: colorHex(away.team?.color),
      score: state === 'scheduled' ? '–' : (readScore(away) ?? 0),
      record: pickRecord(away.records),
      stats: summarizeTeamStats((json.boxscore?.teams || []).find(t => t?.team?.id === away.team?.id)),
      players: extractPlayers(json.boxscore, away.team?.id),
    },
    leaders: [
      ...normalizeLeaders(home.leaders).map(l => ({ ...l, side: 'home' })),
      ...normalizeLeaders(away.leaders).map(l => ({ ...l, side: 'away' })),
    ],
    headlines: (json.news?.articles || json.headlines || []).slice(0, 3).map(a => ({
      title: a.headline || a.title,
      description: a.description || '',
    })),
    // Play-by-play used by the live notifier to push per-event notifications.
    plays: (json.plays || []).map(p => {
      // ESPN ships `team` as either a string (older feeds, MLB sometimes)
      // or an object { abbreviation, id }. Normalize so the notifier can
      // match on g.home / g.away regardless of the source.
      let teamCode = null;
      if (typeof p.team === 'string') teamCode = p.team.toUpperCase();
      else if (p.team?.abbreviation) teamCode = String(p.team.abbreviation).toUpperCase();
      else if (p.team?.id && p.start?.team?.abbreviation) teamCode = String(p.start.team.abbreviation).toUpperCase();
      return {
        id: String(p.id ?? ''),
        text: p.text || '',
        scoringPlay: !!p.scoringPlay,
        scoreValue: Number(p.scoreValue || 0),
        type: p.type?.text || p.type?.name || '',
        period: Number(p.period?.number || 0),
        clock: p.clock?.displayValue || '',
        team: teamCode,
        homeScore: Number(p.homeScore || 0),
        awayScore: Number(p.awayScore || 0),
      };
    }),
  };

  detailCache.set(key, { ts: Date.now(), data: detail });
  return detail;
}

async function getAllTeams() {
  const now = Date.now();
  if (teamsCache && now - teamsCachedAt < TEAMS_TTL_MS) {
    // Self-heal: if the cached payload was built before we added logo /
    // id fields, invalidate it so the next call picks up a fresh shape.
    const sample = Object.values(teamsCache).find(list => list && list.length)?.[0];
    if (sample && Object.prototype.hasOwnProperty.call(sample, 'logo')) {
      return teamsCache;
    }
    teamsCache = null;
  }
  if (teamsInflight) return teamsInflight;

  teamsInflight = (async () => {
    try {
      // Only fetch rosters for leagues that actually have teams. Combat
      // and tournament leagues skip the call entirely.
      const teamLeagues = LEAGUES.filter(l => l.hasTeams);
      const lists = await Promise.allSettled(teamLeagues.map(fetchLeagueTeams));
      const out = {};
      teamLeagues.forEach((l, i) => {
        out[l.code] = lists[i].status === 'fulfilled'
          ? lists[i].value.sort((a, b) => a.name.localeCompare(b.name))
          : [];
      });
      teamsCache = out;
      teamsCachedAt = Date.now();
      return out;
    } finally {
      teamsInflight = null;
    }
  })();
  return teamsInflight;
}

// ── Team schedule ───────────────────────────────────────────────────────
const SCHEDULE_TTL_MS = 5 * 60 * 1000;       // 5 minutes
const scheduleCache = new Map();             // `${league}|${teamId}|${season}` → { ts, data }

async function getTeamSchedule(leagueCode, teamId, season) {
  const league = leagueByCode(leagueCode);
  if (!league) throw new Error('Unknown league');
  const id = String(teamId).replace(/[^0-9]/g, '');
  if (!id) throw new Error('Invalid team id');
  const seasonKey = season ? String(Number(season)) : '';
  const cacheKey = `${league.code}|${id}|${seasonKey}`;
  const now = Date.now();
  const cached = scheduleCache.get(cacheKey);
  if (cached && now - cached.ts < SCHEDULE_TTL_MS) return cached.data;

  // ESPN's /teams/{id}/schedule defaults to regular-season events for
  // most leagues — playoff games (NFL Wild Card, CFB bowls, etc.) don't
  // appear unless we explicitly ask for seasontype=3. Same for preseason
  // (1). Fetch all three in parallel and merge so the schedule view
  // shows the full picture without the user having to switch anything.
  const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${league.path}/teams/${id}/schedule`;
  async function fetchType(type) {
    try {
      const url = new URL(baseUrl);
      if (seasonKey) url.searchParams.set('season', seasonKey);
      url.searchParams.set('seasontype', String(type));
      const r = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'cntrd/1.0' },
      });
      if (!r.ok) return null;
      return r.json();
    } catch { return null; }
  }
  const [pre, reg, post] = await Promise.all([fetchType(1), fetchType(2), fetchType(3)]);
  // Need at least one successful response or we have nothing to show.
  const sources = [pre, reg, post].filter(Boolean);
  if (!sources.length) throw new Error(`ESPN schedule unavailable`);
  // Use whichever response has the richest team header (regular season
  // tends to carry it; fall back to others).
  const json = (reg && reg.team) ? reg : (sources.find(s => s.team) || sources[0]);

  // Merge events from every season-type call, dedupe by id, and stamp
  // the season type onto each event so the client can group them.
  const merged = new Map();
  for (const [stId, src] of [[1, pre], [2, reg], [3, post]]) {
    if (!src) continue;
    const evs = Array.isArray(src.events) ? src.events : [];
    for (const ev of evs) {
      if (!ev?.id) continue;
      const key = String(ev.id);
      if (merged.has(key)) continue;
      // Pin the season type from the URL since ev.seasonType is sometimes
      // missing on the per-type responses.
      merged.set(key, { ev, stId });
    }
  }

  const team = json.team || {};
  const games = Array.from(merged.values()).map(({ ev, stId }) => {
    const comp = ev.competitions?.[0] || {};
    const status = ev.status?.type || comp.status?.type || {};
    const state =
      status.state === 'in'   ? 'live' :
      status.state === 'post' ? 'final' :
      status.state === 'pre'  ? 'scheduled' :
      'unknown';
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    const homeT = home ? teamFromCompetitor(home) : null;
    const awayT = away ? teamFromCompetitor(away) : null;
    // null when the score isn't known yet; client renders '–' in that case.
    // Don't coerce to 0 — that paints scheduled / spring-training games
    // as "0–0" which is misleading.
    const homeScore = state === 'scheduled' ? null : readScore(home);
    const awayScore = state === 'scheduled' ? null : readScore(away);

    // Season type — prefer the explicit one ESPN ships, fall back to the
    // URL-pinned id (which is always set after the merge).
    const stRaw = ev.seasonType || ev.season?.type || comp.seasonType || null;
    const seasonTypeId = Number(stRaw?.id ?? stRaw?.type ?? stRaw) || stId || null;
    const seasonTypeName = stRaw?.name || stRaw?.description || '';
    // Round / bowl / matchup label — ESPN drops this on `notes[]` for
    // playoff or bowl games. Pick the most descriptive headline.
    const rawNotes = (Array.isArray(comp.notes) && comp.notes.length)
      ? comp.notes
      : (Array.isArray(ev.notes) ? ev.notes : []);
    const round = rawNotes
      .map(n => String(n?.headline || n?.text || '').trim())
      .find(s => s) || '';

    return {
      id: String(ev.id),
      league: league.code,
      state,
      date: ev.date,
      period: status.shortDetail || status.detail || '',
      home: homeT?.code || '',
      away: awayT?.code || '',
      homeTeam: homeT,
      awayTeam: awayT,
      homeScore, awayScore,
      isHome: home?.team?.id === id,
      result: home?.team?.id === id ? home?.winner ? 'W' : (state === 'final' ? 'L' : '')
                                    : away?.winner ? 'W' : (state === 'final' ? 'L' : ''),
      venue: comp.venue?.fullName || '',
      season_type: seasonTypeId,           // 1|2|3|4
      season_type_name: seasonTypeName,    // "Regular Season" / "Postseason" / etc.
      round,                                // e.g. "NFC Wild Card", "Sweet 16", "Cotton Bowl"
    };
  });
  // ESPN's team schedule endpoint typically ships a single `season` field
  // (the season the response represents) and no list of available seasons.
  // The "newest" year we know about anchors the dropdown — use the current
  // calendar year as a floor so the list doesn't shrink when the user is
  // looking at last year's schedule. ESPN accepts ?season=YYYY for any of
  // these years.
  const currentYear = new Date().getUTCFullYear();
  const newest = Math.max(
    currentYear + 1,                          // covers winter leagues whose ESPN year = end year
    Number(json.season?.year) || 0,
    Number(json.requestedSeason?.year) || 0,
  );
  // Different leagues use different season-year conventions. ESPN's
  // `?season=Y` parameter takes a single integer; what Y means depends
  // on the league:
  //   · NBA / NHL / WNBA → Y is the year the season ENDS
  //     (so 2026 = 2025-26 season). Display "2025-26".
  //   · NFL / CFB / CBB / soccer leagues → Y is the year the season
  //     STARTS. Display "2025-26".
  //   · MLB → Y is the calendar year (Mar–Oct). Display just "2025".
  //   · UFC / Boxing / golf / racing → calendar year. Display "2025".
  // ESPN's API year convention by league. NBA + NHL + WNBA + NCAAM
  // (basketball runs Nov–Apr) use the END year. NFL + NCAAF (Aug–Jan)
  // use the START year. Soccer leagues vary; most use START. MLB and
  // single-year sports stay as the calendar year.
  const SPLIT_END_YEAR = new Set(['NBA', 'NHL', 'WNBA', 'NCAAM']);
  const SPLIT_START_YEAR = new Set([
    'NFL', 'NCAAF',
    'MLS', 'EPL', 'LaLiga', 'Bundesliga', 'SerieA', 'UCL',
  ]);
  function labelFor(year) {
    if (SPLIT_END_YEAR.has(league.code)) {
      return `${year - 1}–${String(year).slice(2)}`;
    }
    if (SPLIT_START_YEAR.has(league.code)) {
      return `${year}–${String(year + 1).slice(2)}`;
    }
    return `${year}`;
  }
  const explicit = Array.isArray(json.seasons) ? json.seasons.map(s => ({
    year: Number(s.year),
    displayName: s.displayName || labelFor(Number(s.year)),
  })).filter(s => Number.isFinite(s.year)) : [];
  const seasons = explicit.length
    ? explicit
    : Array.from({ length: 6 }, (_, i) => {
        const y = newest - i;
        return { year: y, displayName: labelFor(y) };
      });
  // Which season this response actually represents (for the dropdown's
  // current value). Falls through to the requested key, then ESPN's
  // reported season, then the newest year as a safe default.
  const requestedSeason = (seasonKey && Number(seasonKey))
    || Number(json.season?.year)
    || Number(json.requestedSeason?.year)
    || newest;

  const data = {
    league: league.code,
    team: {
      id,
      name: team.displayName || team.name || '',
      abbreviation: (team.abbreviation || '').toUpperCase(),
      logo: team.logos?.[0]?.href || team.logo || '',
      record: team.recordSummary || (team.record?.items || [])[0]?.summary || '',
      primary: colorHex(team.color),
    },
    season: requestedSeason,
    seasons,
    games,
  };
  scheduleCache.set(cacheKey, { ts: Date.now(), data });
  return data;
}

module.exports = { getAll, getAllTeams, getGameDetail, getTeamSchedule, LEAGUES };
