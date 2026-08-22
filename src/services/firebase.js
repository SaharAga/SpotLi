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
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
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
