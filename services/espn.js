// services/espn.js — fetch + normalize live/recent/upcoming games from
// ESPN's public scoreboard endpoints. Unofficial API; we cache to be a
// good citizen and survive brief outages.

const fs = require('fs');

const LEAGUES = [
  { code: 'NFL',         path: 'football/nfl' },
  { code: 'NBA',         path: 'basketball/nba' },
  { code: 'MLB',         path: 'baseball/mlb' },
  { code: 'NHL',         path: 'hockey/nhl' },
  { code: 'MLS',         path: 'soccer/usa.1' },
  { code: 'EPL',         path: 'soccer/eng.1' },
  { code: 'LaLiga',      path: 'soccer/esp.1' },
  { code: 'Bundesliga',  path: 'soccer/ger.1' },
  { code: 'SerieA',      path: 'soccer/ita.1' },
  { code: 'NCAAF',       path: 'football/college-football' },
  { code: 'NCAAM',       path: 'basketball/mens-college-basketball' },
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

function teamFromCompetitor(comp) {
  const t = comp?.team || {};
  return {
    code: t.abbreviation || (t.shortDisplayName || t.displayName || '???').slice(0, 4).toUpperCase(),
    name: t.shortDisplayName || t.name || t.displayName || '',
    primary: colorHex(t.color),
    accent:  colorHex(t.alternateColor),
  };
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

  return {
    id: String(ev.id),
    league: leagueCode,
    state,
    date: ev.date,
    home: homeTeam.code,
    away: awayTeam.code,
    homeTeam,
    awayTeam,
    homeScore: state === 'scheduled' ? '–' : Number(home.score ?? 0),
    awayScore: state === 'scheduled' ? '–' : Number(away.score ?? 0),
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
  const [todayLists, recentLists] = await Promise.all([
    settled(LEAGUES.map(l => getLeague(l))),
    settled(LEAGUES.map(l => getLeague(l, dateRange(RECENT_DAYS)))),
  ]);

  const live = [];
  const upcoming = [];
  for (const g of todayLists) {
    if (g.state === 'live') live.push(g);
    else if (g.state === 'scheduled') upcoming.push(g);
  }
  // Recent: finals only, dedupe by id, sorted by date desc, capped.
  const recentMap = new Map();
  for (const g of recentLists) if (g.state === 'final') recentMap.set(g.id, g);
  const recent = Array.from(recentMap.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Sort upcoming by start time and cap to a reasonable number for display.
  upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    live: live.slice(0, 12),
    upcoming: upcoming.slice(0, 12),
    recent: recent.slice(0, 12),
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
      out.push({
        code,
        key: `${league.code}:${code}`,           // disambiguates across leagues (NFL:PHI vs NBA:PHI)
        name: t.shortDisplayName || t.name || t.displayName || '',
        fullName: t.displayName || t.name || '',
        location: t.location || '',
        league: league.code,
        primary: colorHex(t.color),
        accent:  colorHex(t.alternateColor),
        espnId: t.id,
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
    home: {
      code: (home.team?.abbreviation || '').toUpperCase(),
      name: home.team?.shortDisplayName || home.team?.displayName || '',
      logo: (home.team?.logos?.[0]?.href) || home.team?.logo || '',
      primary: colorHex(home.team?.color),
      score: state === 'scheduled' ? '–' : Number(home.score ?? 0),
      record: (home.records || []).find(r => r.type === 'total')?.summary || '',
      stats: summarizeTeamStats((json.boxscore?.teams || []).find(t => t?.team?.id === home.team?.id)),
    },
    away: {
      code: (away.team?.abbreviation || '').toUpperCase(),
      name: away.team?.shortDisplayName || away.team?.displayName || '',
      logo: (away.team?.logos?.[0]?.href) || away.team?.logo || '',
      primary: colorHex(away.team?.color),
      score: state === 'scheduled' ? '–' : Number(away.score ?? 0),
      record: (away.records || []).find(r => r.type === 'total')?.summary || '',
      stats: summarizeTeamStats((json.boxscore?.teams || []).find(t => t?.team?.id === away.team?.id)),
    },
    leaders: [
      ...normalizeLeaders(home.leaders).map(l => ({ ...l, side: 'home' })),
      ...normalizeLeaders(away.leaders).map(l => ({ ...l, side: 'away' })),
    ],
    headlines: (json.news?.articles || json.headlines || []).slice(0, 3).map(a => ({
      title: a.headline || a.title,
      description: a.description || '',
    })),
  };

  detailCache.set(key, { ts: Date.now(), data: detail });
  return detail;
}

async function getAllTeams() {
  const now = Date.now();
  if (teamsCache && now - teamsCachedAt < TEAMS_TTL_MS) return teamsCache;
  if (teamsInflight) return teamsInflight;

  teamsInflight = (async () => {
    try {
      const lists = await Promise.allSettled(LEAGUES.map(fetchLeagueTeams));
      const out = {};
      LEAGUES.forEach((l, i) => {
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

module.exports = { getAll, getAllTeams, getGameDetail, LEAGUES };
