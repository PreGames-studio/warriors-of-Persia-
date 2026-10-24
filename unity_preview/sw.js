const CACHE_NAME = 'warriors-of-persia-3d-v3-persian-village';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './potion-shop.css',
  './potion-shop.js',
  './village-theme.css',
  './village-theme.js',
  './lib/three.module.js',
  './lib/OrbitControls.js',
  './lib/OBJExporter.js',
  './fonts/Vazirmatn-Regular.ttf',
  './fonts/Vazirmatn-Bold.ttf',
  './assets/apothecary/apothecary_keeper.jpg',
  './assets/apothecary/potion_vitality.jpg',
  './assets/apothecary/potion_mana.jpg',
  './assets/apothecary/potion_hero.jpg',
  './assets/apothecary/potion_mountain.jpg',
  './assets/apothecary/potion_guardian.jpg',
  './assets/apothecary/potion_restoration.jpg',
  './assets/apothecary/potion_zagros.jpg',
  './assets/apothecary/potion_starlight.jpg',
  './assets/apothecary/potion_immortal.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Always prefer fresh UI code when online, with a complete offline fallback.
  if (['document', 'script', 'style'].includes(event.request.destination)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
