const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'cntrd.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT,
    bio TEXT DEFAULT '',
    avatar TEXT DEFAULT NULL,
    banner TEXT DEFAULT NULL,
    team_tags TEXT DEFAULT '[]',
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    image TEXT DEFAULT NULL,
    like_count INTEGER DEFAULT 0,
    repost_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    reply_to TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reply_to) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS reposts (
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS plays (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    team_code TEXT,
    label TEXT NOT NULL,
    hue INTEGER DEFAULT 200,
    live INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pages (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Idempotent column adds for upgrading older databases.
function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  }
}

ensureColumn('users', 'avatar_hue', "INTEGER DEFAULT 200");
ensureColumn('users', 'pronouns',   "TEXT DEFAULT ''");
ensureColumn('users', 'city',       "TEXT DEFAULT ''");
ensureColumn('users', 'is_admin',   "INTEGER DEFAULT 0");
ensureColumn('users', 'banned',     "INTEGER DEFAULT 0");

// post type: take | photo | score | poll | clip | box | rumor
ensureColumn('posts', 'type',  "TEXT DEFAULT 'take'");
ensureColumn('posts', 'tags',  "TEXT DEFAULT '[]'");      // JSON array of team codes
ensureColumn('posts', 'extra', "TEXT DEFAULT '{}'");       // JSON blob for type-specific data

// Seed Terms / Privacy / About if they don't exist yet. Admins can edit
// them from the admin console at /api/pages/:slug.
const PAGE_DEFAULTS = {
  terms: {
    title: 'Terms of Service',
    content: [
      'Welcome to CNTRD.',
      '',
      'By creating an account or using CNTRD, you agree to these terms.',
      '',
      '1. YOUR ACCOUNT',
      'You are responsible for activity on your account, the accuracy of the information you provide, and keeping your password secure.',
      '',
      '2. CONDUCT',
      'Be respectful. No harassment, hate speech, doxxing, or impersonation. Spam, off-topic content, and posts that violate intellectual property rights will be removed and may result in account suspension.',
      '',
      '3. YOUR CONTENT',
      'You keep ownership of everything you post. By posting, you grant CNTRD a non-exclusive license to display your content within the service.',
      '',
      '4. ENFORCEMENT',
      'We may suspend or terminate accounts that violate these terms. You can delete your account at any time from Settings.',
      '',
      '5. DISCLAIMER',
      'CNTRD is provided "as is" without warranties. Sports content, scores, and statistics come from third-party sources and may be inaccurate or delayed.',
      '',
      '6. CHANGES',
      'These terms may change. Material changes will be announced. Continued use after changes means you accept the updated terms.',
    ].join('\n'),
  },
  privacy: {
    title: 'Privacy Policy',
    content: [
      'We try to keep this short and honest.',
      '',
      'WHAT WE COLLECT',
      '• Account info — email, username, hashed password',
      '• Content you post — takes, plays, replies, profile fields',
      '• Activity data — likes, follows, your team picks',
      '• Standard server logs (IP, user-agent) for abuse prevention',
      '',
      'WHAT WE DO NOT DO',
      '• We do not sell your data',
      '• We do not share data with advertisers',
      '• We do not read your private messages (we do not have private messages yet)',
      '',
      'COOKIES / LOCAL STORAGE',
      'We use browser localStorage to keep you signed in and remember your theme + display preferences. No third-party tracking cookies.',
      '',
      'EMAIL',
      'We use your email for authentication and rare transactional notifications (password resets, security alerts). No marketing email.',
      '',
      'YOUR RIGHTS',
      'You can export, correct, or delete your data at any time. Use the controls in Settings, or email us if anything is missing.',
      '',
      'CONTACT',
      'Questions about privacy? Open an issue or email the team.',
    ].join('\n'),
  },
  about: {
    title: 'About CNTRD',
    content: [
      'CNTRD is a sports-only social network. Where the game gets loud.',
      '',
      'WHY CNTRD',
      'Sports talk gets buried under everything else on general-purpose social apps. CNTRD is built for fans — multi-sport feed, live gameday chat, team-tagged identity.',
      '',
      'HOW IT WORKS',
      '• Sign up and pick the teams you root for. They show next to your username and tune your feed.',
      '• Post takes, photos, polls, clips, rumors, or score reactions.',
      '• During live games, jump into Gameday for real-time chat with other fans.',
      '• Share Plays — short, in-the-moment posts that disappear.',
      '',
      'BUILT FOR THE FANS',
      'No fake users, no algorithmic dark patterns, no ads. Just sports.',
    ].join('\n'),
  },
};

const upsertPage = db.prepare(`
  INSERT INTO pages (slug, title, content)
  VALUES (?, ?, ?)
  ON CONFLICT(slug) DO NOTHING
`);
for (const [slug, { title, content }] of Object.entries(PAGE_DEFAULTS)) {
  upsertPage.run(slug, title, content);
}

module.exports = db;
