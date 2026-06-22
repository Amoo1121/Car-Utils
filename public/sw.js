const CACHE_NAME = "car-utils-pwa-v1";
const shellUrl = (path) => new URL(path, self.registration.scope).toString();
const APP_SHELL = ["./", "./index.html", "./favicon.svg", "./manifest.webmanifest"].map(shellUrl);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;

  if (request.method !== "GET" || !sameOrigin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(shellUrl("./index.html"))));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      });
    }),
  );
});
