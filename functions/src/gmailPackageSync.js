/**
 * Pure logic shared by the Gmail backfill (gmailBackfill.js) and the
 * real-time push handler (gmailPushHandler.js): turning a raw Gmail message
 * into a package record, and deciding whether it's a duplicate of one the
 * user already has.
 */

import {
  extractTrackingDetails,
  sanitizeEmailHtml,
  inferDeliveryStatus,
  extractOrderStatusDetails
} from './trackingExtraction.js';

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
    /package (was |has )?delivered/i.test(text)
  );
}

/**
 * @param {Set<string>} existingTrackingNumbers Uppercased tracking numbers already saved for this user
 * @param {string|null} trackingNumber
 * @returns {boolean}
 */
export function isDuplicateTrackingNumber(existingTrackingNumbers, trackingNumber) {
  if (!trackingNumber) return false;
  return existingTrackingNumbers.has(trackingNumber.toUpperCase());
}

/**
 * Extracts the plain-text body from a Gmail API `messages.get` payload
 * (format: 'full'), preferring text/plain parts and falling back to
 * sanitized text/html.
 * @param {object} gmailMessage Gmail API Message resource
 * @returns {{ subject: string, body: string }}
 */
export function extractSubjectAndBodyFromGmailMessage(gmailMessage) {
  const headers = gmailMessage?.payload?.headers || [];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';

  const parts = [];
  const walk = (part) => {
    if (!part) return;
    if (part.body?.data) parts.push({ mimeType: part.mimeType, data: part.body.data });
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(gmailMessage?.payload);

  const decode = (data) => Buffer.from(data, 'base64url').toString('utf8');

  const plainPart = parts.find((p) => p.mimeType === 'text/plain');
  if (plainPart) return { subject, from, body: decode(plainPart.data) };

  const htmlPart = parts.find((p) => p.mimeType === 'text/html');
  if (htmlPart) return { subject, from, body: sanitizeEmailHtml(decode(htmlPart.data)) };

  return { subject, from, body: gmailMessage?.snippet || '' };
}

/**
 * Builds a package record from a Gmail message, or returns null if no
 * tracking number was found, if it looks already delivered (backfill only),
 * or if it duplicates an existing tracking number.
 *
 * @param {{
 *   gmailMessage: object,
 *   userId: string,
 *   existingTrackingNumbers: Set<string>,
 *   skipDelivered?: boolean
 * }} params
 * @returns {object|null}
 */
export function buildPackageFromGmailMessage({
  gmailMessage,
  userId,
  existingTrackingNumbers,
  skipDelivered = false
}) {
  const { subject, body, from } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const { trackingNumber, carrier, title, store, status: detectionStatus } = extractTrackingDetails(subject, body, from);

  const nowIso = new Date().toISOString();

  // Gmail sync runs without a confirmation screen, so never create a package
  // from a merely probable/uncertain candidate.
  if (trackingNumber && detectionStatus === 'verified') {
    if (isDuplicateTrackingNumber(existingTrackingNumbers, trackingNumber)) return null;
    if (skipDelivered && looksAlreadyDelivered(subject, body)) return null;

    return {
      id: `pkg-gmail-${gmailMessage.id || Date.now()}`,
      userId,
      title,
      trackingNumber,
      carrier,
      status: inferDeliveryStatus(subject, body),
      source: 'gmail_sync',
      notes: store ? `${store} order` : (subject ? `From Gmail: ${subject.slice(0, 80)}` : ''),
      createdAt: nowIso,
      updatedAt: nowIso,
      isArchived: false
    };
  }

  // No verifiable carrier tracking number (e.g. a marketplace order number
  // like AliExpress's, which means nothing to any carrier) — fall back to a
  // lower-confidence "order status" record built from the store + an
  // explicit lifecycle phrase in the email, rather than creating nothing.
  // Kept structurally distinct (no trackingNumber, its own `source` and
  // `confidence`) so it never gets confused with a carrier-verified package.
  const orderStatus = extractOrderStatusDetails(subject, body, from);
  if (!orderStatus) return null;
  if (skipDelivered && looksAlreadyDelivered(subject, body)) return null;

  return {
    id: `pkg-gmail-order-${gmailMessage.id || Date.now()}`,
    userId,
    title: orderStatus.title,
    trackingNumber: '',
    carrier: 'other',
    status: orderStatus.status,
    source: 'gmail_sync_order_status',
    confidence: 'sender_reported',
    notes: `${orderStatus.store} order — from your order confirmation email, no carrier tracking number`,
    createdAt: nowIso,
    updatedAt: nowIso,
    isArchived: false
  };
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
  const { subject, body, from } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const { trackingNumber, status: detectionStatus } = extractTrackingDetails(subject, body, from);

  if (!trackingNumber || detectionStatus !== 'verified') return null;

  return {
    trackingNumber: trackingNumber.toUpperCase(),
    status: inferDeliveryStatus(subject, body)
  };
}
