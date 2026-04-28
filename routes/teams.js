const express = require('express');
const router = express.Router();
const espn = require('../services/espn');
const { TEAMS } = require('../data/teams');

// Build a fallback structure from the static TEAMS map. Used when ESPN is
// unreachable on the very first request (later cached calls succeed once
// upstream is back).
function staticFallback() {
  const out = {};
  for (const t of Object.values(TEAMS)) {
    (out[t.league] = out[t.league] || []).push({
      code: t.code, key: `${t.league}:${t.code}`,
      name: t.name, fullName: t.name,
      league: t.league, primary: t.primary, accent: t.accent,
    });
  }
  return out;
}

router.get('/all', async (req, res) => {
  try {
    const teams = await espn.getAllTeams();
    // If every league came back empty, fall back to the static seed so the
    // signup screen isn't blank when ESPN is down.
    const populated = Object.values(teams).some(list => list && list.length > 0);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(populated ? teams : staticFallback());
  } catch (err) {
    console.error('teams/all error:', err.message);
    res.json(staticFallback());
  }
});

module.exports = router;
