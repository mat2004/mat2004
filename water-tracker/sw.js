// Caches the app so it opens instantly and works offline.
// Bump CACHE when you change any file so phones pick up the new version.
var CACHE = "water-v11";
var FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.json",
  "icons/icon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); })); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(e.request);
    })
  );
});

// Reminders sent by reminders/send.js.
self.addEventListener("push", function (e) {
  var data = {};
  try { data = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title || "Water", {
    body: data.body || "Time for a glass of water 💧",
    icon: "icons/apple-touch-icon.png",
    tag: "water-reminder"
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function (list) {
      return list.length ? list[0].focus() : self.clients.openWindow("./");
    })
  );
});
