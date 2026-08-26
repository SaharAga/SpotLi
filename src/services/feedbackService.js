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

  const screenshot = validateScreenshot(input.screenshot);

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
    timestamp,
    ...(screenshot ? { screenshot } : {})
  };
}

/**
 * Largest screenshot we will store, in base64 characters. Firestore caps a
 * document at 1MiB; this leaves headroom for the message and metadata.
 * Kept deliberately above the client-side compression ceiling so a slightly
 * over-target image is still accepted rather than silently dropped.
 */
export const MAX_SCREENSHOT_CHARS = 750_000;

/**
 * Accepts a screenshot only if it is a plausible image data URL within budget.
 * Anything else is dropped rather than throwing — a malformed attachment
 * should never cost the user their written feedback.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function validateScreenshot(value) {
  if (typeof value !== 'string' || !value) return null;
  const trimmed = value.trim();
  if (!/^data:image\/(png|jpe?g|webp|gif)(;[a-z0-9=_-]+)*;base64,/i.test(trimmed)) return null;
  if (trimmed.length > MAX_SCREENSHOT_CHARS) return null;
  return trimmed;
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
  recordLocalHistoryBatch([payload]);
}

/**
 * Appends several feedback payloads to the client's local history in one pass.
 *
 * Draining an offline backlog used to call `recordLocalHistory` per item, and
 * each call re-read and re-parsed the *entire* stored history, then re-stringified
 * and rewrote it — O(N^2) bytes through JSON for a queue of N. Reading once,
 * merging in memory and writing once makes it linear. The resulting history is
 * byte-identical to what the per-item loop produced: payloads are applied in the
 * same order, an existing id is replaced in place, and a new id is unshifted to
 * the front.
 *
 * @param {FeedbackPayload[]} payloads
 */
export function recordLocalHistoryBatch(payloads) {
  if (typeof localStorage === 'undefined') return;
  if (!Array.isArray(payloads) || payloads.length === 0) return;
  try {
    const history = getLocalFeedbackHistory();
    // Index by id so repeated writes do not each cost a linear findIndex.
    const indexById = new Map();
    history.forEach((item, i) => {
      if (item && !indexById.has(item.id)) indexById.set(item.id, i);
    });

    for (const payload of payloads) {
      const existingIndex = indexById.has(payload.id) ? indexById.get(payload.id) : -1;
      if (existingIndex >= 0) {
        history[existingIndex] = payload;
      } else {
        history.unshift(payload);
        // Every prior entry shifted one place to the right.
        for (const [id, i] of indexById) indexById.set(id, i + 1);
        indexById.set(payload.id, 0);
      }

      // The per-item loop this replaces truncated after every write, so an entry
      // pushed past the cap by an earlier payload was already gone when a later
      // one looked for it. Truncating here too keeps that behaviour exactly.
      if (history.length > MAX_LOCAL_HISTORY_ITEMS) {
        history.length = MAX_LOCAL_HISTORY_ITEMS;
        for (const [id, i] of indexById) {
          if (i >= MAX_LOCAL_HISTORY_ITEMS) indexById.delete(id);
        }
      }
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
 * How many queued feedback uploads may be in flight at once. Each upload carries
 * its own 2.5s timeout budget (see `uploadToFirestore`), so this bounds both the
 * bytes on the wire and the number of items sharing any one stretch of that
 * budget.
 */
export const FLUSH_CONCURRENCY = 4;

/**
 * Runs `task` over `items` with at most `limit` in flight, returning results in
 * input order in `Promise.allSettled` shape — one task settling either way never
 * abandons the rest.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} task
 * @returns {Promise<Array<{status: 'fulfilled', value: R} | {status: 'rejected', reason: unknown}>>}
 */
export async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = { status: 'fulfilled', value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
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

  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!isOnline) {
    // Nothing can be uploaded; the queue is rewritten unchanged, as before.
    setOfflineQueue(queue);
    return { flushed: 0, remaining: queue.length };
  }

  // Each queued item is an independent Firestore document write keyed by its own
  // id, so there is no ordering constraint between them. Overlapping them turns N
  // sequential round trips into ceil(N / FLUSH_CONCURRENCY) — this path runs the
  // moment a user comes back online with a backlog. `allSettled`, not `all`: one
  // rejection must not abandon the rest of the queue.
  //
  // Bounded, not unbounded: `uploadToFirestore` races each write against a fixed
  // 2.5s timeout, so firing all N in one tick would make that one budget cover
  // the entire queue. The queue holds up to 100 items and each may carry a
  // screenshot near MAX_SCREENSHOT_CHARS, so that would also push several MB at
  // once down a connection that has only just come back — and a write that acks
  // after the deadline resolves false, goes back to `remaining`, and is uploaded
  // again on the next `online` event despite having succeeded. A small pool keeps
  // every item's budget realistic while still removing the serial round trips.
  const results = await mapWithConcurrency(queue, FLUSH_CONCURRENCY, uploadToFirestore);

  const remaining = [];
  const flushedPayloads = [];

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    const result = results[i];
    const firestoreSuccess = result.status === 'fulfilled' && result.value === true;

    if (result.status === 'rejected' || (!firestoreSuccess && isFirebaseConfigured)) {
      remaining.push(item);
    } else {
      flushedPayloads.push({ ...item, syncedToCloud: true });
    }
  }

  // One read-modify-write for the whole batch instead of one per item.
  recordLocalHistoryBatch(flushedPayloads);

  setOfflineQueue(remaining);
  return { flushed: flushedPayloads.length, remaining: remaining.length };
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

  // Keep the screenshot out of sanitizeForTelemetry: it walks every string
  // through redactPII, whose phone/number patterns would match inside base64
  // and corrupt the image. It is already validated and contains no key/value
  // text to scrub, so it is re-attached untouched afterwards.
  const { screenshot, ...sanitizable } = validated;
  const payload = sanitizeForTelemetry(sanitizable);
  if (screenshot) {
    payload.screenshot = screenshot;
  }

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

/**
 * Computes analytics and time-series trends from an array of feedback items.
 *
 * @param {Array<object>} feedbacks
 * @returns {{
 *   total: number,
 *   bugCount: number,
 *   featureCount: number,
 *   praiseCount: number,
 *   averageRating: number,
 *   ratingDistribution: Record<number, number>,
 *   weeklyTrends: Array<{ week: string, label: string, bug: number, feature: number, praise: number, total: number, avgRating: number }>,
 *   versionTrends: Array<{ version: string, total: number, bug: number, feature: number, praise: number, avgRating: number }>
 * }}
 */
export function computeFeedbackAnalytics(feedbacks) {
  const items = Array.isArray(feedbacks) ? feedbacks : [];
  const total = items.length;

  if (total === 0) {
    return {
      total: 0,
      bugCount: 0,
      featureCount: 0,
      praiseCount: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      weeklyTrends: [],
      versionTrends: []
    };
  }

  let bugCount = 0;
  let featureCount = 0;
  let praiseCount = 0;
  let sumRating = 0;
  let ratedCount = 0;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const weeklyBuckets = new Map();
  const versionBuckets = new Map();

  for (const item of items) {
    if (!item) continue;
    const type = item.type === 'feature' ? 'feature' : item.type === 'praise' ? 'praise' : 'bug';
    if (type === 'bug') bugCount++;
    else if (type === 'feature') featureCount++;
    else if (type === 'praise') praiseCount++;

    const rating = typeof item.rating === 'number' && item.rating >= 1 && item.rating <= 5 ? Math.round(item.rating) : null;
    if (rating !== null) {
      sumRating += rating;
      ratedCount++;
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    }

    // Weekly trend grouping
    const date = item.timestamp ? new Date(item.timestamp) : null;
    const weekKey = date && !isNaN(date.getTime())
      ? (() => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - d.getDay()); // Sunday start
          return d.toISOString().slice(0, 10);
        })()
      : 'unknown';

    if (!weeklyBuckets.has(weekKey)) {
      weeklyBuckets.set(weekKey, {
        week: weekKey,
        label: weekKey === 'unknown' ? 'Unknown' : new Date(weekKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bug: 0,
        feature: 0,
        praise: 0,
        total: 0,
        ratingSum: 0,
        ratingCount: 0
      });
    }
    const wb = weeklyBuckets.get(weekKey);
    wb.total += 1;
    wb[type] += 1;
    if (rating !== null) {
      wb.ratingSum += rating;
      wb.ratingCount += 1;
    }

    // Version trend grouping
    const version = (typeof item.appVersion === 'string' && item.appVersion) ? item.appVersion : 'unknown';
    if (!versionBuckets.has(version)) {
      versionBuckets.set(version, {
        version,
        total: 0,
        bug: 0,
        feature: 0,
        praise: 0,
        ratingSum: 0,
        ratingCount: 0
      });
    }
    const vb = versionBuckets.get(version);
    vb.total += 1;
    vb[type] += 1;
    if (rating !== null) {
      vb.ratingSum += rating;
      vb.ratingCount += 1;
    }
  }

  const weeklyTrends = Array.from(weeklyBuckets.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      week: w.week,
      label: w.label,
      bug: w.bug,
      feature: w.feature,
      praise: w.praise,
      total: w.total,
      avgRating: w.ratingCount > 0 ? Number((w.ratingSum / w.ratingCount).toFixed(1)) : 0
    }));

  const versionTrends = Array.from(versionBuckets.values())
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
    .map(v => ({
      version: v.version,
      total: v.total,
      bug: v.bug,
      feature: v.feature,
      praise: v.praise,
      avgRating: v.ratingCount > 0 ? Number((v.ratingSum / v.ratingCount).toFixed(1)) : 0
    }));

  const averageRating = ratedCount > 0 ? Number((sumRating / ratedCount).toFixed(1)) : 0;

  return {
    total,
    bugCount,
    featureCount,
    praiseCount,
    averageRating,
    ratingDistribution,
    weeklyTrends,
    versionTrends
  };
}
