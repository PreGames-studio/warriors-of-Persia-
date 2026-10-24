const CACHE_NAME = 'warriors-of-persia-3d-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './lib/three.module.js',
  './lib/OrbitControls.js',
  './lib/OBJExporter.js',
  './fonts/Vazirmatn-Regular.ttf',
  './fonts/Vazirmatn-Bold.ttf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
