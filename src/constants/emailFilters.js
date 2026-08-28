/**
 * Canonical Email Forwarding & Ingestion Filter Queries.
 *
 * Used by emailSyncService to configure Gmail API forwarding filters
 * and by IngestionGuideModal to display manual setup instructions.
 */

export const SUPPORTED_STORE_DOMAINS = Object.freeze([
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
]);

export const SHIPPING_KEYWORD_TERMS = Object.freeze([
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
]);

/**
 * Canonical Gmail search filter query string.
 */
export const DEFAULT_FORWARDING_FILTER_QUERY = Object.freeze(
  `subject:(${SHIPPING_KEYWORD_TERMS.join(' OR ')}) OR from:(${SUPPORTED_STORE_DOMAINS.join(' OR ')})`
);

