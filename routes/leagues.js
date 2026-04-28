const express = require('express');
const router = express.Router();
const { LEAGUES } = require('../services/espn');

// Public catalog of leagues the app knows about. Used by the signup
// "Pick leagues" step and the Settings → My leagues editor.
router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json(LEAGUES.map(l => ({
    code: l.code,
    label: l.label,
    sport: l.sport,
    hasTeams: !!l.hasTeams,
  })));
});

// Lightweight set used server-side for validation.
const VALID_LEAGUE_CODES = new Set(LEAGUES.map(l => l.code));

function normalizeLeagues(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const code = String(raw).trim();
    if (!VALID_LEAGUE_CODES.has(code) || seen.has(code)) continue;
    seen.add(code); out.push(code);
    if (out.length >= LEAGUES.length) break;
  }
  return out;
}

router.VALID_LEAGUE_CODES = VALID_LEAGUE_CODES;
router.normalizeLeagues = normalizeLeagues;

module.exports = router;
