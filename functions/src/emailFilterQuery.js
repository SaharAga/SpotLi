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

const SUPPORTED_STORE_DOMAINS = [
  'aliexpress.com',
  'amazon.com',
  'shein.com',
  'temu.com',
  'israelpost.co.il',
  'dhl.com',
  'fedex.com',
  'ups.com',
  'iherb.com',
  'asos.com',
  'zara.com',
  'next.co.il'
];

const SHIPPING_KEYWORD_TERMS = [
  'shipped',
  'tracking',
  'order confirmation',
  '"מספר מעקב"',
  '"נשלחה חבילה"',
  '"אישור הזמנה"',
  '"ההזמנה בדרך"'
];

export const DEFAULT_FORWARDING_FILTER_QUERY =
  `subject:(${SHIPPING_KEYWORD_TERMS.join(' OR ')}) OR from:(${SUPPORTED_STORE_DOMAINS.join(' OR ')})`;
