/**
 * Pure logic shared by the Gmail backfill (gmailBackfill.js) and the
 * real-time push handler (gmailPushHandler.js): turning a raw Gmail message
 * into a package record, and deciding whether it's a duplicate of one the
 * user already has.
 */

import { extractTrackingDetails, sanitizeEmailHtml } from './trackingExtraction.js';

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

  const parts = [];
  const walk = (part) => {
    if (!part) return;
    if (part.body?.data) parts.push({ mimeType: part.mimeType, data: part.body.data });
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(gmailMessage?.payload);

  const decode = (data) => Buffer.from(data, 'base64url').toString('utf8');

  const plainPart = parts.find((p) => p.mimeType === 'text/plain');
  if (plainPart) return { subject, body: decode(plainPart.data) };

  const htmlPart = parts.find((p) => p.mimeType === 'text/html');
  if (htmlPart) return { subject, body: sanitizeEmailHtml(decode(htmlPart.data)) };

  return { subject, body: gmailMessage?.snippet || '' };
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
  const { subject, body } = extractSubjectAndBodyFromGmailMessage(gmailMessage);
  const { trackingNumber, carrier, title } = extractTrackingDetails(subject, body);

  if (!trackingNumber) return null;
  if (isDuplicateTrackingNumber(existingTrackingNumbers, trackingNumber)) return null;
  if (skipDelivered && looksAlreadyDelivered(subject, body)) return null;

  const packageId = `pkg-gmail-${gmailMessage.id || Date.now()}`;
  const nowIso = new Date().toISOString();

  return {
    id: packageId,
    userId,
    title,
    trackingNumber,
    carrier,
    status: 'ordered',
    source: 'gmail_sync',
    notes: subject ? `From Gmail: ${subject.slice(0, 100)}` : '',
    createdAt: nowIso,
    updatedAt: nowIso,
    isArchived: false
  };
}
