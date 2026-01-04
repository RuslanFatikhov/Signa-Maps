const CACHE_VERSION = "geo-notion-v1";
const CORE_ASSETS = [
  "/",
  "/static/manifest.json",
  "/static/css/reset.css",
  "/static/css/tokens.css",
  "/static/css/colors.css",
  "/static/css/typo.css",
  "/static/css/input.css",
  "/static/css/button.css",
  "/static/css/header.css",
  "/static/css/about.css",
  "/static/css/main.css",
  "/static/css/toolbar.css",
  "/static/css/map.css",
  "/static/css/sheet.css",
  "/static/css/field.css",
  "/static/css/search.css",
  "/static/css/toast.css",
  "/static/js/qr.js",
  "/static/js/toast.js",
  "/static/js/storage.js",
  "/static/js/map.js",
  "/static/js/render.js",
  "/static/js/view.js",
  "/static/js/form.js",
  "/static/js/share.js",
  "/static/js/edit.js",
  "/static/js/app.js",
  "/static/js/pwa.js",
  "/static/img/app-icon.svg",
  "/static/img/icons/arrow_empty.svg",
  "/static/img/icons/cross.svg",
  "/static/img/icons/file.svg",
  "/static/img/icons/forward.svg",
  "/static/img/icons/list.svg",
  "/static/img/icons/maximize.svg",
  "/static/img/icons/minimize.svg",
  "/static/img/icons/my-location.svg",
  "/static/img/icons/new-list.svg",
  "/static/img/icons/pen.svg",
  "/static/img/icons/plus.svg",
  "/static/img/icons/search.svg",
  "/static/img/icons/share.svg",
  "/static/img/icons/trash.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
  );
});
