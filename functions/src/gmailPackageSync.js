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
import { resolveUnverifiedCandidateWithAi } from './gmailAiFallback.js';

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
    store: orderStatus.store,
    notes: `${orderStatus.store} order — from your order confirmation email, no carrier tracking number`,
    createdAt: nowIso,
    updatedAt: nowIso,
    isArchived: false
  };
}

/**
 * Same as buildPackageFromGmailMessage, but when the deterministic parser
 * only found a `probable`/`uncertain` candidate (not enough to create a
 * package unattended on its own), tries the Gemini fallback
 * (gmailAiFallback.js) to disambiguate before giving up on it — see that
 * module for why this can't hallucinate a package out of nothing. Falls
 * back to the exact same order-status / null behavior as the sync version
 * whenever AI is unavailable, capped, or declines.
 *
 * `ai` is optional — when omitted (e.g. GEMINI_API_KEY not configured),
 * this behaves identically to the synchronous version.
 *
 * @param {{
 *   gmailMessage: object,
 *   userId: string,
 *   existingTrackingNumbers: Set<string>,
 *   skipDelivered?: boolean,
 *   ai?: { db: FirebaseFirestore.Firestore, apiKey: string, runBudget?: { used: number, max: number }, parseFn?: Function }
 * }} params
 * @returns {Promise<object|null>}
 */
export async function buildPackageFromGmailMessageWithAiFallback({
  gmailMessage,
  userId,
  existingTrackingNumbers,
  skipDelivered = false,
  ai
}) {
  const { subject, body, from } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const extraction = extractTrackingDetails(subject, body, from);

  if (extraction.status === 'verified' || !ai) {
    return buildPackageFromGmailMessage({ gmailMessage, userId, existingTrackingNumbers, skipDelivered });
  }

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
    return buildPackageFromGmailMessage({ gmailMessage, userId, existingTrackingNumbers, skipDelivered });
  }

  const trackingNumber = aiResolved.trackingNumber.toUpperCase();
  if (isDuplicateTrackingNumber(existingTrackingNumbers, trackingNumber)) return null;
  if (skipDelivered && looksAlreadyDelivered(subject, body)) return null;

  const nowIso = new Date().toISOString();
  return {
    id: `pkg-gmail-ai-${gmailMessage.id || Date.now()}`,
    userId,
    title: aiResolved.title || extraction.title,
    trackingNumber,
    carrier: aiResolved.carrier,
    status: inferDeliveryStatus(subject, body),
    source: 'gmail_sync_ai',
    confidence: aiResolved.confidence,
    notes: subject ? `From Gmail: ${subject.slice(0, 80)}` : '',
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

/**
 * Same idea as `buildStatusUpdateFromGmailMessage`, but for the no-tracking-
 * number "order status" fallback (see `extractOrderStatusDetails`): a
 * follow-up email for a store the user already has an order-status package
 * from (e.g. "order confirmed" → "shipped" → "out for delivery" → "delivery
 * issue") is a status update to that one package, not a brand-new untracked
 * card per email. Returns null when the message has a verified carrier
 * tracking number (that path is handled by `buildStatusUpdateFromGmailMessage`
 * / `buildPackageFromGmailMessage` instead) or matches no known store +
 * lifecycle phrase at all.
 *
 * @param {{ gmailMessage: object }} params
 * @returns {{ store: string, status: string, title: string } | null}
 */
export function buildOrderStatusUpdateFromGmailMessage({ gmailMessage }) {
  const { subject, body, from } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const { trackingNumber, status: detectionStatus } = extractTrackingDetails(subject, body, from);
  if (trackingNumber && detectionStatus === 'verified') return null;

  return extractOrderStatusDetails(subject, body, from);
}
