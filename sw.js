const SHELL_CACHE = 'mica-shell-v45';
const RUNTIME_CACHE = 'mica-runtime-v1';
const RUNTIME_LIMIT = 80;
const SHELL = ['./','./index.html','./styles.css?v=45','./app-config.js?v=45','./app.js?v=45','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];

async function trimRuntimeCache() {
  const cache=await caches.open(RUNTIME_CACHE);const keys=await cache.keys();if(keys.length<=RUNTIME_LIMIT)return;await Promise.all(keys.slice(0,keys.length-RUNTIME_LIMIT).map(key=>cache.delete(key)));
}

self.addEventListener('install', event => event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key=>key.startsWith('mica-')&&![SHELL_CACHE,RUNTIME_CACHE].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(SHELL_CACHE).then(cache=>cache.put('./index.html',response.clone()));return response;}).catch(()=>caches.match('./index.html').then(hit=>hit||new Response('Mica is unavailable offline.',{status:503,headers:{'Content-Type':'text/plain'}}))));
    return;
  }
  if (url.origin !== self.location.origin) {
    if(!['image','font','style'].includes(event.request.destination)){event.respondWith(fetch(event.request));return;}
    event.respondWith(caches.open(RUNTIME_CACHE).then(async cache=>{const hit=await cache.match(event.request);if(hit)return hit;try{const response=await fetch(event.request);if(response.ok){await cache.put(event.request,response.clone());await trimRuntimeCache();}return response;}catch{return new Response('',{status:503});}}));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(SHELL_CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || new Response('', { status: 503 }))));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(openClients=>openClients[0]?.focus()||clients.openWindow(event.notification.data?.url||self.registration.scope)));
});
