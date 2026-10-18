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
  let url;
  try { url = new URL(event.notification.data?.url || '/', self.location.origin); }
  catch { url = new URL('/', self.location.origin); }
  if (url.origin !== self.location.origin) url = new URL('/', self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (client) {
      // A notification tap explicitly requests navigation, even when the URL is
      // unchanged: the app may currently be displaying its lobby or old results.
      try {
        const navigated = await client.navigate(url.href);
        if (navigated) return navigated.focus();
      } catch { /* Fall back to a new app window if the old one closed. */ }
    }
    return self.clients.openWindow(url.href);
  })());
});
