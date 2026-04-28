const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { JWT_SECRET, requireAuth, isAdminEmail } = require('../middleware/auth');
const { isValidTeamCode } = require('../data/teams');
const leaguesRouter = require('./leagues');

const USER_COLUMNS =
  'id, username, email, display_name, bio, avatar, banner, team_tags, ' +
  'followed_leagues, avatar_hue, pronouns, city, is_admin, banned, ' +
  'is_private, follower_count, following_count, post_count, created_at';

function hydrate(user) {
  if (!user) return user;
  user.team_tags        = JSON.parse(user.team_tags || '[]');
  user.followed_leagues = JSON.parse(user.followed_leagues || '[]');
  user.is_admin         = !!user.is_admin;
  user.banned           = !!user.banned;
  user.is_private       = !!user.is_private;
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

// If the user's email is in ADMIN_EMAILS, ensure their is_admin flag is set.
// Idempotent — safe to call on every auth path.
function syncAdminFlag(user) {
  if (!user) return user;
  if (isAdminEmail(user.email) && !user.is_admin) {
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

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
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
  const adminFlag = isAdminEmail(email) ? 1 : 0;

  db.prepare(`
    INSERT INTO users (id, username, email, password, display_name, team_tags, followed_leagues, avatar_hue, pronouns, city, is_admin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, email, hash, name, teamTagsJson, leaguesJson, hue, pronouns || '', city || '', adminFlag);

  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '30d' });
  const user = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id));

  res.status(201).json({ token, user });
});

// Login
router.post('/login', (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Login and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.banned) {
    return res.status(403).json({ error: 'This account has been suspended' });
  }

  syncAdminFlag(user);

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  const safe = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(user.id));

  res.json({ token, user: safe });
});

// Get current user
router.get('/me', requireAuth, (req, res) => {
  const user = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(req.user.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  syncAdminFlag(user);
  res.json(user);
});

module.exports = router;
