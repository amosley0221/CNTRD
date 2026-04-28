// services/notifier.js — small helpers for creating notifications from
// any route, and a setInterval-driven "live game" ticker that pushes
// game-state notifications (tips off / scoring / period end / final).

const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

let espn;   // lazy-required to avoid circular import
function getEspn() {
  if (!espn) espn = require('./espn');
  return espn;
}

// Notification type catalog. Anything not listed here is treated as
// always-allowed (covers ad-hoc admin or system notifications).
const KNOWN_TYPES = [
  'live_game', 'score', 'period_end', 'final',
  'follow', 'follow_request', 'follow_accept', 'message',
];

// Defaults: every type on. Users can opt out from Settings.
const DEFAULT_PREFS = Object.fromEntries(KNOWN_TYPES.map(t => [t, true]));

function parsePrefs(raw) {
  let parsed = {};
  try { parsed = JSON.parse(raw || '{}') || {}; } catch {}
  return { ...DEFAULT_PREFS, ...parsed };
}

function userWantsType(userId, type) {
  if (!KNOWN_TYPES.includes(type)) return true;
  const u = db.prepare('SELECT notification_prefs FROM users WHERE id = ?').get(userId);
  if (!u) return false;
  return parsePrefs(u.notification_prefs)[type] !== false;
}

// Insert (or refresh) a notification. dedupeKey prevents the same logical
// event from creating two rows. bumpOnDedupe=false means a duplicate is
// silently kept as-is (used for game-state events that fire repeatedly).
function notify({ userId, type, actorId = null, data = null, dedupeKey = null, bumpOnDedupe = true }) {
  if (!userId || !type) return null;
  if (!userWantsType(userId, type)) return null;     // user opted out
  const payload = JSON.stringify(data || {});
  if (dedupeKey) {
    const existing = db.prepare(
      'SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?'
    ).get(userId, dedupeKey);
    if (existing) {
      if (!bumpOnDedupe) return existing.id;
      db.prepare(`
        UPDATE notifications
        SET type = ?, actor_id = ?, data = ?, read_at = NULL,
            created_at = datetime('now')
        WHERE id = ?
      `).run(type, actorId, payload, existing.id);
      return existing.id;
    }
  }
  const id = uuidv4();
  try {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, actor_id, data, dedupe_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, type, actorId, payload, dedupeKey);
    return id;
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) return null;   // race; treat as success
    console.error('notify failed:', e.message);
    return null;
  }
}

// Find users for whom a game's events are relevant. League followers OR
// favorites of either team.
function recipientsForGame(game) {
  const homeKey = `${game.league}:${game.home}`;
  const awayKey = `${game.league}:${game.away}`;
  const rows = db.prepare(`
    SELECT id FROM users
    WHERE banned = 0
      AND (
        followed_leagues LIKE ?
        OR team_tags LIKE ?
        OR team_tags LIKE ?
        OR team_tags LIKE ?
        OR team_tags LIKE ?
      )
  `).all(
    `%"${game.league}"%`,
    `%"${homeKey}"%`,
    `%"${awayKey}"%`,
    `%"${game.home}"%`,
    `%"${game.away}"%`,
  );
  return rows.map(r => r.id);
}

// Sport-class helpers.
const BASKETBALL_LEAGUES = new Set(['NBA', 'WNBA', 'NCAAM']);
function isBasketball(league) { return BASKETBALL_LEAGUES.has(String(league || '').toUpperCase()); }

function isPeriodBoundaryText(period) {
  if (!period) return false;
  const t = String(period).toLowerCase();
  // "End of 1st Quarter", "End of 1st Half", "Halftime", "End 3rd"
  return /^end\b/.test(t) || /\bhalftime\b/.test(t) || /\bend of\b/.test(t);
}

function gamePayload(g) {
  return {
    league: g.league,
    game_id: g.id,
    home: g.home, away: g.away,
    home_name: g.homeTeam?.name, away_name: g.awayTeam?.name,
    home_score: g.homeScore, away_score: g.awayScore,
    period: g.period,
  };
}

// Per-game state across ticks — tracks scores + period + final flag.
const gameState = new Map();   // gameId → { homeScore, awayScore, period, everLive, finalSent }

let tickerInterval = null;
let tickerRunning = false;

async function liveGameTick() {
  if (tickerRunning) return;
  tickerRunning = true;
  try {
    const data = await getEspn().getAll();
    // Process live first, then recent (so finals trigger after we've seen
    // the game live at least once during this process's lifetime).
    const all = [...(data.live || []), ...(data.recent || [])];
    for (const g of all) {
      const state = gameState.get(g.id) || { everLive: false, finalSent: false };
      const recipients = recipientsForGame(g);
      const basketball = isBasketball(g.league);

      // — live_game: game just went live for the first time we've seen.
      if (g.state === 'live' && !state.everLive) {
        state.everLive = true;
        const dedupeKey = `live:${g.league}:${g.id}`;
        for (const userId of recipients) {
          notify({ userId, type: 'live_game', data: gamePayload(g), dedupeKey, bumpOnDedupe: false });
        }
      }

      // — score: emit per side that increased. Skip basketball entirely.
      if (g.state === 'live' && state.everLive && !basketball) {
        const lastH = Number.isFinite(state.homeScore) ? state.homeScore : null;
        const lastA = Number.isFinite(state.awayScore) ? state.awayScore : null;
        const newH = Number(g.homeScore);
        const newA = Number(g.awayScore);
        if (lastH !== null && Number.isFinite(newH) && newH > lastH) {
          const dedupeKey = `score:${g.id}:H:${newH}-${newA}`;
          for (const userId of recipients) {
            notify({ userId, type: 'score', data: { ...gamePayload(g), scoring_side: 'home' }, dedupeKey, bumpOnDedupe: false });
          }
        }
        if (lastA !== null && Number.isFinite(newA) && newA > lastA) {
          const dedupeKey = `score:${g.id}:A:${newH}-${newA}`;
          for (const userId of recipients) {
            notify({ userId, type: 'score', data: { ...gamePayload(g), scoring_side: 'away' }, dedupeKey, bumpOnDedupe: false });
          }
        }
      }

      // — period_end: ESPN flips status text to "End of …" or "Halftime".
      if (g.state === 'live' && state.everLive && isPeriodBoundaryText(g.period)) {
        const periodKey = String(g.period).toLowerCase().replace(/\s+/g, '_');
        const dedupeKey = `period:${g.id}:${periodKey}`;
        for (const userId of recipients) {
          notify({ userId, type: 'period_end', data: gamePayload(g), dedupeKey, bumpOnDedupe: false });
        }
      }

      // — final: completed game, fire once.
      if (g.state === 'final' && state.everLive && !state.finalSent) {
        state.finalSent = true;
        const dedupeKey = `final:${g.id}`;
        for (const userId of recipients) {
          notify({ userId, type: 'final', data: gamePayload(g), dedupeKey, bumpOnDedupe: false });
        }
      }
      // Allow a final without ever seeing it live (process restart, etc.).
      if (g.state === 'final' && !state.everLive && !state.finalSent) {
        state.finalSent = true;
        // Don't notify retroactively — we missed the game; just record.
      }

      // Update the cache.
      state.homeScore = Number.isFinite(Number(g.homeScore)) ? Number(g.homeScore) : state.homeScore;
      state.awayScore = Number.isFinite(Number(g.awayScore)) ? Number(g.awayScore) : state.awayScore;
      state.period = g.period;
      gameState.set(g.id, state);
    }
  } catch (e) {
    console.error('live ticker error:', e.message);
  } finally {
    tickerRunning = false;
  }
}

function startLiveGameTicker(intervalMs = 60 * 1000) {
  if (tickerInterval) return;
  setTimeout(liveGameTick, 5_000);
  tickerInterval = setInterval(liveGameTick, intervalMs);
}

module.exports = {
  notify,
  startLiveGameTicker,
  liveGameTick,
  KNOWN_TYPES,
  DEFAULT_PREFS,
  parsePrefs,
};
