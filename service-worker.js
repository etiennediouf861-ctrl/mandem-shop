// MANDEM SHOP Service Worker (PWA root scope)
// Cache statique + API network-first + fallback offline + push basique.

const CACHE_VERSION = "mandem-cache-v2";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/commande.html",
  "/offline.html",
  "/manifest.json",
  "/style.css",
  "/products.js",
  "/favicon.svg",
  "/images/bg-mandem.png",
  "/images/logo.mp4",
  "/images/wave-logo.svg",
  "/images/orange-money-logo.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isStaticAsset(url) {
  return /\.(?:css|js|png|jpg|jpeg|webp|svg|gif|ico|mp4|woff2?)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Gère seulement les requêtes GET same-origin
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API dynamiques: network-first
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Navigation pages: network-first + fallback offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Assets statiques: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, cloned));
          return response;
        });
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "MANDEM SHOP",
    body: "Nouvelle notification",
    url: "/"
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_error) {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return null;
    })
  );
});
