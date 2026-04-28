// api.jsx — tiny client over the CNTRD REST API.
// Exposes a global `API` object plus auth helpers and a relative-time formatter.

const TOKEN_KEY = 'cntrd:token';

function getToken()  { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} }

async function request(method, path, body) {
  const headers = { 'Accept': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const init = { method, headers };
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    init.body = body;
  }

  const res = await fetch(path, init);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const API = {
  hasToken: () => !!getToken(),
  setToken,

  health()                 { return request('GET',  '/api/health'); },
  me()                     { return request('GET',  '/api/auth/me'); },
  login(payload)           { return request('POST', '/api/auth/login', payload); },
  register(payload)        { return request('POST', '/api/auth/register', payload); },

  teams()                  { return request('GET',  '/api/static/teams'); },
  allTeams()               { return request('GET',  '/api/teams/all'); },
  games()                  { return request('GET',  '/api/games'); },
  gameDetail(league, id)   { return request('GET',  `/api/games/${encodeURIComponent(league)}/${encodeURIComponent(id)}`); },

  feed()                   { return request('GET',  '/api/posts/feed'); },
  explore()                { return request('GET',  '/api/posts/explore'); },
  createPost(payload)      { return request('POST', '/api/posts', payload); },
  likePost(id)             { return request('POST', `/api/posts/${id}/like`); },
  repostPost(id)           { return request('POST', `/api/posts/${id}/repost`); },
  userPosts(username)      { return request('GET',  `/api/users/${username}/posts`); },
  user(username)           { return request('GET',  `/api/users/${username}`); },
  updateMe(payload)        { return request('PATCH','/api/users/me/profile', payload); },

  plays()                  { return request('GET',  '/api/plays'); },
  createPlay(payload)      { return request('POST', '/api/plays', payload); },

  // Static pages (terms / privacy / about)
  pages()                  { return request('GET',  '/api/pages'); },
  page(slug)               { return request('GET',  `/api/pages/${slug}`); },
  updatePage(slug, body)   { return request('PUT',  `/api/pages/${slug}`, body); },

  // Admin (server enforces is_admin)
  adminUsers(q)            { return request('GET',  '/api/admin/users' + (q ? '?q=' + encodeURIComponent(q) : '')); },
  adminStats()             { return request('GET',  '/api/admin/stats'); },
  adminUserPosts(id)       { return request('GET',  `/api/admin/users/${id}/posts`); },
  adminBan(id)             { return request('POST', `/api/admin/users/${id}/ban`); },
  adminUnban(id)           { return request('POST', `/api/admin/users/${id}/unban`); },
  adminDeletePost(id)      { return request('DELETE', `/api/admin/posts/${id}`); },

  uploadAvatar(file) {
    const fd = new FormData();
    fd.append('avatar', file);
    return request('POST', '/api/upload/avatar', fd);
  },
};

// Format created_at (ISO/SQLite datetime) → short relative "2m" "1h" "3d".
function relTime(input) {
  if (!input) return '';
  const t = (typeof input === 'string') ? Date.parse(input.replace(' ', 'T') + 'Z') : +input;
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60)        return `${s}s`;
  if (s < 3600)      return `${Math.floor(s / 60)}m`;
  if (s < 86400)     return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 86400 / 7)}w`;
}

// Normalize a server post to the shape design components consume.
// Server already aliases content→text and spreads `extra` on top level; we only
// need to derive `time` (relative) so it renders correctly.
function normalizePost(p) {
  return { ...p, time: p.time || relTime(p.created_at) };
}

function normalizePlay(p) {
  return { ...p, time: p.time || (relTime(p.created_at) + ' ago') };
}

Object.assign(window, { API, getToken: getToken, relTime, normalizePost, normalizePlay });
