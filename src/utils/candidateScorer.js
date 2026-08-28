import carrierSpecs from '../types/carrierSpecs.generated.json';
import { validateUPUS10Mod11, validateMod10 } from './carrierDetector.js';

/**
 * Keyword definitions for label proximity scoring (Hebrew and English).
 */
const TRACKING_KEYWORDS = [
  'tracking',
  'tracking number',
  'track number',
  'waybill',
  'awb',
  'consignment',
  'shipment',
  'package',
  'parcel',
  'order',
  'מספר מעקב',
  'מס מעקב',
  'מס׳ מעקב',
  'מס\' מעקב',
  'קוד מעקב',
  'דבר דואר',
  'חבילה מספר',
  'חבילתך במספר',
  'חבילת',
  'חבילה',
  'משלוח',
  'מספר משלוח',
  'ברקוד משלוח'
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

  if (FALSE_POSITIVE_PATTERNS.phone_number.test(clean) || FALSE_POSITIVE_PATTERNS.phone_number.test(candidate.trim())) {
    flags.push('phone_number');
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

  // OTP Verification check (4-8 digits next to security/verification keywords)
  if (/^\d{4,8}$/.test(clean) && fullText) {
    const windowStart = Math.max(0, startIdx >= 0 ? startIdx - 80 : 0);
    const windowEnd = Math.min(fullText.length, endIdx >= 0 ? endIdx + 80 : fullText.length);
    const surrounding = fullText.slice(windowStart, windowEnd).toLowerCase();

    if (/(?:קוד\s*אימות|קוד\s*חד-?פעמי|אימות\s*חשבון|verification\s*code|one-?time\s*password|otp|security\s*code|your\s*code\s*is)/i.test(surrounding)) {
      flags.push('otp_code');
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
    score += candidate.highestConfidence === 'high' ? 0.45 : 0.25;
  } else if (candidate.labelProximity >= 0.8) {
    // Explicitly labeled tracking candidate (e.g. "Tracking ID: XYZ")
    score += 0.45;
  }

  // 2. Checksum validation
  if (candidate.checksum === 'pass') {
    score += 0.30;
  } else if (candidate.checksum === 'fail') {
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

/**
 * Classifies confidence status from candidate score.
 * @param {number} score
 * @param {object} candidate
 * @returns {'verified' | 'probable' | 'uncertain' | 'none'}
 */
export function classifyConfidenceTier(score, candidate) {
  if (candidate?.falsePositiveFlags && candidate.falsePositiveFlags.length > 0) {
    return score >= 0.65 ? 'probable' : (score >= 0.40 ? 'uncertain' : 'none');
  }

  // Verified requires score >= 0.85 and no checksum failure
  if (score >= 0.85 && candidate?.checksum !== 'fail' && candidate?.formatMatch) {
    return 'verified';
  }

  if (score >= 0.65 && candidate?.checksum !== 'fail') {
    return 'probable';
  }

  if (score >= 0.40) {
    return 'uncertain';
  }

  return 'none';
}

/**
 * Evaluates candidate token against all compiled carrier rules.
 * @param {string} candidateValue
 * @returns {{ formatMatch: boolean, carrierCandidates: string[], highestConfidence: 'high'|'medium'|'none', checksum: 'pass'|'fail'|'not-applicable' }}
 */
export function evaluateCandidateRules(candidateValue) {
  const matchingCarriers = [];
  let highestConf = 'none';
  let checksumResult = 'not-applicable';

  for (const rule of COMPILED_RULES) {
    if (rule.re.test(candidateValue)) {
      if (!matchingCarriers.includes(rule.carrierId)) {
        matchingCarriers.push(rule.carrierId);
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

  return {
    formatMatch: matchingCarriers.length > 0,
    carrierCandidates: matchingCarriers.length > 0 ? matchingCarriers : ['other'],
    highestConfidence: highestConf,
    checksum: checksumResult
  };
}

const METADATA_WORDS = new Set([
  'UPDATE', 'UPDATES', 'DETAILS', 'DETAIL', 'STATUS', 'INFO', 'INFORMATION',
  'ALERT', 'ALERTS', 'NOTIFICATION', 'NOTIFICATIONS', 'MESSAGE', 'MESSAGES',
  'NUMBER', 'NUMBERS', 'CODE', 'CODES', 'LINK', 'LINKS', 'ONLINE', 'CENTER',
  'SERVICE', 'SERVICES', 'DELIVERY', 'DELIVERIES', 'SHIPMENT', 'SHIPMENTS',
  'PACKAGE', 'PACKAGES', 'PARCEL', 'PARCELS', 'TRACK', 'TRACKING', 'REPORT',
  'SUMMARY', 'CUSTOMER', 'SUPPORT', 'CONFIRMATION', 'RECEIPT', 'PORTAL'
]);

/**
 * Checks if a candidate is a false positive based on detected flags.
 * @param {string} candidate
 * @param {string} [fullText='']
 * @param {number} [startIdx=-1]
 * @param {number} [endIdx=-1]
 * @returns {boolean}
 */
export function isFalsePositive(candidate, fullText = '', startIdx = -1, endIdx = -1) {
  const flags = detectFalsePositiveFlags(candidate, fullText, startIdx, endIdx);
  return flags.length > 0;
}

/**
 * Extracts and scores all candidate tracking numbers from input text.
 * @param {string} text
 * @returns {Array<import('./candidateScorer.js').ExtractedCandidate>}
 */
export function extractAndScoreCandidates(text) {
  if (!text || typeof text !== 'string') return [];

  const candidatesMap = new Map();
  const normalizedText = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 1. Scan for labeled tracking number spans (e.g. "מעקב: ABC1234567")
  const labeledPattern = /(?:tracking\s*(?:number|id|code|no|#)?|מספר\s*מעקב|מס['׳`״]\s*מעקב|קוד\s*מעקב|דבר\s*דואר(?:\s*שמספרו)?|חבילתך\s*במספר|חבילה\s*מספר|מספר\s*משלוח|waybill|awb|ברקוד(?:\s*משלוח)?)[\s:=#-]+([A-Za-z0-9_-]{6,35})/gi;
  let labeledMatch;

  while ((labeledMatch = labeledPattern.exec(normalizedText)) !== null) {
    const rawVal = labeledMatch[1];
    const cleanVal = rawVal.trim().toUpperCase();
    if (METADATA_WORDS.has(cleanVal)) continue;

    const start = labeledMatch.index + labeledMatch[0].indexOf(rawVal);
    const end = start + rawVal.length;

    if (isFalsePositive(cleanVal, normalizedText, start, end)) continue;

    const ruleEval = evaluateCandidateRules(cleanVal);
    const primaryCarrier = ruleEval.carrierCandidates[0] || 'other';

    candidatesMap.set(cleanVal, {
      id: `cand_${candidatesMap.size + 1}`,
      value: cleanVal,
      carrierCandidates: ruleEval.carrierCandidates,
      formatMatch: ruleEval.formatMatch,
      highestConfidence: ruleEval.highestConfidence === 'none' ? 'medium' : ruleEval.highestConfidence,
      checksum: ruleEval.checksum,
      urlDomainMatch: checkUrlDomainMatch(primaryCarrier, normalizedText),
      labelProximity: 1.0, // Directly extracted from labeled pattern
      falsePositiveFlags: detectFalsePositiveFlags(cleanVal, normalizedText, start, end),
      sourceSpan: { start, end }
    });
  }

  // 2. Token scan for alphanumeric tokens (length 6 to 35)
  const tokenPattern = /\b([A-Za-z0-9]{6,35})\b/g;
  let tokenMatch;

  while ((tokenMatch = tokenPattern.exec(normalizedText)) !== null) {
    const rawVal = tokenMatch[1];
    const cleanVal = rawVal.trim().toUpperCase();
    const start = tokenMatch.index;
    const end = start + rawVal.length;

    if (candidatesMap.has(cleanVal)) continue;

    const ruleEval = evaluateCandidateRules(cleanVal);
    if (!ruleEval.formatMatch) continue; // Skip non-tracking random tokens

    const primaryCarrier = ruleEval.carrierCandidates[0] || 'other';

    candidatesMap.set(cleanVal, {
      id: `cand_${candidatesMap.size + 1}`,
      value: cleanVal,
      carrierCandidates: ruleEval.carrierCandidates,
      formatMatch: true,
      highestConfidence: ruleEval.highestConfidence,
      checksum: ruleEval.checksum,
      urlDomainMatch: checkUrlDomainMatch(primaryCarrier, normalizedText),
      labelProximity: calculateLabelProximity(normalizedText, start, end),
      falsePositiveFlags: detectFalsePositiveFlags(cleanVal, normalizedText, start, end),
      sourceSpan: { start, end }
    });
  }

  // Finalize composite score and sort descending
  const results = Array.from(candidatesMap.values()).map((cand) => {
    const score = computeCandidateScore(cand);
    return {
      id: cand.id,
      value: cand.value,
      carrierCandidates: cand.carrierCandidates,
      formatMatch: cand.formatMatch,
      checksum: cand.checksum,
      urlDomainMatch: cand.urlDomainMatch,
      labelProximity: cand.labelProximity,
      falsePositiveFlags: cand.falsePositiveFlags,
      sourceSpan: cand.sourceSpan,
      score
    };
  });

  return results.sort((a, b) => b.score - a.score);
}
