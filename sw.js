/* global self, caches, URL */
// Until 11 Nov 2026 the game lived at the front of the site, with its service worker here (sw.js?v=…, scope: the whole
// site). The game has moved to spill/, with its own worker there. A browser that had the old one fetches this file when
// it checks for an update: it takes over, deletes the old game's caches (their names start with this scope, see the
// game's sw.js), lets go of the site and reloads the open pages, which then come from the network. No fetch handler.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const prefix = `lukas:${encodeURIComponent(new URL(self.registration.scope).pathname)}:`;
    for (const key of await caches.keys()) if (key.startsWith(prefix)) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url).catch(() => {});
  })());
});
