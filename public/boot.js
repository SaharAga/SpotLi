/*
 * Pre-paint bootstrap, loaded synchronously from <head> in index.html.
 *
 * These used to be three inline <script> blocks, which forced the CSP to
 * allow `script-src 'unsafe-inline'` — and with that, any injected inline
 * script would run too. As an external same-origin file they are covered by
 * `script-src 'self'`. Classic (non-module) script on purpose: it must run
 * before first paint, which a deferred module script would not.
 *
 * Not hashed by the build, so firebase.json serves it no-cache; sw.js
 * precaches it with the app shell for offline starts.
 */
(function () {
  // 1. Theme before first paint — the OS/browser preference unless pinned.
  try {
    var stored = localStorage.getItem('spotli_theme') || localStorage.getItem('deliveree_theme') || 'system';
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'system' ? prefersDark : stored === 'dark';
    document.documentElement.classList.add(isDark ? 'dark' : 'light');
  } catch {
    document.documentElement.classList.add('dark');
  }

  // 2. Hard cache purge on version bump (keeps the SW and push subscriptions).
  //    The version comes from a <meta> tag the build stamps (vite.config.js
  //    replaces __APP_VERSION__ in index.html only).
  try {
    var versionMeta = document.querySelector('meta[name="spotli-build-version"]');
    var currentVersion = versionMeta && versionMeta.getAttribute('content');
    var storedVersion = localStorage.getItem('spotli_app_build_version') || localStorage.getItem('deliveree_app_build_version');
    if (currentVersion && storedVersion !== currentVersion) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          for (var i = 0; i < registrations.length; i++) {
            registrations[i].update().catch(function () {});
          }
        }).catch(function () {});
      }
      if ('caches' in window) {
        caches.keys().then(function (keys) {
          keys.forEach(function (key) {
            caches.delete(key);
          });
        }).catch(function () {});
      }
      localStorage.setItem('spotli_app_build_version', currentVersion);
    }
  } catch {
    // Storage unavailable — skip the purge; the SW update check still runs.
  }

  // 3. Staging visual differentiation (title, manifest, icons, theme colour).
  try {
    var host = window.location.hostname;
    if (host.indexOf('staging') !== -1 || host.indexOf('localhost') !== -1) {
      document.title = 'SpotLi (Staging)';
      var set = function (selector, attr, value) {
        var el = document.querySelector(selector);
        if (el) el.setAttribute(attr, value);
      };
      set('link[rel="manifest"]', 'href', '/manifest-staging.json');
      set('meta[name="apple-mobile-web-app-title"]', 'content', 'SpotLi (Stg)');
      set('meta[name="theme-color"]', 'content', '#d97706');
      set('link[rel="icon"]', 'href', '/icons/icon-staging.svg');
      set('link[rel="apple-touch-icon"]', 'href', '/icons/apple-touch-icon-staging.png');
    }
  } catch {
    // Cosmetic only.
  }
})();
