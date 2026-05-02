// CNTRD service worker.
// Required for installable PWA + Web Push. Kept intentionally minimal —
// network passes straight through. The push + notificationclick handlers
// are the meaningful surface here.

self.addEventListener('install', (event) => {
  // Take over as soon as we're activated; no waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim already-open clients so the first install doesn't need a reload.
  event.waitUntil(self.clients.claim());
});

// Network-first pass-through for navigations, no caching. Keeps the SW
// install eligible without changing how the app loads. (Caching can be
// added later for offline support.)
self.addEventListener('fetch', () => { /* default behavior */ });

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
    icon: '/icon.svg',
    badge: '/icon.svg',
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
