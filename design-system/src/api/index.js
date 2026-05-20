import { api, get, post, put, del } from './client';

const patch = (p, body) => api(p, { method: 'PATCH', body: JSON.stringify(body || {}) });

export const auth = {
  me:       ()                   => get('/api/auth/me'),
  login:    (identifier, password) => post('/api/auth/login', { login: identifier, password }),
  register: (payload)            => post('/api/auth/register', payload),
  logout:   ()                   => post('/api/auth/logout'),
};

export const posts = {
  feed:     ()                   => get('/api/posts/feed'),
  explore:  ()                   => get('/api/posts/explore'),
  byUser:   (username)           => get(`/api/users/${encodeURIComponent(username)}/posts`),
  byId:     (id)                 => get(`/api/posts/${id}`),
  create:   (body)               => post('/api/posts', body),
  reply:    (parentId, content)  => post('/api/posts', { content, reply_to: parentId }),
  like:     (id)                 => post(`/api/posts/${id}/like`),
};

export const games = {
  all:      ()                   => get('/api/games'),
  detail:   (league, id)         => get(`/api/games/${encodeURIComponent(league)}/${encodeURIComponent(id)}`),
  news:     (leagues)            => {
    const qs = leagues?.length ? `?leagues=${encodeURIComponent(leagues.join(','))}` : '';
    return get(`/api/games/news/articles${qs}`);
  },
};

export const users = {
  profile:  (username)           => get(`/api/users/${encodeURIComponent(username)}`),
  follow:   (username)           => post(`/api/users/${encodeURIComponent(username)}/follow`),
  updateMe: (body)               => patch('/api/users/me/profile', body),
};

export const notifications = {
  list:     ()                   => get('/api/notifications'),
  unread:   ()                   => get('/api/notifications/unread'),
  readAll:  ()                   => post('/api/notifications/read-all'),
  read:     (id)                 => post(`/api/notifications/${id}/read`),
  remove:   (id)                 => del(`/api/notifications/${id}`),
  clear:    ()                   => del('/api/notifications'),
};

export const search = {
  query:    (q)                  => get(`/api/search?q=${encodeURIComponent(q)}`),
  trending: ()                   => get('/api/search/trending'),
};

export const push = {
  vapidPublic: ()                          => get('/api/push/vapid-public'),
  subscribe:   (sub)                       => post('/api/push/subscribe', sub),
  unsubscribe: (endpoint)                  => post('/api/push/unsubscribe', { endpoint }),
  test:        ()                          => post('/api/push/test'),
};

export const plays = {
  list:     ()                   => get('/api/plays'),
  byUser:   (username)           => get(`/api/plays/user/${encodeURIComponent(username)}`),
  create:   (body)               => post('/api/plays', body),
  view:     (id)                 => post(`/api/plays/${id}/view`),
  remove:   (id)                 => del(`/api/plays/${id}`),
};

export const messages = {
  list:        ()                          => get('/api/messages'),
  unread:      ()                          => get('/api/messages/unread'),
  searchUsers: (q)                         => get(`/api/messages/users/search?q=${encodeURIComponent(q)}`),
  create:      (user_ids, opts = {})       => post('/api/messages', { user_ids, ...opts }),
  conversation:(id)                        => get(`/api/messages/${id}`),
  fetch:       (id, opts = {})             => {
    const params = new URLSearchParams();
    if (opts.before) params.set('before', opts.before);
    if (opts.after)  params.set('after',  opts.after);
    const qs = params.toString();
    return get(`/api/messages/${id}/messages${qs ? `?${qs}` : ''}`);
  },
  send:        (id, content, reply_to_id) => post(`/api/messages/${id}/messages`, { content, reply_to_id }),
  gameday:     (gameId, state, date)      => {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (date)  params.set('date',  date);
    const qs = params.toString();
    return get(`/api/messages/gameday/${encodeURIComponent(gameId)}${qs ? `?${qs}` : ''}`);
  },
};

export const uploads = {
  // Multipart upload. The Express endpoint expects field name "media".
  // Returns { url, kind, size } — url is a relative /uploads/... path.
  async media(file) {
    const fd = new FormData();
    fd.append('media', file);
    return api('/api/upload/media', { method: 'POST', body: fd });
  },
};

export { api };
