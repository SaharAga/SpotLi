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
 * Sanitizes an email address for use in Firestore document IDs.
 * @param {string} email
 * @returns {string}
 */
export function sanitizeEmailForDocId(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
}

/**
 * Returns compound doc ID `${uid}__${sanitizedEmail}` or fallback `uid`.
 * @param {string} uid
 * @param {string} [emailAddress]
 * @returns {string}
 */
export function getConnectionDocId(uid, emailAddress) {
  if (!emailAddress) return uid;
  return `${uid}__${sanitizeEmailForDocId(emailAddress)}`;
}

/**
 * Reads a user's stored Gmail connection doc. If emailAddress is provided,
 * looks up that specific connection. Otherwise returns the legacy doc or the
 * first active connection found.
 * @param {{ db: FirebaseFirestore.Firestore, uid: string, emailAddress?: string }} params
 */
export async function getGmailConnection({ db, uid, emailAddress }) {
  if (emailAddress) {
    const targetEmail = String(emailAddress).trim().toLowerCase();
    const docId = getConnectionDocId(uid, targetEmail);
    const snap = await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(docId).get();
    if (snap.exists) {
      const data = snap.data();
      return { connectionId: snap.id, uid: data?.uid || uid, ...data };
    }
    const connections = await getGmailConnectionsForUser({ db, uid });
    const match = connections.find((c) => c.emailAddress?.toLowerCase() === targetEmail);
    if (match) return match;
  }

  // Check legacy doc keyed by uid
  const legacySnap = await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(uid).get();
  if (legacySnap.exists && legacySnap.data()?.refreshToken) {
    const data = legacySnap.data();
    return { connectionId: legacySnap.id, uid: data?.uid || uid, ...data };
  }

  // Return first active connection from multi-account query
  const connections = await getGmailConnectionsForUser({ db, uid });
  const active = connections.find((c) => c.status === 'active' && c.refreshToken) || connections[0];
  return active || null;
}

/**
 * Returns all stored Gmail connections for a user, checking both compound
 * docs (where uid == uid) and legacy docs (keyed directly by uid).
 * @param {{ db: FirebaseFirestore.Firestore, uid: string }} params
 * @returns {Promise<Array<object>>}
 */
export async function getGmailConnectionsForUser({ db, uid }) {
  const colRef = db.collection(GMAIL_CONNECTIONS_COLLECTION);
  const connections = [];
  const seenEmails = new Set();

  if (typeof colRef.where === 'function') {
    try {
      const snap = await colRef.where('uid', '==', uid).get();
      for (const doc of snap.docs || []) {
        const data = typeof doc.data === 'function' ? doc.data() : doc.data;
        const email = data?.emailAddress ? data.emailAddress.toLowerCase() : null;
        if (email) seenEmails.add(email);
        connections.push({ connectionId: doc.id, uid, ...data });
      }
    } catch (err) {
      console.warn('[getGmailConnectionsForUser] where query failed, falling back:', err?.message || err);
    }
  }

  // Check legacy doc keyed by uid
  if (typeof colRef.doc === 'function') {
    try {
      const legacySnap = await colRef.doc(uid).get();
      if (legacySnap.exists) {
        const legacyData = typeof legacySnap.data === 'function' ? legacySnap.data() : legacySnap.data;
        const legacyEmail = legacyData?.emailAddress ? legacyData.emailAddress.toLowerCase() : null;
        if (!legacyEmail || !seenEmails.has(legacyEmail)) {
          connections.push({ connectionId: legacySnap.id, uid, ...legacyData });
        }
      }
    } catch {
      // Ignore if doc lookup fails
    }
  }

  return connections;
}

/**
 * Creates/updates a user's stored Gmail connection doc.
 * Keyed by connectionId, or compound docId derived from emailAddress, or legacy uid.
 * @param {{ db: FirebaseFirestore.Firestore, uid: string, connectionId?: string, data: object }} params
 */
export async function setGmailConnection({ db, uid, connectionId, data }) {
  const email = data?.emailAddress;
  const docId = connectionId || (email ? getConnectionDocId(uid, email) : uid);
  const payload = {
    ...data,
    uid: uid || data?.uid
  };
  if (!payload.uid && docId && !docId.includes('__')) {
    payload.uid = docId;
  }
  await db
    .collection(GMAIL_CONNECTIONS_COLLECTION)
    .doc(docId)
    .set(payload, { merge: true });
  return docId;
}

/**
 * Deletes a user's stored Gmail connection doc.
 * Can delete a specific connection by connectionId or emailAddress, or all connections for uid.
 * @param {{ db: FirebaseFirestore.Firestore, uid: string, emailAddress?: string, connectionId?: string }} params
 */
export async function deleteGmailConnection({ db, uid, emailAddress, connectionId }) {
  if (connectionId) {
    await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(connectionId).delete();
    return;
  }

  if (emailAddress && emailAddress !== 'all') {
    const targetEmail = String(emailAddress).trim().toLowerCase();
    const docId = getConnectionDocId(uid, targetEmail);
    await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(docId).delete();
    try {
      const legacySnap = await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(uid).get();
      if (legacySnap.exists && legacySnap.data()?.emailAddress?.toLowerCase() === targetEmail) {
        await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(uid).delete();
      }
    } catch {
      // Non-fatal
    }
    return;
  }

  // Delete all connections for user
  const connections = await getGmailConnectionsForUser({ db, uid });
  if (typeof db.batch === 'function') {
    const batch = db.batch();
    for (const conn of connections) {
      if (conn.connectionId) {
        batch.delete(db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(conn.connectionId));
      }
    }
    batch.delete(db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(uid));
    await batch.commit();
  } else {
    for (const conn of connections) {
      if (conn.connectionId) {
        await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(conn.connectionId).delete();
      }
    }
    await db.collection(GMAIL_CONNECTIONS_COLLECTION).doc(uid).delete();
  }
}

/**
 * Finds a connection by the connected Gmail address — used by the Pub/Sub
 * push handler, which only receives `emailAddress` + `historyId`, not a uid.
 * @param {{ db: FirebaseFirestore.Firestore, emailAddress: string }} params
 */
export async function findGmailConnectionByEmail({ db, emailAddress }) {
  const colRef = db.collection(GMAIL_CONNECTIONS_COLLECTION);
  let snap = await colRef
    .where('emailAddress', '==', emailAddress)
    .limit(1)
    .get();
  if (snap.empty && emailAddress !== emailAddress.toLowerCase()) {
    snap = await colRef
      .where('emailAddress', '==', emailAddress.toLowerCase())
      .limit(1)
      .get();
  }
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = typeof doc.data === 'function' ? doc.data() : doc.data;
  return { connectionId: doc.id, uid: data?.uid || doc.id, ...data };
}
