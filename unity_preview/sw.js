const CACHE_NAME = 'warriors-of-persia-3d-v29-mia-hero-glow';
const ASSETS = [
  './merchant-signature-items.js',
  ...['jeweler','astrologer','carpet_bazaar','teahouse','district_shop_03','district_shop_04','district_shop_06','district_shop_07','district_shop_08','district_shop_09','district_shop_10','district_shop_11','district_shop_12','district_shop_13','district_shop_14'].map(id=>`./assets/merchants/signature/${id}.png`),
  './merchant-keepers.js',
  './assets/merchants/bookshop-dana.png',
  ...['jeweler','astrologer','carpet_bazaar','teahouse','district_shop_01','district_shop_02','district_shop_03','district_shop_04','district_shop_06','district_shop_07','district_shop_08','district_shop_09','district_shop_10','district_shop_11','district_shop_12','district_shop_13','district_shop_14'].map(id=>`./assets/merchants/keepers/${id}.png`),
  ...Array.from({length:12},(_,i)=>`./assets/merchants/books/book-${String(i+1).padStart(2,'0')}.png`),
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './assets/hero/mia_hero.png',
  './potion-shop.css',
  './potion-shop.js',
  './village-theme.css',
  './village-theme.js',
  './world-landscape.js',
  './dungeon-floors.js',
  './cave-dungeon.js',
  './camera-look.js',
  './camera-motion.js',
  './map-markers.js',
  './portal-arrival.js',
  './adventure-guild.js',
  './guild-atmosphere.js',
  './game-timing.js',
  './open-world-first.js',
  './village-population.js',
  './guild-services.js',
  './merchant-shop.js',
  './merchant-catalog.js',
  './merchant-shop.css',
  './assets/merchants/merchant-hall.jpg',
  './blacksmith-forge.js',
  './blacksmith-textures.js',
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
