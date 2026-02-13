const CACHE_NAME = 'feedlot-v2';
const ASSETS_TO_CACHE = [
    '.feedlotmanagement/',
    '.feedlotmanagement/index.html',
    '.feedlotmanagement/css/style.css',
    '.feedlotmanagement/js/app.js',
    '.feedlotmanagement/js/auth.js',
    '.feedlotmanagement/js/db.js',
    '.feedlotmanagement/js/serial-manager.js',
    '.feedlotmanagement/js/induksi.js',
    '.feedlotmanagement/js/reweight.js',
    '.feedlotmanagement/js/penjualan.js',
    '.feedlotmanagement/js/utils.js',
    '.feedlotmanagement/js/backup.js',
    '.feedlotmanagement/js/supabase-sync.js',
    '.feedlotmanagement/libs/xlsx.full.min.js',
    '.feedlotmanagement/libs/jspdf.umd.min.js',
    '.feedlotmanagement/libs/jspdf.plugin.autotable.umd.min.js',
    '.feedlotmanagement/manifest.json',
    '.feedlotmanagement/icons/icon-192.png',
    '.feedlotmanagement/icons/icon-512.png'
];

// Install — cache all static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch — cache-first for static, network-first for API
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Network-first for Supabase API calls
    if (url.hostname.includes('supabase')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for everything else
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
