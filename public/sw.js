// YouTube Audio Studio - Background Service Worker
// Version 1.0.0

const CACHE_NAME = 'audio-studio-bg-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Fallback gracefully if any single asset fails
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Background sync & audio keep-alive messages
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'PING') {
    event.source?.postMessage({ type: 'PONG', timestamp: Date.now() });
  }

  if (event.data.type === 'BACKGROUND_AUDIO_ACTIVE') {
    // Acknowledge active background playback
    event.source?.postMessage({
      type: 'BACKGROUND_AUDIO_ACK',
      active: true,
      timestamp: Date.now()
    });
  }
});

self.addEventListener('fetch', (event) => {
  // Let network requests pass through normally with cache fallback for app shell
  if (event.request.method !== 'GET') return;
  
  // Do not cache audio streams or dynamic YouTube API requests
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Return offline fallback if offline
        return caches.match('/');
      });
    })
  );
});
