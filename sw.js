const CACHE_NAME = 'mydash-v3-training-analyst-20260718-1';
const APP_SHELL = [
  './',
  './index.html',
  './app-redesign.css?v=20260711-1',
  './training-studio-ui.css?v=20260711-1',
  './studio-shell.css?v=20260711-1',
  './studio-surfaces.css?v=20260711-1',
  './manifest.json?v=20260711-2',
  './icon-192.png?v=20260710-3',
  './icon-512.png?v=20260710-3',
  './js/date-utils.js',
  './js/ui-core.js',
  './js/app-state.js',
  './js/app-bootstrap.js',
  './js/activity-model.js',
  './js/today-dashboard-view-model.js',
  './js/share-card.js',
  './js/wellness.js',
  './js/stats.js',
  './js/news-ai.js',
  './js/sources-strava.js',
  './js/settings.js',
  './js/backup-export.js',
  './js/domain/training/profiles.js',
  './js/domain/training/engine-v2.js',
  './js/services/coach-repository.js',
  './js/training-dashboard-view-model.js',
  './js/coach.js',
  './js/races.js',
  './js/domain/review/matcher-v2.js',
  './js/post-run-review.js'
  ,'./js/activity-detail-model.js'
  ,'./js/training-analyst.js'
  ,'./js/studio-home.js'
  ,'./js/studio-coach.js'
  ,'./js/chart-semantics.js'
  ,'./js/chart-data.js'
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
