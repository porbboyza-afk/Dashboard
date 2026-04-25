// MyDash Service Worker v1.0
const CACHE_NAME = 'mydash-v1';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Resources to pre-cache on install
const PRECACHE_URLS = [
  '/Dashboard/',
  '/Dashboard/index.html',
  '/Dashboard/manifest.json',
  '/Dashboard/icon-192.svg',
  '/Dashboard/icon-512.svg',
  'https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// ── Install: pre-cache core assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategy by resource type ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET, browser-extension, and Firebase/Strava API calls
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname.includes('firebaseio.com')) return;
  if (url.hostname.includes('firebase.googleapis.com')) return;
  if (url.hostname.includes('strava.com')) return;
  if (url.hostname.includes('anthropic.com')) return;
  if (url.hostname.includes('workers.dev')) return;

  // Firebase JS SDK — network first, cache fallback
  if (url.hostname.includes('gstatic.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // CDN assets (Chart.js, fonts) — cache first
  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // App shell (HTML, icons, manifest) — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

// ── Strategy: Cache First ──
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Strategy: Network First (fallback to cache) ──
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── Strategy: Stale While Revalidate ──
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await fetchPromise || new Response('Offline', { status: 503 });
}

// ── Background sync message ──
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
