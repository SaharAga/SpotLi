import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './services/serviceWorkerRegistration';
import { initGlobalCrashReporting } from './services/crashReportService';

// Catch errors ErrorBoundary can't see: thrown outside render (event
// handlers, timers, async callbacks) and unhandled promise rejections.
initGlobalCrashReporting();

// Clean up stale caches on client boot (iOS WebKit fix)
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (!key.includes('v0.6.0-alpha')) {
        caches.delete(key);
      }
    });
  }).catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register service worker for offline functionality and fast PWA boot
registerServiceWorker();
