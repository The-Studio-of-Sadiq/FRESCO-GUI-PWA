const CACHE_NAME = 'fresco-pwa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/logo.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-icon-512.png',
  '/images/fresco_social_banner.jpg',
  '/images/fresco_hero_poster.jpg',
  '/images/fresco_logo_dark.jpg',
  '/images/fresco_logo_horizontal.jpg',
  '/images/fresco_logo_vertical.jpg',
  '/images/fresco_app_icon.jpg',
  '/images/fresco_design_system_board.jpg',
  '/images/fresco_og_image.jpg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Caching app shell & static assets');
      await Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[Service Worker] Optional pre-cache skipped for ${asset}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First with Cache Fallback for API, Cache First for Static Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching non-GET requests or backend Fortran execution APIs
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache freshness
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Offline fallback */});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
