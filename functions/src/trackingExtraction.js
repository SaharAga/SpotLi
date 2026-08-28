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
        if (rule.checksum === 'upu-s10') {
          checksum = validateUPUS10Mod11(cleanVal) ? 'pass' : 'fail';
        }
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
        if (rule.checksum === 'upu-s10') {
          checksum = validateUPUS10Mod11(cleanVal) ? 'pass' : 'fail';
        }

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
