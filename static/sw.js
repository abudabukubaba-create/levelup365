const CACHE_NAME = "levelup365-v1";
const APP_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key.startsWith("levelup365-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Shaxsiy progress ma'lumotlarini keshlamaymiz.
  if (url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/") ||
      event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(response =>
        response || (event.request.mode === "navigate"
          ? caches.match("/index.html")
          : Response.error())
      )
    )
  );
});
