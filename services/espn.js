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

module.exports = { getAll, LEAGUES };
