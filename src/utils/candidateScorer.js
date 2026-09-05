import carrierSpecs from '../types/carrierSpecs.generated.json';
import { validateUPUS10Mod11, validateMod10 } from './carrierDetector.js';

/**
 * Keyword definitions for label proximity scoring (Hebrew and English).
 */
const TRACKING_KEYWORDS = [
  'tracking',
  'package',
  'parcel',
  'מעקב',
  'חבילה',
  'חבילתך',
  'משלוח',
  'tracking number',
  'track number',
  'waybill',
  'awb',
  'consignment',
  'shipment',
  'מספר מעקב',
  'מס מעקב',
  'מס׳ מעקב',
  'מס\' מעקב',
  'קוד מעקב',
  'דבר דואר',
  'חבילה מספר',
  'משלוח מספר',
  'מספר משלוח',
  'ברקוד משלוח',
  'שליחויות',
  'דואר ישראל',
  'israel post',
  'צ\'יטה',
  'chita',
  'בוקסיט',
  'boxit',
  'באזר',
  'buzzr',
  'תפוז',
  'tapuz',
  'hfd',
  'epost',
  'בר הפצה',
  'bar distribution',
  'זיגזג',
  'zigzag',
  'lionwheel',
  'cainiao',
  'aliexpress',
  'עליאקספרס',
  'yunexpress',
  '4px',
  'yanwen',
  'dhl',
  'fedex',
  'פדאקס',
  'ups',
  'usps',
  'aramex'
];

/**
 * Compiled RegExp rules cached from generated specs.
 */
const COMPILED_RULES = (carrierSpecs.rules || []).map((rule) => ({
  ...rule,
  re: new RegExp(rule.source, rule.flags)
}));

/**
 * False-positive detection patterns.
 */
const FALSE_POSITIVE_PATTERNS = {
  // Israeli phone numbers: 050..., 052..., 053..., 054..., 058..., 9725..., +9725...
  phone_number: /^(?:\+?972|0)(?:5[0-9]|7[0-9]|[23489])\d{7}$/,
  // ISO Dates (YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY)
  date: /^(?:\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4})$/,
  // Common Order IDs (e.g. Amazon 114-8291029-1928301, #12345)
  order_number: /^(?:\d{3}-\d{7}-\d{7}|#\d{4,12})$/,
  // Price / currency amounts
  price: /^\d+(?:\.\d{2})?\s*(?:₪|\$|€|ILS|USD|EUR)$/i,
  // Repeated digits e.g. 0000000, 11111111
  repeated_digits: /^(\d)\1{5,}$/
};

/**
 * Markers of a promotional or survey message rather than a shipment notice.
 *
 * Couriers market to their own customers — a Cheetah ad and a Cheetah delivery
 * notice both say "צ'יטה", so brand presence cannot separate them, and both
 * contain numbers. What separates them is intent: a promotion sells or asks,
 * a shipment notice reports. These markers only ever *suppress* a candidate
 * that has no tracking label, no carrier host and no valid check digit, so a
 * genuine delivery notice that happens to mention a discount is unaffected.
 */
const PROMOTIONAL_MARKERS = [
  /מבצע/, /הנחה/, /קופון/, /בתוקף\s*עד/, /קנו\s*עכשיו/, /הצטרפו/, /להסרה/,
  /דרגו\s*אותנו/, /סקר/, /שביעות\s*רצון/, /איך\s*היה\s*השירות/, /נשמח\s*למשוב/,
  /\bcoupon\b/i, /\bpromo\b/i, /\bdiscount\b/i, /\b\d{1,2}%\s*off\b/i,
  /\bsale\b/i, /\bunsubscribe\b/i, /\bsurvey\b/i, /\brate\s+(?:us|your)\b/i,
  /\bshop\s+now\b/i, /\blimited\s+time\b/i
];

/**
 * True when the surrounding message reads as marketing or a survey.
 * @param {string} fullText
 * @returns {boolean}
 */
export function isPromotionalContext(fullText) {
  if (!fullText || typeof fullText !== 'string') return false;
  return PROMOTIONAL_MARKERS.some((marker) => marker.test(fullText));
}

/**
 * Validates check digit according to algorithm.
 * @param {string} value
 * @param {string} checksumAlgorithm
 * @returns {'pass' | 'fail' | 'not-applicable'}
 */
export function evaluateChecksum(value, checksumAlgorithm) {
  if (!value || checksumAlgorithm === 'not-applicable') {
    return 'not-applicable';
  }

  if (checksumAlgorithm === 'upu-s10') {
    return validateUPUS10Mod11(value) ? 'pass' : 'fail';
  }

  if (checksumAlgorithm === 'mod10-31') {
    return validateMod10(value, [3, 1]) ? 'pass' : 'fail';
  }

  return 'not-applicable';
}

/**
 * Calculates keyword proximity score (0.0 to 1.0) based on distance to nearest tracking keyword.
 * @param {string} fullText
 * @param {number} startIdx
 * @param {number} endIdx
 * @returns {number}
 */
export function calculateLabelProximity(fullText, startIdx, endIdx) {
  if (!fullText || startIdx < 0) return 0;

  const windowSize = 120;
  const beforeStart = Math.max(0, startIdx - windowSize);
  const beforeText = fullText.slice(beforeStart, startIdx).toLowerCase();

  const afterEnd = Math.min(fullText.length, endIdx + windowSize);
  const afterText = fullText.slice(endIdx, afterEnd).toLowerCase();

  let closestDistance = Infinity;

  for (const keyword of TRACKING_KEYWORDS) {
    const kwLower = keyword.toLowerCase();

    // Check before candidate (typical: "Tracking Number: 12345")
    const lastBeforePos = beforeText.lastIndexOf(kwLower);
    if (lastBeforePos !== -1) {
      const distance = beforeText.length - (lastBeforePos + kwLower.length);
      if (distance < closestDistance) {
        closestDistance = distance;
      }
    }

    // Check after candidate
    const firstAfterPos = afterText.indexOf(kwLower);
    if (firstAfterPos !== -1) {
      const distance = firstAfterPos;
      if (distance < closestDistance) {
        closestDistance = distance;
      }
    }
  }

  if (closestDistance === Infinity) return 0;
  // Distance decay: immediate proximity (<15 chars) = 1.0, decaying to 0.0 at 120 chars
  return Math.max(0, parseFloat((1 - Math.min(closestDistance, windowSize) / windowSize).toFixed(3)));
}

/**
 * Identifies false positive flags for a candidate string.
 * @param {string} candidate
 * @param {string} fullText
 * @param {number} startIdx
 * @param {number} endIdx
 * @returns {Array<'otp_code' | 'order_number' | 'phone_number' | 'date_or_price' | 'repeated_digits'>}
 */
export function detectFalsePositiveFlags(candidate, fullText = '', startIdx = -1, endIdx = -1) {
  const flags = [];
  const clean = candidate.trim().replace(/[\s-_]/g, '');

  const hasTrackingPrefix = fullText && startIdx >= 0 && /(?:מספר|מס['׳`״]?|מעקב|דואר|משלוח|חבילה|חבילת|פריט|בוקסיט|צ['׳`״]יטה|באזר|תפוז|hfd|chita|epost|boxit|buzzr|tapuz|bar|waybill|awb|tracking)\s*[:#-]?\s*$/i.test(fullText.slice(Math.max(0, startIdx - 40), startIdx));

  // Phone number checks - ONLY applicable to pure numeric candidates
  if (/^\d+$/.test(clean)) {
    if (/^(?:\+?972|0)5[0-9]\d{7}$/.test(clean)) {
      flags.push('phone_number');
    } else if (!hasTrackingPrefix && (FALSE_POSITIVE_PATTERNS.phone_number.test(clean) || FALSE_POSITIVE_PATTERNS.phone_number.test(candidate.trim()))) {
      flags.push('phone_number');
    }

    // Preceded by phone/inquiry keyword (e.g. לבירורים: 02-8123456)
    if (fullText && startIdx >= 0) {
      const before = fullText.slice(Math.max(0, startIdx - 25), startIdx).toLowerCase();
      if (/(?:לבירורים|טלפון|טל['׳`״]|ליצירת\s*קשר|phone|tel)\s*[:#-]+\s*$/i.test(before)) {
        flags.push('phone_number');
      }
    }
  }

  if (FALSE_POSITIVE_PATTERNS.date.test(candidate.trim()) || FALSE_POSITIVE_PATTERNS.price.test(candidate.trim())) {
    flags.push('date_or_price');
  }

  if (FALSE_POSITIVE_PATTERNS.order_number.test(candidate.trim())) {
    flags.push('order_number');
  }

  if (FALSE_POSITIVE_PATTERNS.repeated_digits.test(clean)) {
    flags.push('repeated_digits');
  }

  // Domain name check (e.g. tapuzdelivery.co.il, zigzag.co.il)
  if (/^(?:https?|www|com|courier|delivery|israelpost|chita|epost|hfd|boxit|buzzr|tapuz|tapuzdelivery|zigzag|barexpress|lionwheel|package|tracking)$/i.test(clean)) {
    flags.push('domain_name');
  }

  if (fullText && endIdx > 0) {
    const after = fullText.slice(endIdx, endIdx + 10);
    if (/^\.(?:co\.il|com|org|net|app|io|me|ly)/i.test(after)) {
      flags.push('domain_name');
    }
  }

  // OTP Verification check (4-8 digits immediately next to security/verification keywords)
  if (/^\d{4,8}$/.test(clean) && fullText && startIdx >= 0) {
    const before = fullText.slice(Math.max(0, startIdx - 35), startIdx).toLowerCase();
    const isInsideUrl = /(?:https?:\/\/|www\.|\.co\.il|\.com|\/p\/|\/t\/|\/orders\/|\?num=|\?track=|\?code=|\?id=)/i.test(before);

    if (!isInsideUrl && /(?:קוד\s*(?:אימות|סודי|איסוף|חד-?פעמי|פתיחה|לפתיחה|מסירה|סודי\s*לפתיחה|לפתיחת\s*תא)|verification\s*code|one-?time\s*password|otp|security\s*code|your\s*code\s*is)[^.\r\n]{0,25}$/i.test(before)) {
      if (!hasTrackingPrefix) {
        flags.push('otp_code');
      }
    }
  }

  return flags;
}

/**
 * Checks if a candidate is associated with a matching carrier domain.
 * @param {string} carrierId
 * @param {string} fullText
 * @returns {boolean}
 */
export function checkUrlDomainMatch(carrierId, fullText) {
  if (!carrierId || !fullText || carrierId === 'other') return false;
  const carrierInfo = carrierSpecs.carriers?.[carrierId];
  if (!carrierInfo || !Array.isArray(carrierInfo.domains)) return false;

  const textLower = fullText.toLowerCase();
  return carrierInfo.domains.some((domain) => textLower.includes(domain.toLowerCase()));
}

/**
 * Computes a calibrated evidence score (0.0 to 1.0) for an extracted candidate.
 * @param {object} candidate
 * @returns {number}
 */
export function computeCandidateScore(candidate) {
  let score = 0.0;

  // 1. Format match & rule confidence
  if (candidate.formatMatch) {
    if (candidate.distinctive === false) {
      // Shape-only match (a bare digit run). Alone this is barely evidence at
      // all — but an explicit label directly before it ("מעקב: 3019284756")
      // corroborates the shape, so the match earns its normal medium-confidence
      // credit. Unlabeled, it must wait for a carrier domain or a check digit.
      score += (candidate.labelProximity ?? 0) >= 0.8 ? 0.35 : 0.20;
    } else {
      score += candidate.highestConfidence === 'high' ? 0.65 : 0.35;
    }
  } else if (candidate.labelProximity >= 0.8) {
    // Explicitly labeled tracking candidate (e.g. "Tracking ID: XYZ")
    score += 0.50;
  }

  // 2. Checksum validation
  if (candidate.checksum === 'pass') {
    score += 0.30;
  } else if (candidate.checksum === 'fail' && !candidate.urlDomainMatch && candidate.labelProximity < 0.8) {
    score -= 0.50;
  }

  // 3. Courier URL domain match
  if (candidate.urlDomainMatch) {
    score += 0.30;
  }

  // 4. Labeled proximity
  if (candidate.labelProximity > 0) {
    score += 0.25 * candidate.labelProximity;
  }

  // 5. False positive penalties
  const penalties = {
    promotional_context: 0.85,
    otp_code: 0.85,
    phone_number: 0.85,
    date_or_price: 0.85,
    repeated_digits: 0.60,
    order_number: 0.45
  };

  for (const flag of candidate.falsePositiveFlags || []) {
    score -= penalties[flag] || 0.40;
  }

  return Math.max(0.0, Math.min(1.0, parseFloat(score.toFixed(3))));
}

export function classifyConfidenceTier(score, candidate) {
  if (candidate?.falsePositiveFlags && candidate.falsePositiveFlags.length > 0) {
    return score >= 0.65 ? 'probable' : (score >= 0.40 ? 'uncertain' : 'none');
  }

  if (candidate?.checksum === 'fail' && !candidate?.urlDomainMatch && candidate?.labelProximity < 0.8) {
    return 'uncertain';
  }

  // Candidates with URL domain match on official courier sites
  if (candidate?.urlDomainMatch && candidate?.formatMatch) {
    return 'verified';
  }

  // Valid checksum on known carrier formats
  if (candidate?.checksum === 'pass' && candidate?.formatMatch) {
    return 'verified';
  }

  // `verified` is the tier Smart Import auto-fills without asking, so a
  // shape-only match never reaches it on score alone — it needs a carrier
  // domain or a passing check digit to confirm the number is really a shipment.
  // An explicit label immediately before the number ("מעקב: 3019284756",
  // "Your package 749201849281") is the corroboration a shape-only match
  // needs — it is a statement that this number identifies a shipment. Brand
  // presence alone is not: courier ads and delivery surveys name a carrier
  // too, but put no tracking label anywhere near their digits.
  const shapeOnly = candidate?.formatMatch
    && candidate?.distinctive === false
    && (candidate?.labelProximity ?? 0) < 0.8;

  if (shapeOnly && !candidate?.urlDomainMatch && candidate?.checksum !== 'pass') {
    return score >= 0.60 ? 'probable' : (score >= 0.30 ? 'uncertain' : 'none');
  }

  // Verified requires score >= 0.80 (format match + keyword proximity or official domain)
  if (score >= 0.80 && candidate?.formatMatch && candidate?.checksum !== 'fail') {
    return 'verified';
  }

  // Standalone bare format match with no keyword proximity and no URL match is uncertain
  if (score < 0.70 && (!candidate?.labelProximity || candidate.labelProximity === 0) && !candidate?.urlDomainMatch) {
    return 'uncertain';
  }

  if (score >= 0.50) {
    return 'probable';
  }

  return score >= 0.30 ? 'uncertain' : 'none';
}

/**
 * Evaluates candidate token against all compiled carrier rules.
 * @param {string} candidateValue
 * @returns {{ formatMatch: boolean, carrierCandidates: string[], highestConfidence: 'high'|'medium'|'none', checksum: 'pass'|'fail'|'not-applicable', distinctive: boolean }}
 */
export function evaluateCandidateRules(candidateValue) {
  if (FALSE_POSITIVE_PATTERNS.phone_number.test(candidateValue) || FALSE_POSITIVE_PATTERNS.phone_number.test(candidateValue.trim().replace(/[\s-_]/g, ''))) {
    return {
      formatMatch: false,
      carrierCandidates: ['other'],
      highestConfidence: 'none',
      checksum: 'not-applicable',
      bestPriority: 999,
      distinctive: false
    };
  }

  const matchingCarriers = [];
  let highestConf = 'none';
  let checksumResult = 'not-applicable';
  let bestPriority = 999;

  for (const rule of COMPILED_RULES) {
    if (rule.re.test(candidateValue)) {
      if (!matchingCarriers.includes(rule.carrierId)) {
        matchingCarriers.push(rule.carrierId);
      }
      if (rule.priority !== undefined && rule.priority < bestPriority) {
        bestPriority = rule.priority;
      }
      if (rule.confidence === 'high') {
        highestConf = 'high';
      } else if (highestConf === 'none') {
        highestConf = 'medium';
      }
      if (checksumResult === 'not-applicable' && rule.checksum !== 'not-applicable') {
        checksumResult = evaluateChecksum(candidateValue, rule.checksum);
      }
    }
  }

  const formatMatch = matchingCarriers.length > 0;

  return {
    formatMatch,
    carrierCandidates: formatMatch ? matchingCarriers : ['other'],
    highestConfidence: highestConf,
    checksum: checksumResult,
    bestPriority,
    // A match is *distinctive* when the value itself identifies a carrier: it
    // carries a carrier prefix/suffix (RS…IL, 1Z…, CH…, 4PX…) or its check
    // digit verifies. A match on shape alone — "nine digits", "twelve digits" —
    // is not distinctive: invoice numbers, customer numbers, parking fines and
    // URL path ids all have those shapes, and there are far more of them in a
    // user's SMS inbox than there are shipments.
    distinctive: formatMatch && (/[A-Z]/i.test(candidateValue) || checksumResult === 'pass')
  };
}

const METADATA_WORDS = new Set([
  'UPDATE', 'UPDATES', 'DETAILS', 'DETAIL', 'STATUS', 'INFO', 'INFORMATION',
  'ALERT', 'ALERTS', 'NOTIFICATION', 'NOTIFICATIONS', 'MESSAGE', 'MESSAGES',
  'NUMBER', 'NUMBERS', 'CODE', 'CODES', 'LINK', 'LINKS', 'ONLINE', 'CENTER',
  'SERVICE', 'SERVICES', 'DELIVERY', 'DELIVERIES', 'SHIPMENT', 'SHIPMENTS',
  'PACKAGE', 'PACKAGES', 'PARCEL', 'PARCELS', 'TRACK', 'TRACKING', 'REPORT',
  'SUMMARY', 'CUSTOMER', 'SUPPORT', 'CONFIRMATION', 'RECEIPT', 'PORTAL', 'LOGISTICS'
]);

/**
 * Checks if a candidate is a false positive based on detected flags.
 * @param {string} candidate
 * @param {string} fullText
 * @param {number} startIdx
 * @param {number} endIdx
 * @returns {boolean}
 */
export function isFalsePositive(candidate, fullText = '', startIdx = -1, endIdx = -1) {
  const flags = detectFalsePositiveFlags(candidate, fullText, startIdx, endIdx);
  return flags.length > 0;
}

/**
 * Extracts, validates, and ranks all tracking candidates from raw text.
 * @param {string} text
 * @returns {Array<object>} Sorted candidate array with calibrated scores
 */
export function extractAndScoreCandidates(text) {
  if (!text || typeof text !== 'string') return [];

  const normalizedText = text;
  const candidatesMap = new Map();

  // 1. Scan for URLs containing tracking codes in paths or queries
  const urlPattern = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+|[a-zA-Z0-9-]+\.(?:co\.il|com|org|net|app|io|me|ly)\/[^\s<>"'{}|\\^`[\]]+/gi;
  let urlMatch;
  while ((urlMatch = urlPattern.exec(normalizedText)) !== null) {
    const fullUrl = urlMatch[0];
    try {
      const urlStr = fullUrl.startsWith('http') ? fullUrl : 'https://' + fullUrl;
      const parsed = new URL(urlStr);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

      // Identify carrier from domain
      let domainCarrier = null;
      for (const [id, carrier] of Object.entries(carrierSpecs.carriers || {})) {
        if (carrier.domains && carrier.domains.some((d) => host.includes(d))) {
          domainCarrier = id;
          break;
        }
      }

      // Query parameters
      for (const param of ['num', 'track', 'tracking', 'id', 'itemcode', 'item', 'barcode', 'b', 't', 'code', 'order', 'c', 'tracknum', 'tradeId', 'orderId', 'outPackageId', 'trade_no', 'mailNo', 'mailNoList']) {
        const val = parsed.searchParams.get(param);
        if (val) {
          const cleanVal = val.trim().replace(/[.,;:!?]+$/, '').toUpperCase();
          const start = urlMatch.index + fullUrl.indexOf(val);
          const end = start + val.length;
          if (cleanVal.length >= 5 && cleanVal.length <= 35 && !METADATA_WORDS.has(cleanVal) && !isFalsePositive(cleanVal, normalizedText, start, end)) {
            const ruleEval = evaluateCandidateRules(cleanVal);
            const carriers = domainCarrier
              ? [domainCarrier, ...ruleEval.carrierCandidates.filter((c) => c !== domainCarrier)]
              : ruleEval.carrierCandidates;
            candidatesMap.set(cleanVal, {
              id: `cand_${candidatesMap.size + 1}`,
              value: cleanVal,
              carrierCandidates: carriers,
              // A value sitting in a `?tracking=` parameter is strong evidence
              // even off a carrier domain, but it is not a *format* match unless
              // it actually matches a carrier rule.
              formatMatch: ruleEval.formatMatch || Boolean(domainCarrier),
              distinctive: ruleEval.distinctive || Boolean(domainCarrier),
              highestConfidence: domainCarrier ? 'high' : (ruleEval.highestConfidence === 'none' ? 'medium' : ruleEval.highestConfidence),
              priority: ruleEval.bestPriority,
              checksum: ruleEval.checksum,
              // Only a recognised carrier host counts as a domain match. Any
              // site can have a `?id=` parameter.
              urlDomainMatch: Boolean(domainCarrier),
              labelProximity: 1.0,
              falsePositiveFlags: [],
              sourceSpan: { start: urlMatch.index, end: urlMatch.index + fullUrl.length }
            });
          }
        }
      }
      // Path segments (e.g. /t/3094829104, /p/8492018, /orders/LW94820194)
      const segments = parsed.pathname.split('/').filter(Boolean);
      for (const seg of segments) {
        if (!/^(?:track|itemtrace|tracking|portal|runportal|view|online|app|status|order|orders|p|t|b|packages|package|shipment|shipments|logistics|detail|search|index|home)$/i.test(seg) && !/\.(?:html?|php|jsp|aspx?|do)$/i.test(seg)) {
          const cleanVal = seg.trim().replace(/[.,;:!?]+$/, '').toUpperCase();
          const start = urlMatch.index + fullUrl.indexOf(seg);
          const end = start + seg.length;
          // A path segment with no digit at all is a word, not an identifier
          // ("/article/", "/checkout/"). Every real tracking format contains
          // digits, so this costs no recall.
          const hasDigit = /\d/.test(cleanVal);

          // Unlike a `?tracking=` parameter, a bare path segment carries no
          // statement that it *is* a tracking number. Off a carrier domain it
          // must earn its place by matching a carrier format.
          const ruleEval = hasDigit ? evaluateCandidateRules(cleanVal) : null;
          const segmentIsCredible = hasDigit && (Boolean(domainCarrier) || ruleEval.formatMatch);

          if (segmentIsCredible && /^[A-Za-z0-9_-]{5,35}$/.test(cleanVal) && !METADATA_WORDS.has(cleanVal) && !isFalsePositive(cleanVal, normalizedText, start, end)) {
            const carriers = domainCarrier
              ? [domainCarrier, ...ruleEval.carrierCandidates.filter((c) => c !== domainCarrier)]
              : ruleEval.carrierCandidates;
            candidatesMap.set(cleanVal, {
              id: `cand_${candidatesMap.size + 1}`,
              value: cleanVal,
              carrierCandidates: carriers,
              formatMatch: ruleEval.formatMatch || Boolean(domainCarrier),
              distinctive: ruleEval.distinctive || Boolean(domainCarrier),
              highestConfidence: domainCarrier ? 'high' : ruleEval.highestConfidence,
              priority: ruleEval.bestPriority,
              checksum: ruleEval.checksum,
              urlDomainMatch: Boolean(domainCarrier),
              // On a carrier host, being in the tracking path *is* the label.
              // Anywhere else the segment is just a path id — every site has
              // them — so it has to earn proximity from the surrounding text
              // like any other token.
              labelProximity: domainCarrier ? 1.0 : calculateLabelProximity(normalizedText, start, end),
              falsePositiveFlags: [],
              sourceSpan: { start: urlMatch.index, end: urlMatch.index + fullUrl.length }
            });
          }
        }
      }
    } catch {
      // Ignore URL parse error
    }
  }

  // 2. Scan for labeled tracking number spans (e.g. "מעקב: ABC1234567")
  const labeledPattern = /(?:tracking\s*(?:number|id|code|no|#)?|מספר\s*מעקב|מס['׳`״]\s*מעקב|קוד\s*מעקב|דבר\s*דואר(?:\s*שמספרו)?|פריט\s*דואר|חבילה\s*מספר|מספר\s*משלוח|(?:חבילת|משלוח)\s+(?:בוקסיט|צ['׳`״]יטה|באזר|תפוז|hfd|epost|דואר|boxit|buzzr|tapuz|bar|בר\s*הפצה|זיגזג|zigzag)(?:\s+(?:מס['׳`״]?|מספר))?|משלוח(?:\s+[A-Za-z0-9'״׳א-ת-]+)*\s*(?:מס['׳`״]?|מספר)|waybill|awb|waybill\s*(?:no|#|num)?|ברקוד(?:\s*משלוח)?)[\s:=#-]+([A-Za-z0-9_-]{6,35})/gi;
  let labeledMatch;

  while ((labeledMatch = labeledPattern.exec(normalizedText)) !== null) {
    const rawVal = labeledMatch[1];
    const cleanVal = rawVal.trim().toUpperCase();
    if (METADATA_WORDS.has(cleanVal)) continue;

    const start = labeledMatch.index + labeledMatch[0].indexOf(rawVal);
    const end = start + rawVal.length;

    if (isFalsePositive(cleanVal, normalizedText, start, end)) continue;

    const ruleEval = evaluateCandidateRules(cleanVal);
    let primaryCarrier = ruleEval.carrierCandidates[0] || 'other';

    // If candidate has domestic phrasing (e.g. Cheetah / BoxIt / Buzzr / Tapuz / HFD)
    let carriers = ruleEval.carrierCandidates;
    let formatMatch = ruleEval.formatMatch;
    let highestConf = ruleEval.highestConfidence === 'none' ? 'medium' : ruleEval.highestConfidence;
    let pri = ruleEval.bestPriority;

    if (!formatMatch && /^\d{6,10}$/.test(cleanVal)) {
      const matchSpan = labeledMatch[0].toLowerCase();
      let phrasedCarrier = null;
      if (/בוקסיט|boxit/i.test(matchSpan)) phrasedCarrier = 'boxit';
      else if (/צ['׳`״]יטה|chita/i.test(matchSpan)) phrasedCarrier = 'chita';
      else if (/באזר|buzzr/i.test(matchSpan)) phrasedCarrier = 'buzzr';
      else if (/תפוז|tapuz/i.test(matchSpan)) phrasedCarrier = 'tapuz';
      else if (/hfd|אי-?פוסט|epost/i.test(matchSpan)) phrasedCarrier = 'hfd';
      else if (/בר\s*הפצה|barexpress/i.test(matchSpan)) phrasedCarrier = 'bar-distribution';
      else if (/זיגזג|zigzag/i.test(matchSpan)) phrasedCarrier = 'zigzag';

      if (phrasedCarrier) {
        carriers = [phrasedCarrier];
        primaryCarrier = phrasedCarrier;
        formatMatch = true;
        highestConf = 'high';
        pri = 50;
      }
    }

    candidatesMap.set(cleanVal, {
      id: `cand_${candidatesMap.size + 1}`,
      value: cleanVal,
      carrierCandidates: carriers,
      formatMatch,
      // An explicit "מספר מעקב:" label is itself carrier-independent evidence
      // that the value is a shipment id, so a labeled hit is never shape-only.
      distinctive: true,
      highestConfidence: highestConf,
      priority: pri,
      checksum: ruleEval.checksum,
      urlDomainMatch: checkUrlDomainMatch(primaryCarrier, normalizedText),
      labelProximity: 1.0, // Directly extracted from labeled pattern
      falsePositiveFlags: detectFalsePositiveFlags(cleanVal, normalizedText, start, end),
      sourceSpan: { start, end }
    });
  }

  // 3b. Re-join tracking numbers printed in groups.
  //
  // Carriers space their own identifiers for readability — UPS writes
  // "1Z 999 AA1 01 2345 6784" in its shipment emails, and Israel Post labels
  // read "RS 7361 0294 1 IL". Word tokenization shreds these into fragments
  // that match nothing, so the number is simply never found.
  //
  // A joined form is only kept when it matches a carrier rule *distinctively*
  // (carrier prefix/suffix, or a verifying check digit). That condition is what
  // makes this safe: arbitrary neighbouring numbers in a message — a date next
  // to a price, a street number next to a floor — cannot accidentally join into
  // a valid identifier, so this adds recall without costing precision.
  const groupedPattern = /\b[A-Za-z0-9]{1,6}(?:[ -][A-Za-z0-9]{1,6}){2,9}\b/g;
  let groupedMatch;

  while ((groupedMatch = groupedPattern.exec(normalizedText)) !== null) {
    // The run is greedy, so it also swallows the ordinary words that follow
    // ("… 2345 6784 is out for delivery"). Test contiguous sub-runs, longest
    // first, and keep the first that forms a distinctive identifier.
    const tokens = groupedMatch[0].split(/[ -]/).filter(Boolean);
    let found = null;

    outer:
    for (let from = 0; from < tokens.length - 2 && !found; from += 1) {
      for (let to = tokens.length; to > from + 2; to -= 1) {
        const joined = tokens.slice(from, to).join('').toUpperCase();
        if (joined.length < 8 || joined.length > 35) continue;
        if (candidatesMap.has(joined)) continue;

        const evaluated = evaluateCandidateRules(joined);
        if (evaluated.formatMatch && evaluated.distinctive) {
          const offset = groupedMatch[0].indexOf(tokens[from]);
          found = { joined, ruleEval: evaluated, offset };
          break outer;
        }
      }
    }

    if (!found) continue;

    const { joined, ruleEval } = found;
    const start = groupedMatch.index + found.offset;
    const end = groupedMatch.index + groupedMatch[0].length;
    if (isFalsePositive(joined, normalizedText, start, end)) continue;

    const primaryCarrier = ruleEval.carrierCandidates[0] || 'other';

    candidatesMap.set(joined, {
      id: `cand_${candidatesMap.size + 1}`,
      value: joined,
      carrierCandidates: ruleEval.carrierCandidates,
      formatMatch: true,
      distinctive: true,
      highestConfidence: ruleEval.highestConfidence,
      priority: ruleEval.bestPriority,
      checksum: ruleEval.checksum,
      urlDomainMatch: checkUrlDomainMatch(primaryCarrier, normalizedText),
      labelProximity: calculateLabelProximity(normalizedText, start, end),
      falsePositiveFlags: detectFalsePositiveFlags(joined, normalizedText, start, end),
      sourceSpan: { start, end }
    });
  }

  // 3. Scan for regex tokens in plain text
  const tokenPattern = /\b([A-Za-z0-9]{6,35})\b/g;
  let tokenMatch;

  while ((tokenMatch = tokenPattern.exec(normalizedText)) !== null) {
    const rawVal = tokenMatch[1];
    const cleanVal = rawVal.trim().toUpperCase();

    if (candidatesMap.has(cleanVal) || METADATA_WORDS.has(cleanVal)) continue;

    const start = tokenMatch.index;
    const end = start + rawVal.length;

    if (isFalsePositive(cleanVal, normalizedText, start, end)) continue;

    const ruleEval = evaluateCandidateRules(cleanVal);
    if (!ruleEval.formatMatch) continue; // Skip non-tracking random tokens

    const primaryCarrier = ruleEval.carrierCandidates[0] || 'other';

    candidatesMap.set(cleanVal, {
      id: `cand_${candidatesMap.size + 1}`,
      value: cleanVal,
      carrierCandidates: ruleEval.carrierCandidates,
      formatMatch: ruleEval.formatMatch,
      distinctive: ruleEval.distinctive,
      highestConfidence: ruleEval.highestConfidence,
      priority: ruleEval.bestPriority,
      checksum: ruleEval.checksum,
      urlDomainMatch: checkUrlDomainMatch(primaryCarrier, normalizedText),
      labelProximity: calculateLabelProximity(normalizedText, start, end),
      falsePositiveFlags: detectFalsePositiveFlags(cleanVal, normalizedText, start, end),
      sourceSpan: { start, end }
    });
  }

  // Compute scores and sort candidates
  const promotional = isPromotionalContext(normalizedText);
  const results = [];
  for (const candidate of candidatesMap.values()) {
    // Applied here rather than in detectFalsePositiveFlags because it is a
    // property of the whole message, and because the exemptions below need the
    // candidate's corroboration, which is only complete at this point.
    if (
      promotional
      && !candidate.urlDomainMatch
      && candidate.checksum !== 'pass'
      && (candidate.labelProximity ?? 0) < 0.8
    ) {
      candidate.falsePositiveFlags = [...(candidate.falsePositiveFlags || []), 'promotional_context'];
    }

    candidate.score = computeCandidateScore(candidate);
    candidate.status = classifyConfidenceTier(candidate.score, candidate);
    results.push(candidate);
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aPri = a.priority ?? 999;
    const bPri = b.priority ?? 999;
    if (aPri !== bPri) {
      return aPri - bPri;
    }
    return (b.labelProximity || 0) - (a.labelProximity || 0);
  }).map((cand) => ({
    id: cand.id,
    value: cand.value,
    carrierCandidates: cand.carrierCandidates,
    formatMatch: cand.formatMatch,
    distinctive: cand.distinctive,
    score: cand.score,
    highestConfidence: cand.highestConfidence,
    priority: cand.priority,
    status: cand.status,
    checksum: cand.checksum,
    urlDomainMatch: cand.urlDomainMatch,
    labelProximity: cand.labelProximity,
    falsePositiveFlags: cand.falsePositiveFlags,
    sourceSpan: cand.sourceSpan
  }));
}
