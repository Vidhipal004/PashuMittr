const CACHE = 'pashumitr-shell-v1';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if(res && res.ok){
          const clone=res.clone();
          caches.open(CACHE).then(cache=>cache.put(req,clone));
        }
        return res;
      }).catch(()=>cached);
      return cached || network;
    })
  );
});
