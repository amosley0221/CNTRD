const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');
const { VALID_TEAM_CODES } = require('../data/teams');

const USER_COLUMNS =
  'id, username, email, display_name, bio, avatar, banner, team_tags, ' +
  'avatar_hue, pronouns, city, follower_count, following_count, post_count, created_at';

function hydrate(user) {
  if (!user) return user;
  user.team_tags = JSON.parse(user.team_tags || '[]');
  return user;
}

function normalizeTeams(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map(t => String(t).trim().toUpperCase())
    .filter(t => VALID_TEAM_CODES.has(t))
    .slice(0, 8);
}

// Register
router.post('/register', (req, res) => {
  const { username, email, password, display_name, teams, avatar_hue, pronouns, city } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3–20 characters' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  const name = display_name || username;
  const teamTagsJson = JSON.stringify(normalizeTeams(teams));
  const hue = Number.isFinite(+avatar_hue) ? Math.max(0, Math.min(360, +avatar_hue)) : 200;

  db.prepare(`
    INSERT INTO users (id, username, email, password, display_name, team_tags, avatar_hue, pronouns, city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, email, hash, name, teamTagsJson, hue, pronouns || '', city || '');

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

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  const safe = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(user.id));

  res.json({ token, user: safe });
});

// Get current user
router.get('/me', requireAuth, (req, res) => {
  const user = hydrate(db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(req.user.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
