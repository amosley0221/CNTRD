const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { notify } = require('./notifier');

// Returns the matched term (lower-cased) when content contains any of
// the owner's watchwords (whole-word, case-insensitive), else null.
function findMatch(content) {
  if (!content || typeof content !== 'string') return null;
  const haystack = content.toLowerCase();
  const rows = db.prepare('SELECT word FROM watch_words').all();
  for (const r of rows) {
    const w = String(r.word || '').trim().toLowerCase();
    if (!w) continue;
    // Whole-word match — guard against partial overlaps so "ass" doesn't
    // flag "assist". \b doesn't always work in JS for non-ASCII, so we
    // use a simple character-class boundary check.
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(w)}(?=$|[^\\p{L}\\p{N}_])`, 'iu');
    if (re.test(content)) return w;
  }
  return null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Owner ids — auto-flag notifications go to the owner only, not the
// full admin queue. Returns an array of ids.
function ownerIds() {
  return db.prepare('SELECT id FROM users WHERE banned = 0 AND is_owner = 1').all().map(r => r.id);
}

// Fire an auto-flag review for a post / play. Skips silently if the
// content has no watchword match. The report row is created with
// reporter_id = the author's id (so FK passes) but auto_flag = 1 so
// the UI renders it as a system flag instead of a user report.
function autoFlag({ targetType, targetId, authorId, content, mediaUrl = null }) {
  const term = findMatch(content);
  if (!term) return null;

  const id = uuidv4();
  // Reporter must be non-null per FK; use the author themselves so the
  // row is self-consistent. The UI keys off auto_flag, not reporter.
  db.prepare(`
    INSERT INTO reports (id, reporter_id, target_type, target_id, target_user_id,
                         reason, content_snapshot, auto_flag, matched_term, media_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id, authorId, targetType, targetId, authorId,
    `Auto-flag: matched "${term}"`,
    (content || '').slice(0, 2000),
    term,
    mediaUrl
  );

  for (const uid of ownerIds()) {
    notify({
      userId: uid, type: 'report_new', actorId: authorId,
      data: {
        report_id: id,
        target_type: targetType,
        target_id: targetId,
        preview: (content || '').slice(0, 140),
        auto_flag: true,
        matched_term: term,
      },
      // Per-report dedupe so the same auto-flag never hits the owner twice.
      dedupeKey: `auto-flag:${id}`,
    });
  }

  return { id, term };
}

module.exports = { findMatch, autoFlag };
