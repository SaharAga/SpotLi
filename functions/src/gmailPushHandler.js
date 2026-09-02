/**
 * Pub/Sub push endpoint Gmail's `users.watch()` notifications land on.
 *
 * Pub/Sub POSTs a JSON envelope: `{ message: { data: base64(...), ... },
 * subscription }`. The decoded `data` is `{ emailAddress, historyId }` —
 * Gmail doesn't push message content, just "something changed, look here".
 *
 * Auth: this endpoint is protected by a shared-secret query param
 * (`?token=...` checked against the GMAIL_OAUTH_CLIENT_SECRET-derived
 * value below) configured on the Pub/Sub push subscription's endpoint URL.
 * This is documented as the simpler of the two options in the setup
 * checklist; the more robust alternative — configuring the push
 * subscription with OIDC authentication and verifying the token audience/
 * issuer here — is noted there too for anyone who wants to upgrade it.
 * Either way, Cloud Functions' onRequest already sits behind HTTPS, so this
 * is defense against a stranger discovering the URL and forging events, not
 * against network eavesdropping.
 */

import { findGmailConnectionByEmail, getGmailClientForUser, setGmailConnection } from './gmailAuth.js';
import {
  buildPackageFromGmailMessageWithAiFallback,
  buildStatusUpdateFromGmailMessage,
  buildOrderStatusUpdateFromGmailMessage
} from './gmailPackageSync.js';
import { logUsageEvent } from './analyticsEvents.js';

/**
 * @param {{ db: FirebaseFirestore.Firestore, clientSecret: string, pushToken: string, geminiApiKey?: string }} deps
 */
export function createGmailPushHandler({ db, clientSecret, pushToken, geminiApiKey }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    if (pushToken && req.query.token !== pushToken) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const messageData = req.body?.message?.data;
      if (!messageData) {
        // Ack anyway so Pub/Sub doesn't keep redelivering a malformed message.
        res.status(200).send('ok');
        return;
      }

      const decoded = JSON.parse(Buffer.from(messageData, 'base64').toString('utf8'));
      const { emailAddress, historyId: newHistoryId } = decoded;

      const connection = await findGmailConnectionByEmail({ db, emailAddress });
      if (!connection?.refreshToken) {
        // Unknown or disconnected account — ack and drop.
        res.status(200).send('ok');
        return;
      }

      await syncHistoryForConnection({ db, connection, clientSecret, newHistoryId, geminiApiKey });

      res.status(200).send('ok');
    } catch (err) {
      console.error('[gmailPushHandler] Error processing push notification:', err);
      // Still 200 — a transient failure shouldn't cause Pub/Sub to hammer
      // retries indefinitely; the next watch renewal / push will catch up.
      res.status(200).send('ok');
    }
  };
}

/**
 * Pulls history since the stored historyId, saves any new matching
 * packages, and advances the stored historyId.
 * @param {{ db: FirebaseFirestore.Firestore, connection: object, clientSecret: string, newHistoryId: string|number, geminiApiKey?: string }} params
 */
export async function syncHistoryForConnection({ db, connection, clientSecret, newHistoryId, geminiApiKey }) {
  const { uid, refreshToken, historyId: storedHistoryId } = connection;
  const { gmail } = getGmailClientForUser({ clientSecret, refreshToken });

  if (!storedHistoryId) {
    // Nothing to diff against yet — just fast-forward.
    await setGmailConnection({ db, uid, data: { historyId: String(newHistoryId) } });
    return { saved: 0 };
  }

  let messageIds = [];
  try {
    let pageToken;
    do {
      const historyRes = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: storedHistoryId,
        historyTypes: ['messageAdded'],
        pageToken
      });
      for (const h of historyRes.data.history || []) {
        for (const added of h.messagesAdded || []) {
          if (added.message?.id) messageIds.push(added.message.id);
        }
      }
      pageToken = historyRes.data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    // startHistoryId too old (expired) — Gmail returns 404. Just
    // fast-forward to the new historyId; we'll miss anything in between,
    // which is an acceptable gap for a push-driven sync (the 30-day
    // backfill already covers the bulk case, and this only happens after
    // extended downtime).
    if (err?.code === 404 || err?.response?.status === 404) {
      await setGmailConnection({ db, uid, data: { historyId: String(newHistoryId) } });
      return { saved: 0, historyExpired: true };
    }
    throw err;
  }

  const existingSnap = await db.collection('users').doc(uid).collection('packages').get();
  const trackingNumberToDocId = new Map();
  const storeToOrderStatusDocId = new Map();
  for (const d of existingSnap.docs) {
    const data = d.data() || {};
    if (data.trackingNumber) trackingNumberToDocId.set(String(data.trackingNumber).toUpperCase(), d.id);
    if (data.source === 'gmail_sync_order_status' && data.store) {
      storeToOrderStatusDocId.set(String(data.store).toUpperCase(), d.id);
    }
  }
  const existingTrackingNumbers = new Set(trackingNumberToDocId.keys());

  // One shared budget across this whole push batch (not per-message) so a
  // single burst of history can't run through the entire daily AI cap by
  // itself — see GMAIL_AI_LIMITS.MAX_AI_CALLS_PER_BACKFILL_RUN's rationale
  // in config.js, applied here to a push batch instead of a backfill run.
  const runBudget = geminiApiKey ? { used: 0, max: 5 } : undefined;

  let saved = 0;
  let updated = 0;
  let aiResolved = 0;
  for (const messageId of messageIds) {
    const msgRes = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });

    // A message about a tracking number we already have is a status
    // follow-up (e.g. "out for delivery"), not a new package — update the
    // existing one instead of dropping the message as a duplicate.
    const statusUpdate = buildStatusUpdateFromGmailMessage({ gmailMessage: msgRes.data });
    if (statusUpdate && trackingNumberToDocId.has(statusUpdate.trackingNumber)) {
      const docId = trackingNumberToDocId.get(statusUpdate.trackingNumber);
      const patch = { status: statusUpdate.status, updatedAt: new Date().toISOString() };
      await db.collection('users').doc(uid).collection('packages').doc(docId).set(patch, { merge: true });
      await db.collection('packages').doc(docId).set(patch, { merge: true });
      updated += 1;
      continue;
    }

    // A follow-up email for a store we already have an order-status
    // (no-tracking-number) package from — update that one package instead of
    // spawning a new untracked card for every "shipped"/"out for delivery"/
    // "delivery issue" email in the same order's lifecycle.
    const orderStatusUpdate = buildOrderStatusUpdateFromGmailMessage({ gmailMessage: msgRes.data });
    if (orderStatusUpdate && storeToOrderStatusDocId.has(orderStatusUpdate.store.toUpperCase())) {
      const docId = storeToOrderStatusDocId.get(orderStatusUpdate.store.toUpperCase());
      const patch = { status: orderStatusUpdate.status, title: orderStatusUpdate.title, updatedAt: new Date().toISOString() };
      await db.collection('users').doc(uid).collection('packages').doc(docId).set(patch, { merge: true });
      await db.collection('packages').doc(docId).set(patch, { merge: true });
      updated += 1;
      continue;
    }

    const pkg = await buildPackageFromGmailMessageWithAiFallback({
      gmailMessage: msgRes.data,
      userId: uid,
      existingTrackingNumbers,
      ai: geminiApiKey ? { db, apiKey: geminiApiKey, runBudget } : undefined
    });
    if (!pkg) continue;

    await db.collection('users').doc(uid).collection('packages').doc(pkg.id).set(pkg);
    await db.collection('packages').doc(pkg.id).set(pkg);
    if (pkg.trackingNumber) {
      existingTrackingNumbers.add(pkg.trackingNumber.toUpperCase());
      trackingNumberToDocId.set(pkg.trackingNumber.toUpperCase(), pkg.id);
    }
    if (pkg.source === 'gmail_sync_order_status' && pkg.store) {
      storeToOrderStatusDocId.set(pkg.store.toUpperCase(), pkg.id);
    }
    saved += 1;
    if (pkg.source === 'gmail_sync_ai') aiResolved += 1;
  }

  await setGmailConnection({ db, uid, data: { historyId: String(newHistoryId) } });
  await logUsageEvent(db, {
    feature: 'gmail_sync',
    type: 'push_sync',
    uid,
    messagesScanned: messageIds.length,
    saved,
    updated,
    aiResolved
  });
  return { saved, updated };
}
