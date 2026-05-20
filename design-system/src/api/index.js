import { api, get, post, del } from './client';

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
  create:   (body)               => post('/api/posts', body),
  like:     (id)                 => post(`/api/posts/${id}/like`),
};

export const games = {
  all:      ()                   => get('/api/games'),
};

export const users = {
  profile:  (username)           => get(`/api/users/${encodeURIComponent(username)}`),
};

export const plays = {
  list:     ()                   => get('/api/plays'),
  byUser:   (username)           => get(`/api/plays/user/${encodeURIComponent(username)}`),
  create:   (body)               => post('/api/plays', body),
  view:     (id)                 => post(`/api/plays/${id}/view`),
  remove:   (id)                 => del(`/api/plays/${id}`),
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
