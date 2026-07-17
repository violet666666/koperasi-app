// Service Worker for PRIMKOPPOL PWA
// ponytail: bumped v1->v2 to flush stale Next.js 16 Turbopack cache (white screen:
// old SW served cached RSC flight payload / old runtime chunks after buildId changed).
// Strategy: network-first for navigations + API (never cache HTML/flight/auth);
// cache-first ONLY for content-hashed _next/static/* (immutable, safe).
// Ceiling: no offline HTML shell beyond /offline.html. Upgrade path: if a true
// offline portal is needed later, precache a buildId-scoped build manifest.
const CACHE_NAME = 'koperasi-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
    );
    self.skipWaiting();
});

// Activate: delete ALL old caches (v1 + any) so stale buildId artifacts are flushed.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;
    if (url.protocol === 'chrome-extension:') return;

    // Self-heal: redirect the poisoned /portal/dashboard URL to /portal/berana.
    // The old URL's edge-cache entry serves a brotli RSC-flight body as the
    // document → page JS never runs → SW can't update via app code. But the
    // browser still updates /sw.js on its own schedule (independent of page
    // JS), so once v2 activates this redirect fires and escapes the poison
    // WITHOUT any user action. Works for the stuck-tab subset of the fleet.
    if (url.pathname === '/portal/dashboard' || url.pathname.startsWith('/portal/dashboard/')) {
        event.respondWith(Response.redirect(new URL('/portal/beranda' + url.search + url.hash, self.location.origin), 302));
        return;
    }

    // API: network-only. Never cache (auth-scoped + stale data risk).
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() =>
                new Response(JSON.stringify({ error: 'Offline' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 503,
                })
            )
        );
        return;
    }

    // Hashed static assets (_next/static/* + /icons/* + fonts): cache-first.
    // Content-addressed → safe to cache indefinitely.
    if (
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/icons/') ||
        /\.(woff2?|ttf|otf|png|jpg|jpeg|svg|gif|ico|webp|avif)$/.test(url.pathname)
    ) {
        event.respondWith(
            caches.match(request).then((cached) =>
                cached ||
                fetch(request).then((response) => {
                    if (response.ok && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    }
                    return response;
                })
            )
        );
        return;
    }

    // Navigations (HTML / RSC flight): network-first, NEVER cache the response.
    // Caching HTML post-Turbopack was the white-screen root cause (stale buildId
    // flight payload served to new runtime). Fall back to /offline.html only.
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => response)
                .catch(() => caches.match(OFFLINE_URL).then((c) => c || Response.error()))
        );
        return;
    }

    // Default: network, fall back to cache.
    event.respondWith(fetch(request).catch(() => caches.match(request)));
});
