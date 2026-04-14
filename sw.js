// MTG Token Tracker — Service Worker v21
const CACHE  = 'mtg-tokens-v21';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './monarch.svg',
  './citys.svg',
  './icons/heart.svg',
  './icons/dice.svg',
  './icons/gear.svg',
  './icons/star.svg',
  './icons/plus.svg',
  './icons/trash.svg',
  './icons/untap.svg',
  './icons/effects.svg',
  './icons/endturn.svg',
  './icons/chevron-up.svg',
];

// Install: pre-cache app shell, then WAIT — do NOT auto-skipWaiting.
// The page will detect reg.waiting and show the update banner, then
// send SKIP_WAITING when the user taps "Refresh".
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' }))))
    // intentionally no self.skipWaiting() here
  );
});

// Message: page sends this after user taps "Refresh"
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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
