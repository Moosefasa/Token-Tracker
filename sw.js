// MTG Token Tracker — Service Worker v1
const CACHE  = 'mtg-tokens-v1';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// Install: pre-cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first for app shell, network-first for Scryfall API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network-first for Scryfall (live data)
  if (url.hostname === 'api.scryfall.com' || url.hostname.includes('cards.scryfall.io')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Cache Scryfall card images for offline art display
          if (url.hostname.includes('cards.scryfall.io') && res.ok) {
            const clone = res.clone();
            caches.open(CACHE + '-images').then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (app shell)
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
      )
  );
});
