import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './services/serviceWorkerRegistration';
import { initGlobalCrashReporting } from './services/crashReportService';
import { setDateFormatPreference } from './utils/dateUtils';
import { STORAGE_KEYS } from './constants/storageKeys';

// Catch errors ErrorBoundary can't see: thrown outside render (event
// handlers, timers, async callbacks) and unhandled promise rejections.
initGlobalCrashReporting();

// Apply the stored date format before the first render, so dates never paint
// once in the default style and then switch. AuthContext re-applies it from
// the user's synced preferences once they are signed in.
try {
  setDateFormatPreference(localStorage.getItem(STORAGE_KEYS.DATE_FORMAT));
} catch {
  // Storage disabled — the locale default applies.
}

/*
 * Cache cleanup belongs to the service worker's `activate` handler, which
 * drops exactly the superseded `spotli-shell-v*` caches and keeps the current
 * one.
 *
 * What stood here deleted every cache whose name did not contain the literal
 * `v0.6.0-alpha` — a version string frozen since 0.6.0 and never updated
 * since. It therefore matched nothing and ran on EVERY boot, so the shell
 * cache was wiped before it could ever be used and the app had no offline
 * availability no matter what the worker cached. index.html still does a
 * deliberate one-shot purge when the build version changes; that one is keyed
 * to the real version and stays.
 */

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register service worker for offline functionality and fast PWA boot
registerServiceWorker();
