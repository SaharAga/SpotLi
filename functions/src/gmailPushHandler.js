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
  buildPackagesFromGmailMessageWithAiFallback,
  buildStatusUpdateFromGmailMessage,
  buildOrderStatusUpdateFromGmailMessage,
  shouldAdvanceStatus
} from './gmailPackageSync.js';
import { logUsageEvent } from './analyticsEvents.js';
import { isAutomatedSource } from './automatedSources.js';
import { safeCompareTokens } from './inboundEmailHandler.js';
import {
  findExistingOrderMatch,
  isGenericPackageTitle,
  isValidOrderNumber,
  fetchOrderConfirmationTitleFromGmail
} from './orderCorrelationService.js';

/**
 * @param {{ db: FirebaseFirestore.Firestore, clientSecret: string, pushToken: string, geminiApiKey?: string }} deps
 */
export function createGmailPushHandler({ db, clientSecret, pushToken, geminiApiKey }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    if (!pushToken || !req.query?.token || !safeCompareTokens(req.query.token, pushToken)) {
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
  const existingPackagesMap = new Map();
  const storeToOrderStatusDocId = new Map();
  const orderNumberToDocMap = new Map();
  for (const d of existingSnap.docs) {
    const data = d.data() || {};
    if (data.trackingNumber) {
      const tn = String(data.trackingNumber).toUpperCase();
      trackingNumberToDocId.set(tn, d.id);
      existingPackagesMap.set(tn, data);
    }
    if (data.source === 'gmail_sync_order_status' && data.store) {
      storeToOrderStatusDocId.set(String(data.store).toUpperCase(), { id: d.id, status: data.status });
    }
    if (data.orderNumber) {
      orderNumberToDocMap.set(String(data.orderNumber).trim(), { id: d.id, data });
    }
  }
  const existingTrackingNumbers = new Set(trackingNumberToDocId.keys());
  const crossLookupBudget = { used: 0, max: 2 };

  // One shared budget across this whole push batch (not per-message) so a
  // single burst of history can't run through the entire daily AI cap by
  // itself — see GMAIL_AI_LIMITS.MAX_AI_CALLS_PER_BACKFILL_RUN's rationale
  // in config.js, applied here to a push batch instead of a backfill run.
  const runBudget = geminiApiKey ? { used: 0, max: 5 } : undefined;

  let saved = 0;
  let updated = 0;
  let aiResolved = 0;
  for (const messageId of messageIds) {
    let msgRes;
    try {
      msgRes = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    } catch (err) {
      const status = err?.code || err?.status || err?.response?.status;
      if (status === 404 || status === 410) {
        console.warn(`[gmailPushHandler] Skipping message ${messageId} (status: ${status})`);
        continue;
      }
      throw err;
    }

    if (!msgRes?.data) continue;

    // A message about a tracking number we already have is a status
    // follow-up (e.g. "out for delivery"), not a new package — update the
    // existing one instead of dropping the message as a duplicate.
    const statusUpdate = buildStatusUpdateFromGmailMessage({ gmailMessage: msgRes.data });
    if (statusUpdate && trackingNumberToDocId.has(statusUpdate.trackingNumber)) {
      const docId = trackingNumberToDocId.get(statusUpdate.trackingNumber);
      const existingData = existingPackagesMap.get(statusUpdate.trackingNumber) || {};
      const patch = { updatedAt: new Date().toISOString(), lastUpdateSource: 'gmail_sync' };

      if (shouldAdvanceStatus(existingData.status, statusUpdate.status)) {
        patch.status = statusUpdate.status;
      }
      if (statusUpdate.lockerPin && !existingData.lockerPin) {
        patch.lockerPin = statusUpdate.lockerPin;
      }
      if (statusUpdate.pickupCode && !existingData.pickupCode) {
        patch.pickupCode = statusUpdate.pickupCode;
      }
      if (statusUpdate.pickupLocation && (!existingData.pickupLocation || statusUpdate.isRedirected)) {
        patch.pickupLocation = statusUpdate.pickupLocation;
      }
      if (statusUpdate.pickupHours && !existingData.pickupHours) {
        patch.pickupHours = statusUpdate.pickupHours;
      }
      if (statusUpdate.pickupPhone && !existingData.pickupPhone) {
        patch.pickupPhone = statusUpdate.pickupPhone;
      }
      if (statusUpdate.isRedirected) {
        patch.isRedirected = true;
        if (statusUpdate.originalPickupLocation || existingData.pickupLocation) {
          patch.originalPickupLocation = statusUpdate.originalPickupLocation || existingData.pickupLocation;
        }
        if (statusUpdate.redirectReason) {
          patch.redirectReason = statusUpdate.redirectReason;
        }
      }

      await db.collection('users').doc(uid).collection('packages').doc(docId).set(patch, { merge: true });
      existingPackagesMap.set(statusUpdate.trackingNumber, { ...existingData, ...patch });
      updated += 1;
      continue;
    }

    // A follow-up email for a store we already have an order-status
    // (no-tracking-number) package from — update that one package instead of
    // spawning a new untracked card for every "shipped"/"out for delivery"/
    // "delivery issue" email in the same order's lifecycle.
    const orderStatusUpdate = buildOrderStatusUpdateFromGmailMessage({ gmailMessage: msgRes.data });
    if (orderStatusUpdate && storeToOrderStatusDocId.has(orderStatusUpdate.store.toUpperCase())) {
      const existing = storeToOrderStatusDocId.get(orderStatusUpdate.store.toUpperCase());
      const patch = { title: orderStatusUpdate.title, updatedAt: new Date().toISOString(), lastUpdateSource: 'gmail_sync_order_status' };
      if (shouldAdvanceStatus(existing.status, orderStatusUpdate.status)) {
        patch.status = orderStatusUpdate.status;
      }
      await db.collection('users').doc(uid).collection('packages').doc(existing.id).set(patch, { merge: true });
      storeToOrderStatusDocId.set(orderStatusUpdate.store.toUpperCase(), { ...existing, ...patch });
      updated += 1;
      continue;
    }

    const pkgs = await buildPackagesFromGmailMessageWithAiFallback({
      gmailMessage: msgRes.data,
      userId: uid,
      existingTrackingNumbers,
      ai: geminiApiKey ? { db, apiKey: geminiApiKey, runBudget } : undefined
    });
    if (!pkgs || pkgs.length === 0) continue;

    for (const pkg of pkgs) {
      // 1. Tier 1: In-Memory Order Match (95%+ Fast Path)
      if (pkg.orderNumber) {
        const match = findExistingOrderMatch(orderNumberToDocMap, pkg.orderNumber, pkg.trackingNumber);
        if (match.matchedDocId && !match.isMultiParcel) {
          const existingDocId = match.matchedDocId;
          const existingData = match.existingData || {};
          const patch = {
            updatedAt: new Date().toISOString(),
            lastUpdateSource: isAutomatedSource(pkg.source) ? pkg.source : 'gmail_sync',
            trackingNumber: pkg.trackingNumber,
            carrier: pkg.carrier,
            ...(pkg.status && shouldAdvanceStatus(existingData.status, pkg.status) ? { status: pkg.status } : {}),
            ...(pkg.lockerPin && !existingData.lockerPin ? { lockerPin: pkg.lockerPin, pickupCode: pkg.lockerPin } : {}),
            ...(pkg.pickupLocation && !existingData.pickupLocation ? { pickupLocation: pkg.pickupLocation } : {}),
            ...(pkg.pickupHours && !existingData.pickupHours ? { pickupHours: pkg.pickupHours } : {}),
            ...(pkg.pickupPhone && !existingData.pickupPhone ? { pickupPhone: pkg.pickupPhone } : {}),
            ...(!isGenericPackageTitle(pkg.title) && isGenericPackageTitle(existingData.title) ? { title: pkg.title } : {})
          };
          await db.collection('users').doc(uid).collection('packages').doc(existingDocId).set(patch, { merge: true });
          if (pkg.trackingNumber) {
            existingTrackingNumbers.add(pkg.trackingNumber.toUpperCase());
            trackingNumberToDocId.set(pkg.trackingNumber.toUpperCase(), existingDocId);
            existingPackagesMap.set(pkg.trackingNumber.toUpperCase(), { ...existingData, ...patch });
          }
          orderNumberToDocMap.set(String(pkg.orderNumber).trim(), { id: existingDocId, data: { ...existingData, ...patch } });
          updated += 1;
          continue;
        }
      }

      // 2. Tier 2: On-Demand Gmail Confirmation Search Fallback (Only when missing from DB & title is generic)
      if (isGenericPackageTitle(pkg.title) && isValidOrderNumber(pkg.orderNumber) && crossLookupBudget.used < crossLookupBudget.max) {
        const foundTitle = await fetchOrderConfirmationTitleFromGmail({
          gmail,
          orderNumber: pkg.orderNumber,
          store: pkg.store,
          budget: crossLookupBudget
        });
        if (foundTitle) {
          pkg.title = pkg.store ? `${pkg.store} - ${foundTitle}` : foundTitle;
        }
      }

      await db.collection('users').doc(uid).collection('packages').doc(pkg.id).set(pkg);
      if (pkg.trackingNumber) {
        existingTrackingNumbers.add(pkg.trackingNumber.toUpperCase());
        trackingNumberToDocId.set(pkg.trackingNumber.toUpperCase(), pkg.id);
        existingPackagesMap.set(pkg.trackingNumber.toUpperCase(), pkg);
      }
      if (pkg.orderNumber) {
        orderNumberToDocMap.set(String(pkg.orderNumber).trim(), { id: pkg.id, data: pkg });
      }
      if (pkg.source === 'gmail_sync_order_status' && pkg.store) {
        storeToOrderStatusDocId.set(pkg.store.toUpperCase(), { id: pkg.id, status: pkg.status });
      }
      saved += 1;
      if (pkg.source === 'gmail_sync_ai') aiResolved += 1;
    }
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
