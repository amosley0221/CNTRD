const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Create post
router.post('/', requireAuth, (req, res) => {
  const { content, reply_to } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  if (content.length > 280) {
    return res.status(400).json({ error: 'Post must be 280 characters or fewer' });
  }

  if (reply_to) {
    const parent = db.prepare('SELECT id FROM posts WHERE id = ?').get(reply_to);
    if (!parent) return res.status(404).json({ error: 'Post not found' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO posts (id, user_id, content, reply_to)
    VALUES (?, ?, ?, ?)
  `).run(id, req.user.id, content.trim(), reply_to || null);

  db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').run(req.user.id);
  if (reply_to) {
    db.prepare('UPDATE posts SET reply_count = reply_count + 1 WHERE id = ?').run(reply_to);
  }

  const post = db.prepare(`
    SELECT p.*, u.username, u.display_name, u.avatar, u.team_tags
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(id);

  post.team_tags = JSON.parse(post.team_tags || '[]');
  post.liked = false;
  post.reposted = false;

  res.status(201).json(post);
});

// Get feed (following + own posts)
router.get('/feed', requireAuth, (req, res) => {
  const cursor = req.query.cursor;
  let params = [req.user.id, req.user.id];
  let query = `
    SELECT p.*, u.username, u.display_name, u.avatar, u.team_tags
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.reply_to IS NULL
      AND (
        p.user_id = ?
        OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
      )
  `;

  if (cursor) {
    query += ' AND p.created_at < ?';
    params.push(cursor);
  }

  query += ' ORDER BY p.created_at DESC LIMIT 20';

  const posts = db.prepare(query).all(...params);

  posts.forEach(p => {
    p.team_tags = JSON.parse(p.team_tags || '[]');
    p.liked = !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, p.id);
    p.reposted = !!db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(req.user.id, p.id);
  });

  res.json(posts);
});

// Get explore / global feed
router.get('/explore', optionalAuth, (req, res) => {
  const cursor = req.query.cursor;
  let params = [];
  let query = `
    SELECT p.*, u.username, u.display_name, u.avatar, u.team_tags
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.reply_to IS NULL
  `;

  if (cursor) {
    query += ' AND p.created_at < ?';
    params.push(cursor);
  }

  query += ' ORDER BY p.created_at DESC LIMIT 20';

  const posts = db.prepare(query).all(...params);

  posts.forEach(p => {
    p.team_tags = JSON.parse(p.team_tags || '[]');
    if (req.user) {
      p.liked = !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, p.id);
      p.reposted = !!db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(req.user.id, p.id);
    } else {
      p.liked = false;
      p.reposted = false;
    }
  });

  res.json(posts);
});

// Get single post + replies
router.get('/:id', optionalAuth, (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.username, u.display_name, u.avatar, u.team_tags
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });

  post.team_tags = JSON.parse(post.team_tags || '[]');
  if (req.user) {
    post.liked = !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, post.id);
    post.reposted = !!db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(req.user.id, post.id);
  } else {
    post.liked = false;
    post.reposted = false;
  }

  const replies = db.prepare(`
    SELECT p.*, u.username, u.display_name, u.avatar, u.team_tags
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.reply_to = ?
    ORDER BY p.created_at ASC
    LIMIT 50
  `).all(req.params.id);

  replies.forEach(p => {
    p.team_tags = JSON.parse(p.team_tags || '[]');
    if (req.user) {
      p.liked = !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, p.id);
      p.reposted = !!db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(req.user.id, p.id);
    } else {
      p.liked = false;
      p.reposted = false;
    }
  });

  res.json({ post, replies });
});

// Like / Unlike
router.post('/:id/like', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
    db.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT like_count FROM posts WHERE id = ?').get(req.params.id);
    return res.json({ liked: false, like_count: updated.like_count });
  } else {
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT like_count FROM posts WHERE id = ?').get(req.params.id);
    return res.json({ liked: true, like_count: updated.like_count });
  }
});

// Repost / Unrepost
router.post('/:id/repost', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.prepare('SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id);

  if (existing) {
    db.prepare('DELETE FROM reposts WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
    db.prepare('UPDATE posts SET repost_count = MAX(0, repost_count - 1) WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT repost_count FROM posts WHERE id = ?').get(req.params.id);
    return res.json({ reposted: false, repost_count: updated.repost_count });
  } else {
    db.prepare('INSERT INTO reposts (user_id, post_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    db.prepare('UPDATE posts SET repost_count = repost_count + 1 WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT repost_count FROM posts WHERE id = ?').get(req.params.id);
    return res.json({ reposted: true, repost_count: updated.repost_count });
  }
});

// Delete post
router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id, user_id, reply_to FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

  db.prepare('DELETE FROM likes WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM reposts WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?').run(req.user.id);
  if (post.reply_to) {
    db.prepare('UPDATE posts SET reply_count = MAX(0, reply_count - 1) WHERE id = ?').run(post.reply_to);
  }

  res.json({ success: true });
});

module.exports = router;
