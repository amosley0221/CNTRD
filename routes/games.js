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

module.exports = router;
