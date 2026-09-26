const PREFIX='mydash-performance-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE = PREFIX+'v3';
const SHELL = ['offline.html','styles.css','src/ui/favicon.svg','src/ui/icon-192.png','src/ui/icon-512.png','manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith(PREFIX) && key !== CACHE)||(new URL(self.registration.scope).pathname==='/'&&['mydash-performance-shell-v1','mydash-performance-shell-v2'].includes(key))).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope=new URL(self.registration.scope);
  if(!url.pathname.startsWith(scope.pathname))return;
  const relative=url.pathname.slice(scope.pathname.length);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/api/snapshot')) return;

  if (request.mode === 'navigate' && ['', 'index.html'].includes(relative)) {
    event.respondWith(fetch(request).catch(async()=> (await caches.open(CACHE)).match(new URL('offline.html',scope).href)));
    return;
  }

  if (!SHELL.includes(relative)||url.search) return;
  event.respondWith(fetch(request).catch(async()=> (await caches.open(CACHE)).match(new URL(relative,scope).href)));
});
