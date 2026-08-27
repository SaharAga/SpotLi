/**
 * Disconnects a user's Gmail connection: revokes the stored refresh token
 * with Google, cancels the watch subscription, and deletes the
 * gmailConnections/{uid} doc.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { getGmailConnection, getGmailClientForUser, deleteGmailConnection } from './gmailAuth.js';

/**
 * @param {{ db: FirebaseFirestore.Firestore, clientSecret: string }} deps
 */
export function createGmailDisconnectHandler({ db, clientSecret }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const connection = await getGmailConnection({ db, uid });
    if (!connection?.refreshToken) {
      // Nothing to disconnect — treat as success (idempotent).
      return { ok: true };
    }

    const { gmail, oauth2Client } = getGmailClientForUser({
      clientSecret,
      refreshToken: connection.refreshToken
    });

    try {
      await gmail.users.stop({ userId: 'me' });
    } catch (err) {
      console.warn('[gmailDisconnect] users.stop failed (continuing):', err?.message || err);
    }

    try {
      await oauth2Client.revokeToken(connection.refreshToken);
    } catch (err) {
      console.warn('[gmailDisconnect] token revoke failed (continuing):', err?.message || err);
    }

    await deleteGmailConnection({ db, uid });

    return { ok: true };
  };
}
