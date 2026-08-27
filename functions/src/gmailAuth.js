/**
 * Gmail OAuth2 client factory and Firestore accessors for the
 * `gmailConnections/{uid}` collection.
 *
 * This module is the only place that touches Gmail OAuth credentials.
 * `gmailConnections` docs hold a refresh token and must never be read or
 * written from the client SDK — see the explicit deny rule in
 * firestore.rules — only Cloud Functions using firebase-admin (which
 * bypasses rules) may touch this collection.
 */

import { google } from 'googleapis';
import { defineSecret } from 'firebase-functions/params';

/** Firebase secret holding the Google Cloud OAuth client secret. */
export const gmailOAuthClientSecret = defineSecret('GMAIL_OAUTH_CLIENT_SECRET');

/** Read access only — no forwarding-rule creation, no mailbox mutation. */
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export const GMAIL_CONNECTIONS_COLLECTION = 'gmailConnections';

/**
 * Builds an OAuth2Client for the Gmail auth-code flow.
 * @param {{ clientSecret: string }} deps
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
export function createOAuth2Client({ clientSecret }) {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const appBaseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const redirectUri = deriveRedirectUri(appBaseUrl);
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * The OAuth callback is itself a Cloud Function, not a route on APP_BASE_URL
 * — its real deployed URL is only known at deploy time. Deployers should set
 * GMAIL_OAUTH_REDIRECT_URI explicitly to the deployed gmailOAuthCallback
 * function URL; this falls back to a best-effort guess from APP_BASE_URL's
 * project for local/dev convenience only.
 * @param {string} appBaseUrl
 */
function deriveRedirectUri(appBaseUrl) {
  if (process.env.GMAIL_OAUTH_REDIRECT_URI) return process.env.GMAIL_OAUTH_REDIRECT_URI;
  return `${appBaseUrl}/gmailOAuthCallback`;
}

/**
 * Returns a Gmail API client authorized with a user's stored refresh token,
 * refreshing the access token as needed.
 * @param {{ clientSecret: string, refreshToken: string }} params
 */
export function getGmailClientForUser({ clientSecret, refreshToken }) {
  const oauth2Client = createOAuth2Client({ clientSecret });
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return { gmail: google.gmail({ version: 'v1', auth: oauth2Client }), oauth2Client };
}

/**
 * Reads a user's stored Gmail connection doc.
 * @param {{ db: FirebaseFirestore.Firestore, uid: string }} params
 */
export async function getGmailConnection({ db, uid }) {
  const snap = await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(uid).get();
  return snap.exists ? snap.data() : null;
}

/**
 * Creates/updates a user's stored Gmail connection doc.
 * @param {{ db: FirebaseFirestore.Firestore, uid: string, data: object }} params
 */
export async function setGmailConnection({ db, uid, data }) {
  await db
    .collection(GMAIL_CONNECTIONS_COLLECTION)
    .doc(uid)
    .set(data, { merge: true });
}

/**
 * Deletes a user's stored Gmail connection doc.
 * @param {{ db: FirebaseFirestore.Firestore, uid: string }} params
 */
export async function deleteGmailConnection({ db, uid }) {
  await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(uid).delete();
}

/**
 * Finds a connection by the connected Gmail address — used by the Pub/Sub
 * push handler, which only receives `emailAddress` + `historyId`, not a uid.
 * @param {{ db: FirebaseFirestore.Firestore, emailAddress: string }} params
 */
export async function findGmailConnectionByEmail({ db, emailAddress }) {
  const snap = await db
    .collection(GMAIL_CONNECTIONS_COLLECTION)
    .where('emailAddress', '==', emailAddress)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, ...doc.data() };
}
