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
    // Preserve the tap across iOS Home Screen launches that ignore openWindow's URL.
    // Only a deliberate tap writes this; receiving an alert never redirects play.
    try {
      const cache = await caches.open('battle-picz-notification-navigation');
      await cache.put('/__notification-target', new Response(JSON.stringify({url: url.href, at: Date.now()})));
    } catch { /* Normal navigation still works without Cache Storage. */ }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (client) {
      // A notification tap explicitly requests navigation, even when the URL is
      // unchanged: the app may currently be displaying its lobby or old results.
      try {
        const navigated = await client.navigate(url.href);
        if (navigated) {
          await navigated.focus();
          navigated.postMessage?.({type: 'battle-picz:notification-tap'});
          return;
        }
      } catch { /* Fall back to a new app window if the old one closed. */ }
    }
    const opened = await self.clients.openWindow(url.href);
    opened?.postMessage?.({type: 'battle-picz:notification-tap'});
  })());
});
