// Service worker: makes the app installable and keeps the look working when offline.
// Pages always come from the network first (bookings must be live); static files are cached.
const VERSION = "rh-v2";
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
    event.respondWith(
      caches.match(req).then((hit) => {
        const live = fetch(req).then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || live;
      }),
    );
  }
});
