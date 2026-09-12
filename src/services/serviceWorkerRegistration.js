/**
 * Service Worker Registration and Lifecycle Manager
 *
 * Checks for updates on launch, tab focus, visibility change and every ten
 * minutes, and announces one via the `sw-update-ready` event that App renders
 * its "update available" banner from.
 *
 * The page reloads only when the user accepts that banner. It used to reload
 * on any `controllerchange`, which fires on the very first visit too (when the
 * new worker claims an uncontrolled page) and again whenever sw.js called
 * `skipWaiting()` — so every visitor got an unexplained reload, and the update
 * banner could never be seen because the worker had already taken over.
 */

let waitingRegistration = null;
let userRequestedUpdate = false;

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Immediately check for updates upon registration
        registration.update().catch(() => {});

        const announce = () => {
          waitingRegistration = registration;
          console.info('[SW] New version available, emitting update event.');
          window.dispatchEvent(
            new CustomEvent('sw-update-ready', { detail: { registration } })
          );
        };

        // A worker that finished installing while this page was already
        // controlled is an update sitting in the waiting state.
        if (registration.waiting && navigator.serviceWorker.controller) {
          announce();
        }

        // Listen for background updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              announce();
            }
          });
        });

        // Check for updates on window focus (switching tabs/apps)
        window.addEventListener('focus', () => {
          registration.update().catch(() => {});
        });

        // Check for updates on visibility change (unlocking phone / returning to app)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });

        // Periodic check every 10 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 10 * 60 * 1000);
      })
      .catch((error) => {
        console.warn('[SW] Registration failed:', error);
      });

    // Swap to the fresh bundle, but only for an update the user asked for.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!userRequestedUpdate || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

/**
 * Applies the pending update: tells the waiting worker to take over, which
 * triggers the `controllerchange` reload above. Falls back to a plain reload
 * when there is no waiting worker to talk to.
 */
export function applyServiceWorkerUpdate() {
  if (typeof window === 'undefined') return;
  userRequestedUpdate = true;

  const waiting = waitingRegistration?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }
  window.location.reload();
}

export function unregisterServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
