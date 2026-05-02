// api.jsx — tiny client over the CNTRD REST API.
// Exposes a global `API` object plus auth helpers and a relative-time formatter.

const TOKEN_KEY = 'cntrd:token';
const COOKIE_DAYS = 30;

// iOS standalone mode (Add to Home Screen → "Open as web app", especially
// from Chrome on iOS) sometimes wipes localStorage between launches.
// Mirror the token into a long-lived cookie so we can recover the
// session even when storage gets cleared. Cookie is JS-readable on
// purpose — we still send the JWT via the Authorization header, the
// cookie just acts as a persistence backup.
function _writeCookie(name, value, days) {
  try {
    const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
    const secure = (typeof location !== 'undefined' && location.protocol === 'https:') ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
  } catch {}
}
function _deleteCookie(name) {
  try {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/; SameSite=Lax`;
  } catch {}
}
function _readCookie(name) {
  try {
    const re = new RegExp('(?:^|; )' + name + '=([^;]*)');
    const m = document.cookie.match(re);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

// Token can be persisted in either localStorage (sticky across sessions —
// the "Stay signed in" checkbox) or sessionStorage (cleared when the user
// closes the tab). getToken consults both, plus a cookie fallback for
// installed iOS web apps that wipe localStorage.
function getToken() {
  let t = null;
  try { t = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch {}
  if (!t) t = _readCookie(TOKEN_KEY);
  // If the cookie had a token but storage didn't, replant it in
  // localStorage so subsequent reads are fast and the "logged in" flag
  // survives even if the cookie expires next.
  if (t) {
    try { if (!localStorage.getItem(TOKEN_KEY)) localStorage.setItem(TOKEN_KEY, t); } catch {}
  }
  return t;
}
function setToken(t, { persist = true } = {}) {
  try {
    if (!t) {
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
      try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
      _deleteCookie(TOKEN_KEY);
      return;
    }
    if (persist) {
      try { localStorage.setItem(TOKEN_KEY, t); sessionStorage.removeItem(TOKEN_KEY); } catch {}
      _writeCookie(TOKEN_KEY, t, COOKIE_DAYS);
    } else {
      try { sessionStorage.setItem(TOKEN_KEY, t); localStorage.removeItem(TOKEN_KEY); } catch {}
      // Session-only login → no cookie. Clear any prior persistent cookie.
      _deleteCookie(TOKEN_KEY);
    }
  } catch {}
}

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
  // Safari/iOS caps JS-set cookies at 7 days under ITP, regardless of the
  // declared expiry. Refresh the cookie + localStorage on every successful
  // authed request so an active user stays signed in indefinitely.
  if (token) {
    _writeCookie(TOKEN_KEY, token, COOKIE_DAYS);
    try { if (localStorage.getItem(TOKEN_KEY) !== token && !sessionStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, token);
    }} catch {}
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
  logout()                 { return request('POST', '/api/auth/logout').catch(() => null); },
  updateAccount(payload)   { return request('PATCH','/api/auth/account', payload); },
  saveTweaks(payload)      { return request('PUT',  '/api/auth/tweaks', payload); },

  teams()                  { return request('GET',  '/api/static/teams'); },
  allTeams()               { return request('GET',  '/api/teams/all'); },
  leagueCatalog()          { return request('GET',  '/api/leagues'); },
  games()                  { return request('GET',  '/api/games'); },
  gameDetail(league, id)   { return request('GET',  `/api/games/${encodeURIComponent(league)}/${encodeURIComponent(id)}`); },
  teamSchedule(league, teamId, season) {
    const qs = season ? `?season=${encodeURIComponent(season)}` : '';
    return request('GET', `/api/teams/${encodeURIComponent(league)}/${encodeURIComponent(teamId)}/schedule${qs}`);
  },

  feed()                   { return request('GET',  '/api/posts/feed'); },
  explore()                { return request('GET',  '/api/posts/explore'); },
  postsByTag(code)         { return request('GET',  `/api/posts/by-tag/${encodeURIComponent(code)}`); },
  post(id)                 { return request('GET',  `/api/posts/${encodeURIComponent(id)}`); },
  createPost(payload)      { return request('POST', '/api/posts', payload); },
  editPost(id, content)    { return request('PATCH',`/api/posts/${id}`, { content }); },
  deletePost(id)           { return request('DELETE',`/api/posts/${id}`); },
  likePost(id)             { return request('POST', `/api/posts/${id}/like`); },
  repostPost(id)           { return request('POST', `/api/posts/${id}/repost`); },
  bookmarkPost(id)         { return request('POST', `/api/posts/${id}/bookmark`); },
  myBookmarks()            { return request('GET',  '/api/posts/me/bookmarks'); },
  search(q)                { return request('GET',  '/api/search?q=' + encodeURIComponent(q || '')); },
  trending()               { return request('GET',  '/api/search/trending'); },
  userPosts(username)      { return request('GET',  `/api/users/${username}/posts`); },
  user(username)           { return request('GET',  `/api/users/${username}`); },
  updateMe(payload)        { return request('PATCH','/api/users/me/profile', payload); },

  plays()                  { return request('GET',  '/api/plays'); },
  userPlays(username)      { return request('GET',  `/api/plays/user/${encodeURIComponent(username)}`); },
  createPlay(payload)      { return request('POST', '/api/plays', payload); },
  deletePlay(id)           { return request('DELETE', `/api/plays/${id}`); },
  markPlayViewed(id)       { return request('POST', `/api/plays/${id}/view`).catch(() => null); },
  togglePlayReaction(id, emoji) { return request('POST', `/api/plays/${id}/reactions`, { emoji }); },

  // Static pages (terms / privacy / about)
  pages()                  { return request('GET',  '/api/pages'); },
  page(slug)               { return request('GET',  `/api/pages/${slug}`); },
  updatePage(slug, body)   { return request('PUT',  `/api/pages/${slug}`, body); },

  // Notifications
  notifications()                       { return request('GET',  '/api/notifications'); },
  notificationsUnread()                 { return request('GET',  '/api/notifications/unread'); },
  markNotifRead(id)                     { return request('POST', `/api/notifications/${id}/read`); },
  markAllNotifsRead()                   { return request('POST', '/api/notifications/read-all'); },
  dismissNotif(id)                      { return request('DELETE', `/api/notifications/${id}`); },
  dismissReadNotifs()                   { return request('DELETE', '/api/notifications'); },

  // Follow / privacy / blocks
  followUser(username)                  { return request('POST', `/api/users/${username}/follow`); },
  followers(username)                   { return request('GET',  `/api/users/${username}/followers`); },
  followingList(username)               { return request('GET',  `/api/users/${username}/following`); },
  removeFollower(username)              { return request('POST', `/api/users/${username}/remove-follower`); },
  muteUser(username)                    { return request('POST', `/api/users/${username}/mute`); },
  followRequests()                      { return request('GET',  '/api/users/me/follow-requests'); },
  acceptFollowRequest(username)         { return request('POST', `/api/users/${username}/follow-request/accept`); },
  rejectFollowRequest(username)         { return request('POST', `/api/users/${username}/follow-request/reject`); },
  blockUser(username)                   { return request('POST', `/api/users/${username}/block`); },
  unblockUser(username)                 { return request('POST', `/api/users/${username}/unblock`); },
  blocks()                              { return request('GET',  '/api/users/me/blocks'); },

  // Messages
  conversations()                       { return request('GET',  '/api/messages'); },
  unreadCount()                         { return request('GET',  '/api/messages/unread'); },
  conversation(id)                      { return request('GET',  `/api/messages/${id}`); },
  conversationMessages(id, before)      { return request('GET',  `/api/messages/${id}/messages${before ? '?before=' + encodeURIComponent(before) : ''}`); },
  conversationMessagesAfter(id, after)  { return request('GET',  `/api/messages/${id}/messages?after=${encodeURIComponent(after)}`); },
  gamedayConversation(gameId, opts = {}) {
    const params = new URLSearchParams();
    if (opts.state) params.set('state', String(opts.state));
    if (opts.date)  params.set('date',  String(opts.date));
    const qs = params.toString();
    return request('GET', `/api/messages/gameday/${encodeURIComponent(gameId)}${qs ? '?' + qs : ''}`);
  },
  sendMessage(id, content, replyToId)   { return request('POST', `/api/messages/${id}/messages`, replyToId ? { content, reply_to_id: replyToId } : { content }); },
  editMessage(id, msgId, content)       { return request('PATCH',  `/api/messages/${id}/messages/${msgId}`, { content }); },
  deleteMessage(id, msgId)              { return request('DELETE', `/api/messages/${id}/messages/${msgId}`); },
  pulseTyping(id)                       { return request('POST', `/api/messages/${id}/typing`); },
  clearTyping(id)                       { return request('DELETE', `/api/messages/${id}/typing`); },
  conversationParticipants(id, q)       { return request('GET',  `/api/messages/${id}/participants${q ? '?q=' + encodeURIComponent(q) : ''}`); },
  groupInvites()                        { return request('GET',  '/api/messages/invites'); },
  acceptGroupInvite(convId)             { return request('POST', `/api/messages/invites/${convId}/accept`); },
  rejectGroupInvite(convId)             { return request('POST', `/api/messages/invites/${convId}/reject`); },
  createConversation(payload)           { return request('POST', '/api/messages', payload); },
  renameConversation(id, name)          { return request('PATCH',`/api/messages/${id}`, { name }); },
  searchUsers(q)                        { return request('GET',  '/api/messages/users/search?q=' + encodeURIComponent(q)); },
  leaveConversation(id)                 { return request('DELETE', `/api/messages/${id}/members/me`); },
  kickGroupMember(id, userId)           { return request('DELETE', `/api/messages/${id}/members/${userId}`); },
  deleteGroup(id)                       { return request('DELETE', `/api/messages/${id}`); },
  inviteToGroup(id, userId)             { return request('POST',   `/api/messages/${id}/members`, { user_id: userId }); },
  conversationEvents(id)                { return request('GET',  `/api/messages/${id}/events`); },
  createEvent(id, payload)              { return request('POST', `/api/messages/${id}/events`, payload); },
  deleteEvent(id, eventId)              { return request('DELETE', `/api/messages/${id}/events/${eventId}`); },

  // Reports — anyone signed-in can file; admin/owner manage.
  reportSubmit(payload)              { return request('POST', '/api/reports', payload); },
  reportsList(status = 'pending')    { return request('GET',  `/api/reports?status=${encodeURIComponent(status)}`); },
  reportsCounts()                    { return request('GET',  '/api/reports/counts').catch(() => ({ pending: 0, escalated: 0 })); },
  reportResolve(id, payload)         { return request('POST', `/api/reports/${id}/resolve`, payload); },

  // Watchwords (owner manages, admins can read).
  watchwordsList()                   { return request('GET',    '/api/admin/watchwords'); },
  watchwordsAdd(word)                { return request('POST',   '/api/admin/watchwords', { word }); },
  watchwordsRemove(id)               { return request('DELETE', `/api/admin/watchwords/${id}`); },

  // Web Push.
  pushVapidPublic()                  { return request('GET',  '/api/push/vapid-public'); },
  pushSubscribe(subscription)        { return request('POST', '/api/push/subscribe', { subscription }); },
  pushUnsubscribe(endpoint)          { return request('POST', '/api/push/unsubscribe', { endpoint }); },
  pushTest()                         { return request('POST', '/api/push/test'); },
  pushStatus()                       { return request('GET',  '/api/admin/push-status'); },
  pushDebug(payload)                 { return request('POST', '/api/admin/push-debug', payload); },

  // Admin (server enforces is_admin)
  adminUsers(q)            { return request('GET',  '/api/admin/users' + (q ? '?q=' + encodeURIComponent(q) : '')); },
  adminStats()             { return request('GET',  '/api/admin/stats'); },
  adminUserPosts(id)       { return request('GET',  `/api/admin/users/${id}/posts`); },
  adminBan(id)             { return request('POST', `/api/admin/users/${id}/ban`); },
  adminUnban(id)           { return request('POST', `/api/admin/users/${id}/unban`); },
  adminDeletePost(id)      { return request('DELETE', `/api/admin/posts/${id}`); },
  adminToggleAdmin(id)     { return request('POST', `/api/admin/users/${id}/admin`); },
  adminToggleVerified(id)  { return request('POST', `/api/admin/users/${id}/verified`); },
  adminToggleOfficial(id)  { return request('POST', `/api/admin/users/${id}/official`); },

  uploadAvatar(file) {
    const fd = new FormData();
    fd.append('avatar', file);
    return request('POST', '/api/upload/avatar', fd);
  },
  // Photo or short clip attachment for a post. Returns { url, kind }.
  uploadMedia(file) {
    const fd = new FormData();
    fd.append('media', file);
    return request('POST', '/api/upload/media', fd);
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
