/**
 * Robust email parsing and tracking extraction logic.
 * Shared by the CloudMailin inbound webhook (inboundEmailHandler.js),
 * Gmail push handler (gmailPushHandler.js), and Gmail historical backfill (gmailBackfill.js).
 */

/**
 * Strips HTML tags while preserving and extracting embedded hyperlinks.
 * Appends extracted URLs and anchor text so tracking links in buttons/banners are never lost.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeEmailHtml(html) {
  if (typeof html !== 'string') return '';

  // 1. Remove script and style tags completely
  let clean = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // 2. Extract all href links and append them into the text stream
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const extractedLinks = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(clean)) !== null) {
    const href = linkMatch[1];
    const anchorText = linkMatch[2]?.replace(/<[^>]+>/g, '').trim();
    if (href && !href.startsWith('mailto:') && !href.startsWith('javascript:')) {
      extractedLinks.push(` ${anchorText || ''} ${href} `);
    }
  }

  // 3. Strip all HTML tags
  clean = clean.replace(/<[^>]+>/g, ' ');

  // 4. Decode common HTML entities
  clean = clean
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&zwnj;/gi, '')
    .replace(/&zwj;/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 5. Append extracted links at the end so courier URLs are reachable
  if (extractedLinks.length > 0) {
    clean += ' ' + extractedLinks.join(' ');
  }

  return clean;
}

/**
 * Known store signatures mapped from sender addresses or body signatures.
 */
const STORE_SIGNATURES = [
  { store: 'Amazon', pattern: /amazon\.(com|co\.uk|de|fr|es|it|co\.jp|ca|com\.be)/i },
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
  { store: 'Super-Pharm', pattern: /(super-pharm|סופר-?פארם)/i },
  { store: 'Shufersal', pattern: /(shufersal|שופרסל)/i },
  { store: 'Terminal X', pattern: /terminal\s*x/i },
  { store: 'Wolt', pattern: /wolt(\.com)?/i },
  { store: 'Bug', pattern: /bug(\.co\.il)?/i },
  { store: 'Castro', pattern: /(castro|קסטרו)/i },
  { store: 'Renuar', pattern: /(renuar|רנואר)/i },
  { store: 'Foot Locker', pattern: /foot\s*locker/i }
];

/**
 * Common false-positive patterns (phone numbers, OTP verification codes, dates, prices, etc.).
 */
const FALSE_POSITIVES = [
  // Israeli phone numbers: 050..., 052..., 053..., 054..., 058..., 9725..., +9725...
  /^(?:\+?972|0)(?:5[0-9]|7[0-9]|[23489])\d{7}$/,
  // ISO Dates (YYYY-MM-DD, DD/MM/YYYY)
  /^\d{4}[-/]\d{2}[-/]\d{2}$/,
  /^\d{2}[-/]\d{2}[-/]\d{4}$/,
  // Standard Order IDs (e.g. Amazon 114-8291029-1928301)
  /^\d{3}-\d{7}-\d{7}$/,
  // Prices / currency
  /^\d+(?:\.\d{2})?\s*(?:₪|\$|€|ILS|USD|EUR)$/i,
  // Generic numeric words like years or short IDs
  /^(?:202[0-9]|2030)$/
];

/**
 * Checks if a string is a false-positive tracking candidate.
 * @param {string} candidate
 * @param {string} [context='']
 * @returns {boolean}
 */
export function isFalsePositive(candidate, context = '') {
  if (!candidate || candidate.length < 5 || candidate.length > 45) return true;
  const trimmed = candidate.trim();
  if (FALSE_POSITIVES.some((re) => re.test(trimmed))) return true;
  const clean = trimmed.replace(/[\s-]/g, '');
  if (FALSE_POSITIVES.some((re) => re.test(clean))) return true;

  // OTP Verification Code Guard: 4-8 digits immediately next to verification keywords
  if (/^\d{4,8}$/.test(clean) && context) {
    if (/(?:קוד\s*אימות|קוד\s*חד-?פעמי|אימות\s*חשבון|verification\s*code|one-?time\s*password|otp|security\s*code)/i.test(context)) {
      return true;
    }
  }

  return false;
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
  { carrier: 'cainiao', regex: /\b(LP\d{14,16}|AE\d{10,16}|CN\d{12,16}|GSH[A-Z0-9]{10,20})\b/i },
  // 5. YunExpress
  { carrier: 'yunexpress', regex: /\b(YT\d{16,18})\b/i },
  // 6. Yanwen
  { carrier: 'yanwen', regex: /\b(U[A-Z]\d{9}YP|VR\d{9}YP)\b/i },
  // 7. Sunyou
  { carrier: 'sunyou', regex: /\b(SY[A-Z0-9]{11,16})\b/i },
  // 8. 4PX
  { carrier: '4px', regex: /\b(4PX\d{12,16})\b/i },
  // 9. Cheetah / Chita (CH prefix or labeled)
  { carrier: 'chita', regex: /\b(CH\d{8,14}|CHT\d{6,12})\b/i },
  // 10. HFD / E-Post
  { carrier: 'hfd', regex: /\b(HFD\d{6,14}|EP\d{8,14})\b/i },
  // 11. BoxIt
  { carrier: 'boxit', regex: /\b(BOX\d{6,12}|BX\d{6,12})\b/i },
  // 12. Tapuz
  { carrier: 'tapuz', regex: /\b(TP\d{6,12}|TAP\d{6,12}|TPZ\d{6,12})\b/i },
  // 13. Buzzr
  { carrier: 'buzzr', regex: /\b(BZ\d{6,12}|BUZZ\d{6,12}|BZR\d{6,12})\b/i },
  // 14. Bar Distribution / Baldar
  { carrier: 'bar-distribution', regex: /\b(BAR\d{6,12}|BAL\d{6,12}|BD\d{6,12})\b/i },
  // 15. LionWheel
  { carrier: 'lionwheel', regex: /\b(LW\d{6,12}|LION\d{6,12})\b/i },
  // 16. Flying Cargo
  { carrier: 'flying-cargo', regex: /\b(FC\d{8,14})\b/i },
  // 17. Cargo Express
  { carrier: 'cargo', regex: /\b(CRG\d{6,12})\b/i },
  // 18. ZigZag
  { carrier: 'zigzag', regex: /\b(ZZ\d{6,12}|ZIG\d{6,12})\b/i },
  // 19. DHL Express (specific prefixes or 10-digit with DHL keyword)
  { carrier: 'dhl', regex: /\b(JJD\d{16,20}|JVGL\d{10,20})\b/i }
];

/**
 * Known Carrier URL Extractors from Israeli & Global Courier short-links and domains
 */
const CARRIER_URL_EXTRACTORS = [
  { carrier: 'chita', pattern: /(?:chtr\.co\.il|chita(?:-il)?\.co\.il|chita-il\.com)(?:\/(?:t|runportal\/track|runportal\/tracking|tracking)\/([A-Za-z0-9_-]{6,20})|.*?[?&](?:num|b|track|code)=([A-Za-z0-9_-]{6,20})|\/([A-Za-z0-9_-]{6,20}))/i },
  { carrier: 'hfd', pattern: /(?:hfd\.co\.il|epost\.co\.il|tracking\.hfd\.co\.il)(?:\/(?:t|tracking|track|e)\/([A-Za-z0-9_-]{6,20})|.*?[?&](?:num|t|track|barcode|item|b)=([A-Za-z0-9_-]{6,20}))/i },
  { carrier: 'boxit', pattern: /boxit\.co\.il(?:\/(?:tracking|b|lockers)\/([A-Za-z0-9_-]{6,20})|.*?[?&](?:b|num|code|track)=([A-Za-z0-9_-]{6,20}))/i },
  { carrier: 'buzzr', pattern: /(?:buzzr\.co\.il|link\.buzzr\.co\.il)(?:\/(?:track|tracking|b)\/([A-Za-z0-9_-]{6,20})|.*?[?&](?:num|track|code|b)=([A-Za-z0-9_-]{6,20}))/i },
  { carrier: 'tapuz', pattern: /(?:tapuzdelivery\.co\.il|tapuz\.co\.il)(?:\/(?:track|tracking)\/([A-Za-z0-9_-]{6,20})|.*?[?&](?:num|track|code)=([A-Za-z0-9_-]{6,20}))/i },
  { carrier: 'bar-distribution', pattern: /(?:bardistribution\.co\.il|barexpress\.co\.il|bar-express\.co\.il)(?:\/(?:track|tracking)\/([A-Za-z0-9_-]{6,20})|.*?[?&](?:track|tracknum|num|barcode)=([A-Za-z0-9_-]{6,20}))/i },
  { carrier: 'lionwheel', pattern: /(?:lionwheel\.com|tracking\.lionwheel\.com)(?:\/(?:orders|tracking|track)\/([A-Za-z0-9_-]{6,20})|.*?[?&](?:order|orderId|num|track)=([A-Za-z0-9_-]{6,20}))/i },
  { carrier: 'israel-post', pattern: /(?:mypost\.israelpost\.co\.il|israelpost\.co\.il|postil\.com)(?:\/(?:itemtrace|item|tracking)\/([A-Za-z0-9_-]{8,25})|.*?[?&](?:itemcode|item|barcode|num|track|id)=([A-Za-z0-9_-]{8,25}))/i },
  { carrier: 'dhl', pattern: /dhl\.com\/.*?tracking-id=([A-Za-z0-9_-]{8,25})/i },
  { carrier: 'fedex', pattern: /fedex\.com\/.*?(?:trknbr|tracknumbers)=([0-9]{10,25})/i },
  { carrier: 'ups', pattern: /ups\.com\/.*?tracknum=([0-9A-Za-z]{10,25})/i }
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
  let clean = subject
    .replace(/^(fwd|fw|re|הועבר|תגובה):\s*/gi, '')
    .replace(/(your order has shipped|order confirmation|shipping confirmation|shipment update|update on order|is on its way|has been dispatched|נשלחה חבילה|אישור הזמנה|ההזמנה שלך נשלחה|ההזמנה בדרך|החבילה שלך בדרך)/gi, '')
    .replace(/[#[\](){}:|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
 * Extracts tracking details from email subject, body, and sender with multi-factor confidence.
 * @param {string} subject
 * @param {string} body
 * @param {string} [from]
 * @returns {{ trackingNumber: string|null, carrier: string, title: string, store: string|null, confidence: 'high'|'medium'|'low'|'none' }}
 */
export function extractTrackingDetails(subject = '', body = '', from = '') {
  const cleanBody = sanitizeEmailHtml(body);
  const combinedText = `${subject} ${cleanBody} ${from}`.slice(0, 25000);
  const store = detectStore(from, combinedText);

  let foundTracking = null;
  let foundCarrier = 'other';
  let confidence = 'none';

  // 1. Courier URL Link Extraction (Highest Confidence)
  for (const { carrier, pattern } of CARRIER_URL_EXTRACTORS) {
    const match = combinedText.match(pattern);
    const candidate = match ? (match[1] || match[2]) : null;
    if (candidate && !isFalsePositive(candidate, combinedText)) {
      foundTracking = candidate.trim().toUpperCase();
      foundCarrier = carrier;
      confidence = 'high';
      break;
    }
  }

  // 2. High-confidence Hebrew & English Labeled Context
  // e.g. "מספר מעקב: 123456", "מס' מעקב: CH123456", "דבר דואר שמספרו RR123456789IL", "קוד מעקב: ..."
  if (!foundTracking) {
    const labeledRegex = /(?:tracking\s*(?:number|id|code|no|#)?|מספר\s*מעקב|מס['׳`״]\s*מעקב|קוד\s*מעקב|דבר\s*דואר(?:\s*שמספרו)?|חבילתך\s*במספר|חבילה\s*מספר|מספר\s*משלוח|waybill|awb|consign(?:ment)?|ברקוד(?:\s*משלוח)?)[\s:=#-]+([A-Za-z0-9_-]{6,35})/i;
    const labeledMatch = combinedText.match(labeledRegex);
    if (labeledMatch && labeledMatch[1]) {
      const candidate = labeledMatch[1].trim().toUpperCase();
      if (!isFalsePositive(candidate, combinedText)) {
        foundTracking = candidate;
        confidence = 'high';
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
          else if (/chita|cheetah|צ['׳`״]?יטה/i.test(combinedText)) foundCarrier = 'chita';
          else if (/hfd|epost|אי-?פוסט/i.test(combinedText)) foundCarrier = 'hfd';
          else if (/boxit|בוקסיט/i.test(combinedText)) foundCarrier = 'boxit';
          else if (/buzzr|באזר/i.test(combinedText)) foundCarrier = 'buzzr';
          else if (/tapuz|תפוז/i.test(combinedText)) foundCarrier = 'tapuz';
          else if (/israel\s*post|דואר\s*ישראל/i.test(combinedText)) foundCarrier = 'israel-post';
        }
      }
    }
  }

  // 3. Scan against Pattern Registry
  if (!foundTracking) {
    for (const { carrier, regex } of CARRIER_PATTERNS) {
      const match = combinedText.match(regex);
      if (match && match[1]) {
        const candidate = match[1].trim().toUpperCase();
        if (!isFalsePositive(candidate, combinedText)) {
          foundTracking = candidate;
          foundCarrier = carrier;
          confidence = (carrier === 'israel-post' || carrier === 'ups' || carrier === 'amazon' || carrier === 'cainiao') ? 'high' : 'medium';
          break;
        }
      }
    }
  }

  // 4. DHL 10-digit or FedEx fallback with proximity keyword check
  if (!foundTracking) {
    const dhlMatch = combinedText.match(/\b([0-9]{10})\b/);
    if (dhlMatch && !isFalsePositive(dhlMatch[1], combinedText)) {
      const windowStart = Math.max(0, (dhlMatch.index ?? 0) - 150);
      const windowEnd = Math.min(combinedText.length, (dhlMatch.index ?? 0) + dhlMatch[0].length + 150);
      if (/dhl/i.test(combinedText.slice(windowStart, windowEnd))) {
        foundTracking = dhlMatch[1];
        foundCarrier = 'dhl';
        confidence = 'medium';
      }
    }
  }

  if (!foundTracking) {
    const fedexMatch = combinedText.match(/\b(96\d{20}|[0-9]{12}|[0-9]{15})\b/);
    if (fedexMatch && !isFalsePositive(fedexMatch[1], combinedText)) {
      const windowStart = Math.max(0, (fedexMatch.index ?? 0) - 150);
      const windowEnd = Math.min(combinedText.length, (fedexMatch.index ?? 0) + fedexMatch[0].length + 150);
      if (/fedex/i.test(combinedText.slice(windowStart, windowEnd))) {
        foundTracking = fedexMatch[1];
        foundCarrier = 'fedex';
        confidence = 'medium';
      }
    }
  }

  const title = generateCleanTitle(subject, store, foundCarrier);

  return {
    trackingNumber: foundTracking,
    carrier: foundCarrier,
    title,
    store,
    confidence: foundTracking ? confidence : 'none'
  };
}

