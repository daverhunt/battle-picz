/* Network-only service worker: avoid caching auth responses or stale game code. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || 'Battle Picz', {
    body: data.body || 'Open Battle Picz to see your latest battles.',
    icon: '/assets/app-icon-192.png', badge: '/assets/app-icon-192.png',
    tag: data.tag || 'battle-picz', data: { url: data.url || '/' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  let url = new URL(event.notification.data?.url || '/', self.location.origin);
  if (url.origin !== self.location.origin) url = new URL('/', self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(w => w.url === url.href);
    if (client) return client.focus();
    // Do not navigate an existing in-progress game away from its round.
    return self.clients.openWindow(url.href);
  })());
});
