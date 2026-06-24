/* CardVault service worker — offline shell caching.
   API calls (pokemontcg.io) always go to network; the app shell is cached. */
const CACHE = 'cardvault-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Never cache the live pricing API — always fetch fresh.
  if (url.hostname.includes('pokemontcg.io')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Card images: cache-first (they're immutable per id).
  if (url.hostname.includes('images.pokemontcg.io')) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        cache.put(e.request, res.clone());
        return res;
      }).catch(() => fetch(e.request))
    );
    return;
  }

  // App shell: cache-first, fall back to network.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
