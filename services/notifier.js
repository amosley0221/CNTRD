// services/notifier.js — small helpers for creating notifications from
// any route, and a setInterval-driven "live game" ticker that pushes one
// notification per (user, game) when a game first goes live.

const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

let espn;   // lazy-required to avoid circular import
function getEspn() {
  if (!espn) espn = require('./espn');
  return espn;
}

// Insert (or refresh) a notification.
// When dedupeKey is supplied and a notification already exists for
// (user_id, dedupe_key), we bump it: clear read_at, update created_at to
// now, replace data + actor. That way a flurry of new messages collapses
// into one always-fresh row instead of being silently dropped.
function notify({ userId, type, actorId = null, data = null, dedupeKey = null, bumpOnDedupe = true }) {
  if (!userId || !type) return null;
  const payload = JSON.stringify(data || {});
  if (dedupeKey) {
    const existing = db.prepare(
      'SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?'
    ).get(userId, dedupeKey);
    if (existing) {
      if (!bumpOnDedupe) return existing.id;     // leave the row alone
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

// Find users for whom a given live game is relevant.
// Match on followed leagues, OR composite team picks (LEAGUE:CODE), OR
// legacy bare team picks. JSON columns are flat strings here, so LIKE
// patterns are the cheapest predicate.
function recipientsForLiveGame(game) {
  const homeKey = `${game.league}:${game.home}`;
  const awayKey = `${game.league}:${game.away}`;
  // " around the codes prevents partial-prefix matches.
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

let tickerInterval = null;
let tickerRunning = false;

async function liveGameTick() {
  if (tickerRunning) return;
  tickerRunning = true;
  try {
    const data = await getEspn().getAll();
    for (const g of data.live || []) {
      const recipients = recipientsForLiveGame(g);
      if (!recipients.length) continue;
      const dedupeKey = `live:${g.league}:${g.id}`;
      const payload = {
        league: g.league,
        game_id: g.id,
        home: g.home, away: g.away,
        home_name: g.homeTeam?.name, away_name: g.awayTeam?.name,
        home_score: g.homeScore, away_score: g.awayScore,
        period: g.period,
      };
      for (const userId of recipients) {
        notify({
          userId, type: 'live_game', actorId: null,
          data: payload, dedupeKey, bumpOnDedupe: false,
        });
      }
    }
  } catch (e) {
    // ESPN unreachable / rate-limited / network blip — try again next tick.
    console.error('live ticker error:', e.message);
  } finally {
    tickerRunning = false;
  }
}

function startLiveGameTicker(intervalMs = 60 * 1000) {
  if (tickerInterval) return;
  // Tick once on boot so users see notifications without the first delay.
  setTimeout(liveGameTick, 5_000);
  tickerInterval = setInterval(liveGameTick, intervalMs);
}

module.exports = { notify, startLiveGameTicker, liveGameTick };
