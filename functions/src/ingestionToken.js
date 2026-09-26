/**
 * Per-user ingestion-address tokens for the inbound-email webhook.
 *
 * The forwarding address used to be `<inbox>+usr_<firebaseUid>@…`. That made
 * the uid a bearer credential: anyone who learned the address could inject
 * packages — including pickup locations, phone numbers and locker codes —
 * into that user's list, the sender is never verified, and a uid can't be
 * rotated. The address now carries a random token that maps to a uid only
 * server-side (`ingestionTokens/{token}`, client access denied by the
 * catch-all rule) and that the user can regenerate.
 *
 * Migration: a legacy uid address is still honoured, but only for a user who
 * has never been issued a token. The first time the app shows the address it
 * issues one, and from then on the uid form is rejected.
 */

import { randomBytes } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';

export const INGESTION_TOKENS_COLLECTION = 'ingestionTokens';

/** 96 bits, lowercase hex — email local parts are case-insensitive in practice. */
const TOKEN_PATTERN = /^[a-f0-9]{24}$/;

export function generateIngestionToken() {
  return randomBytes(12).toString('hex');
}

/**
 * Pulls the credential out of a recipient address.
 * @param {unknown} toAddress
 * @returns {{ kind: 'token' | 'uid', value: string } | null}
 */
export function parseIngestionRecipient(toAddress) {
  if (typeof toAddress !== 'string') return null;

  const tokenMatch = toAddress.match(/[+.]?tok_([a-f0-9]{24})@/i);
  if (tokenMatch) return { kind: 'token', value: tokenMatch[1].toLowerCase() };

  // Legacy forms — see the migration note above.
  const plusMatch = toAddress.match(/\+(?:usr_)?([a-zA-Z0-9_-]+)@/i);
  if (plusMatch && plusMatch[1]) {
    const cleanId = plusMatch[1].split('_')[0];
    if (cleanId && cleanId.length >= 3) return { kind: 'uid', value: cleanId };
  }

  const emailMatch = toAddress.match(/([a-zA-Z0-9_-]+)(?:\.pkg)?@(?:in\.)?(?:spotliapp\.com|deliveree\.app|cloudmailin\.net)/i);
  if (!emailMatch) return null;
  const localPart = emailMatch[1];
  const userId = localPart.startsWith('usr_') ? localPart.slice(4) : localPart;
  const cleanUserId = userId.split('_')[0];
  return cleanUserId && cleanUserId.length >= 3 ? { kind: 'uid', value: cleanUserId } : null;
}

async function findTokenDocsForUser(db, uid) {
  const snap = await db.collection(INGESTION_TOKENS_COLLECTION).where('uid', '==', uid).get();
  return snap.docs;
}

/**
 * Maps a recipient address to the uid whose package list it may write to.
 * @returns {Promise<string | null>}
 */
export async function resolveIngestionRecipient({ db, toAddress }) {
  const parsed = parseIngestionRecipient(toAddress);
  if (!parsed) return null;

  if (parsed.kind === 'token') {
    if (!TOKEN_PATTERN.test(parsed.value)) return null;
    const snap = await db.collection(INGESTION_TOKENS_COLLECTION).doc(parsed.value).get();
    const uid = snap.exists ? snap.data()?.uid : null;
    return typeof uid === 'string' && uid ? uid : null;
  }

  // Legacy uid address: only for an existing user who has no token yet.
  const uid = parsed.value;
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) return null;
  const tokenDocs = await findTokenDocsForUser(db, uid);
  return tokenDocs.length === 0 ? uid : null;
}

async function issueToken(db, uid) {
  const token = generateIngestionToken();
  await db.collection(INGESTION_TOKENS_COLLECTION).doc(token).set({
    uid,
    createdAt: new Date().toISOString()
  });
  return token;
}

/**
 * Callable: returns the caller's ingestion token, issuing one on first use.
 * `{ rotate: true }` revokes every existing token and issues a fresh one.
 */
export function createIngestionAddressHandler({ db }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const existing = await findTokenDocsForUser(db, uid);
    if (request.data?.rotate === true) {
      await Promise.all(existing.map((d) => d.ref.delete()));
      return { token: await issueToken(db, uid) };
    }
    if (existing.length > 0) {
      return { token: existing[0].id };
    }
    return { token: await issueToken(db, uid) };
  };
}
