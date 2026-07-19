// Minimal offline-caching service worker — no Workbox, kept small and readable.
// Scope: cache the app shell for offline navigation, and stale-while-revalidate the
// read-only menu endpoints so "You're offline — showing the last saved menu" (see
// common.offlineBanner) is actually true rather than aspirational copy.

const CACHE_VERSION = "fresh-cup-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const MENU_CACHE = `${CACHE_VERSION}-menu`;

const MENU_API_PATTERN = /\/api\/v1\/(branches|menu-categories|menu-items)(\/|\?|$)/;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(["/"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("fresh-cup-") && key !== SHELL_CACHE && key !== MENU_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? networkFetch;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return cache.match("/");
    throw new Error("offline and not cached");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (MENU_API_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, MENU_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate" || url.pathname.startsWith("/_next/static/")) {
      event.respondWith(networkFirst(request, SHELL_CACHE));
    }
  }
});
