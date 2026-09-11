import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider, 
  FacebookAuthProvider, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

/**
 * Firebase Client Configuration.
 *
 * Every value comes from the environment — see `.env.example`. There are
 * deliberately no inline defaults: a build with missing or misspelled vars must
 * not quietly connect to the production project. `vite.config.js` fails the
 * production build when any of them are absent.
 *
 * When unconfigured (tests, or a local run without a .env), the app degrades to
 * local-only storage rather than throwing.
 */
/**
 * Trims surrounding whitespace from a config value.
 *
 * Not defensive programming for its own sake: a trailing CRLF in the
 * `VITE_FIREBASE_AUTH_DOMAIN` repository variable (easy to introduce by
 * pasting a value into a CI secrets/variables field) silently broke Google
 * sign-in in production. Firebase builds its OAuth helper iframe URL by
 * string-concatenating authDomain, so the newline survived into the URL as
 * `https://…firebaseapp.com%0D%0A/__/auth/iframe?…` and the SDK rejected it
 * with "Illegal url for new iframe".
 *
 * It failed quietly in the worst way: email/password sign-in kept working
 * (that path talks to identitytoolkit.googleapis.com with the API key and
 * never touches authDomain), so only the Google button broke, and the
 * error surfaced as a generic auth failure rather than a config problem.
 */
function cleanConfigValue(value) {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Dynamically resolves the authDomain for Firebase Authentication.
 *
 * In Firebase Auth, OAuth popups and redirects route through authDomain to
 * complete the handshake (via `/__/auth/handler` and `/__/auth/iframe`).
 * When running on Firebase Hosting (such as staging preview channels like
 * `deliveree-app-2a938--staging-*.web.app` or custom domains), setting
 * authDomain to the current hosting origin (window.location.hostname)
 * makes the auth flow completely same-origin. This avoids cross-origin
 * third-party cookie blocking and prevents redirects from accidentally
 * bouncing users back to production.
 *
 * For local development (localhost) or unconfigured/non-hosting environments,
 * it safely falls back to the configured domain (e.g. VITE_FIREBASE_AUTH_DOMAIN).
 *
 * @param {string} configuredDomain The static authDomain from env
 * @param {string} [currentHostname] Optional hostname override (defaults to window.location.hostname)
 * @param {string} [projectId] Optional projectId override (defaults to VITE_FIREBASE_PROJECT_ID)
 * @returns {string}
 */
function resolveAuthDomain(
  configuredDomain,
  currentHostname = typeof window !== 'undefined' ? window.location?.hostname : undefined,
  projectId = cleanConfigValue(import.meta.env?.VITE_FIREBASE_PROJECT_ID)
) {
  const cleaned = cleanConfigValue(configuredDomain);
  if (typeof currentHostname !== 'string' || !currentHostname) {
    return cleaned;
  }

  const host = currentHostname.trim().toLowerCase();
  const allowedCustomDomains = new Set(['spotliapp.com', 'www.spotliapp.com', 'deliveree.app']);
  if (allowedCustomDomains.has(host)) {
    return host;
  }

  if (projectId) {
    const cleanProjectId = projectId.trim().toLowerCase();
    const isProjectHosting =
      host === `${cleanProjectId}.web.app` ||
      host === `${cleanProjectId}.firebaseapp.com` ||
      (host.startsWith(`${cleanProjectId}--`) &&
        (host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')));
    if (isProjectHosting) {
      return host;
    }
  } else if (host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) {
    return host;
  }

  return cleaned;
}

const firebaseConfig = {
  apiKey: cleanConfigValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: resolveAuthDomain(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanConfigValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: cleanConfigValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanConfigValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanConfigValue(import.meta.env.VITE_FIREBASE_APP_ID),
};

export { cleanConfigValue, resolveAuthDomain };

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain
);

// Loud in the browser, silent in tests, where local-only mode is the point.
if (!isFirebaseConfigured && typeof window !== 'undefined') {
  console.error(
    '[Firebase] Not configured \u2014 VITE_FIREBASE_* environment variables are missing. ' +
    'Cloud sync and sign-in are disabled; see .env.example.'
  );
}

// Initialize Firebase only once
export const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const functionsInstance = app ? getFunctions(app) : null;

/**
 * App Check.
 *
 * The /feedback collection accepts writes from anyone with the project's
 * public API key, which is unauthenticated-by-design (guest testers submit
 * feedback without an account). App Check is what actually closes that off:
 * it rejects requests that don't come from this app's real build, without
 * requiring sign-in.
 *
 * reCAPTCHA ENTERPRISE, not the classic v3 provider: Firebase deprecated
 * classic reCAPTCHA for App Check, and its console now refuses to register a
 * web app with one. The env var keeps its name so nothing else has to change;
 * the value is an Enterprise key ID from Google Cloud, which has no secret
 * half — the key ID is public and ships in the bundle by design.
 *
 * Optional and gated on VITE_RECAPTCHA_V3_SITE_KEY so a build with no key
 * behaves exactly as before — App Check simply isn't initialized. Setting up
 * the site key and turning on enforcement is a Firebase console step outside
 * this repo; see README.md.
 */
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;

if (app && recaptchaSiteKey) {
  // Lets `npm run dev` keep working once enforcement is turned on: register
  // this logged token as a debug token in Firebase Console -> App Check.
  // Vite strips import.meta.env.DEV to `false` in production builds, so this
  // branch and its console.info are compiled out of what ships.
  if (import.meta.env.DEV) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (err) {
    console.warn('[Firebase] App Check failed to initialize:', err);
  }
} else if (app && typeof window !== 'undefined' && import.meta.env.PROD) {
  console.warn(
    '[Firebase] App Check is not configured (VITE_RECAPTCHA_V3_SITE_KEY unset). ' +
    'Firestore write paths that accept unauthenticated requests, like /feedback, ' +
    'have no bot protection until it is.'
  );
}

// Guarantee persistent login state across browser restarts and page refreshes
if (auth && isFirebaseConfigured) {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase] setPersistence error:', err);
  });
}

// OAuth Providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export const facebookProvider = new FacebookAuthProvider();
