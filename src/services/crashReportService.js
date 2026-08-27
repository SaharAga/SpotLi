import { sanitizeString } from '../utils/packageValidator';
import { sanitizeForTelemetry } from '../utils/privacySanitizer';
import { APP_VERSION, BUILD_CHANNEL } from '../constants/version';
import { db, isFirebaseConfigured } from './firebase';
import { STORAGE_KEYS } from '../constants/storageKeys';

// Deliberately its own Firestore collection and its own offline queue, not
// merged into feedbackService's /feedback — see the comment on the
// `crashReports` match block in firestore.rules for why: crash volume is
// machine-driven and bursty, and mixing it with human feedback would let a
// crash wave crowd out real testers in the admin inspector's fetch limit.

export const OFFLINE_CRASH_QUEUE_KEY = STORAGE_KEYS.OFFLINE_CRASH_QUEUE;
const SESSION_SEEN_KEY = STORAGE_KEYS.CRASH_SEEN;
const MAX_REPORTS_PER_SESSION = 20;
const MAX_QUEUE_ITEMS = 100;
const MAX_MESSAGE_CHARS = 1500;
const MAX_STACK_LINES = 6;

/**
 * @typedef {Object} CrashReportPayload
 * @property {string} id
 * @property {string} signature
 * @property {string} [componentName]
 * @property {string} message
 * @property {string} appVersion
 * @property {string} buildChannel
 * @property {string} userAgent
 * @property {number} screenWidth
 * @property {number} screenHeight
 * @property {string} timestamp
 * @property {boolean} [syncedToCloud]
 */

/**
 * Cheap non-cryptographic string hash for deduplication/grouping signatures
 * only — never used for anything security-sensitive.
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * @param {unknown} error
 * @param {string} [componentName]
 * @returns {{ signature: string, message: string }}
 */
export function buildCrashReport(error, componentName) {
  const name = error?.name || 'Error';
  const rawMessage = error?.message ? String(error.message) : String(error ?? 'Unknown error');
  const stack = typeof error?.stack === 'string' ? error.stack : '';
  const stackLines = stack.split('\n').slice(0, MAX_STACK_LINES).join('\n');

  const header = componentName
    ? `[${componentName}] ${name}: ${rawMessage}`
    : `${name}: ${rawMessage}`;
  const message = `${header}\n${stackLines}`.slice(0, MAX_MESSAGE_CHARS);

  // Signature covers component + error name + message, not the stack — the
  // same logical crash can carry a slightly different stack across builds
  // (minified line numbers) while still being the same bug. This is also
  // the key the admin view groups occurrences by.
  const signature = hashString(`${componentName || ''}|${name}|${rawMessage}`);

  return { signature, message };
}

/**
 * @param {unknown} input
 * @returns {CrashReportPayload}
 */
function validateAndSanitizeCrashReport(input) {
  const signature = sanitizeString(typeof input.signature === 'string' ? input.signature : '', 64);
  const message = sanitizeString(typeof input.message === 'string' ? input.message : '', MAX_MESSAGE_CHARS);
  if (!message) {
    throw new Error('Crash report message is required and cannot be empty');
  }

  const id = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const componentName = typeof input.componentName === 'string' && input.componentName
    ? sanitizeString(input.componentName, 100)
    : undefined;

  return {
    id,
    signature,
    ...(componentName ? { componentName } : {}),
    message,
    appVersion: APP_VERSION,
    buildChannel: BUILD_CHANNEL,
    userAgent: typeof navigator !== 'undefined' ? sanitizeString(navigator.userAgent, 300) : '',
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    timestamp: new Date().toISOString()
  };
}

function getOfflineQueue() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_CRASH_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setOfflineQueue(queue) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_CRASH_QUEUE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE_ITEMS)));
  } catch {
    // Ignore — losing a queued crash report is not worth surfacing to the user.
  }
}

/**
 * @param {CrashReportPayload} payload
 * @returns {Promise<boolean>}
 */
async function uploadToFirestore(payload) {
  if (!isFirebaseConfigured || !db) return false;
  try {
    const { collection, doc, setDoc } = await import('firebase/firestore');
    const ref = doc(collection(db, 'crashReports'), payload.id);
    const uploadPromise = setDoc(ref, payload).then(() => true).catch(() => false);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 2500));
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    console.warn('[crashReportService] Firestore submission failed:', err);
    return false;
  }
}

/**
 * Flushes all pending offline crash reports to Cloud Firestore.
 * @returns {Promise<{ flushed: number, remaining: number }>}
 */
export async function flushOfflineCrashQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const remaining = [];
  let flushedCount = 0;

  for (const item of queue) {
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!isOnline) {
      remaining.push(item);
      continue;
    }
    const success = await uploadToFirestore(item);
    if (success || !isFirebaseConfigured) {
      flushedCount += 1;
    } else {
      remaining.push(item);
    }
  }

  setOfflineQueue(remaining);
  return { flushed: flushedCount, remaining: remaining.length };
}

let isFlushListenerAttached = false;
function initOfflineFlushListener() {
  if (typeof window === 'undefined' || isFlushListenerAttached) return;
  window.addEventListener('online', () => {
    flushOfflineCrashQueue().catch(() => {});
  });
  isFlushListenerAttached = true;
}

function getSeenSignatures() {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markSeen(seen) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Ignore — dedup is a nicety, not a correctness requirement.
  }
}

/**
 * Reports a caught or uncaught error as an anonymous crash report.
 *
 * Deduplicated per browser tab session so a repeating render-loop error
 * can't flood Firestore — at most one report per distinct (component, error
 * name, message) signature per session, and a hard cap on total reports per
 * session regardless of how many distinct errors occur.
 *
 * Never throws — a failure to report a crash must not itself crash the app.
 *
 * @param {unknown} error
 * @param {{ componentName?: string }} [options]
 * @returns {Promise<void>}
 */
export async function reportCrash(error, { componentName } = {}) {
  try {
    const seen = getSeenSignatures();
    if (seen.size >= MAX_REPORTS_PER_SESSION) return;

    const built = buildCrashReport(error, componentName);
    if (seen.has(built.signature)) return;

    seen.add(built.signature);
    markSeen(seen);

    const validated = validateAndSanitizeCrashReport({ ...built, componentName });
    const payload = sanitizeForTelemetry(validated);

    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const success = isOnline ? await uploadToFirestore(payload) : false;

    if (!success) {
      const queue = getOfflineQueue();
      queue.push(payload);
      setOfflineQueue(queue);
    }
  } catch (reportingError) {
    console.warn('[crashReportService] Failed to report crash:', reportingError);
  }
}

let isGlobalHandlerAttached = false;

/**
 * Installs window-level handlers to catch errors React's ErrorBoundary can't
 * see — thrown outside a render (event handlers, timers, async callbacks)
 * and unhandled promise rejections — and starts the offline-queue flush
 * listener. Idempotent; safe to call multiple times.
 */
export function initGlobalCrashReporting() {
  initOfflineFlushListener();

  if (typeof window === 'undefined' || isGlobalHandlerAttached) return;

  window.addEventListener('error', (event) => {
    if (event?.error) {
      reportCrash(event.error, { componentName: 'window' });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportCrash(event?.reason, { componentName: 'unhandledrejection' });
  });

  isGlobalHandlerAttached = true;
}

/**
 * Fetches every crash report from Cloud Firestore, newest first.
 * Only succeeds for allowlisted admins — firestore.rules denies reads on
 * /crashReports to everyone else.
 *
 * @param {number} [limitCount=500]
 * @returns {Promise<{ ok: boolean, items: CrashReportPayload[], error: string|null }>}
 */
export async function fetchAllCrashReports(limitCount = 500) {
  if (!isFirebaseConfigured || !db) {
    return { ok: false, items: [], error: 'not-configured' };
  }
  try {
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    const crashQuery = query(
      collection(db, 'crashReports'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(crashQuery);
    const items = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
    return { ok: true, items, error: null };
  } catch (err) {
    console.warn('[crashReportService] Failed to fetch cloud crash reports:', err);
    return { ok: false, items: [], error: err?.code || 'unknown' };
  }
}

/**
 * @typedef {Object} CrashGroup
 * @property {string} signature
 * @property {string} message
 * @property {string} [componentName]
 * @property {number} count
 * @property {string} firstSeen
 * @property {string} lastSeen
 * @property {string} appVersion
 */

/**
 * Groups raw crash report documents by signature for display, since reports
 * are stored one-per-occurrence (see firestore.rules — clients get no
 * Firestore update permission, so aggregation happens at read time here
 * instead of via a shared counter document).
 *
 * @param {CrashReportPayload[]} items
 * @returns {CrashGroup[]} sorted by most recent occurrence first
 */
export function groupCrashReports(items) {
  const bySignature = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.signature) continue;
    const existing = bySignature.get(item.signature);
    if (!existing) {
      bySignature.set(item.signature, {
        signature: item.signature,
        message: item.message,
        componentName: item.componentName,
        count: 1,
        firstSeen: item.timestamp,
        lastSeen: item.timestamp,
        appVersion: item.appVersion
      });
      continue;
    }

    existing.count += 1;
    if (String(item.timestamp) > String(existing.lastSeen)) {
      existing.lastSeen = item.timestamp;
      existing.appVersion = item.appVersion;
    }
    if (String(item.timestamp) < String(existing.firstSeen)) {
      existing.firstSeen = item.timestamp;
    }
  }

  return Array.from(bySignature.values()).sort((a, b) =>
    String(b.lastSeen || '').localeCompare(String(a.lastSeen || ''))
  );
}
