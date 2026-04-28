const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXTS = ['.mp4', '.mov', '.webm'];

const imageOnly = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (IMAGE_EXTS.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const imageOrVideo = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext)) cb(null, true);
  else cb(new Error('Only image or video files are allowed'), false);
};

const upload = multer({
  storage,
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024 }   // 5 MB — avatars/banners are small
});

// Larger limit for post media (images can be richer, videos need headroom).
const mediaUpload = multer({
  storage,
  fileFilter: imageOrVideo,
  limits: { fileSize: 25 * 1024 * 1024 }  // 25 MB
});

// Upload avatar
router.post('/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

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

// Upload a post attachment (photo or short clip). Returns the public URL
// and a `kind` field the client can switch on. Caller is responsible for
// passing the URL to /api/posts.
router.post('/media', requireAuth, mediaUpload.single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const kind = VIDEO_EXTS.includes(ext) ? 'video' : 'image';
  res.json({
    url:  `/uploads/${req.file.filename}`,
    kind,
    size: req.file.size,
  });
});

router.use((err, req, res, next) => {
  const known = [
    'Only image files are allowed',
    'Only image or video files are allowed',
  ];
  if (err instanceof multer.MulterError || known.includes(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

router.uploadDir = UPLOAD_DIR;
module.exports = router;
