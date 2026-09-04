import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

/**
 * Injects the app version everywhere it needs to appear, from the one place
 * it's actually defined (package.json). Fixes a real bug: index.html carried
 * its own hardcoded version string for its cache-purge check, independent of
 * src/constants/version.js — the two drifted apart silently, since nothing
 * forced them to move together.
 */
function injectAppVersion() {
  return {
    name: 'inject-app-version',
    transformIndexHtml(html) {
      return html.replace(/__APP_VERSION__/g, pkg.version);
    }
  };
}

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

/**
 * Fail the production build when Firebase config is missing or malformed,
 * instead of shipping a bundle that silently runs without cloud sync — or,
 * worse, one that looks fine and breaks a single auth path at runtime.
 *
 * The malformed check exists because of a real outage: a trailing CRLF in
 * VITE_FIREBASE_AUTH_DOMAIN (pasted into the CI variables field with the
 * newline attached) rode into Firebase's OAuth iframe URL as
 * `https://…firebaseapp.com%0D%0A/__/auth/iframe`, which the SDK rejected.
 * Google sign-in broke while email/password kept working, and the error
 * surfaced as a generic auth failure — so it took a browser console dump to
 * find. None of these values may legitimately contain whitespace, so
 * whitespace anywhere in one is always a paste accident. Better to fail
 * loudly here in CI than to ship it and debug it in production again.
 */
function malformedReason(value) {
  if (value !== value.trim()) return 'has leading or trailing whitespace';
  if (/\s/.test(value)) return 'contains an internal space or line break';
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(value)) return 'contains a control character';
  return null;
}

function requireFirebaseEnv() {
  return {
    name: 'require-firebase-env',
    apply: 'build',
    config(_config, { mode }) {
      if (mode !== 'production') return;
      const env = loadEnv(mode, process.cwd(), 'VITE_');
      const missing = REQUIRED_ENV.filter((key) => !env[key]);
      if (missing.length > 0) {
        throw new Error(
          `Missing required environment variables for a production build: ${missing.join(', ')}. ` +
          'See .env.example.'
        );
      }

      const malformed = REQUIRED_ENV
        .map((key) => {
          const reason = malformedReason(env[key]);
          return reason ? `${key} ${reason}` : null;
        })
        .filter(Boolean);

      if (malformed.length > 0) {
        throw new Error(
          `Malformed environment variables for a production build:\n  - ${malformed.join('\n  - ')}\n` +
          'These values must not contain whitespace. Re-save them in GitHub -> Settings -> ' +
          'Secrets and variables -> Actions, taking care not to include a trailing newline.'
        );
      }
    }
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    requireFirebaseEnv(),
    injectAppVersion(),
    react(),
    tailwindcss()
  ],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/canvas-confetti')) {
            return 'vendor-icons';
          }
        }
      }
    }
  }
});
