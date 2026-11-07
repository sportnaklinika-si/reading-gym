// The friends' version moved from v2/ to the main address. This worker replaces the old one of v2/ on phones that had it,
// clears its cache and removes itself, so v2/ is only the forwarding page (v2/index.html).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('bm2-')) await caches.delete(k);
  await self.registration.unregister();
})()));
