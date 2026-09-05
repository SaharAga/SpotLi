// Self-Destruct & Immediate Re-Sync Service Worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    })
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll())
    .then((clients) => {
      clients.forEach((client) => {
        client.navigate(client.url);
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch live network directly
  event.respondWith(fetch(event.request));
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

  const title = data.title || (data.notification && data.notification.title) || 'Deliveree | עדכון משלוח';
  const options = {
    body: data.body || (data.notification && data.notification.body) || 'יש לך עדכון חדש לגבי חבילה',
    icon: data.icon || (data.notification && data.notification.icon) || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || (data.data && data.data.packageId ? `pkg-${data.data.packageId}` : 'deliveree-update'),
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
      const baseOrigin = (self.location && self.location.origin) ? self.location.origin : 'https://deliveree.app';
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
