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

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT NULL,                -- null for 1:1 DMs, free text for groups
    is_group INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_message_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TEXT DEFAULT (datetime('now')),
    last_read_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS follow_requests (
    requester_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (requester_id, target_id),
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id)    REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,        -- recipient
    type TEXT NOT NULL,           -- follow | follow_request | follow_accept | message | live_game
    actor_id TEXT,                -- optional triggering user
    data TEXT DEFAULT '{}',       -- JSON blob with type-specific context
    dedupe_key TEXT,              -- unique per (user_id, dedupe_key) when not null
    read_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conv     ON messages(conversation_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notif_user_recent ON notifications(user_id, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedupe
    ON notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

  CREATE TABLE IF NOT EXISTS blocks (
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (blocker_id, blocked_id),
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_at TEXT NOT NULL,                -- ISO timestamp; UTC on insert
    created_by TEXT NOT NULL,
    pre_alert_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_events_conv ON events(conversation_id, start_at);
  CREATE INDEX IF NOT EXISTS idx_events_pending ON events(start_at, pre_alert_sent);

  CREATE TABLE IF NOT EXISTS mutes (
    muter_id TEXT NOT NULL,
    muted_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (muter_id, muted_id),
    FOREIGN KEY (muter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (muted_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_mutes_muter ON mutes(muter_id);

  CREATE TABLE IF NOT EXISTS bookmarks (
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at DESC);
`);

// Idempotent column adds for upgrading older databases.
function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  }
}

ensureColumn('users', 'avatar_hue',       "INTEGER DEFAULT 200");
ensureColumn('users', 'pronouns',         "TEXT DEFAULT ''");
ensureColumn('users', 'city',             "TEXT DEFAULT ''");
ensureColumn('users', 'is_admin',         "INTEGER DEFAULT 0");
ensureColumn('users', 'banned',           "INTEGER DEFAULT 0");
ensureColumn('users', 'followed_leagues', "TEXT DEFAULT '[]'");
ensureColumn('users', 'is_private',       "INTEGER DEFAULT 0");
// JSON object: per-type opt-out flags for notifications. Missing key = on.
ensureColumn('users', 'notification_prefs', "TEXT DEFAULT '{}'");
// JSON object: UI tweaks (accent, dark/light, density, etc.) so settings
// follow the user across devices.
ensureColumn('users', 'tweaks', "TEXT DEFAULT '{}'");
// Role flags. is_owner is the platform owner (single user, set via
// OWNER_EMAIL env var on signup/login). is_official = team /
// organization account; is_verified = identity-verified individual.
// Both badges are managed by admins through the admin console.
ensureColumn('users', 'is_owner',    "INTEGER DEFAULT 0");
ensureColumn('users', 'is_official', "INTEGER DEFAULT 0");
ensureColumn('users', 'is_verified', "INTEGER DEFAULT 0");
// Admin / owner privilege: drop the @username from public surfaces so
// only the display name shows. Routing + login still use the username
// internally; this only affects what other users see.
ensureColumn('users', 'hide_username', "INTEGER DEFAULT 0");

// Gameday group chats: each live game gets one shared conversation.
// game_id stores the external game identifier so we can find-or-create
// the room without scanning by name.
ensureColumn('conversations', 'game_id', "TEXT DEFAULT NULL");
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_game_id ON conversations(game_id) WHERE game_id IS NOT NULL`);
} catch {}

// Gameday chats auto-close after a 24 h grace period past the game's
// expected end. closes_at is set once on first access and never moved.
ensureColumn('conversations', 'closes_at', "TEXT DEFAULT NULL");

// Threaded replies inside a conversation.
ensureColumn('messages', 'reply_to_id', "TEXT DEFAULT NULL");

// Edit / soft-delete metadata for chat messages. Both null when untouched.
ensureColumn('messages', 'edited_at',  "TEXT DEFAULT NULL");
ensureColumn('messages', 'deleted_at', "TEXT DEFAULT NULL");
// System-generated messages (e.g. "Alice renamed the group to …") render
// differently than user posts; flag them so the client can centre and
// dim them, and so the server can skip mention/reply notifications.
ensureColumn('messages', 'is_system',  "INTEGER DEFAULT 0");

// Typing indicator: each member pings this column while composing; readers
// poll the conversation and surface anyone whose typing_until > now.
ensureColumn('conversation_members', 'typing_until', "TEXT DEFAULT NULL");

// Group-chat invitations. Adding someone to a group now creates a
// pending invite; they're only added to conversation_members on accept.
db.exec(`
  CREATE TABLE IF NOT EXISTS conversation_invites (
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    invited_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE,
    FOREIGN KEY (invited_by)      REFERENCES users(id)         ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_conv_invites_user ON conversation_invites(user_id);
`);

// post type: take | photo | score | poll | clip | box | rumor
ensureColumn('posts', 'type',  "TEXT DEFAULT 'take'");
ensureColumn('posts', 'tags',  "TEXT DEFAULT '[]'");      // JSON array of team codes
ensureColumn('posts', 'extra', "TEXT DEFAULT '{}'");       // JSON blob for type-specific data
ensureColumn('posts', 'edited_at', "TEXT DEFAULT NULL");   // timestamp of last edit, null if never edited

// Plays carry an optional uploaded photo or short clip.
ensureColumn('plays', 'media_url',  "TEXT DEFAULT NULL");
ensureColumn('plays', 'media_kind', "TEXT DEFAULT NULL");  // 'image' | 'video'

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
