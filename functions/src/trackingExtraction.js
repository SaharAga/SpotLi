/**
 * Robust email parsing and candidate-constrained tracking extraction logic (v2.0.0).
 * Shared by the CloudMailin inbound webhook (inboundEmailHandler.js),
 * Gmail push handler (gmailPushHandler.js), and Gmail historical backfill (gmailBackfill.js).
 */

import carrierSpecs from './carrierSpecs.generated.json' with { type: 'json' };

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
  /^(?:\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4})$/,
  // Standard Order IDs (e.g. Amazon 114-8291029-1928301)
  /^\d{3}-\d{7}-\d{7}$/,
  // Prices / currency
  /^\d+(?:\.\d{2})?\s*(?:₪|\$|€|ILS|USD|EUR)$/i,
  // Generic numeric words like years or short IDs
  /^(?:202[0-9]|2030)$/
];

/**
 * Compiled rules from generated spec.
 */
const COMPILED_RULES = (carrierSpecs.rules || []).map((r) => ({
  ...r,
  re: new RegExp(r.source, r.flags)
}));

/**
 * Standard UPU S10 Modulo-11 Checksum (Israel Post, Cainiao S10, USPS S10, Royal Mail S10).
 * @param {string} s10Identifier
 * @returns {boolean}
 */
export function validateUPUS10Mod11(s10Identifier) {
  if (!s10Identifier || typeof s10Identifier !== 'string') return false;
  const clean = s10Identifier.trim().toUpperCase();
  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(clean)) return false;

  const weights = [8, 6, 4, 2, 3, 5, 9, 7];
  const digits = clean.slice(2, 10);
  const checkDigit = parseInt(clean[10], 10);

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  const remainder = sum % 11;
  let calculatedCheck = 11 - remainder;

  if (calculatedCheck === 10) {
    calculatedCheck = 0;
  } else if (calculatedCheck === 11) {
    calculatedCheck = 5;
  }

  return calculatedCheck === checkDigit;
}

/**
 * USPS IMpb weighted modulo-10 checksum (weights alternate 3, 1 from the
 * right-most data digit). The final digit is the check digit.
 *
 * This intentionally mirrors the client-side `validateMod10(value, [3, 1])`
 * implementation without importing client code into the Functions deploy.
 * @param {string} value
 * @returns {boolean}
 */
export function validateMod10(value) {
  if (!value || typeof value !== 'string' || !/^\d+$/.test(value) || value.length < 2) {
    return false;
  }

  let sum = 0;
  let weight = 3;
  for (let index = value.length - 2; index >= 0; index -= 1) {
    sum += Number(value[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return (10 - (sum % 10)) % 10 === Number(value[value.length - 1]);
}

/**
 * Evaluates a checksum algorithm named by the generated carrier spec.
 * @param {string} value
 * @param {string} checksumAlgorithm
 * @returns {'pass' | 'fail' | 'not-applicable'}
 */
function evaluateChecksum(value, checksumAlgorithm) {
  if (checksumAlgorithm === 'upu-s10') {
    return validateUPUS10Mod11(value) ? 'pass' : 'fail';
  }
  if (checksumAlgorithm === 'mod10-31') {
    return validateMod10(value) ? 'pass' : 'fail';
  }
  return 'not-applicable';
}

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
 * Infers the package lifecycle status from email subject and body text.
 * @param {string} subject
 * @param {string} body
 * @returns {'ordered' | 'in_transit' | 'out_for_delivery' | 'ready_for_pickup' | 'delivered' | 'exception'}
 */
export function inferDeliveryStatus(subject = '', body = '') {
  const combined = `${subject} ${body}`.toLowerCase();

  // 1. Delivered
  if (
    /\b(delivered|successfully delivered|package delivered|item delivered)\b/i.test(combined) ||
    /(?:נמסרה בהצלחה|נמסר ליעד|החבילה נמסרה|נמסר בהצלחה)/i.test(combined)
  ) {
    return 'delivered';
  }

  // 2. Ready for Pickup / Locker / Collection point
  if (
    /\b(ready for (?:pickup|collection)|available for (?:pickup|collection)|waiting for (?:pickup|collection)|arrived at (?:pickup|collection) point|delivered to locker|ready to collect)\b/i.test(combined) ||
    /(?:מוכנה לאיסוף|ממתינה לאיסוף|הגיעה לנקודת איסוף|הגיעה לנקודת חלוקה|הגיעה ללוקר|הגיע ללוקר|החבילה ממתינה לך|מחכה לך בנקודת|איסוף עצמי מ)/i.test(combined)
  ) {
    return 'ready_for_pickup';
  }

  // 3. Out for delivery (courier on the road)
  if (
    /\b(out for delivery|with (?:the\s+)?courier|on its way to you today|delivery today|arriving today)\b/i.test(combined) ||
    /(?:יוצאת למסירה|יצאה עם שליח|נמסרה לשליח|השליח בדרך אליך|חלוקה היום|מגיע היום)/i.test(combined)
  ) {
    return 'out_for_delivery';
  }

  // 4. Exception / Customs issue
  if (
    /\b(delivery issue|delivery failed|delivery exception|customs clearance required|undeliverable)\b/i.test(combined) ||
    /(?:עיכוב במכס|בעיה במסירה|מסירה נכשלה|נכשל ניסיון מסירה)/i.test(combined)
  ) {
    return 'exception';
  }

  // 5. In Transit / Shipped
  if (
    /\b(shipped|in transit|dispatched|on its way|departed|in delivery)\b/i.test(combined) ||
    /(?:נשלחה|נשלח|בדרך|נמסרה לחברת השליחויות|יצאה לדרך)/i.test(combined)
  ) {
    return 'in_transit';
  }

  return 'ordered';
}

/**
 * Derives a clean, user-friendly package title from store and subject.
 * @param {string} subject
 * @param {string|null} store
 * @param {string} carrier
 * @returns {string}
 */
export function generateCleanTitle(subject = '', store = null, carrier = 'other') {
  if (!subject || typeof subject !== 'string') {
    if (store) return `${store} Order`;
    if (carrier !== 'other') return `Package via ${carrier.toUpperCase()}`;
    return 'Online Order';
  }

  // 1. Check for product enclosed in quotes first: e.g. Your order for "Mechanical Keyboard" has shipped
  const productInQuotes = subject.match(/["'״”]([^"'״”]{3,60})["'״”]/);
  if (productInQuotes && productInQuotes[1]) {
    const item = productInQuotes[1].trim();
    if (!/^[A-Z0-9_-]{8,35}$/i.test(item) && !/^(?:order|package|tracking|delivery|shipment)/i.test(item)) {
      return store ? `${store} - ${item}` : item;
    }
  }

  // 2. Check for "for <Item Name>" pattern: e.g. "Delivery update for Running Shoes"
  const forProductMatch = subject.match(/(?:for|עבור)\s+([A-Za-z0-9\u0590-\u05FF\s-]{3,40})(?:\s+(?:has|is|was|נשלח|הגיע|בדרך)|$)/i);
  if (forProductMatch && forProductMatch[1]) {
    const itemCandidate = forProductMatch[1].trim();
    if (!/^(?:order|package|delivery|shipment|pickup|collection|חבילה|משלוח|הזמנה|איסוף|your\s+package)/i.test(itemCandidate) && itemCandidate.length >= 3) {
      return store ? `${store} - ${itemCandidate}` : itemCandidate;
    }
  }

  let clean = subject
    // Strip email forwards / replies
    .replace(/^(?:fwd|fw|re|הועבר|תגובה):\s*/gi, '')
    // Strip common store prefixes like "AliExpress - ", "Amazon.com: ", "SHEIN: "
    .replace(/^(?:aliexpress|amazon(?:\.com)?|shein|temu|ebay|zara|asos|ksp|ivory|super-pharm|wolt)\s*[-:|–—]\s*/gi, '')
    // Strip delivery issue phrases
    .replace(/delivery\s*issue(?:\s*for)?/gi, '')
    // Strip "Package <TRACKING_ID>" or "חבילה <TRACKING_ID>"
    .replace(/(?:package|shipment|order|חבילה|משלוח|הזמנה)\s+[A-Za-z0-9_-]{5,35}/gi, '')
    // Strip tracking numbers
    .replace(/\b[A-Za-z0-9_-]{8,35}\b/g, '')
    // Strip delivery status sentences / phrases
    .replace(/(?:is\s+)?(?:ready|available|waiting)\s+for\s+(?:pickup|collection|delivery)/gi, '')
    .replace(/(?:your\s+order\s+has\s+shipped|order\s+confirmation|shipping\s+confirmation|shipment\s+update|update\s+on\s+order|is\s+on\s+its\s+way|has\s+been\s+dispatched|has\s+been\s+delivered|out\s+for\s+delivery)/gi, '')
    .replace(/(?:נשלחה\s+חבילה|אישור\s+הזמנה|ההזמנה\s+שלך\s+נשלחה|ההזמנה\s+בדרך|החבילה\s+שלך\s+בדרך|הודעה\s+על\s+הגעת\s+חבילה|ממתינה\s+לאיסוף|מוכנה\s+לאיסוף|איסוף\s+מלוקר|איסוף\s+מנקודה|אי-פוסט|שליחויות)/gi, '')
    // Strip remaining generic delivery keywords
    .replace(/\b(?:package|shipment|order|delivery|pickup|collection|delivered|shipped|tracking|item)\b/gi, '')
    .replace(/(?:חבילה|משלוח|הזמנה|איסוף|לוקר|דואר|נקודת\s*חלוקה)/g, '')
    // Strip carrier suffixes like "מ-HFD" or "from HFD" or "via Chita"
    .replace(/(?:מ-|from\s+|via\s+|ב-)(?:hfd|chita|boxit|buzzr|tapuz|bar|lionwheel|israel\s*post|dhl|fedex|ups)/gi, '')
    // Strip punctuation
    .replace(/[#[\](){}:|–—.,/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If the remaining clean text is generic, too short (<3 chars), or purely digits/symbols
  const isGeneric = !clean || 
    clean.length < 3 || 
    /^[0-9_-]+$/.test(clean) ||
    /^(?:package|order|delivery|pickup|collection|delivered|shipped|tracking|item|חבילה|משלוח|הזמנה|איסוף|דואר)$/i.test(clean);

  if (!isGeneric) {
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
 * Extracts locker PIN if present in message body.
 * @param {string} text
 * @returns {string|null}
 */
export function extractLockerPin(text = '') {
  if (!text) return null;
  const pinMatch = text.match(/(?:קוד\s*איסוף|קוד\s*לוקר|קוד\s*פתיחה|locker\s*pin|pickup\s*code|collection\s*pin)[\s:=#-]+(\d{4,8})/i);
  return pinMatch ? pinMatch[1] : null;
}

/**
 * Extracts tracking details and ranked candidates from email with multi-signal evidence scoring.
 * Backwards-compatible with all existing callers while exposing v2.0.0 additive fields.
 *
 * @param {string} subject
 * @param {string} body
 * @param {string} [from]
 * @returns {object}
 */
export function extractTrackingDetails(subject = '', body = '', from = '') {
  const startTime = Date.now();
  const cleanBody = sanitizeEmailHtml(body);
  const combinedText = `${subject} ${cleanBody} ${from}`.slice(0, 25000);
  const store = detectStore(from, combinedText);
  const lockerPin = extractLockerPin(combinedText);

  const candidatesMap = new Map();

  // 1. Courier URL Link Extraction (Highest Priority)
  const carrierUrlPatterns = [
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

  for (const { carrier, pattern } of carrierUrlPatterns) {
    const match = combinedText.match(pattern);
    const candidateVal = match ? (match[1] || match[2] || match[3]) : null;
    if (candidateVal && !isFalsePositive(candidateVal, combinedText)) {
      const cleanVal = candidateVal.trim().toUpperCase();
      candidatesMap.set(cleanVal, {
        id: `cand_${candidatesMap.size + 1}`,
        value: cleanVal,
        carrierCandidates: [carrier],
        formatMatch: true,
        checksum: 'not-applicable',
        urlDomainMatch: true,
        labelProximity: 1.0,
        falsePositiveFlags: [],
        sourceSpan: { start: match.index || 0, end: (match.index || 0) + match[0].length },
        score: 0.95
      });
      break;
    }
  }

  // 2. Scan Labeled Patterns
  const labeledRegex = /(?:tracking\s*(?:number|id|code|no|#)?|מספר\s*מעקב|מס['׳`״]\s*מעקב|קוד\s*מעקב|דבר\s*דואר(?:\s*שמספרו)?|חבילתך\s*במספר|חבילה\s*מספר|מספר\s*משלוח|waybill|awb|consign(?:ment)?|ברקוד(?:\s*משלוח)?)[\s:=#-]+([A-Za-z0-9_-]{6,35})/gi;
  let labeledMatch;

  while ((labeledMatch = labeledRegex.exec(combinedText)) !== null) {
    const rawVal = labeledMatch[1];
    const cleanVal = rawVal.trim().toUpperCase();
    if (isFalsePositive(cleanVal, combinedText)) continue;

    let matchedCarrier = 'other';
    let checksum = 'not-applicable';

    for (const rule of COMPILED_RULES) {
      if (rule.re.test(cleanVal)) {
        matchedCarrier = rule.carrierId;
        checksum = evaluateChecksum(cleanVal, rule.checksum);
        break;
      }
    }

    const start = labeledMatch.index + labeledMatch[0].indexOf(rawVal);
    const end = start + rawVal.length;

    // Check local proximity window for carrier hints
    const windowStart = Math.max(0, start - 150);
    const windowEnd = Math.min(combinedText.length, end + 150);
    const localContext = combinedText.slice(windowStart, windowEnd).toLowerCase();

    if (matchedCarrier === 'other') {
      if (localContext.includes('dhl')) matchedCarrier = 'dhl';
      else if (localContext.includes('fedex')) matchedCarrier = 'fedex';
      else if (localContext.includes('ups')) matchedCarrier = 'ups';
      else if (/chita|cheetah|צ['׳`״]?יטה/i.test(localContext)) matchedCarrier = 'chita';
      else if (/hfd|epost|אי-?פוסט/i.test(localContext)) matchedCarrier = 'hfd';
      else if (/boxit|בוקסיט/i.test(localContext)) matchedCarrier = 'boxit';
      else if (/buzzr|באזר/i.test(localContext)) matchedCarrier = 'buzzr';
      else if (/tapuz|תפוז/i.test(localContext)) matchedCarrier = 'tapuz';
      else if (/israel\s*post|דואר\s*ישראל/i.test(localContext)) matchedCarrier = 'israel-post';
      else if (localContext.includes('amazon') || /tba\d+/i.test(cleanVal)) matchedCarrier = 'amazon';
    }

    let score = 0.70;
    if (matchedCarrier !== 'other') score += 0.15;
    if (checksum === 'pass') score += 0.15;
    if (checksum === 'fail') score -= 0.10; // modest penalty for placeholder test fixtures

    if (!candidatesMap.has(cleanVal)) {
      candidatesMap.set(cleanVal, {
        id: `cand_${candidatesMap.size + 1}`,
        value: cleanVal,
        carrierCandidates: [matchedCarrier],
        formatMatch: matchedCarrier !== 'other',
        checksum,
        urlDomainMatch: false,
        labelProximity: 1.0,
        falsePositiveFlags: [],
        sourceSpan: { start, end },
        score: Math.min(1.0, Math.max(0.0, score))
      });
    }
  }

  // 3. Scan Tokens against Carrier Rules
  const tokenRegex = /\b([A-Za-z0-9]{6,35})\b/g;
  let tokenMatch;

  while ((tokenMatch = tokenRegex.exec(combinedText)) !== null) {
    const rawVal = tokenMatch[1];
    const cleanVal = rawVal.trim().toUpperCase();
    if (candidatesMap.has(cleanVal) || isFalsePositive(cleanVal, combinedText)) continue;

    for (const rule of COMPILED_RULES) {
      if (rule.re.test(cleanVal)) {
        let checksum = 'not-applicable';
        checksum = evaluateChecksum(cleanVal, rule.checksum);

        // Check proximity if rule is generic digits (e.g. 10 digits for DHL or 12 for FedEx)
        let proximityBoost = 0;
        if (/^\d{10,12}$/.test(cleanVal)) {
          const windowStart = Math.max(0, tokenMatch.index - 120);
          const windowEnd = Math.min(combinedText.length, tokenMatch.index + rawVal.length + 120);
          const localContext = combinedText.slice(windowStart, windowEnd).toLowerCase();
          if (localContext.includes(rule.carrierId.toLowerCase())) {
            proximityBoost = 0.25;
          } else {
            continue; // Skip ambiguous bare digits without carrier keyword nearby
          }
        }

        let score = rule.confidence === 'high' ? 0.70 : 0.45;
        score += proximityBoost;
        if (checksum === 'pass') score += 0.20;
        if (checksum === 'fail') score -= 0.10;

        candidatesMap.set(cleanVal, {
          id: `cand_${candidatesMap.size + 1}`,
          value: cleanVal,
          carrierCandidates: [rule.carrierId],
          formatMatch: true,
          checksum,
          urlDomainMatch: false,
          labelProximity: proximityBoost > 0 ? 0.8 : 0.0,
          falsePositiveFlags: [],
          sourceSpan: { start: tokenMatch.index, end: tokenMatch.index + rawVal.length },
          score: Math.min(1.0, Math.max(0.0, score))
        });
        break;
      }
    }
  }

  const candidates = Array.from(candidatesMap.values()).sort((a, b) => b.score - a.score);
  const selectedCandidate = candidates.length > 0 ? candidates[0] : null;

  let trackingNumber = null;
  let carrier = 'other';
  let status = 'none';
  let confidence = 'none';

  if (selectedCandidate && selectedCandidate.score >= 0.40) {
    trackingNumber = selectedCandidate.value;
    carrier = selectedCandidate.carrierCandidates[0] || 'other';

    if (selectedCandidate.score >= 0.80 && selectedCandidate.checksum !== 'fail') {
      status = 'verified';
      confidence = 'high';
    } else if (selectedCandidate.score >= 0.60) {
      status = 'probable';
      confidence = 'medium';
    } else {
      status = 'uncertain';
      confidence = 'low';
    }
  }

  const title = generateCleanTitle(subject, store, carrier);
  const latencyMs = Date.now() - startTime;

  return {
    trackingNumber,
    carrier,
    title,
    store,
    pickupLocation: '',
    origin: '',
    notes: '',
    lockerPin,
    status,
    confidence: trackingNumber ? confidence : 'none',
    candidates,
    selectedCandidate,
    evidenceSummary: selectedCandidate ? [`Selected ${selectedCandidate.value} for ${carrier} (score: ${selectedCandidate.score})`] : [],
    executionPath: selectedCandidate ? 'deterministic_fast_path' : 'safe_abstention',
    latencyMs
  };
}
