const CACHE_VERSION = "geo-notion-v2";
const CORE_CACHE = `core-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const OFFLINE_URL = "/static/offline.html";

const CORE_ASSETS = [
  "/",
  "/about",
  OFFLINE_URL,
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
  "/static/js/map_links.js",
  "/static/js/storage.js",
  "/static/js/map.js",
  "/static/js/render.js",
  "/static/js/view.js",
  "/static/js/form.js",
  "/static/js/share.js",
  "/static/js/edit.js",
  "/static/js/app.js",
  "/static/js/pwa.js",
  "/static/js/analytics.js",
  "/static/img/app-icon.svg",
  "/static/img/tofu-br.svg",
  "/static/img/apple-touch-icon.png",
  "/static/img/favicon-16x16.png",
  "/static/img/favicon-32x32.png",
  "/static/img/favicon.ico",
  "/static/img/android-chrome-192x192.png",
  "/static/img/android-chrome-512x512.png",
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
  "/static/img/icons/trash.svg",
  "/static/img/icons/success.svg"
];

const precacheCore = async () => {
  const cache = await caches.open(CORE_CACHE);
  await Promise.allSettled(
    CORE_ASSETS.map(async (asset) => {
      try {
        const response = await fetch(asset, { cache: "reload" });
        if (response && response.ok) {
          await cache.put(asset, response);
        }
      } catch (err) {
        // Ignore precache failures to avoid install rejection.
      }
    })
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(precacheCore());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![CORE_CACHE, RUNTIME_CACHE, API_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || new Response("Offline", { status: 503, statusText: "Offline" });
  }
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || new Response("Offline", { status: 503, statusText: "Offline" });
  }
};

const handleNavigation = async (request) => {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response("Offline", { status: 503, statusText: "Offline" });
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/share" || url.pathname.startsWith("/api/share/")) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (url.pathname.startsWith("/static/")) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(cacheFirst(request, RUNTIME_CACHE));
});
