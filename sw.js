const SHELL_CACHE = "mica-shell-v111";
const RUNTIME_CACHE = "mica-runtime-v2";
const RUNTIME_LIMIT = 80;
const CORE_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=88",
  "./themes.css?v=83",
  "./app-config.js?v=69",
  "./app.js?v=108",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];
const OPTIONAL_SHELL = [
  "./assets/mica-mineral-paper.jpg",
  "./assets/mica-collection-ornament.jpg",
  "./assets/coach-parallel-pass.jpg",
  "./assets/coach-parallel-retake.jpg",
  "./assets/coach-frame-pass.jpg",
  "./assets/coach-frame-retake.jpg",
  "./assets/coach-light-pass.jpg",
  "./assets/coach-light-retake.jpg",
  "./assets/coach-background-pass.jpg",
  "./assets/coach-background-retake.jpg",
  "./icons/apple-touch-icon.png",
];

async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(CORE_SHELL);
  await Promise.allSettled(OPTIONAL_SHELL.map((asset) => cache.add(asset)));
}

async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  if (keys.length <= RUNTIME_LIMIT) return;
  await Promise.all(
    keys.slice(0, keys.length - RUNTIME_LIMIT).map((key) => cache.delete(key)),
  );
}

function isPrivateStorageRequest(url) {
  return /\/storage\/v1\/(?:object|render\/image)\/(?:sign|authenticated)\//.test(
    url.pathname,
  );
}

self.addEventListener("install", (event) =>
  event.waitUntil(cacheShell().then(() => self.skipWaiting())),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("mica-") &&
                ![SHELL_CACHE, RUNTIME_CACHE].includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok)
            caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put("./index.html", response.clone()));
          return response;
        })
        .catch(() =>
          caches.match("./index.html").then(
            (hit) =>
              hit ||
              new Response("Mica is unavailable offline.", {
                status: 503,
                headers: { "Content-Type": "text/plain" },
              }),
          ),
        ),
    );
    return;
  }
  if (url.origin !== self.location.origin) {
    if (isPrivateStorageRequest(url)) {
      event.respondWith(fetch(event.request, { cache: "no-store" }));
      return;
    }
    if (!["image", "font", "style"].includes(event.request.destination)) {
      event.respondWith(fetch(event.request));
      return;
    }
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            await cache.put(event.request, response.clone());
            await trimRuntimeCache();
          }
          return response;
        } catch {
          return new Response("", { status: 503 });
        }
      }),
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok)
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((hit) => hit || new Response("", { status: 503 })),
      ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(
        (openClients) =>
          openClients[0]?.focus() ||
          clients.openWindow(
            event.notification.data?.url || self.registration.scope,
          ),
      ),
  );
});
