self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.open("inventory-cache-v1").then((cache) =>
      cache.match(event.request).then(
        (response) =>
          response ||
          fetch(event.request).then((res) => {
            cache.put(event.request, res.clone());
            return res;
          })
      )
    )
  );
});
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
