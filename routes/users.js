const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { isValidTeamCode } = require('../data/teams');
const leaguesRouter = require('./leagues');
const { notify } = require('../services/notifier');

const PUBLIC_USER_COLS =
  'id, username, display_name, bio, avatar, banner, team_tags, followed_leagues, ' +
  'avatar_hue, pronouns, city, is_private, is_admin, is_owner, is_official, is_verified, notification_prefs, ' +
  'follower_count, following_count, post_count, created_at';

const { DEFAULT_PREFS: NOTIF_DEFAULTS } = require('../services/notifier');

function hydrate(u) {
  if (!u) return u;
  u.team_tags        = JSON.parse(u.team_tags || '[]');
  u.followed_leagues = JSON.parse(u.followed_leagues || '[]');
  u.is_private       = !!u.is_private;
  u.is_admin         = !!u.is_admin || !!u.is_owner;
  u.is_owner         = !!u.is_owner;
  u.is_official      = !!u.is_official;
  u.is_verified      = !!u.is_verified;
  let prefs = {};
  try { prefs = JSON.parse(u.notification_prefs || '{}'); } catch {}
  u.notification_prefs = { ...NOTIF_DEFAULTS, ...prefs };
  return u;
}

// Strip details from a private user when the viewer isn't an approved follower.
function lockedView(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar: user.avatar,
    avatar_hue: user.avatar_hue,
    is_private: true,
    locked: true,                 // tells the client to show a "private" CTA
    follower_count: user.follower_count,
    following_count: user.following_count,
    created_at: user.created_at,
    team_tags: [],
    followed_leagues: [],
    bio: '',
    pronouns: '',
    city: '',
    post_count: user.post_count,
  };
}

function isApprovedFollower(viewerId, ownerId) {
  if (!viewerId || viewerId === ownerId) return true;
  return !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(viewerId, ownerId);
}

// Get user by username
router.get('/:username', optionalAuth, (req, res) => {
  const user = hydrate(db.prepare(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE username = ?`).get(req.params.username));
  if (!user) return res.status(404).json({ error: 'User not found' });

  let is_following = false;
  let request_pending = false;
  if (req.user) {
    is_following = !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, user.id);
    request_pending = !!db.prepare('SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?').get(req.user.id, user.id);
  }

  // Lock the response if private and the viewer isn't allowed in.
  const allowed = isApprovedFollower(req.user?.id, user.id);
  if (user.is_private && !allowed) {
    return res.json({ ...lockedView(user), is_following: false, request_pending });
  }
  res.json({ ...user, is_following, request_pending });
});

const { KNOWN_TYPES: NOTIF_TYPES } = require('../services/notifier');

// Update profile
router.patch('/me/profile', requireAuth, (req, res) => {
  const { display_name, bio, team_tags, followed_leagues, avatar_hue, pronouns, city, is_private, notification_prefs } = req.body;

  const updates = [];
  const values = [];

  if (display_name !== undefined) {
    if (display_name.length > 50) return res.status(400).json({ error: 'Display name too long' });
    updates.push('display_name = ?'); values.push(display_name);
  }
  if (bio !== undefined) {
    if (bio.length > 160) return res.status(400).json({ error: 'Bio must be 160 characters or fewer' });
    updates.push('bio = ?'); values.push(bio);
  }
  if (team_tags !== undefined) {
    if (!Array.isArray(team_tags)) return res.status(400).json({ error: 'team_tags must be an array' });
    if (team_tags.length > 30) return res.status(400).json({ error: 'Maximum 30 team tags allowed' });
    const seen = new Set();
    const cleaned = [];
    for (const raw of team_tags) {
      const code = String(raw).trim().toUpperCase();
      if (!isValidTeamCode(code) || seen.has(code)) continue;
      seen.add(code); cleaned.push(code);
    }
    updates.push('team_tags = ?'); values.push(JSON.stringify(cleaned));
  }
  if (followed_leagues !== undefined) {
    if (!Array.isArray(followed_leagues)) return res.status(400).json({ error: 'followed_leagues must be an array' });
    const cleaned = leaguesRouter.normalizeLeagues(followed_leagues);
    updates.push('followed_leagues = ?'); values.push(JSON.stringify(cleaned));
  }
  if (avatar_hue !== undefined) {
    const h = Math.max(0, Math.min(360, +avatar_hue || 0));
    updates.push('avatar_hue = ?'); values.push(h);
  }
  if (pronouns !== undefined) { updates.push('pronouns = ?'); values.push(String(pronouns).slice(0, 30)); }
  if (city     !== undefined) { updates.push('city = ?');     values.push(String(city).slice(0, 80)); }
  if (is_private !== undefined) { updates.push('is_private = ?'); values.push(is_private ? 1 : 0); }
  if (notification_prefs !== undefined) {
    if (notification_prefs && typeof notification_prefs === 'object' && !Array.isArray(notification_prefs)) {
      const cleaned = {};
      for (const [k, v] of Object.entries(notification_prefs)) {
        if (NOTIF_TYPES.includes(k)) cleaned[k] = !!v;
      }
      updates.push('notification_prefs = ?'); values.push(JSON.stringify(cleaned));
    } else {
      return res.status(400).json({ error: 'notification_prefs must be an object' });
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = hydrate(db.prepare(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id = ?`).get(req.user.id));
  res.json(updated);
});

// Follow / unfollow / request-follow.
// - Already following → unfollow.
// - Has a pending request → cancel it.
// - Target is private → create a follow_request + notify target.
// - Otherwise → instant follow + notify target.
router.post('/:username/follow', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id, is_private FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  const refreshedCount = () => {
    const row = db.prepare('SELECT follower_count FROM users WHERE id = ?').get(target.id);
    return row?.follower_count ?? 0;
  };

  const existingFollow = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, target.id);
  if (existingFollow) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
    db.prepare('UPDATE users SET follower_count  = MAX(0, follower_count  - 1) WHERE id = ?').run(target.id);
    db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(req.user.id);
    return res.json({ following: false, is_following: false, request_pending: false, follower_count: refreshedCount() });
  }

  const existingReq = db.prepare('SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?').get(req.user.id, target.id);
  if (existingReq) {
    db.prepare('DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?').run(req.user.id, target.id);
    return res.json({ following: false, is_following: false, request_pending: false, follower_count: refreshedCount() });
  }

  if (target.is_private) {
    db.prepare('INSERT INTO follow_requests (requester_id, target_id) VALUES (?, ?)').run(req.user.id, target.id);
    notify({
      userId: target.id, type: 'follow_request', actorId: req.user.id,
      data: { username: req.user.username },
      dedupeKey: `follow_req:${req.user.id}`,
    });
    return res.json({ following: false, is_following: false, request_pending: true, follower_count: refreshedCount() });
  }

  db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target.id);
  db.prepare('UPDATE users SET follower_count  = follower_count  + 1 WHERE id = ?').run(target.id);
  db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(req.user.id);
  notify({
    userId: target.id, type: 'follow', actorId: req.user.id,
    data: { username: req.user.username },
  });
  return res.json({ following: true, is_following: true, request_pending: false, follower_count: refreshedCount() });
});

// Incoming follow requests for me.
router.get('/me/follow-requests', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags, fr.created_at
    FROM follow_requests fr
    JOIN users u ON u.id = fr.requester_id
    WHERE fr.target_id = ?
    ORDER BY fr.created_at DESC LIMIT 100
  `).all(req.user.id);
  res.json(rows.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    avatar: u.avatar,
    avatarHue: u.avatar_hue ?? 200,
    teams: JSON.parse(u.team_tags || '[]'),
    requested_at: u.created_at,
  })));
});

// Accept / decline a follow request from <username>.
router.post('/:username/follow-request/accept', requireAuth, (req, res) => {
  const requester = db.prepare('SELECT id, username FROM users WHERE username = ?').get(req.params.username);
  if (!requester) return res.status(404).json({ error: 'User not found' });
  const reqRow = db.prepare('SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?').get(requester.id, req.user.id);
  if (!reqRow) return res.status(404).json({ error: 'No pending request' });

  db.prepare('DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?').run(requester.id, req.user.id);
  // Don't double-create a follow row if one already exists.
  const already = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(requester.id, req.user.id);
  if (!already) {
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(requester.id, req.user.id);
    db.prepare('UPDATE users SET follower_count  = follower_count  + 1 WHERE id = ?').run(req.user.id);
    db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(requester.id);
  }
  notify({
    userId: requester.id, type: 'follow_accept', actorId: req.user.id,
    data: { username: req.user.username },
  });
  res.json({ accepted: true });
});

router.post('/:username/follow-request/reject', requireAuth, (req, res) => {
  const requester = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!requester) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?').run(requester.id, req.user.id);
  res.json({ rejected: true });
});

// Block / unblock another user. Blocking severs any existing follow in
// either direction and clears any pending follow request between them.
router.post('/:username/block', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });

  const tx = db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(req.user.id, target.id);
    // Tear down both directions of follow + pending requests.
    const a = db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
    const b = db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(target.id, req.user.id);
    if (a.changes) {
      db.prepare('UPDATE users SET follower_count  = MAX(0, follower_count  - 1) WHERE id = ?').run(target.id);
      db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(req.user.id);
    }
    if (b.changes) {
      db.prepare('UPDATE users SET follower_count  = MAX(0, follower_count  - 1) WHERE id = ?').run(req.user.id);
      db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(target.id);
    }
    db.prepare('DELETE FROM follow_requests WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)')
      .run(req.user.id, target.id, target.id, req.user.id);
  });
  tx();
  res.json({ blocked: true });
});

router.post('/:username/unblock', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(req.user.id, target.id);
  res.json({ blocked: false });
});

// List my blocked users.
router.get('/me/blocks', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags, b.created_at
    FROM blocks b JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ?
    ORDER BY b.created_at DESC
    LIMIT 200
  `).all(req.user.id);
  res.json(rows.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    avatar: u.avatar,
    avatarHue: u.avatar_hue ?? 200,
    teams: JSON.parse(u.team_tags || '[]'),
    blocked_at: u.created_at,
  })));
});

// Followers / Following / Posts ---------

router.get('/:username/followers', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const followers = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM follows f JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC LIMIT 50
  `).all(target.id);
  followers.forEach(u => { u.team_tags = JSON.parse(u.team_tags || '[]'); });
  res.json(followers);
});

router.get('/:username/following', (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const following = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM follows f JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC LIMIT 50
  `).all(target.id);
  following.forEach(u => { u.team_tags = JSON.parse(u.team_tags || '[]'); });
  res.json(following);
});

// Get user's posts (private profiles return [] for non-approved viewers).
router.get('/:username/posts', optionalAuth, (req, res) => {
  const target = db.prepare('SELECT id, is_private FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.is_private && !isApprovedFollower(req.user?.id, target.id)) {
    return res.json([]);
  }

  const cursor = req.query.cursor;
  const params = [target.id];
  let query = `
    SELECT p.id, p.user_id, p.content, p.image, p.like_count, p.repost_count,
           p.reply_count, p.reply_to, p.created_at, p.type, p.tags, p.extra,
           u.username, u.display_name, u.avatar, u.avatar_hue, u.team_tags
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? AND p.reply_to IS NULL
  `;
  if (cursor) { query += ' AND p.created_at < ?'; params.push(cursor); }
  query += ' ORDER BY p.created_at DESC LIMIT 30';

  const rows = db.prepare(query).all(...params);
  const userId = req.user?.id;
  const out = rows.map(p => {
    let extra = {}; try { extra = JSON.parse(p.extra || '{}'); } catch {}
    let tags  = []; try { tags  = JSON.parse(p.tags  || '[]'); } catch {}
    let userTeams = []; try { userTeams = JSON.parse(p.team_tags || '[]'); } catch {}
    const liked    = userId ? !!db.prepare('SELECT 1 FROM likes   WHERE user_id = ? AND post_id = ?').get(userId, p.id) : false;
    const reposted = userId ? !!db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(userId, p.id) : false;
    return {
      id: p.id, type: p.type || 'take', content: p.content, text: p.content,
      image: p.image, tags, extra, ...extra,
      likes: p.like_count, reposts: p.repost_count, replies: p.reply_count,
      reply_to: p.reply_to, created_at: p.created_at,
      liked, reposted,
      user: { id: p.user_id, username: p.username, displayName: p.display_name, avatar: p.avatar, avatarHue: p.avatar_hue ?? 200, teams: userTeams },
    };
  });
  res.json(out);
});

module.exports = router;
