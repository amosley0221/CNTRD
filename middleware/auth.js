const jwt = require('jsonwebtoken');
const db  = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'cntrd_jwt_secret_change_in_production';
// Server-set HttpOnly session cookie. Survives Safari ITP's 7-day JS-cookie
// cap because it's set via Set-Cookie, not document.cookie.
const SESSION_COOKIE = 'cntrd_session';
const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;  // seconds

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
}
function clearSessionCookie(res) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}
function readBearerOrCookie(req) {
  const auth = req.headers.authorization?.split(' ')[1];
  if (auth) return auth;
  return req.cookies?.[SESSION_COOKIE] || null;
}

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
);
// Single platform owner — has elevated privileges over admins. Set via
// OWNER_EMAIL on Render. The owner is implicitly an admin too.
const OWNER_EMAIL = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();

function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.has(String(email).toLowerCase());
}
function isOwnerEmail(email) {
  return !!email && !!OWNER_EMAIL && String(email).toLowerCase() === OWNER_EMAIL;
}

// Look up fresh state on every request — JWTs aren't reissued, so a banned
// user with a still-valid token would otherwise keep posting until expiry.
// Also clears expired temp bans so a 3-day suspension self-heals once
// banned_until is in the past.
function loadFreshUser(id) {
  const u = db.prepare('SELECT id, username, email, banned, banned_until, is_admin, is_owner FROM users WHERE id = ?').get(id);
  if (!u) return null;
  if (u.banned && u.banned_until) {
    const t = Date.parse(u.banned_until.includes('T') ? u.banned_until : u.banned_until.replace(' ', 'T') + 'Z');
    if (Number.isFinite(t) && t < Date.now()) {
      db.prepare('UPDATE users SET banned = 0, banned_until = NULL WHERE id = ?').run(id);
      u.banned = 0;
      u.banned_until = null;
    }
  }
  return u;
}

function requireAuth(req, res, next) {
  const token = readBearerOrCookie(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const fresh = loadFreshUser(decoded.id);
    if (!fresh) return res.status(401).json({ error: 'User not found' });
    if (fresh.banned) return res.status(403).json({ error: 'Account suspended' });
    req.user = {
      id: fresh.id,
      username: fresh.username,
      email: fresh.email,
      is_admin: !!fresh.is_admin || !!fresh.is_owner,    // owner is always also admin
      is_owner: !!fresh.is_owner,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const token = readBearerOrCookie(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const fresh = loadFreshUser(decoded.id);
      // Banned users count as anonymous on optional-auth routes.
      if (fresh && !fresh.banned) {
        req.user = {
          id: fresh.id,
          username: fresh.username,
          email: fresh.email,
          is_admin: !!fresh.is_admin || !!fresh.is_owner,
          is_owner: !!fresh.is_owner,
        };
      }
    } catch { /* ignore */ }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
}
function requireOwner(req, res, next) {
  if (!req.user?.is_owner) return res.status(403).json({ error: 'Owner only' });
  next();
}

module.exports = {
  requireAuth, optionalAuth, requireAdmin, requireOwner,
  JWT_SECRET, isAdminEmail, isOwnerEmail,
  setSessionCookie, clearSessionCookie,
};
