const PRECACHE = 'precache-v1';
const RUNTIME = 'runtime-v1';

const PRECACHE_URLS = ['/interface', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const currentCaches = [PRECACHE, RUNTIME];
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        names.filter((name) => !currentCaches.includes(name))
      )
      .then((stale) =>
        Promise.all(stale.map((name) => caches.delete(name)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Network-first: navigations and API calls
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first: static assets (JS, CSS, fonts, images)
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }
});
