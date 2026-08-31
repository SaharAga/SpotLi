import { HttpsError } from 'firebase-functions/v2/https';
import { LIMITS } from './config.js';

/**
 * Callable functions verify the Firebase Auth ID token automatically and
 * populate request.auth — but only reject the call if we check it. Smart
 * Import / feedback-image analysis has no reason to work for a logged-out
 * caller (unlike the /feedback Firestore write, which is deliberately
 * anonymous-friendly), so requiring a real user closes off the cheapest
 * form of abuse: a script with no account hammering the endpoint.
 */
export function assertAuthenticated(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  return request.auth.uid;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically checks and increments per-user and global daily call counters.
 * Both limits are checked before either is incremented, inside one
 * transaction, so concurrent calls can't race past the ceiling.
 *
 * `collection`/`userLimit`/`globalLimit` let a caller other than
 * parseWithAi (e.g. the Gmail sync AI fallback in gmailAiFallback.js) track
 * its own budget in its own Firestore collection, so a chatty inbox can't
 * eat into interactive Smart Import's daily allowance or vice versa — same
 * transactional shape, separate counters.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} userId
 * @param {{ collection?: string, userLimit?: number, globalLimit?: number }} [options]
 * @returns {Promise<{ allowed: true } | { allowed: false, reason: 'user-limit' | 'global-limit' }>}
 */
export async function checkAndIncrementUsage(db, userId, options = {}) {
  const {
    collection = 'usage',
    userLimit = LIMITS.PER_USER_DAILY_CALLS,
    globalLimit = LIMITS.GLOBAL_DAILY_CALLS
  } = options;
  const date = todayUtc();
  const userRef = db.collection(collection).doc(`user_${userId}_${date}`);
  const globalRef = db.collection(collection).doc(`global_${date}`);

  return db.runTransaction(async (tx) => {
    const [userSnap, globalSnap] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
    const userCount = userSnap.exists ? userSnap.data().count : 0;
    const globalCount = globalSnap.exists ? globalSnap.data().count : 0;

    if (userCount >= userLimit) {
      return { allowed: false, reason: 'user-limit' };
    }
    if (globalCount >= globalLimit) {
      return { allowed: false, reason: 'global-limit' };
    }

    const now = new Date().toISOString();
    tx.set(userRef, { count: userCount + 1, updatedAt: now }, { merge: true });
    tx.set(globalRef, { count: globalCount + 1, updatedAt: now }, { merge: true });
    return { allowed: true };
  });
}

/**
 * Throws if the request's payload doesn't fit the declared mode's size cap.
 * Checked before any Gemini call is made, so an oversized request never
 * reaches the point of costing money.
 *
 * @param {{ mode: 'text-fallback' | 'image', text?: string, imageBase64?: string }} payload
 */
export function assertPayloadWithinLimits(payload) {
  if (payload.mode === 'text-fallback') {
    const text = payload.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new HttpsError('invalid-argument', 'text is required for mode "text-fallback".');
    }
    if (text.length > LIMITS.MAX_TEXT_LENGTH) {
      throw new HttpsError('invalid-argument', `text exceeds ${LIMITS.MAX_TEXT_LENGTH} characters.`);
    }
    return;
  }

  if (payload.mode === 'image') {
    const image = payload.imageBase64;
    if (typeof image !== 'string' || !image.trim()) {
      throw new HttpsError('invalid-argument', 'imageBase64 is required for mode "image".');
    }
    if (image.length > LIMITS.MAX_IMAGE_BASE64_BYTES) {
      throw new HttpsError('invalid-argument', `imageBase64 exceeds ${LIMITS.MAX_IMAGE_BASE64_BYTES} bytes.`);
    }
    return;
  }

  throw new HttpsError('invalid-argument', 'mode must be "text-fallback" or "image".');
}
