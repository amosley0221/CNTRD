const express = require('express');
const path = require('path');
const cors = require('cors');

const uploadRouter = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

// Tiny cookie parser — no extra dep. Stores parsed values on req.cookies.
app.use((req, _res, next) => {
  req.cookies = Object.create(null);
  const header = req.headers.cookie;
  if (header) {
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (k) {
        try { req.cookies[k] = decodeURIComponent(v); }
        catch { req.cookies[k] = v; }
      }
    }
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadRouter.uploadDir));

// API Routes
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/users',  require('./routes/users'));
app.use('/api/posts',  require('./routes/posts'));
app.use('/api/plays',  require('./routes/plays'));
app.use('/api/games',  require('./routes/games'));
app.use('/api/teams',  require('./routes/teams'));
app.use('/api/leagues',require('./routes/leagues'));
app.use('/api/pages',  require('./routes/pages'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/push',    require('./routes/push'));
app.use('/api/articles', require('./routes/articles'));

// Eagerly configure Web Push so VAPID keys are generated/cached on boot
// (logged on first generation so they can be promoted to env vars).
try { require('./services/push').ensureConfigured(); } catch { /* tolerate */ }
app.use('/api/static', require('./routes/static'));
app.use('/api/search', require('./routes/search'));
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'CNTRD' }));

// /v2/* SPA fallback: serve the v2 shell for any deep link inside the
// new app so React Router (browser history mode) can take over.
// express.static already handles /v2/ → public/v2/index.html for the
// bare directory; this catches /v2/feed, /v2/u/anyone, etc.
app.get('/v2/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'v2', 'index.html'));
});

// SPA fallback – serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Background notifier — polls ESPN every 60s and creates a one-time
// notification per user when a game involving their team / league goes live.
if (process.env.DISABLE_LIVE_TICKER !== '1') {
  const notifier = require('./services/notifier');
  notifier.startLiveGameTicker(60_000);
  // Group event pre-alerts: same cadence; cheap SQL scan per minute.
  notifier.startEventAlertTicker(60_000);
}

app.listen(PORT, () => {
  console.log(`CNTRD running at http://localhost:${PORT}`);
});
