// Service worker: makes the app installable and keeps the look working when offline.
// Everything comes from the network first (bookings must be live, updates apply at once);
// the cache is only used when you're offline.
const VERSION = "rh-v3";
const STATIC = [
  "/css/styles.css",
  "/css/motion.css",
  "/js/app.js",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch form posts
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/ics/")) return;

  if (req.mode === "navigate") {
    // Live pages; show the offline page only when there is no connection.
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  if (STATIC.includes(url.pathname)) {
    // Network first, so a new version of the app is used straight away; the cache is for offline only.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req)),
    );
  }
});
