const express = require('express');
const router = express.Router();
const espn = require('../services/espn');

router.get('/', async (req, res) => {
  try {
    const data = await espn.getAll();
    // Tell upstream caches the data goes stale fast.
    res.set('Cache-Control', 'public, max-age=20');
    res.json(data);
  } catch (err) {
    console.error('games error:', err.message);
    res.status(502).json({ error: 'Upstream scoreboard unavailable', live: [], upcoming: [], recent: [] });
  }
});

// Top sports articles aggregated across the requested leagues. Pass
// ?leagues=NFL,NBA,EPL to scope. Cached upstream for 5 min so flooding
// the endpoint doesn't hammer ESPN.
router.get('/news/articles', async (req, res) => {
  try {
    const leagues = String(req.query.leagues || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const items = await espn.getNews(leagues);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ articles: items });
  } catch (err) {
    console.error('news error:', err.message);
    res.status(502).json({ error: 'Upstream news unavailable', articles: [] });
  }
});

// Detailed view of a single game (box, leaders, headlines).
router.get('/:league/:id', async (req, res) => {
  try {
    const detail = await espn.getGameDetail(req.params.league, req.params.id);
    res.set('Cache-Control', 'public, max-age=20');
    res.json(detail);
  } catch (err) {
    console.error('game detail error:', err.message);
    const status = /Unknown league|Invalid event id/i.test(err.message) ? 400 : 502;
    res.status(status).json({ error: err.message || 'Upstream summary unavailable' });
  }
});

module.exports = router;
