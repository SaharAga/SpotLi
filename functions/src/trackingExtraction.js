/**
 * Shared email parsing logic — used both by the CloudMailin inbound webhook
 * (inboundEmailHandler.js) and the Gmail push handler (gmailPushHandler.js),
 * so carrier regexes and HTML sanitizing live in exactly one place.
 */

/**
 * Strips HTML tags and decodes common entities to produce clean plain text.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeEmailHtml(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Regex patterns for common carriers and tracking numbers in emails.
 *
 * Unambiguous, carrier-prefixed formats (israel-post, cheetah, ups, cainiao)
 * are checked first and need no extra corroboration — nothing else looks
 * like "1Z..." or "LP...".
 *
 * DHL and FedEx's plain-digit-run formats are checked last and gated behind
 * `contextHint`: a bare `\d{10}` or `\d{12}` matches an Israeli phone number
 * (e.g. an "05XXXXXXXX" in a shipping-address block) or plenty of other
 * incidental numbers just as readily as a real tracking number, so these
 * only fire when the carrier's own name actually appears in the email —
 * otherwise an AliExpress order with the recipient's phone number in it
 * gets mis-tagged as a DHL package.
 */
const TRACKING_PATTERNS = [
  // Israel Post / UPU S10 format (e.g., RR123456789IL, LP123456789CN)
  { carrier: 'israel-post', regex: /\b([A-Z]{2}\d{9}[A-Z]{2})\b/ },
  // Cheetah / Bar Distribution (IL local numeric)
  { carrier: 'cheetah', regex: /\b(CH\d{8,12})\b/i },
  // UPS (1Z...)
  { carrier: 'ups', regex: /\b(1Z[0-9A-Z]{16})\b/i },
  // Cainiao / AliExpress standard
  { carrier: 'cainiao', regex: /\b(LP\d{14}|CN\d{13,16})\b/i },
  // DHL Express (10 digits) — ambiguous with phone numbers, needs "dhl" nearby
  { carrier: 'dhl', regex: /\b(\d{10})\b/, contextHint: /dhl/i },
  // FedEx (12 or 15 digits) — ambiguous, needs "fedex" nearby
  { carrier: 'fedex', regex: /\b(\d{12}|\d{15})\b/, contextHint: /fedex/i }
];

/**
 * Extracts tracking details from email subject and body.
 * @param {string} subject
 * @param {string} body
 * @returns {{ trackingNumber: string|null, carrier: string, title: string }}
 */
export function extractTrackingDetails(subject = '', body = '') {
  const combinedText = `${subject} ${body}`.slice(0, 10000); // Cap to 10k chars against DoS

  let foundTracking = null;
  let foundCarrier = 'other';

  for (const { carrier, regex, contextHint } of TRACKING_PATTERNS) {
    const match = combinedText.match(regex);
    if (!match || !match[1]) continue;

    if (contextHint) {
      // The carrier's own name must appear near the candidate number, not
      // just anywhere in the email — an AliExpress email that merely lists
      // DHL among its available shipping methods shouldn't tag the order as
      // DHL just because the word appears in a footer far from the number.
      const windowStart = Math.max(0, match.index - 150);
      const windowEnd = Math.min(combinedText.length, match.index + match[0].length + 150);
      if (!contextHint.test(combinedText.slice(windowStart, windowEnd))) continue;
    }

    foundTracking = match[1].toUpperCase();
    foundCarrier = carrier;
    break;
  }

  // Derive a friendly title from subject or fallback
  let cleanTitle = subject
    .replace(/(fwd:|re:|fw:)/gi, '')
    .replace(/(order confirmation|shipping update|your order has shipped|נשלחה חבילה|אישור הזמנה)/gi, '')
    .trim();

  if (!cleanTitle || cleanTitle.length < 3) {
    cleanTitle = foundCarrier !== 'other'
      ? `Package via ${foundCarrier.toUpperCase()}`
      : 'New Online Order';
  }

  return {
    trackingNumber: foundTracking,
    carrier: foundCarrier,
    title: cleanTitle.slice(0, 80)
  };
}
