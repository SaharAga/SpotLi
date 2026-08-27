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
 */
const TRACKING_PATTERNS = [
  // Israel Post / UPU S10 format (e.g., RR123456789IL, LP123456789CN)
  { carrier: 'israel-post', regex: /\b([A-Z]{2}\d{9}[A-Z]{2})\b/ },
  // Cheetah / Bar Distribution (IL local numeric)
  { carrier: 'cheetah', regex: /\b(CH\d{8,12})\b/i },
  // DHL Express (10 digits)
  { carrier: 'dhl', regex: /\b(\d{10})\b/ },
  // FedEx (12 or 15 digits)
  { carrier: 'fedex', regex: /\b(\d{12}|\d{15})\b/ },
  // UPS (1Z...)
  { carrier: 'ups', regex: /\b(1Z[0-9A-Z]{16})\b/i },
  // Cainiao / AliExpress standard
  { carrier: 'cainiao', regex: /\b(LP\d{14}|CN\d{13,16})\b/i }
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

  for (const { carrier, regex } of TRACKING_PATTERNS) {
    const match = combinedText.match(regex);
    if (match && match[1]) {
      foundTracking = match[1].toUpperCase();
      foundCarrier = carrier;
      break;
    }
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
