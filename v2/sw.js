// Keeps Bralni mentor 2 working without internet. Network first and past the browser's own cache (GitHub Pages lets browsers keep
// files for 10 minutes), so a new version arrives the moment the app is opened with a connection.
// The first Bralni mentor lives one folder up with its own cache ('bralni-mentor-v…'); this one only ever touches caches named 'bm2-'.
const CACHE = 'bm2-v1';
const FILES = ['./', 'index.html', 'app.js', 'core.js', 'kid.js', 'club.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'fonts/figtree.woff2', 'fonts/newsreader-semibold.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bm2-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // a page navigation can't be copied with new options, so it is fetched again by its address
  const req = e.request.mode === 'navigate' ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true, cacheName: CACHE }).then(r => r || caches.match('index.html', { cacheName: CACHE }))));
});
