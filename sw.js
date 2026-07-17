const CACHE = 'mica-shell-v17';
const SHELL = ['./','./index.html','./styles.css?v=17','./app-config.js?v=17','./app.js?v=17','./manifest.webmanifest','./icons/icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.origin !== self.location.origin) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const hit=await cache.match(event.request); if(hit) return hit;
      try { const response=await fetch(event.request); if(response.ok) cache.put(event.request,response.clone()); return response; } catch { return new Response('',{status:503}); }
    }));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || new Response('', { status: 503 }))));
});
