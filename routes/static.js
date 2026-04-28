const express = require('express');
const router = express.Router();
const { TEAMS, LIVE_GAMES } = require('../data/teams');

router.get('/teams', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(TEAMS);
});

router.get('/games', (req, res) => {
  res.json(LIVE_GAMES);
});

module.exports = router;
