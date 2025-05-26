
// Basic service worker

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // Optional: skip waiting to activate new service worker immediately
  // self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  // Optional: clients.claim() ensures that the SW takes control of the page ASAP.
  // event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // For a basic PWA, we might not intercept fetch requests initially,
  // or implement a simple cache-first/network-first strategy.
  // For now, just let the browser handle it.
  // console.log('Service Worker: Fetching', event.request.url);
  // event.respondWith(fetch(event.request));
});
