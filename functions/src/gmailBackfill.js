/**
 * One-time historical backfill: on first Gmail connect, search the last 30
 * days of mail for shipping-looking messages, dedupe against the user's
 * existing packages by tracking number, and save the new ones.
 *
 * Exposed as an onCall the client invokes right after the OAuth
 * redirect-back completes (App Check + auth enforced) — chosen over having
 * the OAuth callback (an onRequest, unauthenticated by App Check) run it
 * synchronously, so a slow backfill can't hold up the user's redirect back
 * to the app, and so it reuses the same auth/App-Check guard pattern as
 * parseWithAi instead of a bespoke one for a plain HTTP redirect handler.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { DEFAULT_FORWARDING_FILTER_QUERY } from './emailFilterQuery.js';
import { getGmailConnection, getGmailClientForUser } from './gmailAuth.js';
import { buildPackageFromGmailMessage } from './gmailPackageSync.js';

const BACKFILL_WINDOW_DAYS = 30;
const MAX_MESSAGES = 100;

/**
 * @param {{ db: FirebaseFirestore.Firestore, clientSecret: string }} deps
 */
export function createGmailBackfillHandler({ db, clientSecret }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const connection = await getGmailConnection({ db, uid });
    if (!connection?.refreshToken) {
      throw new HttpsError('failed-precondition', 'No connected Gmail account for this user.');
    }

    const result = await runBackfillForUser({ db, uid, refreshToken: connection.refreshToken, clientSecret });
    return result;
  };
}

/**
 * @param {{ db: FirebaseFirestore.Firestore, uid: string, refreshToken: string, clientSecret: string }} params
 */
export async function runBackfillForUser({ db, uid, refreshToken, clientSecret }) {
  const { gmail } = getGmailClientForUser({ clientSecret, refreshToken });

  const existingSnap = await db.collection('users').doc(uid).collection('packages').get();
  const existingTrackingNumbers = new Set(
    existingSnap.docs
      .map((d) => d.data()?.trackingNumber)
      .filter(Boolean)
      .map((t) => String(t).toUpperCase())
  );

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `${DEFAULT_FORWARDING_FILTER_QUERY} newer_than:${BACKFILL_WINDOW_DAYS}d`,
    maxResults: MAX_MESSAGES
  });

  const messageRefs = listRes.data.messages || [];
  let saved = 0;
  let skipped = 0;

  for (const ref of messageRefs) {
    const msgRes = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' });
    const pkg = buildPackageFromGmailMessage({
      gmailMessage: msgRes.data,
      userId: uid,
      existingTrackingNumbers,
      skipDelivered: true
    });

    if (!pkg) {
      skipped += 1;
      continue;
    }

    await db.collection('users').doc(uid).collection('packages').doc(pkg.id).set(pkg);
    await db.collection('packages').doc(pkg.id).set(pkg);
    existingTrackingNumbers.add(pkg.trackingNumber.toUpperCase());
    saved += 1;
  }

  return { ok: true, scanned: messageRefs.length, saved, skipped };
}
