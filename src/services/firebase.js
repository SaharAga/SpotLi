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
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

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
 * Resolves the Firebase `authDomain`.
 *
 * Why this isn't just the env var: `signInWithPopup`/`signInWithRedirect`
 * load a hidden helper iframe at `https://<authDomain>/__/auth/iframe`. When
 * authDomain differs from the origin the app is served from, that iframe is
 * cross-origin — so its cookies/storage are third-party, and every modern
 * browser blocks them (Chrome's 3P-cookie phase-out, Safari ITP, and any
 * in-app webview). The iframe then can't relay the auth result and sign-in
 * fails. Firebase's own guidance is to keep authDomain on the same origin as
 * the app.
 *
 * Firebase Hosting serves the `/__/auth/*` helper routes from every Hosting
 * site in the project, so when the page is already on one of this project's
 * Hosting domains, pointing authDomain at that same hostname makes the
 * iframe same-origin and the whole third-party-storage problem disappears.
 * Anywhere else (custom domain, localhost, tests) we fall back to the
 * configured value.
 *
 * History: this existed once (9470547) and was reverted 8 minutes later
 * (dffebf6) — the code was right, but the Google Cloud OAuth client still
 * only allowed the `.firebaseapp.com` redirect URI, so switching origins
 * broke sign-in a different way. Both console entries below must exist for
 * this to work:
 *   - Firebase Console → Authentication → Settings → Authorized domains:
 *     `deliveree-app-2a938.web.app`
 *   - Google Cloud Console → APIs & Services → Credentials → the Web OAuth
 *     client → Authorized redirect URIs:
 *     `https://deliveree-app-2a938.web.app/__/auth/handler`
 */
export function resolveAuthDomain(hostname, configuredDomain) {
  const isProjectHostingDomain =
    typeof hostname === 'string' &&
    (hostname.endsWith('.web.app') || hostname.endsWith('.firebaseapp.com'));

  return isProjectHostingDomain ? hostname : configuredDomain;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(
    typeof window !== 'undefined' ? window.location.hostname : undefined,
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  ),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

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
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
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
