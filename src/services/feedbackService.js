import { sanitizeString } from '../utils/packageValidator';
import { sanitizeForTelemetry, redactPII } from '../utils/privacySanitizer';
import { APP_VERSION, BUILD_CHANNEL } from '../constants/version';
import { db, isFirebaseConfigured } from './firebase';

export const OFFLINE_FEEDBACK_QUEUE_KEY = 'deliveree_offline_feedback_queue';
export const LOCAL_FEEDBACK_HISTORY_KEY = 'deliveree_tester_feedback';
const MAX_LOCAL_HISTORY_ITEMS = 50;

/**
 * @typedef {'bug' | 'feature' | 'praise'} FeedbackType
 * 
 * @typedef {Object} FeedbackPayload
 * @property {string} id
 * @property {'pending' | 'triaged'} status
 * @property {FeedbackType} type
 * @property {string} message
 * @property {number} rating
 * @property {string} appVersion
 * @property {string} buildChannel
 * @property {Object|string} user
 * @property {string} userAgent
 * @property {number} screenWidth
 * @property {number} screenHeight
 * @property {string} timestamp
 * @property {boolean} [syncedToCloud]
 */

/**
 * Masks an email address for privacy and PII protection (e.g., s***@gmail.com or j***n@domain.com).
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return '***';
  
  const [local, domain] = parts;
  if (!local || !domain) return '***';

  if (local.length <= 1) {
    return `*@${domain}`;
  } else if (local.length === 2) {
    return `${local[0]}*@${domain}`;
  } else if (local.length === 3) {
    return `${local[0]}*${local[2]}@${domain}`;
  } else {
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }
}

/**
 * Validates and normalizes raw feedback input according to ASVS Level 3 rules.
 * 
 * @param {any} input
 * @returns {FeedbackPayload}
 */
export function validateAndSanitizeFeedback(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Feedback payload must be a non-null object');
  }

  const rawType = typeof input.type === 'string' ? input.type.toLowerCase().trim() : 'bug';
  const type = (rawType === 'bug' || rawType === 'feature' || rawType === 'praise') ? rawType : 'bug';

  const rawMessage = typeof input.message === 'string' ? input.message : '';
  const sanitizedStringMessage = sanitizeString(rawMessage, 1500).trim();
  const message = redactPII(sanitizedStringMessage);
  if (!message) {
    throw new Error('Feedback message is required and cannot be empty');
  }

  const rawRating = Number(input.rating);
  const rating = (!Number.isNaN(rawRating) && rawRating >= 1 && rawRating <= 5) ? Math.round(rawRating) : 5;

  // Strict complete anonymity: Zero user tracking, no UID, name or email extraction
  const isAnonymous = true;
  const user = 'Anonymous Tester';

  const id = input.id && typeof input.id === 'string'
    ? sanitizeString(input.id, 64)
    : `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const appVersion = typeof input.appVersion === 'string' && input.appVersion
    ? sanitizeString(input.appVersion, 30)
    : APP_VERSION;

  const buildChannel = typeof input.buildChannel === 'string' && input.buildChannel
    ? sanitizeString(input.buildChannel, 30)
    : BUILD_CHANNEL;

  const userAgent = typeof input.userAgent === 'string'
    ? sanitizeString(input.userAgent, 300)
    : (typeof navigator !== 'undefined' ? sanitizeString(navigator.userAgent, 300) : '');

  const screenWidth = typeof input.screenWidth === 'number' && input.screenWidth >= 0
    ? input.screenWidth
    : (typeof window !== 'undefined' ? window.innerWidth : 0);

  const screenHeight = typeof input.screenHeight === 'number' && input.screenHeight >= 0
    ? input.screenHeight
    : (typeof window !== 'undefined' ? window.innerHeight : 0);

  const timestamp = typeof input.timestamp === 'string' && input.timestamp
    ? sanitizeString(input.timestamp, 50)
    : new Date().toISOString();

  return {
    id,
    status: 'pending',
    type,
    message,
    rating,
    isAnonymous,
    appVersion,
    buildChannel,
    user,
    userAgent,
    screenWidth,
    screenHeight,
    timestamp
  };
}

/**
 * Returns the array of currently queued offline feedback items.
 * @returns {FeedbackPayload[]}
 */
export function getOfflineQueue() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_FEEDBACK_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[FeedbackService] Error reading offline feedback queue:', err);
    return [];
  }
}

/**
 * Persists the offline feedback queue to localStorage.
 * @param {FeedbackPayload[]} queue
 */
export function setOfflineQueue(queue) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_FEEDBACK_QUEUE_KEY, JSON.stringify(queue.slice(0, 100)));
  } catch (err) {
    console.warn('[FeedbackService] Error writing offline feedback queue:', err);
  }
}

/**
 * Returns number of feedback items currently queued offline.
 * @returns {number}
 */
export function getOfflineFeedbackCount() {
  return getOfflineQueue().length;
}

/**
 * Retrieves the local feedback history stored on the client.
 * @returns {FeedbackPayload[]}
 */
export function getLocalFeedbackHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[FeedbackService] Error reading local feedback history:', err);
    return [];
  }
}

/**
 * Appends a feedback payload to the client's local history.
 * @param {FeedbackPayload} payload
 */
export function recordLocalHistory(payload) {
  if (typeof localStorage === 'undefined') return;
  try {
    const history = getLocalFeedbackHistory();
    const existingIndex = history.findIndex(item => item.id === payload.id);
    if (existingIndex >= 0) {
      history[existingIndex] = payload;
    } else {
      history.unshift(payload);
    }
    localStorage.setItem(
      LOCAL_FEEDBACK_HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_LOCAL_HISTORY_ITEMS))
    );
  } catch (err) {
    console.warn('[FeedbackService] Error recording local feedback history:', err);
  }
}

/**
 * Attempts to upload a feedback payload directly to Cloud Firestore.
 * @param {FeedbackPayload} payload
 * @returns {Promise<boolean>}
 */
export async function uploadToFirestore(payload) {
  if (!isFirebaseConfigured || !db) {
    return false;
  }
  try {
    const { collection, doc, setDoc } = await import('firebase/firestore');
    const feedbackRef = doc(collection(db, 'feedback'), payload.id);
    const uploadPromise = setDoc(feedbackRef, payload).then(() => true).catch(() => false);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 2500));
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    console.warn('[FeedbackService] Firestore submission failed:', err);
    return false;
  }
}

/**
 * Fetches every tester's feedback from Cloud Firestore, newest first.
 *
 * Only succeeds for allowlisted admins — `firestore.rules` denies reads on
 * /feedback to everyone else, so a non-admin caller gets a permission error
 * from the SDK rather than a partial result.
 *
 * @param {number} [limitCount=200]
 * @returns {Promise<{ ok: boolean, items: FeedbackPayload[], error: string|null }>}
 */
export async function fetchAllFeedback(limitCount = 200) {
  if (!isFirebaseConfigured || !db) {
    return { ok: false, items: [], error: 'not-configured' };
  }
  try {
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    const feedbackQuery = query(
      collection(db, 'feedback'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(feedbackQuery);
    const items = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
    return { ok: true, items, error: null };
  } catch (err) {
    console.warn('[FeedbackService] Failed to fetch cloud feedback:', err);
    return { ok: false, items: [], error: err?.code || 'unknown' };
  }
}

/**
 * Merges cloud and local feedback into one list, newest first.
 *
 * The two overlap: anything submitted on this device is in local history *and*
 * (once synced) in Firestore. Cloud wins on conflict since it is the record
 * other devices also see.
 *
 * @param {FeedbackPayload[]} cloudItems
 * @param {FeedbackPayload[]} localItems
 * @returns {FeedbackPayload[]}
 */
export function mergeFeedbackSources(cloudItems, localItems) {
  const byId = new Map();
  for (const item of Array.isArray(localItems) ? localItems : []) {
    if (item?.id) byId.set(item.id, { ...item, source: 'local' });
  }
  for (const item of Array.isArray(cloudItems) ? cloudItems : []) {
    if (item?.id) byId.set(item.id, { ...item, source: 'cloud' });
  }
  return Array.from(byId.values()).sort((a, b) =>
    String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
  );
}

/**
 * Flushes all pending offline feedback items to Cloud Firestore.
 * @returns {Promise<{ flushed: number, remaining: number }>}
 */
export async function flushOfflineFeedbackQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { flushed: 0, remaining: 0 };
  }

  const remaining = [];
  let flushedCount = 0;

  for (const item of queue) {
    try {
      const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (!isOnline) {
        remaining.push(item);
        continue;
      }

      const firestoreSuccess = await uploadToFirestore(item);

      if (firestoreSuccess || !isFirebaseConfigured) {
        flushedCount += 1;
        recordLocalHistory({ ...item, syncedToCloud: true });
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  setOfflineQueue(remaining);
  return { flushed: flushedCount, remaining: remaining.length };
}

/**
 * Global window online event listener initialization.
 * Automatically triggers flushOfflineFeedbackQueue when network connectivity resumes.
 */
let isListenerAttached = false;
export function initOfflineFeedbackSyncListener() {
  if (typeof window === 'undefined' || isListenerAttached) {
    return;
  }

  window.addEventListener('online', () => {
    flushOfflineFeedbackQueue().catch(err => {
      console.warn('[FeedbackService] Auto-sync on reconnect error:', err);
    });
  });

  isListenerAttached = true;
}

// Auto-initialize online sync listener in browser environments
if (typeof window !== 'undefined') {
  initOfflineFeedbackSyncListener();
}

/**
 * Main ingestion entry point: validates, sanitizes, and dispatches feedback.
 * Dispatches to Firestore, falling back to offline queue if offline or unconfigured.
 * 
 * @param {unknown} rawFeedback
 * @returns {Promise<{ success: boolean, syncedToCloud: boolean, feedback: FeedbackPayload }>}
 */
export async function submitFeedback(rawFeedback) {
  const validated = validateAndSanitizeFeedback(rawFeedback);
  const payload = sanitizeForTelemetry(validated);

  // Check network connectivity
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

  let firestoreSuccess = false;
  if (isOnline) {
    firestoreSuccess = await uploadToFirestore(payload);
  }

  const finalPayload = {
    ...payload,
    syncedToCloud: firestoreSuccess
  };

  if (!firestoreSuccess) {
    // Save to offline queue for automatic background flush
    const queue = getOfflineQueue();
    // Avoid duplicate queue entries
    if (!queue.some(item => item.id === payload.id)) {
      queue.push(finalPayload);
      setOfflineQueue(queue);
    }
  }

  // Update local client history
  recordLocalHistory(finalPayload);

  return {
    success: true,
    syncedToCloud: firestoreSuccess,
    feedback: finalPayload
  };
}
