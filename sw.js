// Service Worker — IT-Kas PWA
// Minimal SW for installability (no offline caching)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests to network (no caching)
  event.respondWith(fetch(event.request));
});
