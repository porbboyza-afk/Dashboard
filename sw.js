const CACHE_NAME = 'mydash-v3-health-20260707-4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json?v=20260707-4',
  './icon-192.png?v=20260707-4',
  './icon-512.png?v=20260707-4',
  './js/date-utils.js',
  './js/ui-core.js',
  './js/share-card.js',
  './js/wellness.js',
  './js/stats.js',
  './js/news-ai.js',
  './js/sources-strava.js',
  './js/settings.js',
  './js/backup-export.js',
  './js/coach.js',
  './js/races.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html')))
  );
});
