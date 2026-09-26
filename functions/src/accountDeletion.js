/**
 * Server-side half of account deletion.
 *
 * The client can delete its own packages, profile and training samples, but
 * several things tied to a uid are unreachable from the browser by design
 * (firestore.rules deny client reads): the Gmail refresh token and its watch,
 * push-subscription tokens (write-only), the ingestion-address token, and the
 * per-user rate-limit counters and usage logs. Before this function existed,
 * deleting an account left all of those behind — including a live Gmail
 * refresh token whose watch kept syncing mail into the deleted user's
 * `users/{uid}/packages`. The Privacy Policy promises they are purged.
 *
 * The client calls this while still signed in, *before* deleting the Auth
 * user, and aborts the deletion if it fails, so a failure is retryable
 * instead of leaving orphans behind a uid nobody can authenticate as again.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { INGESTION_TOKENS_COLLECTION } from './ingestionToken.js';

/** Rate-limit counter collections whose docs are keyed `user_{uid}_{date}`. */
export const PER_USER_COUNTER_COLLECTIONS = Object.freeze([
  'usage',
  'carrierUsage',
  'gmailBackfillUsage',
  'gmailAiUsage'
]);

/** Collections whose docs carry the uid in a field. [collection, field] */
export const UID_FIELD_COLLECTIONS = Object.freeze([
  ['trainingExamples', 'userId'],
  ['gmailAiOutcomes', 'userId'],
  ['usageEvents', 'uid'],
  [INGESTION_TOKENS_COLLECTION, 'uid']
]);

async function deleteDocs(docs) {
  await Promise.all(docs.map((d) => d.ref.delete()));
  return docs.length;
}

async function deleteByField(db, collectionName, field, uid) {
  const snap = await db.collection(collectionName).where(field, '==', uid).get();
  return deleteDocs(snap.docs);
}

async function deleteByIdPrefix(db, collectionName, prefix, documentIdField) {
  const snap = await db
    .collection(collectionName)
    .where(documentIdField, '>=', prefix)
    .where(documentIdField, '<', `${prefix}`)
    .get();
  return deleteDocs(snap.docs);
}

/**
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   disconnectGmail: (request: object) => Promise<unknown>,
 *   documentIdField: unknown
 * }} deps
 *   `disconnectGmail` is the gmailDisconnect handler (stops the watch,
 *   revokes the token, deletes the connection docs). `documentIdField` is
 *   `FieldPath.documentId()`, injected so tests need no Admin SDK.
 */
export function createDeleteAccountDataHandler({ db, disconnectGmail, documentIdField }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    // Gmail first: it is the only item that keeps *producing* data.
    await disconnectGmail({ auth: request.auth, data: { emailAddress: 'all' } });

    const deleted = {};
    for (const [collectionName, field] of UID_FIELD_COLLECTIONS) {
      deleted[collectionName] = await deleteByField(db, collectionName, field, uid);
    }
    for (const collectionName of PER_USER_COUNTER_COLLECTIONS) {
      deleted[collectionName] = await deleteByIdPrefix(db, collectionName, `user_${uid}_`, documentIdField);
    }

    // Push tokens and the whole users/{uid} subtree (profile + packages).
    await db.recursiveDelete(db.collection('pushSubscriptions').doc(uid));
    await db.recursiveDelete(db.collection('users').doc(uid));

    console.log(`[deleteAccountData] purged uid=${uid}`, JSON.stringify(deleted));
    return { ok: true };
  };
}
