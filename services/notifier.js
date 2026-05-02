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
  'post', 'event_alert', 'mention', 'group_invite', 'reaction',
  // Reports queue (admin / owner only):
  'report_new', 'report_resolved', 'report_escalated',
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

  let id = null;
  let didWrite = false;        // any insert OR bump → fan a push
  if (dedupeKey) {
    const existing = db.prepare(
      'SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?'
    ).get(userId, dedupeKey);
    if (existing) {
      if (!bumpOnDedupe) return existing.id;     // intentional silence (e.g. live_game)
      db.prepare(`
        UPDATE notifications
        SET type = ?, actor_id = ?, data = ?, read_at = NULL,
            created_at = datetime('now')
        WHERE id = ?
      `).run(type, actorId, payload, existing.id);
      id = existing.id;
      didWrite = true;
    }
  }

  if (!id) {
    id = uuidv4();
    try {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, actor_id, data, dedupe_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, userId, type, actorId, payload, dedupeKey);
      didWrite = true;
    } catch (e) {
      if (String(e.message || '').includes('UNIQUE')) return null;   // race; treat as success
      console.error('notify failed:', e.message);
      return null;
    }
  }

  // Fan out a Web Push to every device this user has subscribed.
  // Fires for both fresh inserts AND dedupe-bumps so a second message
  // in the same conversation still pings the user. Lazy-loaded so the
  // require chain doesn't break if web-push isn't installed yet.
  if (didWrite) {
    try {
      const push = require('./push');
      const actor = actorId
        ? db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(actorId)
        : null;
      const actorClean = actor ? {
        id: actor.id, username: actor.username,
        displayName: actor.display_name || actor.username,
      } : null;
      const subCount = db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?').get(userId).n;
      console.log(`[push] notify type=${type} to user=${userId} subs=${subCount}`);
      push.sendToUser(userId, { type, actor: actorClean, data: data || {} })
        .then(r => {
          if (r && (r.sent || r.removed || (r.errors && r.errors.length))) {
            console.log(`[push] result type=${type} user=${userId} sent=${r.sent} removed=${r.removed} errors=${r.errors?.length || 0}`);
          }
        })
        .catch((e) => console.warn('[push] dispatch failed:', e?.message || e));
    } catch (e) {
      // services/push.js missing or web-push not installed yet — fine.
    }
  }
  return id;
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
    home_logo: g.homeTeam?.logo || '', away_logo: g.awayTeam?.logo || '',
    home_id:   g.homeTeam?.id   || null, away_id:  g.awayTeam?.id  || null,
    home_primary: g.homeTeam?.primary || '', away_primary: g.awayTeam?.primary || '',
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
      const state = gameState.get(g.id) || { everLive: false, finalSent: false, seenPlayIds: new Set() };
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

      // — score: walk the play-by-play. Each new scoring play emits one
      //   notification (with the full play text). Basketball skips per-play
      //   scoring entirely — quarter and final still fire below.
      if (state.everLive && (g.state === 'live' || (g.state === 'final' && !state.finalSent))) {
        try {
          const detail = await getEspn().getGameDetail(g.league, g.id);
          if (detail?.plays?.length) {
            // Track the running cumulative score so we can infer which side
            // scored when ESPN doesn't supply a team on the play itself.
            let lastHome = state.lastPlayHomeScore ?? 0;
            let lastAway = state.lastPlayAwayScore ?? 0;
            for (const play of detail.plays) {
              if (!play.id || state.seenPlayIds.has(play.id)) {
                // Even if we've seen the play before, advance the running
                // tally so deltas stay consistent.
                lastHome = play.homeScore ?? lastHome;
                lastAway = play.awayScore ?? lastAway;
                continue;
              }
              state.seenPlayIds.add(play.id);
              if (!play.scoringPlay) {
                lastHome = play.homeScore ?? lastHome;
                lastAway = play.awayScore ?? lastAway;
                continue;
              }
              if (basketball) {
                lastHome = play.homeScore ?? lastHome;
                lastAway = play.awayScore ?? lastAway;
                continue;
              }
              // Prefer the explicit team tag; fall back to whichever side's
              // cumulative score went up on this play.
              let scoringSide = null;
              if (play.team) {
                if (play.team === g.home) scoringSide = 'home';
                else if (play.team === g.away) scoringSide = 'away';
              }
              if (!scoringSide) {
                const homeDelta = (play.homeScore ?? lastHome) - lastHome;
                const awayDelta = (play.awayScore ?? lastAway) - lastAway;
                if (homeDelta > awayDelta) scoringSide = 'home';
                else if (awayDelta > homeDelta) scoringSide = 'away';
              }
              const dedupeKey = `play:${g.id}:${play.id}`;
              const data = {
                ...gamePayload(g),
                home_score: play.homeScore || g.homeScore,
                away_score: play.awayScore || g.awayScore,
                play_text: play.text,
                play_team: play.team,
                play_period: play.period,
                play_clock: play.clock,
                scoring_side: scoringSide,
              };
              for (const userId of recipients) {
                notify({ userId, type: 'score', data, dedupeKey, bumpOnDedupe: false });
              }
              lastHome = play.homeScore ?? lastHome;
              lastAway = play.awayScore ?? lastAway;
            }
            state.lastPlayHomeScore = lastHome;
            state.lastPlayAwayScore = lastAway;
          }
        } catch (e) {
          // ESPN summary missing or rate-limited — fall through; status-text
          // detection below still gives us period/final coverage.
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
      if (g.state === 'final' && !state.everLive && !state.finalSent) {
        state.finalSent = true;
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

// ─── Group event pre-alerts ──────────────────────────────────────────────
// Fires "event_alert" notifications to every member of the host group 15
// minutes before the event's start_at, exactly once per event. SQLite's
// datetime() lets us compare ISO strings as long as we stored them in the
// same format.
let eventTickerInterval = null;
function eventAlertTick() {
  try {
    const due = db.prepare(`
      SELECT e.id, e.conversation_id, e.title, e.start_at, e.created_by
      FROM events e
      WHERE e.pre_alert_sent = 0
        AND datetime(e.start_at) <= datetime('now', '+15 minutes')
        AND datetime(e.start_at) >= datetime('now')
    `).all();

    for (const ev of due) {
      const members = db.prepare(`
        SELECT user_id FROM conversation_members WHERE conversation_id = ?
      `).all(ev.conversation_id);
      const conv = db.prepare(`SELECT name FROM conversations WHERE id = ?`).get(ev.conversation_id);
      const groupName = conv?.name || 'group';
      const dedupeKey = `event:${ev.id}:pre`;
      for (const m of members) {
        notify({
          userId: m.user_id, type: 'event_alert', actorId: ev.created_by,
          data: {
            event_id: ev.id,
            conversation_id: ev.conversation_id,
            title: ev.title,
            start_at: ev.start_at,
            group_name: groupName,
          },
          dedupeKey, bumpOnDedupe: false,
        });
      }
      db.prepare('UPDATE events SET pre_alert_sent = 1 WHERE id = ?').run(ev.id);
    }
  } catch (e) {
    console.error('event alert tick error:', e.message);
  }
}

function startEventAlertTicker(intervalMs = 60 * 1000) {
  if (eventTickerInterval) return;
  setTimeout(eventAlertTick, 10_000);
  eventTickerInterval = setInterval(eventAlertTick, intervalMs);
}

// Roll up posts from a single author into one notification per follower
// per UTC day. The first post of the day creates the row with count=1; each
// later post bumps count, refreshes the preview, and clears read_at so the
// row reappears as unread. Skipped if the follower has post notifications
// turned off.
function rollupPostNotif({ followerId, author, post }) {
  if (!followerId || !author?.id || !post?.id) return null;
  if (!userWantsType(followerId, 'post')) return null;

  // YYYY-MM-DD in UTC — straightforward and timezone-independent on the server.
  const today = new Date().toISOString().slice(0, 10);
  const dedupeKey = `post:${author.id}:${today}`;
  const preview = String(post.content || '').slice(0, 140);

  const existing = db.prepare(
    'SELECT id, data FROM notifications WHERE user_id = ? AND dedupe_key = ?'
  ).get(followerId, dedupeKey);

  if (existing) {
    let data = {};
    try { data = JSON.parse(existing.data || '{}'); } catch {}
    data.count          = (Number(data.count) || 1) + 1;
    data.preview        = preview;
    data.last_post_id   = post.id;
    data.last_post_type = post.type || 'take';
    db.prepare(`
      UPDATE notifications
      SET data = ?, actor_id = ?, read_at = NULL, created_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(data), author.id, existing.id);
    return existing.id;
  }

  const id = uuidv4();
  const data = {
    count: 1,
    preview,
    last_post_id: post.id,
    last_post_type: post.type || 'take',
    author_username: author.username,
    author_displayName: author.displayName,
  };
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, actor_id, data, dedupe_key)
    VALUES (?, ?, 'post', ?, ?, ?)
  `).run(id, followerId, author.id, JSON.stringify(data), dedupeKey);
  return id;
}

module.exports = {
  notify,
  rollupPostNotif,
  startLiveGameTicker,
  startEventAlertTicker,
  liveGameTick,
  eventAlertTick,
  KNOWN_TYPES,
  DEFAULT_PREFS,
  parsePrefs,
};
