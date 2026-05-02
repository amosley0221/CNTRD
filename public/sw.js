// CNTRD service worker.
// Required for installable PWA + Web Push. The fetch handler actively
// responds (network with offline fallback) because Chrome's PWA
// installability check on Android only accepts the manifest as a real
// WebAPK candidate when the SW responds to fetch events. An empty
// listener is not enough — `Install app` won't appear without
// respondWith returning a real Response.

// Bump CACHE_VERSION whenever the SW logic changes so Chrome picks
// up the new file instead of reusing the cached old one.
const CACHE_VERSION = 'cntrd-v2';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  // Pre-cache the start URL so navigations work offline. This is the
  // minimum the installability check looks for.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    try { await cache.add(new Request(OFFLINE_URL, { cache: 'reload' })); } catch {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  // Drop old caches whose name doesn't match the current version, then
  // take control of any open tab so the first install doesn't need a
  // hard reload.
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(n => n === CACHE_VERSION ? null : caches.delete(n)));
    await self.clients.claim();
  })());
});

// Network-first for navigations with an offline fallback to the cached
// start page. Other requests pass straight through. The key requirement
// for PWA installability is that the SW returns a Response from
// respondWith — this satisfies Chrome's check while keeping the app
// online-first.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only intercept top-level navigations; let other resources hit the
  // network directly so we don't change static asset behavior.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Refresh the start-URL cache opportunistically so the offline
        // fallback stays current.
        const cache = await caches.open(CACHE_VERSION);
        cache.put(OFFLINE_URL, fresh.clone()).catch(() => {});
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(OFFLINE_URL);
        return cached || Response.error();
      }
    })());
  }
});

// Web Push — server payload is { title, body, url, type }.
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); }
    catch { data = { title: 'CNTRD', body: event.data.text() }; }
  }
  const title = data.title || 'CNTRD';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.type || 'cntrd',     // collapses repeat pushes for the same type
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap → focus an existing tab if we already have one open, otherwise
// open a fresh window at the deep-link URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        try {
          await c.focus();
          if ('navigate' in c) await c.navigate(url);
          return;
        } catch { /* ignore and fall through to openWindow */ }
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
