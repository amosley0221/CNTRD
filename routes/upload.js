const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Upload avatar
router.post('/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Delete old avatar if exists
  const current = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
  if (current?.avatar) {
    const oldPath = path.join(UPLOAD_DIR, path.basename(current.avatar));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const avatarUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.id);

  res.json({ avatar: avatarUrl });
});

// Upload banner
router.post('/banner', requireAuth, upload.single('banner'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const current = db.prepare('SELECT banner FROM users WHERE id = ?').get(req.user.id);
  if (current?.banner) {
    const oldPath = path.join(UPLOAD_DIR, path.basename(current.banner));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const bannerUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET banner = ? WHERE id = ?').run(bannerUrl, req.user.id);

  res.json({ banner: bannerUrl });
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Only image files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
