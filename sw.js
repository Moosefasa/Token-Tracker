// MTG Token Tracker — Service Worker v2
const CACHE  = 'mtg-tokens-v2';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// Install: pre-cache app shell, always fetch fresh copies
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove ALL old caches so updates are never blocked
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   index.html        → network-first (always get latest, fall back to cache)
//   Scryfall API/imgs → network-first (live data)
//   everything else   → cache-first (icons, manifest)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-first for the HTML entry point so updates always land immediately
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first for Scryfall (live data + card images)
  if (url.hostname === 'api.scryfall.com' || url.hostname.includes('cards.scryfall.io')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
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

  // Cache-first for static assets (icons, manifest)
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
