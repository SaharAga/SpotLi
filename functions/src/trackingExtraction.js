/**
 * Robust email parsing and tracking extraction logic.
 * Shared by the CloudMailin inbound webhook (inboundEmailHandler.js),
 * Gmail push handler (gmailPushHandler.js), and Gmail historical backfill (gmailBackfill.js).
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
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Known store signatures mapped from sender addresses or body signatures.
 */
const STORE_SIGNATURES = [
  { store: 'Amazon', pattern: /amazon\.(com|co\.uk|de|fr|es|it|co\.jp|ca)/i },
  { store: 'AliExpress', pattern: /aliexpress(\.com)?/i },
  { store: 'eBay', pattern: /ebay\.(com|co\.uk|de)/i },
  { store: 'SHEIN', pattern: /shein(\.com)?/i },
  { store: 'Temu', pattern: /temu(\.com)?/i },
  { store: 'ASOS', pattern: /asos(\.com)?/i },
  { store: 'iHerb', pattern: /iherb(\.com)?/i },
  { store: 'Zara', pattern: /zara(\.com)?/i },
  { store: 'Next', pattern: /next(direct)?(\.com|\.co\.il)?/i },
  { store: 'KSP', pattern: /ksp(\.co\.il)?/i },
  { store: 'Ivory', pattern: /ivory(\.co\.il)?/i },
  { store: 'Super-Pharm', pattern: /(super-pharm|סופר-פארם)/i },
  { store: 'Shufersal', pattern: /(shufersal|שופרסל)/i },
  { store: 'Terminal X', pattern: /terminal\s*x/i },
  { store: 'Wolt', pattern: /wolt(\.com)?/i },
  { store: 'Bug', pattern: /bug(\.co\.il)?/i }
];

/**
 * Common false-positive patterns (phone numbers, dates, prices, etc.).
 */
const FALSE_POSITIVES = [
  // Israeli phone numbers: 050..., 052..., 053..., 054..., 058..., 9725..., +9725...
  /^(?:\+?972|0)(?:5[0-9]|7[0-9]|[23489])\d{7}$/,
  // ISO Dates (YYYY-MM-DD, DD/MM/YYYY)
  /^\d{4}[-/]\d{2}[-/]\d{2}$/,
  /^\d{2}[-/]\d{2}[-/]\d{4}$/,
  // Prices / currency
  /^\d+(?:\.\d{2})?\s*(?:₪|\$|€|ILS|USD|EUR)$/i
];

/**
 * Checks if a string is a false-positive tracking candidate.
 * @param {string} candidate
 * @returns {boolean}
 */
export function isFalsePositive(candidate) {
  if (!candidate || candidate.length < 6 || candidate.length > 40) return true;
  const trimmed = candidate.trim();
  if (FALSE_POSITIVES.some((re) => re.test(trimmed))) return true;
  const clean = trimmed.replace(/[\s-]/g, '');
  return FALSE_POSITIVES.some((re) => re.test(clean));
}

/**
 * Carrier patterns ranked from most specific to general.
 */
const CARRIER_PATTERNS = [
  // 1. Israel Post / UPU S10 global standard (e.g. RR123456789IL, LP123456789CN, CA123456789US)
  { carrier: 'israel-post', regex: /\b([A-Z]{2}\d{9}[A-Z]{2})\b/ },
  // 2. UPS (1Z...)
  { carrier: 'ups', regex: /\b(1Z[0-9A-Z]{16})\b/i },
  // 3. Amazon Logistics TBA
  { carrier: 'amazon', regex: /\b(TBA\d{12,15})\b/i },
  // 4. Cainiao / AliExpress
  { carrier: 'cainiao', regex: /\b(LP\d{14,16}|AE\d{10,16}|CN\d{12,16})\b/i },
  // 5. YunExpress
  { carrier: 'yunexpress', regex: /\b(YT\d{16})\b/i },
  // 6. Yanwen
  { carrier: 'yanwen', regex: /\b(U[A-Z]\d{9}YP|VR\d{9}YP)\b/i },
  // 7. Sunyou
  { carrier: 'sunyou', regex: /\b(SY[A-Z0-9]{11,16})\b/i },
  // 8. 4PX
  { carrier: '4px', regex: /\b(4PX\d{12,16})\b/i },
  // 9. Cheetah / Chita (CH prefix or labeled)
  { carrier: 'chita', regex: /\b(CH\d{8,12})\b/i },
  // 10. HFD / E-Post
  { carrier: 'hfd', regex: /\b(HFD\d{6,12}|EP\d{8,12})\b/i },
  // 11. BoxIt
  { carrier: 'boxit', regex: /\b(BOX\d{6,12}|BX\d{6,12})\b/i },
  // 12. Tapuz
  { carrier: 'tapuz', regex: /\b(TP\d{6,12}|TAP\d{6,12})\b/i },
  // 13. Buzzr
  { carrier: 'buzzr', regex: /\b(BZ\d{6,12}|BUZZ\d{6,12})\b/i },
  // 14. Bar Distribution / Baldar
  { carrier: 'bar-distribution', regex: /\b(BAR\d{6,12}|BAL\d{6,12})\b/i },
  // 15. LionWheel
  { carrier: 'lionwheel', regex: /\b(LW\d{6,12}|LION\d{6,12})\b/i },
  // 16. DHL Express (specific prefixes or 10-digit with DHL keyword)
  { carrier: 'dhl', regex: /\b(JJD\d{16,20}|JVGL\d{10,20})\b/i }
];

/**
 * Extracts store name from sender email or text.
 * @param {string} from
 * @param {string} text
 * @returns {string|null}
 */
export function detectStore(from = '', text = '') {
  const combined = `${from} ${text}`;
  for (const { store, pattern } of STORE_SIGNATURES) {
    if (pattern.test(combined)) return store;
  }
  return null;
}

/**
 * Derives a clean, user-friendly package title from store and subject.
 * @param {string} subject
 * @param {string|null} store
 * @param {string} carrier
 * @returns {string}
 */
export function generateCleanTitle(subject = '', store = null, carrier = 'other') {
  // Strip common noisy email subject prefixes and shipping noise
  let clean = subject
    .replace(/^(fwd|fw|re|הועבר|תגובה):\s*/gi, '')
    .replace(/(your order has shipped|order confirmation|shipping confirmation|shipment update|update on order|is on its way|has been dispatched|נשלחה חבילה|אישור הזמנה|ההזמנה שלך נשלחה|ההזמנה בדרך)/gi, '')
    .replace(/[#[\](){}:|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If subject had quotes containing the actual product (e.g. Amazon: Your order of "Product Name" has shipped)
  const productInQuotes = subject.match(/["']([^"']{3,60})["']/);
  if (productInQuotes && productInQuotes[1]) {
    const item = productInQuotes[1].trim();
    return store ? `${store} - ${item}` : item;
  }

  if (clean && clean.length >= 3) {
    if (store && !clean.toLowerCase().includes(store.toLowerCase())) {
      return `${store} - ${clean.slice(0, 60)}`.trim();
    }
    return clean.slice(0, 70);
  }

  if (store) return `${store} Order`;
  if (carrier !== 'other') return `Package via ${carrier.toUpperCase()}`;
  return 'Online Order';
}

/**
 * Extracts tracking details from email subject, body, and sender.
 * @param {string} subject
 * @param {string} body
 * @param {string} [from]
 * @returns {{ trackingNumber: string|null, carrier: string, title: string, store: string|null }}
 */
export function extractTrackingDetails(subject = '', body = '', from = '') {
  const combinedText = `${subject} ${body}`.slice(0, 15000);
  const store = detectStore(from, combinedText);

  let foundTracking = null;
  let foundCarrier = 'other';

  // 1. Check high-confidence labeled context first
  // e.g. "Tracking Number: 123456789", "מספר מעקב: RR123456789IL"
  const labeledRegex = /(?:tracking\s*(?:number|id|code|#)?|מספר\s*מעקב|מעקב\s*משלוח|waybill|awb|consign(?:ment)?|מספר\s*משלוח)[\s:=#-]+([A-Z0-9_-]{7,35})/i;
  const labeledMatch = combinedText.match(labeledRegex);
  if (labeledMatch && labeledMatch[1]) {
    const candidate = labeledMatch[1].trim().toUpperCase();
    if (!isFalsePositive(candidate)) {
      foundTracking = candidate;
      // Match carrier for candidate
      for (const { carrier, regex } of CARRIER_PATTERNS) {
        if (regex.test(candidate)) {
          foundCarrier = carrier;
          break;
        }
      }
      if (foundCarrier === 'other') {
        if (/dhl/i.test(combinedText)) foundCarrier = 'dhl';
        else if (/fedex/i.test(combinedText)) foundCarrier = 'fedex';
        else if (/ups/i.test(combinedText)) foundCarrier = 'ups';
        else if (/chita|cheetah|צ['׳]?יטה/i.test(combinedText)) foundCarrier = 'chita';
        else if (/hfd|epost|איפסט|אי פוסט/i.test(combinedText)) foundCarrier = 'hfd';
        else if (/israel\s*post|דואר\s*ישראל/i.test(combinedText)) foundCarrier = 'israel-post';
      }
    }
  }

  // 2. If no labeled tracking number, scan against pattern registry
  if (!foundTracking) {
    for (const { carrier, regex } of CARRIER_PATTERNS) {
      const match = combinedText.match(regex);
      if (match && match[1]) {
        const candidate = match[1].trim().toUpperCase();
        if (!isFalsePositive(candidate)) {
          foundTracking = candidate;
          foundCarrier = carrier;
          break;
        }
      }
    }
  }

  // 3. DHL 10-digit or FedEx fallback only when DHL/FedEx keyword is in proximity
  if (!foundTracking) {
    const dhlMatch = combinedText.match(/\b([0-9]{10})\b/);
    if (dhlMatch && !isFalsePositive(dhlMatch[1])) {
      const windowStart = Math.max(0, (dhlMatch.index ?? 0) - 150);
      const windowEnd = Math.min(combinedText.length, (dhlMatch.index ?? 0) + dhlMatch[0].length + 150);
      if (/dhl/i.test(combinedText.slice(windowStart, windowEnd))) {
        foundTracking = dhlMatch[1];
        foundCarrier = 'dhl';
      }
    }
  }

  if (!foundTracking) {
    const fedexMatch = combinedText.match(/\b(96\d{20}|[0-9]{12}|[0-9]{15})\b/);
    if (fedexMatch && !isFalsePositive(fedexMatch[1])) {
      const windowStart = Math.max(0, (fedexMatch.index ?? 0) - 150);
      const windowEnd = Math.min(combinedText.length, (fedexMatch.index ?? 0) + fedexMatch[0].length + 150);
      if (/fedex/i.test(combinedText.slice(windowStart, windowEnd))) {
        foundTracking = fedexMatch[1];
        foundCarrier = 'fedex';
      }
    }
  }

  // 4. Israeli domestic courier short link resolution (e.g. chtr.co.il/t/123456)
  if (!foundTracking) {
    const chitaLink = combinedText.match(/chtr\.co\.il\/(?:t\/)?([A-Za-z0-9_-]{6,16})/i);
    if (chitaLink && chitaLink[1] && !isFalsePositive(chitaLink[1])) {
      foundTracking = chitaLink[1].toUpperCase();
      foundCarrier = 'chita';
    }
  }

  const title = generateCleanTitle(subject, store, foundCarrier);

  return {
    trackingNumber: foundTracking,
    carrier: foundCarrier,
    title,
    store
  };
}
