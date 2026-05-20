import { api, get, post } from './client';

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

export { api };
