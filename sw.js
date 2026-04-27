const CACHE_NAME = 'curbsidedx-v1';

// Assets to cache on install — keeps app fast and partially usable offline
const STATIC_ASSETS = [
  '/curbsidedx/',
  '/curbsidedx/index.html',
  '/curbsidedx/manifest.json',
  '/curbsidedx/icons/icon-192.png',
  '/curbsidedx/icons/icon-512.png'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Supabase API calls: network-only (always fresh data)
// - Everything else: network-first, fall back to cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for Supabase and external APIs
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('anthropic.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache when offline
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/curbsidedx/index.html');
          }
        });
      })
  );
});
