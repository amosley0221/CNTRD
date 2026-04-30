const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { JWT_SECRET, requireAuth, isAdminEmail, isOwnerEmail, setSessionCookie, clearSessionCookie } = require('../middleware/auth');
const { isValidTeamCode } = require('../data/teams');
const leaguesRouter = require('./leagues');

const USER_COLUMNS =
  'id, username, email, display_name, bio, avatar, banner, team_tags, ' +
  'followed_leagues, avatar_hue, pronouns, city, is_admin, is_owner, is_official, is_verified, banned, ' +
  'is_private, hide_username, notification_prefs, tweaks, ' +
  'follower_count, following_count, post_count, created_at';

const { DEFAULT_PREFS, KNOWN_TYPES } = require('../services/notifier');

function hydrate(user) {
  if (!user) return user;
  user.team_tags        = JSON.parse(user.team_tags || '[]');
  user.followed_leagues = JSON.parse(user.followed_leagues || '[]');
  user.is_admin         = !!user.is_admin || !!user.is_owner;   // owner is implicitly admin
  user.is_owner         = !!user.is_owner;
  user.is_official      = !!user.is_official;
  user.is_verified      = !!user.is_verified;
  user.banned           = !!user.banned;
  user.is_private       = !!user.is_private;
  user.hide_username    = !!user.hide_username;
  let prefs = {};
  try { prefs = JSON.parse(user.notification_prefs || '{}'); } catch {}
  user.notification_prefs = { ...DEFAULT_PREFS, ...prefs };
  let tweaks = {};
  try { tweaks = JSON.parse(user.tweaks || '{}'); } catch {}
  user.tweaks = tweaks;
  return user;
}

function normalizeTeams(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const code = String(raw).trim().toUpperCase();
    if (!isValidTeamCode(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
    if (out.length >= 30) break;
  }
  return out;
}

function passwordErrors(password) {
  const errs = [];
  if (!password || password.length < 8) errs.push('at least 8 characters');
  if (!/[A-Z]/.test(password))           errs.push('one capital letter');
  if (!/[0-9]/.test(password))           errs.push('one number');
  if (!/[^A-Za-z0-9]/.test(password))    errs.push('one special character');
  return errs;
}

// If the user's email is in ADMIN_EMAILS, ensure their is_admin flag is
// set. If it matches OWNER_EMAIL, mark them as the owner (which also
// implies admin). Idempotent — safe to call on every auth path.
function syncAdminFlag(user) {
  if (!user) return user;
  const owner = isOwnerEmail(user.email);
  if (owner && !user.is_owner) {
    db.prepare('UPDATE users SET is_owner = 1, is_admin = 1 WHERE id = ?').run(user.id);
    user.is_owner = 1;
    user.is_admin = 1;
  } else if (isAdminEmail(user.email) && !user.is_admin) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
    user.is_admin = 1;
  }
  return user;
}

// Register
router.post('/register', (req, res) => {
  const { username, email, password, display_name, teams, leagues, avatar_hue, pronouns, city } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3–20 characters' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores' });
  }
  const pwErrs = passwordErrors(password);
  if (pwErrs.length) {
    return res.status(400).json({ error: 'Password needs ' + pwErrs.join(', ') });
  }

  // Both checks case-insensitive so "ALICE" can't sneak past "alice".
  const existingUser = db.prepare(
    'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)'
  ).get(username, email);
  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  const name = display_name || username;
  const cleanedTeams = normalizeTeams(teams);
  const teamTagsJson = JSON.stringify(cleanedTeams);
  // Default followed leagues = the leagues of any picked teams (so a fan
  // who picks the Eagles auto-follows NFL). User can edit on the next step.
  const inferredLeagues = Array.from(new Set(
    cleanedTeams.map(c => c.includes(':') ? c.split(':')[0] : null).filter(Boolean)
  ));
  const finalLeagues = leaguesRouter.normalizeLeagues(
    Array.isArray(leagues) ? leagues : inferredLeagues
  );
  const leaguesJson = JSON.stringify(finalLeagues);
  const hue = Number.isFinite(+avatar_hue) ? Math.max(0, Math.min(360, +avatar_hue)) : 200;
  const ownerFlag = isOwnerEmail(email) ? 1 : 0;
  const adminFlag = ownerFlag || (isAdminEmail(email) ? 1 : 0);

  db.prepare(`
    INSERT INTO users (id, username, email, password, display_name, team_tags, followed_leagues, avatar_hue, pronouns, city, is_admin, is_owner)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, email, hash, name, teamTagsJson, leaguesJson, hue, pronouns || '', city || '', adminFlag, ownerFlag);

  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '30d' });
  const user = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id));

  // Sign-up always plants the HttpOnly cookie — fresh users want to stay
  // logged in. The Bearer token is also returned for clients that prefer it.
  setSessionCookie(res, token);
  res.status(201).json({ token, user });
});

// Login
router.post('/login', (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Login and password are required' });
  }

  // Match on either username or email, case-insensitively. Users
  // routinely capitalize their email out of habit; that shouldn't break
  // login.
  const user = db.prepare(
    'SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)'
  ).get(String(login).trim(), String(login).trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.banned) {
    return res.status(403).json({ error: 'This account has been suspended' });
  }

  syncAdminFlag(user);
  // Stamp the sign-in time so admin / owner tools can show last activity.
  db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(user.id);

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  const safe = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(user.id));

  // Plant an HttpOnly session cookie unless the caller explicitly opted out
  // (sessionStorage-only login). Server-set cookies aren't subject to
  // Safari's 7-day ITP cap, so the user stays signed in across browser
  // restarts even when localStorage is wiped.
  if (req.body?.persist !== false) setSessionCookie(res, token);
  else clearSessionCookie(res);

  res.json({ token, user: safe });
});

// Logout — clears both the in-memory session (client) and the HttpOnly cookie.
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Get current user
router.get('/me', requireAuth, (req, res) => {
  const user = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(req.user.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  syncAdminFlag(user);
  res.json(user);
});

// Update credentials — username / email / password. Any subset can be sent
// in one call. Password changes additionally require current_password.
router.patch('/account', requireAuth, (req, res) => {
  const { username, email, current_password, new_password } = req.body || {};

  const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!me) return res.status(404).json({ error: 'User not found' });

  const updates = [];
  const values = [];

  if (username !== undefined && username !== me.username) {
    if (typeof username !== 'string') return res.status(400).json({ error: 'Username must be a string' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3–20 characters' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores' });
    const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, me.id);
    if (taken) return res.status(409).json({ error: 'Username already taken' });
    updates.push('username = ?'); values.push(username);
  }

  if (email !== undefined && email !== me.email) {
    if (typeof email !== 'string' || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (email.length > 120) return res.status(400).json({ error: 'Email too long' });
    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, me.id);
    if (taken) return res.status(409).json({ error: 'Email already in use' });
    updates.push('email = ?'); values.push(email);
    // Recompute admin status based on the new email.
    updates.push('is_admin = ?'); values.push(isAdminEmail(email) ? 1 : 0);
  }

  if (new_password !== undefined && new_password !== '') {
    if (!current_password) return res.status(400).json({ error: 'Current password is required to change password' });
    if (!bcrypt.compareSync(current_password, me.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const pwErrs = passwordErrors(new_password);
    if (pwErrs.length) return res.status(400).json({ error: 'New password needs ' + pwErrs.join(', ') });
    updates.push('password = ?'); values.push(bcrypt.hashSync(new_password, 10));
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(me.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(me.id));
  res.json(updated);
});

// Save UI tweaks (accent color, dark/light, density, etc.) so settings
// follow the user across devices. Body is the entire tweaks object — small
// enough that overwriting is fine.
router.put('/tweaks', requireAuth, (req, res) => {
  const incoming = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
  if (!incoming) return res.status(400).json({ error: 'Body must be a JSON object' });
  // Cap the serialized size so a misuse can't bloat the row.
  const json = JSON.stringify(incoming);
  if (json.length > 4000) return res.status(413).json({ error: 'Tweaks too large' });
  db.prepare('UPDATE users SET tweaks = ? WHERE id = ?').run(json, req.user.id);
  res.json({ tweaks: incoming });
});

module.exports = router;
