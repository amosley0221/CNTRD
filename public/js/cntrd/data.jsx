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

const ME = {
  username: 'mike_b',
  displayName: 'Mike Bautista',
  bio: '15 yrs courtside. Cold takes. From Inglewood.',
  pronouns: 'he/him',
  city: 'Los Angeles',
  joined: 'Joined Feb 2024',
  teams: ['LAL', 'NYG', 'ARS'],
  followers: 1284,
  following: 312,
  posts: 847,
  // SVG data-uri avatar so it's portable
  avatar: 'pattern',
  avatarHue: 280,
};

const USERS = {
  mike_b:       { ...ME },
  hoopjuice:    { username: 'hoopjuice',   displayName: 'Maya Okafor',  teams: ['BOS','ARS'],     avatarHue: 140 },
  ten_seconds:  { username: 'ten_seconds', displayName: 'Diego Vela',   teams: ['FER','MCL'],     avatarHue: 10 },
  pickyourpoison: { username: 'pickyourpoison', displayName: 'Sam Lin', teams: ['KC','LAD','NYY'],avatarHue: 200 },
  flagrant_one: { username: 'flagrant_one',displayName: 'Reggie Cole',  teams: ['MIA','PHI'],     avatarHue: 340 },
  set_piece:    { username: 'set_piece',   displayName: 'Lola Mensah',  teams: ['ARS','MCI'],     avatarHue: 60 },
  cold_take:    { username: 'cold_take',   displayName: 'Andre Powell', teams: ['LAL','GSW','RMA'], avatarHue: 240 },
  glove_save:   { username: 'glove_save',  displayName: 'Ivan Petrov',  teams: ['TOR','EDM'],     avatarHue: 180 },
  buzzer:       { username: 'buzzer',      displayName: 'CNTRD Editorial', teams: [], verified: true, avatarHue: 0 },
};

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

// FEED posts — diverse types. type: 'take' | 'photo' | 'score' | 'poll' | 'clip' | 'box' | 'rumor'
const POSTS = [
  {
    id: 'p1', type: 'take', user: 'flagrant_one',
    text: 'Bron at 41 still posterizing rooks on the break is genuinely insane. What we are watching is not normal.',
    time: '2m', likes: 1284, replies: 92, reposts: 38,
    tags: ['LAL','BOS'],
  },
  {
    id: 'p2', type: 'score', user: 'buzzer',
    game: 'g1',
    headline: 'Tatum hits 3 to take the lead',
    blurb: 'Celtics +3 with 4:21 left in Q4. Lakers timeout.',
    time: '4m', likes: 612, replies: 211, reposts: 109,
    tags: ['BOS','LAL'],
  },
  {
    id: 'p3', type: 'photo', user: 'hoopjuice',
    text: 'Section 110, row 12. Greatest seats of my life.',
    caption: 'TD Garden · BOS vs LAL',
    time: '11m', likes: 4011, replies: 142, reposts: 88,
    tags: ['BOS'],
  },
  {
    id: 'p4', type: 'poll', user: 'pickyourpoison',
    text: 'Real question. Who wins the AL East this year?',
    options: [
      { label: 'Yankees', votes: 41 },
      { label: 'Orioles', votes: 28 },
      { label: 'Red Sox', votes: 18 },
      { label: 'Rays',    votes: 13 },
    ],
    totalVotes: 9410,
    time: '23m', likes: 188, replies: 410, reposts: 22,
    tags: ['NYY'],
  },
  {
    id: 'p5', type: 'clip', user: 'set_piece',
    text: 'Saka with the cutback. Watch how he sells the inside cut.',
    duration: '0:18',
    time: '38m', likes: 2902, replies: 64, reposts: 312,
    tags: ['ARS'],
  },
  {
    id: 'p6', type: 'box', user: 'buzzer',
    headline: 'Box · Lakers @ Celtics',
    leaders: [
      { name: 'J. Tatum',  team: 'BOS', line: '32 PTS · 8 REB · 6 AST' },
      { name: 'L. James',  team: 'LAL', line: '28 PTS · 11 AST · 7 REB' },
      { name: 'A. Davis',  team: 'LAL', line: '24 PTS · 14 REB · 3 BLK' },
    ],
    time: '1h', likes: 401, replies: 33, reposts: 14,
    tags: ['LAL','BOS'],
  },
  {
    id: 'p7', type: 'rumor', user: 'cold_take',
    text: "Hearing whispers the Warriors made a real push for a 3&D wing before the deadline. Didn't bite. Front office getting impatient.",
    source: 'via league sources',
    time: '2h', likes: 821, replies: 388, reposts: 102,
    tags: ['GSW'],
  },
  {
    id: 'p8', type: 'take', user: 'ten_seconds',
    text: "Verstappen on softs at Imola tomorrow is unfair. Like watching someone bring a katana to a knife fight.",
    time: '3h', likes: 542, replies: 71, reposts: 38,
    tags: ['FER','MCL'],
  },
];

// PLAYS (stories) — short clips users have posted
const PLAYS = [
  { id: 'pl1', user: 'mike_b',       team: 'LAL', label: 'My seat',     hue: 280, time: '1h ago' },
  { id: 'pl2', user: 'hoopjuice',    team: 'BOS', label: 'Garden W',     hue: 140, time: '2h ago', live: true },
  { id: 'pl3', user: 'set_piece',    team: 'ARS', label: 'Saka magic',   hue: 60,  time: '4h ago' },
  { id: 'pl4', user: 'ten_seconds',  team: 'FER', label: 'Lap 1 chaos',  hue: 10,  time: '6h ago' },
  { id: 'pl5', user: 'flagrant_one', team: 'MIA', label: 'Pre-game',     hue: 340, time: '8h ago' },
  { id: 'pl6', user: 'glove_save',   team: 'TOR', label: 'OT winner',    hue: 180, time: '12h ago' },
];

// GAMEDAY chat messages (for the live game chat room)
const CHAT_MESSAGES = [
  { id: 'c1', user: 'hoopjuice', text: "Tatum's been locked in all quarter", time: '4:42', side: 'BOS' },
  { id: 'c2', user: 'flagrant_one', text: 'AD has to stay out of foul trouble', time: '4:40', side: 'LAL' },
  { id: 'c3', user: 'cold_take', text: 'why are we still running this play', time: '4:38', side: 'LAL' },
  { id: 'c4', user: 'pickyourpoison', text: 'Lakers +180 looking SPICY rn', time: '4:37' },
  { id: 'c5', user: 'hoopjuice', text: 'CALL THAT', time: '4:35', side: 'BOS' },
  { id: 'c6', user: 'mike_b', text: 'ref needs to put the whistle away', time: '4:34', side: 'LAL', mine: true },
  { id: 'c7', user: 'set_piece', text: 'Brown 1-of-7 from three btw', time: '4:32', side: 'BOS' },
  { id: 'c8', user: 'flagrant_one', text: 'this is THE possession', time: '4:30', side: 'LAL' },
  { id: 'c9', user: 'cold_take', text: 'BRON LOB!!!!!!', time: '4:28', side: 'LAL' },
  { id: 'c10', user: 'hoopjuice', text: 'lol that was barely a dunk', time: '4:27', side: 'BOS' },
  { id: 'c11', user: 'mike_b', text: 'cope', time: '4:26', side: 'LAL', mine: true },
  { id: 'c12', user: 'pickyourpoison', text: 'down 1, possession Lakers, 4 minutes. this is what we watch sports for', time: '4:25' },
];

// Notifications
const NOTIFS = [
  { id: 'n1', kind: 'like', user: 'hoopjuice', text: 'liked your hot take', time: '2m' },
  { id: 'n2', kind: 'follow', user: 'set_piece', text: 'started following you', time: '14m' },
  { id: 'n3', kind: 'live', user: 'buzzer', text: 'LAL vs BOS just tipped off', time: '1h' },
  { id: 'n4', kind: 'reply', user: 'cold_take', text: 'replied to your trade rumor', time: '3h' },
];

Object.assign(window, {
  TEAMS, USERS, ME, LIVE_GAMES, POSTS, PLAYS, CHAT_MESSAGES, NOTIFS,
  avatarBg, avatarInitials,
});
