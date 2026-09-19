/**
 * Reports whether the signed-in caller has an active Gmail connection.
 *
 * `gmailConnections/{uid}` holds a refresh token and is deliberately
 * unreadable from the client SDK (see firestore.rules) — this is the only
 * sanctioned way for the client to learn "is Gmail connected," and it never
 * returns the refresh token itself.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { getGmailConnectionsForUser } from './gmailAuth.js';

/**
 * @param {{ db: FirebaseFirestore.Firestore }} deps
 */
export function createGmailConnectionStatusHandler({ db }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const connections = await getGmailConnectionsForUser({ db, uid });
    const activeConnections = (connections || []).filter((c) => (c.status === undefined || c.status === 'active') && c.refreshToken);

    if (activeConnections.length === 0) {
      return { connected: false };
    }

    const accounts = activeConnections.map((c) => ({
      email: c.emailAddress || null,
      emailAddress: c.emailAddress || null,
      connectedAt: c.connectedAt || null,
      status: c.status || 'active',
      lastRenewalError: c.lastRenewalError || null
    }));

    const primary = accounts[0];

    return {
      connected: true,
      emailAddress: primary.emailAddress,
      connectedAt: primary.connectedAt,
      lastRenewalError: primary.lastRenewalError,
      accounts
    };
  };
}
