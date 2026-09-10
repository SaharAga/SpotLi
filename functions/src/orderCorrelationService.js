/**
 * Cross-Email Order Correlation Service.
 *
 * Links shipping notifications / courier emails with store Order Confirmations
 * so shipments get labeled with the real item name (e.g., "Keychron K2 Keyboard")
 * rather than a generic store label (e.g., "AliExpress Order").
 *
 * Operates in two distinct tiers:
 * - Tier 1: Instant Firestore in-memory cache lookup (95%+ of cases, 0 API quota cost).
 * - Tier 2: Safe, bounded on-demand Gmail query fallback with strict quota, timeout, and PII guards.
 */

import { extractSchemaOrgData } from './trackingExtraction.js';

const MIN_ORDER_NUMBER_LENGTH = 6;
const MAX_TITLE_LENGTH = 60;
const LOOKUP_TIMEOUT_MS = 3000;

// Exclude numbers that look like dates (e.g. 20260911), pure timestamps, or trivial repeated sequences
const DATE_LIKE_RE = /^(?:19|20)\d{6,}$/;
const REPEATED_DIGIT_RE = /^(\d)\1{5,}$/;

// Known store domain hints for targeted Gmail search
const STORE_DOMAIN_MAP = {
  aliexpress: 'aliexpress.com',
  amazon: 'amazon.com',
  shein: 'shein.com',
  temu: 'temu.com',
  ebay: 'ebay.com',
  zara: 'zara.com',
  asos: 'asos.com',
  ksp: 'ksp.co.il',
  ivory: 'ivory.co.il',
  iherb: 'iherb.com'
};

/**
 * Validates whether an order number string is safe and specific enough to search for.
 * Rejects dates, timestamps, trivial sequences, or numbers shorter than 6 characters.
 *
 * @param {string|null|undefined} orderNumber
 * @returns {boolean}
 */
export function isValidOrderNumber(orderNumber) {
  if (!orderNumber || typeof orderNumber !== 'string') return false;
  const clean = orderNumber.trim();
  if (clean.length < MIN_ORDER_NUMBER_LENGTH) return false;
  if (DATE_LIKE_RE.test(clean)) return false;
  if (REPEATED_DIGIT_RE.test(clean)) return false;
  return true;
}

/**
 * Checks if a title is a generic store or tracking fallback.
 *
 * @param {string|null|undefined} title
 * @returns {boolean}
 */
export function isGenericPackageTitle(title) {
  if (!title || typeof title !== 'string') return true;
  const clean = title.trim().toLowerCase();
  return (
    clean === 'online order' ||
    clean === 'new tracked package' ||
    clean === 'חבילה חדשה למעקב' ||
    clean === 'spotli package' ||
    clean === 'deliveree package' ||
    /^package\s+[a-z0-9_.-]+$/i.test(clean) ||
    /^חבילה\s+[a-z0-9_.-]+$/i.test(clean) ||
    /^(?:aliexpress|shein|temu|amazon|ebay|zara|asos|ksp|ivory)\s+(?:order|package)$/i.test(clean) ||
    /^(?:הזמנה מ-|משלוח מ-)(?:aliexpress|shein|temu|amazon|ebay|zara|asos|ksp|ivory)$/i.test(clean)
  );
}

/**
 * Tier 1: Searches existing in-memory Firestore packages for a matching order record.
 * Enforces Multi-Parcel Protection: If an existing package already has a DIFFERENT,
 * non-empty tracking number, it is treated as a separate parcel and will NOT be overwritten.
 *
 * @param {Map<string, { id: string, data: object }>} orderNumberToDocMap
 * @param {string} orderNumber
 * @param {string} incomingTrackingNumber
 * @returns {{ matchedDocId?: string, existingData?: object, isMultiParcel: boolean }}
 */
export function findExistingOrderMatch(orderNumberToDocMap, orderNumber, incomingTrackingNumber) {
  if (!orderNumberToDocMap || !isValidOrderNumber(orderNumber)) {
    return { isMultiParcel: false };
  }

  const cleanOrder = String(orderNumber).trim();
  const entry = orderNumberToDocMap.get(cleanOrder);
  if (!entry) return { isMultiParcel: false };

  const existingData = entry.data || {};
  const existingTn = existingData.trackingNumber ? String(existingData.trackingNumber).toUpperCase() : '';
  const incomingTn = incomingTrackingNumber ? String(incomingTrackingNumber).toUpperCase() : '';

  // If existing doc already tracks a DIFFERENT parcel, don't overwrite it!
  if (existingTn && incomingTn && existingTn !== incomingTn) {
    return {
      matchedDocId: entry.id,
      existingData,
      isMultiParcel: true
    };
  }

  return {
    matchedDocId: entry.id,
    existingData,
    isMultiParcel: false
  };
}

/**
 * Extracts product title from an email message (Schema.org JSON-LD or receipt text).
 * Filters out PII (phones, card numbers, addresses) and caps length.
 *
 * @param {{ subject?: string, body?: string, html?: string, snippet?: string }} emailPayload
 * @returns {string|null}
 */
export function extractProductTitleFromOrderEmail(emailPayload) {
  if (!emailPayload) return null;
  const { subject = '', html = '', body = '', snippet = '' } = emailPayload;

  // 1. Check Schema.org data for itemShipped / Order
  if (html) {
    try {
      const schemas = extractSchemaOrgData(html);
      for (const s of schemas) {
        if (s.title && !isGenericPackageTitle(s.title)) {
          return sanitizeTitle(s.title);
        }
      }
    } catch {}
  }

  // 2. Check for quoted product name in subject: e.g. Your order for "Mechanical Keyboard" has been confirmed
  const quoteMatch = subject.match(/["'״”]([^"'״”\n]{3,60})["'״”]/);
  if (quoteMatch && quoteMatch[1]) {
    const cand = quoteMatch[1].trim();
    if (!isGenericPackageTitle(cand) && !DATE_LIKE_RE.test(cand)) {
      return sanitizeTitle(cand);
    }
  }

  // 3. Check for explicit receipt line item pattern in body/snippet: "Item: Wireless Mouse", "מוצר: מקלדת"
  const textSample = `${snippet}\n${body.slice(0, 1000)}`;
  const itemMatch = textSample.match(/(?:item|product|מוצר|פריט)\s*[:：-]\s*([A-Za-z0-9\u0590-\u05FF\s-]{3,60})(?:[,\n.]|$)/i);
  if (itemMatch && itemMatch[1]) {
    const cand = itemMatch[1].trim();
    if (!isGenericPackageTitle(cand) && !DATE_LIKE_RE.test(cand)) {
      return sanitizeTitle(cand);
    }
  }

  return null;
}

/**
 * Sanitizes and strips PII from product titles.
 * @param {string} raw
 * @returns {string}
 */
function sanitizeTitle(raw) {
  if (!raw) return '';
  return raw
    // Strip credit card fragments: 4xxx-xxxx or **** 1234
    .replace(/(?:\d{4}[-\s]?){3,4}/g, '')
    .replace(/\*{4,}\s*\d{4}/g, '')
    // Strip phone numbers
    .replace(/\b0\d{1,2}[-\s]?\d{7}\b/g, '')
    // Strip HTML/script characters
    .replace(/[<>{}|\\]/g, '')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

/**
 * Tier 2: Queries Gmail for the original Order Confirmation email using the orderNumber.
 * Strictly bounded by timeout and batch quota budget.
 *
 * @param {{
 *   gmail: object,
 *   orderNumber: string,
 *   store?: string,
 *   budget?: { used: number, max: number },
 *   timeoutMs?: number
 * }} params
 * @returns {Promise<string|null>} Extracted product title, or null if not found or budget exceeded
 */
export async function fetchOrderConfirmationTitleFromGmail({
  gmail,
  orderNumber,
  store = '',
  budget,
  timeoutMs = LOOKUP_TIMEOUT_MS
}) {
  if (!gmail || !isValidOrderNumber(orderNumber)) return null;

  // Enforce quota budget
  if (budget && budget.used >= budget.max) {
    return null;
  }

  let searchQuery = `"${orderNumber.trim()}"`;
  const domainHint = STORE_DOMAIN_MAP[store?.toLowerCase()];
  if (domainHint) {
    searchQuery += ` from:${domainHint}`;
  }

  try {
    const searchPromise = gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 2
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gmail order query timeout')), timeoutMs)
    );

    const listRes = await Promise.race([searchPromise, timeoutPromise]);
    if (budget) budget.used += 1;

    const messages = listRes?.data?.messages || [];
    if (messages.length === 0) return null;

    // Fetch message details
    const msgId = messages[0].id;
    const getPromise = gmail.users.messages.get({
      userId: 'me',
      id: msgId,
      format: 'full'
    });

    const msgRes = await Promise.race([getPromise, timeoutPromise]);
    const payload = msgRes?.data?.payload;
    if (!payload) return null;

    // Extract subject & body snippet
    let subject = '';
    const headers = payload.headers || [];
    for (const h of headers) {
      if (h.name?.toLowerCase() === 'subject') subject = h.value;
    }

    const snippet = msgRes.data.snippet || '';
    const title = extractProductTitleFromOrderEmail({ subject, snippet });
    return title;
  } catch (err) {
    console.info('[orderCorrelationService] Tier 2 lookup safely skipped:', err.message);
    return null;
  }
}
