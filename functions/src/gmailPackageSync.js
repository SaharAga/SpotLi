/**
 * Pure logic shared by the Gmail backfill (gmailBackfill.js) and the
 * real-time push handler (gmailPushHandler.js): turning a raw Gmail message
 * into a package record, and deciding whether it's a duplicate of one the
 * user already has.
 */

import {
  extractTrackingDetails,
  extractAllTrackingDetails,
  sanitizeEmailHtml,
  inferDeliveryStatus,
  extractOrderStatusDetails,
  shouldAdvanceStatus
} from './trackingExtraction.js';
import { resolveUnverifiedCandidateWithAi } from './gmailAiFallback.js';

export { shouldAdvanceStatus };

/**
 * Rough "looks already delivered" heuristic for backfill — mirrors the
 * status strings written by other ingestion paths, so a delivered order
 * doesn't get re-created as brand-new "ordered".
 * @param {string} subject
 * @param {string} body
 */
export function looksAlreadyDelivered(subject = '', body = '') {
  const text = `${subject} ${body}`.toLowerCase();
  return (
    /\bdelivered\b/.test(text) ||
    /נמסרה בהצלחה/.test(text) ||
    /נמסר ליעד/.test(text) ||
    /החבילה נמסרה/.test(text)
  );
}

/**
 * Helper to check duplicate tracking numbers (case-insensitive).
 * @param {Set<string>} existingTrackingNumbers
 * @param {string} candidate
 * @returns {boolean}
 */
export function isDuplicateTrackingNumber(existingTrackingNumbers, candidate) {
  if (!candidate || !existingTrackingNumbers) return false;
  return existingTrackingNumbers.has(candidate.toUpperCase());
}

/**
 * Extracts subject, plain text body, sender email, and optional raw HTML from a Gmail message resource.
 * @param {object} message
 * @returns {{ subject: string, body: string, from: string, html: string }}
 */
export function extractSubjectAndBodyFromGmailMessage(message) {
  if (!message || !message.payload) {
    return { subject: '', body: '', from: '', html: '' };
  }

  let subject = '';
  let from = '';
  const headers = message.payload.headers || [];
  for (const h of headers) {
    if (h.name && h.name.toLowerCase() === 'subject') {
      subject = h.value || '';
    }
    if (h.name && h.name.toLowerCase() === 'from') {
      from = h.value || '';
    }
  }

  let bodyText = '';
  let htmlText = '';

  function traverseParts(part) {
    if (!part) return;

    if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      try {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf8');
        bodyText += `\n${decoded}`;
      } catch (err) {
        console.warn('[gmailPackageSync] Failed to decode text/plain part:', err.message);
      }
    } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
      try {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf8');
        htmlText += `\n${decoded}`;
      } catch (err) {
        console.warn('[gmailPackageSync] Failed to decode text/html part:', err.message);
      }
    }

    if (Array.isArray(part.parts)) {
      for (const p of part.parts) {
        traverseParts(p);
      }
    }
  }

  traverseParts(message.payload);

  const cleanHtmlText = htmlText ? sanitizeEmailHtml(htmlText) : '';
  const body = [bodyText, cleanHtmlText].filter(Boolean).join('\n\n').trim() || message?.snippet || '';

  return { subject, body, from, html: htmlText };
}

/**
 * Builds package objects from a Gmail message, disaggregating multi-parcel shipments.
 * When an email contains multiple distinct verified tracking numbers, returns one package per parcel.
 *
 * @param {{
 *   gmailMessage: object,
 *   userId: string,
 *   existingTrackingNumbers: Set<string>,
 *   skipDelivered?: boolean
 * }} params
 * @returns {Array<object>}
 */
export function buildPackagesFromGmailMessage({
  gmailMessage,
  userId,
  existingTrackingNumbers,
  skipDelivered = false
}) {
  const { subject, body, from, html } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const allExtracted = extractAllTrackingDetails(subject, body, from, { html });
  const nowIso = new Date().toISOString();

  const verifiedPackages = allExtracted.filter((pkg) => pkg.trackingNumber && pkg.status === 'verified');

  if (verifiedPackages.length > 0) {
    const packages = [];
    for (let idx = 0; idx < verifiedPackages.length; idx += 1) {
      const ext = verifiedPackages[idx];
      if (isDuplicateTrackingNumber(existingTrackingNumbers, ext.trackingNumber)) continue;
      if (skipDelivered && looksAlreadyDelivered(subject, body)) continue;

      const pkgId = verifiedPackages.length > 1
        ? `pkg-gmail-${gmailMessage.id || Date.now()}-${idx + 1}`
        : `pkg-gmail-${gmailMessage.id || Date.now()}`;

      packages.push({
        id: pkgId,
        userId,
        title: ext.title,
        trackingNumber: ext.trackingNumber,
        carrier: ext.carrier,
        status: ext.deliveryStatus || inferDeliveryStatus(subject, body),
        source: 'gmail_sync',
        notes: ext.store ? `${ext.store} order` : (subject ? `From Gmail: ${subject.slice(0, 80)}` : ''),
        ...(ext.orderNumber ? { orderNumber: ext.orderNumber } : {}),
        ...(ext.store ? { store: ext.store } : {}),
        ...(ext.lockerPin ? { lockerPin: ext.lockerPin, pickupCode: ext.lockerPin } : {}),
        ...(ext.pickupLocation ? { pickupLocation: ext.pickupLocation } : {}),
        ...(ext.pickupHours ? { pickupHours: ext.pickupHours } : {}),
        ...(ext.pickupPhone ? { pickupPhone: ext.pickupPhone } : {}),
        ...(ext.isRedirected ? { isRedirected: ext.isRedirected } : {}),
        ...(ext.originalPickupLocation ? { originalPickupLocation: ext.originalPickupLocation } : {}),
        ...(ext.redirectReason ? { redirectReason: ext.redirectReason } : {}),
        createdAt: nowIso,
        updatedAt: nowIso,
        isArchived: false
      });
    }
    return packages;
  }

  // No verifiable carrier tracking number, so no package.
  //
  // This used to create an "order status" record instead: a card with an empty
  // trackingNumber, carrier "other", and a note explaining there was nothing to
  // track. The intent was to surface that an order exists before it ships.
  //
  // In practice it cannot. Nothing links such a record to the real shipment
  // when tracking finally arrives — the only matching that exists pairs an
  // order-status email with another order-status record from the same store —
  // so the user is shown a card naming a store, with no tracking number, no
  // carrier and no way to tell which of their orders it refers to. Labelling it
  // honestly does not help: an accurate description of an unusable card is
  // still an unusable card, and it renders with the same six-stage tracker and
  // "Advance to Next Stage" control as a real parcel.
  //
  // Follow-up emails still update an order-status record that already exists
  // (see gmailPushHandler), so records already in a user's data keep working.
  // New ones are no longer created; the shipping email that carries a real
  // tracking number creates the package, as it does for every other sender.
  return [];
}

/**
 * Builds a single package record from a Gmail message (for backwards compatibility).
 * Returns the first discovered parcel, or null if none discovered.
 *
 * @param {{
 *   gmailMessage: object,
 *   userId: string,
 *   existingTrackingNumbers: Set<string>,
 *   skipDelivered?: boolean
 * }} params
 * @returns {object|null}
 */
export function buildPackageFromGmailMessage(params) {
  const pkgs = buildPackagesFromGmailMessage(params);
  return pkgs.length > 0 ? pkgs[0] : null;
}

/**
 * Disaggregates multi-parcel Gmail messages with AI fallback support for ambiguous single-parcel emails.
 *
 * @param {{
 *   gmailMessage: object,
 *   userId: string,
 *   existingTrackingNumbers: Set<string>,
 *   skipDelivered?: boolean,
 *   ai?: { db: FirebaseFirestore.Firestore, apiKey: string, runBudget?: { used: number, max: number }, parseFn?: Function }
 * }} params
 * @returns {Promise<Array<object>>}
 */
export async function buildPackagesFromGmailMessageWithAiFallback({
  gmailMessage,
  userId,
  existingTrackingNumbers,
  skipDelivered = false,
  ai
}) {
  const { subject, body, from, html } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const allExtracted = extractAllTrackingDetails(subject, body, from, { html });
  const verifiedPackages = allExtracted.filter((pkg) => pkg.trackingNumber && pkg.status === 'verified');

  // If verified packages exist or no AI supplied, return deterministic packages
  if (verifiedPackages.length > 0 || !ai) {
    return buildPackagesFromGmailMessage({ gmailMessage, userId, existingTrackingNumbers, skipDelivered });
  }

  const extraction = extractTrackingDetails(subject, body, from, { html });
  const aiResolved = await resolveUnverifiedCandidateWithAi({
    db: ai.db,
    apiKey: ai.apiKey,
    uid: userId,
    subject,
    body,
    from,
    extraction,
    runBudget: ai.runBudget,
    ...(ai.parseFn ? { parseFn: ai.parseFn } : {})
  });

  if (!aiResolved) {
    return buildPackagesFromGmailMessage({ gmailMessage, userId, existingTrackingNumbers, skipDelivered });
  }

  const trackingNumber = aiResolved.trackingNumber.toUpperCase();
  if (isDuplicateTrackingNumber(existingTrackingNumbers, trackingNumber)) return [];
  if (skipDelivered && looksAlreadyDelivered(subject, body)) return [];

  const nowIso = new Date().toISOString();
  return [{
    id: `pkg-gmail-ai-${gmailMessage.id || Date.now()}`,
    userId,
    title: aiResolved.title || extraction.title,
    trackingNumber,
    carrier: aiResolved.carrier,
    status: inferDeliveryStatus(subject, body),
    source: 'gmail_sync_ai',
    confidence: aiResolved.confidence,
    notes: subject ? `From Gmail: ${subject.slice(0, 80)}` : '',
    ...(extraction.lockerPin ? { lockerPin: extraction.lockerPin, pickupCode: extraction.lockerPin } : {}),
    ...(extraction.pickupLocation ? { pickupLocation: extraction.pickupLocation } : {}),
    ...(extraction.pickupHours ? { pickupHours: extraction.pickupHours } : {}),
    ...(extraction.pickupPhone ? { pickupPhone: extraction.pickupPhone } : {}),
    ...(extraction.isRedirected ? { isRedirected: extraction.isRedirected } : {}),
    ...(extraction.originalPickupLocation ? { originalPickupLocation: extraction.originalPickupLocation } : {}),
    ...(extraction.redirectReason ? { redirectReason: extraction.redirectReason } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
    isArchived: false
  }];
}

/**
 * Builds a single package from Gmail with AI fallback (backwards-compatible wrapper).
 * @param {object} params
 * @returns {Promise<object|null>}
 */
export async function buildPackageFromGmailMessageWithAiFallback(params) {
  const pkgs = await buildPackagesFromGmailMessageWithAiFallback(params);
  return pkgs.length > 0 ? pkgs[0] : null;
}

/**
 * Extracts a status update from a Gmail message whose tracking number is
 * already saved — a shipping follow-up (e.g. "out for delivery") for a
 * package the user already has, as opposed to a brand-new package. Used by
 * the live push handler so a duplicate tracking number updates the existing
 * package instead of being silently dropped.
 *
 * @param {{ gmailMessage: object }} params
 * @returns {{ trackingNumber: string, status: string } | null}
 */
export function buildStatusUpdateFromGmailMessage({ gmailMessage }) {
  const { subject, body, from, html } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const {
    trackingNumber,
    status: detectionStatus,
    lockerPin,
    pickupLocation,
    pickupHours,
    pickupPhone,
    isRedirected,
    originalPickupLocation,
    redirectReason,
    deliveryStatus
  } = extractTrackingDetails(subject, body, from, { html });

  if (!trackingNumber || detectionStatus !== 'verified') return null;

  return {
    trackingNumber: trackingNumber.toUpperCase(),
    status: deliveryStatus || inferDeliveryStatus(subject, body),
    ...(lockerPin ? { lockerPin, pickupCode: lockerPin } : {}),
    ...(pickupLocation ? { pickupLocation } : {}),
    ...(pickupHours ? { pickupHours } : {}),
    ...(pickupPhone ? { pickupPhone } : {}),
    ...(isRedirected ? { isRedirected } : {}),
    ...(originalPickupLocation ? { originalPickupLocation } : {}),
    ...(redirectReason ? { redirectReason } : {})
  };
}

/**
 * Same idea as `buildStatusUpdateFromGmailMessage`, but for order-status
 * records: a follow-up email for a store the user already has one from
 * ("order confirmed" → "shipped" → "out for delivery") updates that record
 * rather than adding another card.
 *
 * New order-status records are no longer created — nothing could link one to
 * the shipment whose tracking number arrived later, so it could only ever be
 * a card the user was unable to act on or identify. This path remains for
 * records already in a user's data, so their follow-up emails keep updating
 * the record they belong to instead of being ignored.
 *
 * Returns null when the message has a verified carrier tracking number (that
 * path is handled by `buildStatusUpdateFromGmailMessage` /
 * `buildPackageFromGmailMessage` instead) or matches no known store +
 * lifecycle phrase at all.
 *
 * @param {{ gmailMessage: object }} params
 * @returns {{ store: string, status: string, title: string } | null}
 */
export function buildOrderStatusUpdateFromGmailMessage({ gmailMessage }) {
  const { subject, body, from, html } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const { trackingNumber, status: detectionStatus } = extractTrackingDetails(subject, body, from, { html });
  if (trackingNumber && detectionStatus === 'verified') return null;

  return extractOrderStatusDetails(subject, body, from);
}
