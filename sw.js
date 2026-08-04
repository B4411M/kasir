/* ============================================
   Kasir Pro - Service Worker v3
   Strategi offline yang kuat:
   - Navigasi (HTML): Network-first, fallback ke cache
   - Aset statis: Cache-first (cepat & offline)
   - Semua request penting di-cache
   ============================================ */

const CACHE_NAME = 'kasir-pro-v3';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Hanya tangani GET
  if (request.method !== 'GET') return;

  // Tidak cache API eksternal/non-basic (mis. data dari server lain)
  if (request.url.includes('chrome-extension') || request.url.includes('localhost') && !request.url.includes('kasir')) {
    // kustomisasi localhost tetap biarkan default fetch
  }

  // ==== Request Navigasi (HTML) ====
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache versi terbaru halaman
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline → gunakan halaman yang di-cache
          return caches.match('./index.html').then((cached) => {
            return cached || caches.match(request);
          });
        })
    );
    return;
  }

  // ==== Aset Statis (CSS, JS, Icons, dll) — Cache-first ====
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Jika benar-benar offline dan tidak ada cache
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return Response.error();
        });
    })
  );
});
