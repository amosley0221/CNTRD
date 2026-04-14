const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');

// Register
router.post('/register', (req, res) => {
  const { username, email, password, display_name } = req.body;

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

  db.prepare(`
    INSERT INTO users (id, username, email, password, display_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, email, hash, name);

  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '30d' });
  const user = db.prepare('SELECT id, username, email, display_name, bio, avatar, team_tags, follower_count, following_count, post_count, created_at FROM users WHERE id = ?').get(id);
  user.team_tags = JSON.parse(user.team_tags || '[]');

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
  const safeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    bio: user.bio,
    avatar: user.avatar,
    team_tags: JSON.parse(user.team_tags || '[]'),
    follower_count: user.follower_count,
    following_count: user.following_count,
    post_count: user.post_count,
    created_at: user.created_at
  };

  res.json({ token, user: safeUser });
});

// Get current user
router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, display_name, bio, avatar, banner, team_tags, follower_count, following_count, post_count, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.team_tags = JSON.parse(user.team_tags || '[]');
  res.json(user);
});

module.exports = router;
