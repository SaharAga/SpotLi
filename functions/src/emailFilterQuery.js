/**
 * Gmail search query used by the backfill (gmailBackfill.js) to find
 * shipping-looking messages in a connected mailbox.
 *
 * Mirrors src/constants/emailFilters.js (SUPPORTED_STORE_DOMAINS /
 * SHIPPING_KEYWORD_TERMS / DEFAULT_FORWARDING_FILTER_QUERY). `functions/`
 * is a separate npm package from the client build and can't import across
 * that boundary, so this is a deliberate duplicate — keep the two in sync
 * by hand when either list changes.
 */

export const SUPPORTED_STORE_DOMAINS = [
  'aliexpress.com',
  'amazon.com',
  'shein.com',
  'temu.com',
  'israelpost.co.il',
  'chtr.co.il',
  'chita.co.il',
  'epost.co.il',
  'hfd.co.il',
  'boxit.co.il',
  'buzzr.co.il',
  'tapuzdelivery.co.il',
  'bardistribution.co.il',
  'lionwheel.com',
  'dhl.com',
  'fedex.com',
  'ups.com',
  'iherb.com',
  'asos.com',
  'zara.com',
  'next.co.il',
  'ksp.co.il',
  'ivory.co.il',
  'terminalx.com',
  'wolt.com'
];

export const SHIPPING_KEYWORD_TERMS = [
  'shipped',
  'tracking',
  'order confirmation',
  '"מספר מעקב"',
  '"נשלחה חבילה"',
  '"אישור הזמנה"',
  '"ההזמנה בדרך"',
  '"החבילה בדרך"',
  '"דבר דואר"',
  '"קוד איסוף"',
  '"נקודת איסוף"',
  '"החבילה שלך מחכה"'
];

export const DEFAULT_FORWARDING_FILTER_QUERY =
  `subject:(${SHIPPING_KEYWORD_TERMS.join(' OR ')}) OR from:(${SUPPORTED_STORE_DOMAINS.join(' OR ')})`;

const NORMALIZED_KEYWORD_TERMS = SHIPPING_KEYWORD_TERMS.map((t) => t.replace(/"/g, '').toLowerCase());

/**
 * Cheap, local re-check of the same signal the Gmail search query above
 * already filters on server-side — used by the live push path
 * (gmailPushHandler.js), which pulls messages by historyId rather than by
 * this search query, so it has no equivalent gate until now. Not a
 * duplicate parser: this never extracts anything, it only decides whether
 * a message is plausible enough to be worth the (comparatively expensive)
 * AI fallback call in gmailAiFallback.js.
 *
 * @param {string} subject
 * @param {string} from
 * @returns {boolean}
 */
export function looksLikeShippingCandidate(subject = '', from = '') {
  const lowerSubject = subject.toLowerCase();
  const lowerFrom = from.toLowerCase();
  if (SUPPORTED_STORE_DOMAINS.some((domain) => lowerFrom.includes(domain))) return true;
  return NORMALIZED_KEYWORD_TERMS.some((term) => lowerSubject.includes(term));
}

