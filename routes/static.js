const express = require('express');
const router = express.Router();
const { TEAMS } = require('../data/teams');

router.get('/teams', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(TEAMS);
});

module.exports = router;
