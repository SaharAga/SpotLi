/**
 * SpotLi Service Worker — offline shell + opt-in updates.
 *
 * This replaces a "self-destruct" worker that shipped a bare
 * `event.respondWith(fetch(event.request))` passthrough: it cached nothing, so
 * the app had no offline page availability at all despite being documented and
 * marketed as offline-first, and it deleted every cache on each activate. It
 * also called `skipWaiting()` on install and then `client.navigate()` on every
 * open window, which — together with the `controllerchange` reload in
 * serviceWorkerRegistration.js — force-reloaded the tab out from under the
 * user and made the app's own "update ready" prompt unreachable.
 *
 * `__APP_VERSION__` is substituted at build time by the inject-app-version
 * plugin in vite.config.js. In dev it stays a literal, which is fine: the
 * cache name just needs to be stable, and nothing under /assets/ exists on the
 * dev server, so Vite's own modules and HMR are never served from cache.
 */
const APP_VERSION = '__APP_VERSION__';
const CACHE_NAME = `spotli-shell-v${APP_VERSION}`;
const SHELL_URL = '/index.html';

// Best-effort: a missing entry must not fail the whole install.
const PRECACHE_URLS = ['/', SHELL_URL, '/manifest.json', '/icons/icon-192.png'];

const OFFLINE_FALLBACK = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SpotLi — Offline</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0b1220;color:#e2e8f0;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
p{color:#94a3b8}</style></head><body><div>
<h1>You're offline</h1><p>SpotLi will load again once you have a connection.</p>
</div></body></html>`;

self.addEventListener('install', (event) => {
  // No skipWaiting(): a new worker waits until the user accepts the update
  // banner, which posts SKIP_WAITING below. That is what makes the
  // 'sw-update-ready' event in serviceWorkerRegistration.js meaningful.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Only our own superseded caches. Blanket-deleting every cache also
            // wiped caches this worker does not own.
            .filter((key) => key !== CACHE_NAME && /^(spotli|deliveree)/.test(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// The page asks for the pending update to be applied (see applyServiceWorkerUpdate).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const isAssetRequest = (url, request) =>
  url.pathname.startsWith('/assets/') ||
  ['script', 'style', 'font', 'image'].includes(request.destination);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never interpose on Firebase, Firestore, carrier endpoints or any other
  // origin — those must stay live, and caching them would be wrong.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, so a released build is picked up immediately;
  // the cached shell is what makes the app open at all when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = (await caches.match(SHELL_URL)) || (await caches.match('/'));
          return (
            cached ||
            new Response(OFFLINE_FALLBACK, {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            })
          );
        })
    );
    return;
  }

  if (!isAssetRequest(url, request)) return;

  // Build assets carry a content hash, so a cache hit can never be stale.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached || Response.error());
    })
  );
});

// Web Push Notifications & Background Payload Handling
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || (data.notification && data.notification.title) || 'SpotLi | עדכון משלוח';
  const options = {
    body: data.body || (data.notification && data.notification.body) || 'יש לך עדכון חדש לגבי חבילה',
    icon: data.icon || (data.notification && data.notification.icon) || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    // Read packageId from BOTH shapes. The server (functions/src/newPackagePush.js,
    // updatePackagePush.js) sends it at the TOP level and sends no `data` key at
    // all, so checking only `data.data.packageId` made every automatic push fall
    // back to the shared tag 'spotli-update' — and a shared tag means each new
    // notification REPLACES the previous one. Two packages arriving together
    // showed as one.
    tag: data.tag || (() => {
      const pkgId = (data.data && data.data.packageId) || data.packageId;
      return pkgId ? `pkg-${pkgId}` : 'spotli-update';
    })(),
    data: data.data || {
      url: data.url || '/',
      packageId: data.packageId || null,
      trackingNumber: data.trackingNumber || null
    },
    vibrate: data.vibrate || [200, 100, 200],
    actions: data.actions || [
      { action: 'view', title: 'צפה במשלוח' },
      { action: 'dismiss', title: 'סגור' }
    ]
  };

  if ('setAppBadge' in navigator && typeof data.badgeCount === 'number') {
    if (data.badgeCount > 0) {
      navigator.setAppBadge(data.badgeCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Interaction Handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  let targetUrl = '/';
  try {
    const rawUrl = (event.notification.data && event.notification.data.url)
      ? event.notification.data.url
      : (event.notification.data && event.notification.data.packageId
          ? `/?packageId=${encodeURIComponent(event.notification.data.packageId)}`
          : '/');

    if (typeof rawUrl === 'string') {
      const baseOrigin = (self.location && self.location.origin) ? self.location.origin : 'https://spotliapp.com';
      const parsed = new URL(rawUrl, baseOrigin);
      const expectedOrigin = (self.location && self.location.origin) || baseOrigin;
      if (parsed.origin === expectedOrigin && (parsed.protocol === 'https:' || parsed.protocol === 'http:')) {
        const safePath = parsed.pathname + parsed.search + parsed.hash;
        if (safePath.startsWith('/') && !safePath.startsWith('//') && !safePath.startsWith('/\\')) {
          targetUrl = safePath;
        }
      }
    }
  } catch {
    targetUrl = '/';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
