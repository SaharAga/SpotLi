/**
 * Reports whether the signed-in caller has an active Gmail connection.
 *
 * `gmailConnections/{uid}` holds a refresh token and is deliberately
 * unreadable from the client SDK (see firestore.rules) — this is the only
 * sanctioned way for the client to learn "is Gmail connected," and it never
 * returns the refresh token itself.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { getGmailConnection } from './gmailAuth.js';

/**
 * @param {{ db: FirebaseFirestore.Firestore }} deps
 */
export function createGmailConnectionStatusHandler({ db }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const connection = await getGmailConnection({ db, uid });
    if (!connection?.refreshToken) {
      return { connected: false };
    }

    return {
      connected: true,
      emailAddress: connection.emailAddress || null,
      connectedAt: connection.connectedAt || null
    };
  };
}
