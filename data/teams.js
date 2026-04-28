// Shared team registry — used server-side for validation and frontend for UI.
// Mirrors the team data in public/js/cntrd/data.jsx.

const TEAMS = {
  // NBA
  LAL: { code: 'LAL', name: 'Lakers',     league: 'NBA',    primary: '#552583', accent: '#FDB927' },
  BOS: { code: 'BOS', name: 'Celtics',    league: 'NBA',    primary: '#007A33', accent: '#BA9653' },
  GSW: { code: 'GSW', name: 'Warriors',   league: 'NBA',    primary: '#1D428A', accent: '#FFC72C' },
  MIA: { code: 'MIA', name: 'Heat',       league: 'NBA',    primary: '#98002E', accent: '#F9A01B' },
  // NFL
  KC:  { code: 'KC',  name: 'Chiefs',     league: 'NFL',    primary: '#E31837', accent: '#FFB81C' },
  PHI: { code: 'PHI', name: 'Eagles',     league: 'NFL',    primary: '#004C54', accent: '#A5ACAF' },
  NYG: { code: 'NYG', name: 'Giants',     league: 'NFL',    primary: '#0B2265', accent: '#A71930' },
  SF:  { code: 'SF',  name: '49ers',      league: 'NFL',    primary: '#AA0000', accent: '#B3995D' },
  // MLB
  NYY: { code: 'NYY', name: 'Yankees',    league: 'MLB',    primary: '#003087', accent: '#E4002C' },
  LAD: { code: 'LAD', name: 'Dodgers',    league: 'MLB',    primary: '#005A9C', accent: '#FFFFFF' },
  // NHL
  TOR: { code: 'TOR', name: 'Maple Leafs',league: 'NHL',    primary: '#00205B', accent: '#FFFFFF' },
  EDM: { code: 'EDM', name: 'Oilers',     league: 'NHL',    primary: '#FF4C00', accent: '#041E42' },
  // Soccer
  ARS: { code: 'ARS', name: 'Arsenal',    league: 'EPL',    primary: '#EF0107', accent: '#FFFFFF' },
  RMA: { code: 'RMA', name: 'Real Madrid',league: 'LaLiga', primary: '#FEBE10', accent: '#00529F' },
  BAR: { code: 'BAR', name: 'Barcelona',  league: 'LaLiga', primary: '#A50044', accent: '#004D98' },
  MCI: { code: 'MCI', name: 'Man City',   league: 'EPL',    primary: '#6CABDD', accent: '#1C2C5B' },
  // F1
  FER: { code: 'FER', name: 'Ferrari',    league: 'F1',     primary: '#DC0000', accent: '#FFF200' },
  MCL: { code: 'MCL', name: 'McLaren',    league: 'F1',     primary: '#FF8700', accent: '#000000' },
};

const VALID_TEAM_CODES = new Set(Object.keys(TEAMS));

// Stable team identifier shape: either a bare code (LAL, BOS — legacy data
// from before we supported multi-league disambiguation) or a composite
// `LEAGUE:CODE` (NFL:PHI, NBA:PHI). Uppercase A–Z and 0–9 only, capped at
// 8 chars per segment.
function isValidTeamCode(code) {
  if (typeof code !== 'string') return false;
  const s = code.trim().toUpperCase();
  return /^[A-Z0-9]{1,8}(:[A-Z0-9]{1,8})?$/.test(s);
}

module.exports = { TEAMS, VALID_TEAM_CODES, isValidTeamCode };
