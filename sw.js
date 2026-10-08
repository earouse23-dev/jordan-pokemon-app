const SHELL_CACHE = "mica-shell-local-ocr-78";
const RUNTIME_CACHE = "mica-runtime-v2";
const RUNTIME_LIMIT = 80;
const CORE_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=91",
  "./themes.css?v=85",
  "./app-config.js?v=69",
  "./app.js?v=114",
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

// The browser subscription belongs to one signed-in owner on this device. Keep
// that binding across worker restarts, but never display a queued prior-owner
// push after logout. Storage failures fail closed.
function pushOwnerStorage(value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mica-push-binding", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("binding");
    request.onerror = () => reject(new Error("Push binding unavailable"));
    request.onblocked = () => reject(new Error("Push binding unavailable"));
    request.onsuccess = () => {
      const database = request.result;
      const write = value !== undefined;
      const transaction = database.transaction("binding", write ? "readwrite" : "readonly");
      const store = transaction.objectStore("binding");
      const operation = write ? store.put(value, "owner") : store.get("owner");
      transaction.oncomplete = () => { database.close(); resolve(write ? value : operation.result || ""); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error("Push binding unavailable")); };
    };
  });
}

let pushOwnerWork = Promise.resolve();
function serializePushOwner(work) {
  const result = pushOwnerWork.then(work);
  pushOwnerWork = result.catch(() => {});
  return result;
}

function localNotificationUrl(value) {
  try {
    const url = new URL(value || "./", self.registration.scope);
    if (url.origin === self.location.origin && ["/", "/profile"].includes(url.pathname) && !url.username && !url.password)
      return url.href;
  } catch {}
  return self.registration.scope;
}

self.addEventListener("message", event => {
  const type = event.data?.type;
  if (!["MICA_PUSH_OWNER", "MICA_PUSH_OWNER_STATUS"].includes(type)) return;
  let origin;
  try { origin = new URL(event.source?.url).origin; } catch { return; }
  if (origin !== self.location.origin) return;
  const reply = value => event.ports?.[0]?.postMessage(value);
  event.waitUntil(serializePushOwner(async () => {
    if (type === "MICA_PUSH_OWNER_STATUS") {
      reply({ ok: true, ownerId: await pushOwnerStorage() });
      return;
    }
    const ownerId = event.data.ownerId || "";
    if (typeof ownerId !== "string" || ownerId.length > 100) throw new Error("Invalid binding");
    const previous = await pushOwnerStorage();
    await pushOwnerStorage(ownerId);
    if (previous !== ownerId || !ownerId) {
      const notifications = await self.registration.getNotifications();
      notifications.forEach(notification => notification.close());
    }
    reply({ ok: true, ownerId });
  }).catch(() => reply({ ok: false })));
});

self.addEventListener("push", event => {
  event.waitUntil(serializePushOwner(async () => {
    let payload;
    try {
      const raw = event.data?.text() || "";
      if (raw.length > 4096) return;
      payload = JSON.parse(raw);
    } catch { return; }
    const ownerId = payload?.data?.ownerId;
    if (typeof ownerId !== "string" || !ownerId || ownerId !== await pushOwnerStorage()) return;
    const tag = typeof payload.tag === "string" ? payload.tag.slice(0, 120) : "update";
    await self.registration.showNotification("Mica", {
      body: "You have a new collection update. Open Mica to review it.",
      icon: new URL("./icons/icon-192.png", self.registration.scope).href,
      badge: new URL("./icons/icon-192.png", self.registration.scope).href,
      tag: `mica:${tag}`,
      renotify: false,
      data: { ownerId, url: localNotificationUrl(payload.data.url) },
    });
  }).catch(() => {}));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(serializePushOwner(async () => {
    const ownerId = event.notification.data?.ownerId;
    if (ownerId && ownerId !== await pushOwnerStorage()) return;
    const url = localNotificationUrl(event.notification.data?.url);
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => {
      try { return new URL(client.url).origin === self.location.origin; } catch { return false; }
    });
    if (existing?.navigate) {
      try {
        const navigated = await existing.navigate(url);
        if (navigated) { await navigated.focus(); return; }
      } catch {}
    }
    await clients.openWindow(url);
  }).catch(() => {}));
});
