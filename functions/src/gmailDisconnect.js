/**
 * Disconnects a user's Gmail connection: revokes the stored refresh token
 * with Google, cancels the watch subscription, and deletes the
 * gmailConnections/{uid} doc.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import {
  getGmailConnection,
  getGmailConnectionsForUser,
  getGmailClientForUser,
  deleteGmailConnection
} from './gmailAuth.js';

/**
 * @param {{ db: FirebaseFirestore.Firestore, clientSecret: string }} deps
 */
export function createGmailDisconnectHandler({ db, clientSecret }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const targetEmail = request.data?.emailAddress ? String(request.data.emailAddress).trim() : null;
    const isDisconnectAll = !targetEmail || targetEmail === 'all';

    if (isDisconnectAll) {
      const connections = await getGmailConnectionsForUser({ db, uid });
      for (const connection of connections) {
        if (connection.refreshToken) {
          const { gmail, oauth2Client } = getGmailClientForUser({
            clientSecret,
            refreshToken: connection.refreshToken
          });
          try {
            await gmail.users.stop({ userId: 'me' });
          } catch (err) {
            console.warn(`[gmailDisconnect] users.stop failed for ${connection.emailAddress} (continuing):`, err?.message || err);
          }
          try {
            await oauth2Client.revokeToken(connection.refreshToken);
          } catch (err) {
            console.warn(`[gmailDisconnect] token revoke failed for ${connection.emailAddress} (continuing):`, err?.message || err);
          }
        }
      }
      await deleteGmailConnection({ db, uid, emailAddress: 'all' });
      return { ok: true };
    }

    // Disconnect a specific mailbox
    const connection = await getGmailConnection({ db, uid, emailAddress: targetEmail });
    if (connection?.refreshToken) {
      const { gmail, oauth2Client } = getGmailClientForUser({
        clientSecret,
        refreshToken: connection.refreshToken
      });
      try {
        await gmail.users.stop({ userId: 'me' });
      } catch (err) {
        console.warn(`[gmailDisconnect] users.stop failed for ${targetEmail} (continuing):`, err?.message || err);
      }
      try {
        await oauth2Client.revokeToken(connection.refreshToken);
      } catch (err) {
        console.warn(`[gmailDisconnect] token revoke failed for ${targetEmail} (continuing):`, err?.message || err);
      }
    }

    await deleteGmailConnection({ db, uid, emailAddress: targetEmail, connectionId: connection?.connectionId });

    return { ok: true };
  };
}
