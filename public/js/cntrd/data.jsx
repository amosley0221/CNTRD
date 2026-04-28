// data.jsx — shared data model for CNTRD
// Multi-sport: NBA, NFL, MLB, NHL, soccer, F1, tennis, MMA.

const TEAMS = {
  // NBA
  LAL: { code: 'LAL', name: 'Lakers',     league: 'NBA',  primary: '#552583', accent: '#FDB927' },
  BOS: { code: 'BOS', name: 'Celtics',    league: 'NBA',  primary: '#007A33', accent: '#BA9653' },
  GSW: { code: 'GSW', name: 'Warriors',   league: 'NBA',  primary: '#1D428A', accent: '#FFC72C' },
  MIA: { code: 'MIA', name: 'Heat',       league: 'NBA',  primary: '#98002E', accent: '#F9A01B' },
  // NFL
  KC:  { code: 'KC',  name: 'Chiefs',     league: 'NFL',  primary: '#E31837', accent: '#FFB81C' },
  PHI: { code: 'PHI', name: 'Eagles',     league: 'NFL',  primary: '#004C54', accent: '#A5ACAF' },
  NYG: { code: 'NYG', name: 'Giants',     league: 'NFL',  primary: '#0B2265', accent: '#A71930' },
  SF:  { code: 'SF',  name: '49ers',      league: 'NFL',  primary: '#AA0000', accent: '#B3995D' },
  // MLB
  NYY: { code: 'NYY', name: 'Yankees',    league: 'MLB',  primary: '#003087', accent: '#E4002C' },
  LAD: { code: 'LAD', name: 'Dodgers',    league: 'MLB',  primary: '#005A9C', accent: '#FFFFFF' },
  // NHL
  TOR: { code: 'TOR', name: 'Maple Leafs',league: 'NHL',  primary: '#00205B', accent: '#FFFFFF' },
  EDM: { code: 'EDM', name: 'Oilers',     league: 'NHL',  primary: '#FF4C00', accent: '#041E42' },
  // Soccer
  ARS: { code: 'ARS', name: 'Arsenal',    league: 'EPL',  primary: '#EF0107', accent: '#FFFFFF' },
  RMA: { code: 'RMA', name: 'Real Madrid',league: 'LaLiga', primary: '#FEBE10', accent: '#00529F' },
  BAR: { code: 'BAR', name: 'Barcelona',  league: 'LaLiga', primary: '#A50044', accent: '#004D98' },
  MCI: { code: 'MCI', name: 'Man City',   league: 'EPL',  primary: '#6CABDD', accent: '#1C2C5B' },
  // F1
  FER: { code: 'FER', name: 'Ferrari',    league: 'F1',   primary: '#DC0000', accent: '#FFF200' },
  MCL: { code: 'MCL', name: 'McLaren',    league: 'F1',   primary: '#FF8700', accent: '#000000' },
};

// ME is a generic placeholder used before login — the real user is loaded
// from /api/auth/me at startup and replaces this on window.ME.
const ME = {
  username: 'guest',
  displayName: 'Guest',
  bio: '',
  pronouns: '',
  city: '',
  joined: '',
  teams: [],
  followers: 0,
  following: 0,
  posts: 0,
  avatar: null,
  avatarHue: 200,
};

// No seed/demo users — only people who have actually signed up appear
// in the app. USERS stays as an empty map so legacy `USERS[username]`
// lookups in the design components don't blow up.
const USERS = {};

// Generate a procedural avatar background as a CSS gradient (string).
function avatarBg(hue) {
  return `radial-gradient(circle at 30% 20%, oklch(0.78 0.16 ${hue}) 0%, oklch(0.42 0.16 ${(hue+30)%360}) 65%, oklch(0.22 0.10 ${(hue+60)%360}) 100%)`;
}

function avatarInitials(displayName) {
  if (!displayName) return '?';
  const parts = displayName.split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// LIVE_GAMES is intentionally empty — real game data is fetched from
// /api/games (ESPN-backed). Kept as an empty fallback so any straggler
// reference doesn't blow up the UI.
const LIVE_GAMES = [];

// FEED posts come from /api/posts/{feed,explore}. No seed posts.
const POSTS = [];

// PLAYS come from /api/plays. No seed plays.
const PLAYS = [];

// Gameday chat is not yet wired to a real backend. Empty until then.
const CHAT_MESSAGES = [];

// Notifications — empty placeholder until the notifications API ships.
const NOTIFS = [];

Object.assign(window, {
  TEAMS, USERS, ME, LIVE_GAMES, POSTS, PLAYS, CHAT_MESSAGES, NOTIFS,
  avatarBg, avatarInitials,
});
