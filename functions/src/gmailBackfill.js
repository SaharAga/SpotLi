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
import {
  buildPackagesFromGmailMessageWithAiFallback,
  buildOrderStatusUpdateFromGmailMessage
} from './gmailPackageSync.js';
import { findExistingOrderMatch, isGenericPackageTitle } from './orderCorrelationService.js';
import { logUsageEvent } from './analyticsEvents.js';
import { isAutomatedSource } from './automatedSources.js';
import { GMAIL_AI_LIMITS, GMAIL_BACKFILL_LIMITS } from './config.js';
import { checkAndIncrementUsage } from './guards.js';

const BACKFILL_WINDOW_DAYS = 30;
const MAX_MESSAGES = 100;

/**
 * @param {{ db: FirebaseFirestore.Firestore, clientSecret: string, geminiApiKey?: string }} deps
 */
export function createGmailBackfillHandler({ db, clientSecret, geminiApiKey }) {
  return async function handler(request) {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    // This callable is reachable by any signed-in client directly, not only
    // through the UI's connect button — bound how often one user (or all
    // users combined) can re-trigger a full 30-day scan, independent of the
    // in-run AI-fallback budget below, since the Gmail API cost of the scan
    // itself is incurred regardless of whether AI fallback ever runs.
    const usage = await checkAndIncrementUsage(db, uid, {
      collection: 'gmailBackfillUsage',
      userLimit: GMAIL_BACKFILL_LIMITS.PER_USER_DAILY_CALLS,
      globalLimit: GMAIL_BACKFILL_LIMITS.GLOBAL_DAILY_CALLS
    });
    if (!usage.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        usage.reason === 'user-limit'
          ? 'Daily Gmail sync limit reached for this account. Please try again tomorrow.'
          : 'Gmail sync is temporarily at capacity. Please try again later.'
      );
    }

    const connection = await getGmailConnection({ db, uid });
    if (!connection?.refreshToken) {
      throw new HttpsError('failed-precondition', 'No connected Gmail account for this user.');
    }

    const result = await runBackfillForUser({ db, uid, refreshToken: connection.refreshToken, clientSecret, geminiApiKey });
    return result;
  };
}

/**
 * @param {{ db: FirebaseFirestore.Firestore, uid: string, refreshToken: string, clientSecret: string, geminiApiKey?: string }} params
 */
export async function runBackfillForUser({ db, uid, refreshToken, clientSecret, geminiApiKey }) {
  const { gmail } = getGmailClientForUser({ clientSecret, refreshToken });

  const existingSnap = await db.collection('users').doc(uid).collection('packages').get();
  const existingTrackingNumbers = new Set(
    existingSnap.docs
      .map((d) => d.data()?.trackingNumber)
      .filter(Boolean)
      .map((t) => String(t).toUpperCase())
  );
  // docId of each existing order-status (no-tracking-number) package, keyed
  // by store — lets a re-run update that package's status instead of
  // creating a second untracked card for the same store.
  const storeToOrderStatusDocId = new Map();
  const orderNumberToDocMap = new Map();
  for (const d of existingSnap.docs) {
    const data = d.data() || {};
    if (data.source === 'gmail_sync_order_status' && data.store) {
      storeToOrderStatusDocId.set(String(data.store).toUpperCase(), d.id);
    }
    if (data.orderNumber) {
      orderNumberToDocMap.set(String(data.orderNumber).trim(), { id: d.id, data });
    }
  }

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `${DEFAULT_FORWARDING_FILTER_QUERY} newer_than:${BACKFILL_WINDOW_DAYS}d`,
    maxResults: MAX_MESSAGES
  });

  const messageRefs = listRes.data.messages || [];
  if (messageRefs.length === 0) {
    return { ok: true, scanned: 0, saved: 0, skipped: 0 };
  }

  // Fetch messages in parallel chunks of 25 to reduce sequential network latency
  const CHUNK_SIZE = 25;
  const rawMessages = [];
  for (let i = 0; i < messageRefs.length; i += CHUNK_SIZE) {
    const chunk = messageRefs.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.allSettled(
      chunk.map((ref) => gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' }))
    );
    for (const res of chunkResults) {
      if (res.status === 'fulfilled' && res.value?.data) {
        rawMessages.push(res.value.data);
      }
    }
  }

  const packagesToSave = [];
  const orderStatusUpdates = [];
  // store -> index into packagesToSave, for order-status packages created
  // earlier in this same run (so a second email for the same store updates
  // that entry instead of adding a duplicate).
  const storeToNewPackageIndex = new Map();
  const orderNumberToNewPackageIndex = new Map();
  let skipped = 0;
  let aiResolved = 0;
  // Own budget for this single backfill run — on top of, not instead of,
  // the daily caps checked per-call inside resolveUnverifiedCandidateWithAi
  // — a 30-day historical scan is the single biggest burst this pipeline
  // sees (up to MAX_MESSAGES messages at once), so it needs a run-scoped
  // ceiling even on a day nothing else has touched the daily cap yet.
  const runBudget = geminiApiKey ? { used: 0, max: GMAIL_AI_LIMITS.MAX_AI_CALLS_PER_BACKFILL_RUN } : undefined;

  for (const msgData of rawMessages) {
    // A follow-up email (shipped / out for delivery / delivery issue) for a
    // store already represented by an order-status package — either one
    // already saved from a prior run, or one created earlier in this same
    // run — updates that package instead of creating another untracked card.
    const orderStatusUpdate = buildOrderStatusUpdateFromGmailMessage({ gmailMessage: msgData });
    if (orderStatusUpdate) {
      const storeKey = orderStatusUpdate.store.toUpperCase();
      const newIndex = storeToNewPackageIndex.get(storeKey);
      if (newIndex !== undefined) {
        packagesToSave[newIndex].status = orderStatusUpdate.status;
        packagesToSave[newIndex].title = orderStatusUpdate.title;
        packagesToSave[newIndex].updatedAt = new Date().toISOString();
        skipped += 1;
        continue;
      }
      const existingDocId = storeToOrderStatusDocId.get(storeKey);
      if (existingDocId) {
        orderStatusUpdates.push({
          docId: existingDocId,
          patch: { status: orderStatusUpdate.status, title: orderStatusUpdate.title, updatedAt: new Date().toISOString(), lastUpdateSource: 'gmail_sync_order_status' }
        });
        skipped += 1;
        continue;
      }
    }

    // eslint-disable-next-line no-await-in-loop
    const pkgs = await buildPackagesFromGmailMessageWithAiFallback({
      gmailMessage: msgData,
      userId: uid,
      existingTrackingNumbers,
      skipDelivered: true,
      ai: geminiApiKey ? { db, apiKey: geminiApiKey, runBudget } : undefined
    });

    if (!pkgs || pkgs.length === 0) {
      skipped += 1;
      continue;
    }

    for (const pkg of pkgs) {
      if (pkg.orderNumber) {
        // 1. Match against packages already in Firestore
        const match = findExistingOrderMatch(orderNumberToDocMap, pkg.orderNumber, pkg.trackingNumber);
        if (match.matchedDocId && !match.isMultiParcel) {
          const existingData = match.existingData || {};
          const patch = {
            updatedAt: new Date().toISOString(),
            lastUpdateSource: isAutomatedSource(pkg.source) ? pkg.source : 'gmail_sync',
            trackingNumber: pkg.trackingNumber,
            carrier: pkg.carrier,
            ...(pkg.status ? { status: pkg.status } : {}),
            ...(pkg.lockerPin && !existingData.lockerPin ? { lockerPin: pkg.lockerPin, pickupCode: pkg.lockerPin } : {}),
            ...(pkg.pickupLocation && !existingData.pickupLocation ? { pickupLocation: pkg.pickupLocation } : {}),
            ...(pkg.pickupHours && !existingData.pickupHours ? { pickupHours: pkg.pickupHours } : {}),
            ...(pkg.pickupPhone && !existingData.pickupPhone ? { pickupPhone: pkg.pickupPhone } : {}),
            ...(!isGenericPackageTitle(pkg.title) && isGenericPackageTitle(existingData.title) ? { title: pkg.title } : {})
          };
          orderStatusUpdates.push({ docId: match.matchedDocId, patch });
          if (pkg.trackingNumber) existingTrackingNumbers.add(pkg.trackingNumber.toUpperCase());
          orderNumberToDocMap.set(String(pkg.orderNumber).trim(), { id: match.matchedDocId, data: { ...existingData, ...patch } });
          skipped += 1;
          continue;
        }

        // 2. Match against packages created earlier in this same backfill run
        const cleanOrder = String(pkg.orderNumber).trim();
        const earlierIndex = orderNumberToNewPackageIndex.get(cleanOrder);
        if (earlierIndex !== undefined) {
          const earlierPkg = packagesToSave[earlierIndex];
          const earlierTn = earlierPkg.trackingNumber ? String(earlierPkg.trackingNumber).toUpperCase() : '';
          const incomingTn = pkg.trackingNumber ? String(pkg.trackingNumber).toUpperCase() : '';

          if (!earlierTn && incomingTn) {
            earlierPkg.trackingNumber = pkg.trackingNumber;
            earlierPkg.carrier = pkg.carrier;
            if (pkg.status) earlierPkg.status = pkg.status;
            if (pkg.lockerPin && !earlierPkg.lockerPin) earlierPkg.lockerPin = earlierPkg.pickupCode = pkg.lockerPin;
            if (pkg.pickupLocation && !earlierPkg.pickupLocation) earlierPkg.pickupLocation = pkg.pickupLocation;
            if (pkg.pickupHours && !earlierPkg.pickupHours) earlierPkg.pickupHours = pkg.pickupHours;
            if (pkg.pickupPhone && !earlierPkg.pickupPhone) earlierPkg.pickupPhone = pkg.pickupPhone;
            if (!isGenericPackageTitle(pkg.title) && isGenericPackageTitle(earlierPkg.title)) earlierPkg.title = pkg.title;
            earlierPkg.updatedAt = new Date().toISOString();
            if (pkg.trackingNumber) existingTrackingNumbers.add(pkg.trackingNumber.toUpperCase());
            skipped += 1;
            continue;
          }

          if (isGenericPackageTitle(pkg.title) && earlierPkg.title && !isGenericPackageTitle(earlierPkg.title)) {
            pkg.title = earlierPkg.title;
          }
        }

        if (match.isMultiParcel && isGenericPackageTitle(pkg.title) && match.existingData?.title && !isGenericPackageTitle(match.existingData.title)) {
          pkg.title = match.existingData.title;
        }
      }

      if (pkg.source === 'gmail_sync_ai') aiResolved += 1;
      if (pkg.source === 'gmail_sync_order_status' && pkg.store) {
        storeToNewPackageIndex.set(pkg.store.toUpperCase(), packagesToSave.length);
      }
      if (pkg.orderNumber) {
        orderNumberToNewPackageIndex.set(String(pkg.orderNumber).trim(), packagesToSave.length);
        orderNumberToDocMap.set(String(pkg.orderNumber).trim(), { id: pkg.id, data: pkg });
      }
      packagesToSave.push(pkg);
      if (pkg.trackingNumber) existingTrackingNumbers.add(pkg.trackingNumber.toUpperCase());
    }
  }

  // Atomic batch commit for all discovered packages plus any order-status
  // updates to packages that already existed before this run.
  if (packagesToSave.length > 0 || orderStatusUpdates.length > 0) {
    const batch = db.batch();
    for (const pkg of packagesToSave) {
      const userPkgRef = db.collection('users').doc(uid).collection('packages').doc(pkg.id);
      batch.set(userPkgRef, pkg);
    }
    for (const { docId, patch } of orderStatusUpdates) {
      batch.set(db.collection('users').doc(uid).collection('packages').doc(docId), patch, { merge: true });
      batch.set(db.collection('packages').doc(docId), patch, { merge: true });
    }
    await batch.commit();
  }

  await logUsageEvent(db, {
    feature: 'gmail_sync',
    type: 'backfill',
    uid,
    scanned: messageRefs.length,
    saved: packagesToSave.length,
    skipped,
    aiResolved
  });

  return { ok: true, scanned: messageRefs.length, saved: packagesToSave.length, skipped };
}
