import { DETECTION_RULES, getCarrier } from '../types/carriers.js';

/**
 * Universal Tracking Number Sanitizer
 * Strips whitespace, control characters, hyphens, and non-printable noise
 * @param {string} trackingNumber 
 * @returns {string}
 */
export function sanitizeTrackingNumber(trackingNumber) {
  if (!trackingNumber || typeof trackingNumber !== 'string') return '';
  // Max cap 100 chars to avoid ReDoS or memory DOS
  const trimmed = trackingNumber.trim().slice(0, 100);
  // Remove whitespace, dashes, spaces, tabs, zero-width chars
  return trimmed.toUpperCase().replace(/[\s\-_.\u200B-\u200D\uFEFF]+/g, '');
}

/**
 * Modulo 10 Checksum Algorithm (Luhn / USPS / FedEx Mod 10)
 * Calculates standard weighted modulo 10 checksum verification.
 * 
 * @param {string} digits - Numeric string of digits
 * @param {number[]} weights - Alternating weights (e.g., [3, 1] or [1, 3])
 * @param {number} checkDigitIndex - Position of check digit (default: last digit)
 * @returns {boolean}
 */
export function validateMod10(digits, weights = [3, 1], checkDigitIndex = digits.length - 1) {
  if (!digits || typeof digits !== 'string' || !/^\d+$/.test(digits)) return false;
  if (digits.length < 2) return false;

  const checkDigit = parseInt(digits[checkDigitIndex], 10);
  const dataDigits = digits.slice(0, checkDigitIndex) + digits.slice(checkDigitIndex + 1);

  let sum = 0;
  // Calculate from right to left of dataDigits
  for (let i = dataDigits.length - 1, wIdx = 0; i >= 0; i--, wIdx++) {
    const weight = weights[wIdx % weights.length];
    sum += parseInt(dataDigits[i], 10) * weight;
  }

  const remainder = sum % 10;
  const calculatedCheck = remainder === 0 ? 0 : 10 - remainder;
  return calculatedCheck === checkDigit;
}

/**
 * Modulo 11 Checksum Algorithm (UPU S10 Standard for Israel Post, China Post, USPS S10, etc.)
 * Standard UPU S10 format: 2 letters + 8 serial digits + 1 check digit + 2 letters (e.g. RS123456789IL)
 * Weights: [8, 6, 4, 2, 3, 5, 9, 7]
 * 
 * @param {string} s10Identifier - Tracking number formatted as [A-Z]{2}\d{9}[A-Z]{2}
 * @returns {boolean}
 */
export function validateUPUS10Mod11(s10Identifier) {
  if (!s10Identifier || typeof s10Identifier !== 'string') return false;
  const clean = s10Identifier.trim().toUpperCase();
  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(clean)) return false;

  const weights = [8, 6, 4, 2, 3, 5, 9, 7];
  const digits = clean.slice(2, 10); // 8 serial digits
  const checkDigit = parseInt(clean[10], 10); // 9th digit is check digit

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
 * Modulo 11 Checksum (BoxIt & Local Israeli Couriers standard)
 * 
 * @param {string} digits 
 * @returns {boolean}
 */
export function validateMod11Generic(digits) {
  if (!digits || typeof digits !== 'string' || !/^\d+$/.test(digits)) return false;
  if (digits.length < 2) return false;

  const checkDigit = parseInt(digits[digits.length - 1], 10);
  const dataDigits = digits.slice(0, -1);

  let sum = 0;
  for (let i = dataDigits.length - 1, weight = 2; i >= 0; i--, weight++) {
    const w = weight > 7 ? (weight % 7) + 1 : weight;
    sum += parseInt(dataDigits[i], 10) * w;
  }

  const remainder = sum % 11;
  const calculatedCheck = (11 - remainder) % 11;
  return calculatedCheck === checkDigit;
}

/**
 * Named checksum validators referenced by `checksum` in the carrier rule table.
 *
 * Keeping the registry here (rather than putting functions in the table) lets
 * `carriers.js` stay a plain data module with no imports.
 *
 * - `upu-s10`      UPU S10 mod-11 check digit (IL / GB / US / CN registered mail)
 * - `mod10-31`     USPS IMpb weighted mod-10 check digit
 * - `assume-valid` the format carries no verifiable check digit, so a match
 *                  reports a passing checksum
 */
export const CHECKSUM_VALIDATORS = Object.freeze({
  'upu-s10': (value) => validateUPUS10Mod11(value),
  'mod10-31': (value) => validateMod10(value, [3, 1]),
  'assume-valid': () => true
});

/**
 * Detects if a candidate string matches an Israeli phone number format.
 * Guards against phone numbers in SMS being falsely identified as 12-digit FedEx / other pure-digit couriers.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function isPhoneNumber(str) {
  if (!str || typeof str !== 'string') return false;
  const clean = str.trim().replace(/[\s\-_.]+/g, '');
  return /^(?:\+?972|0)(?:5[0-9]|7[0-9]|[23489])\d{7}$/.test(clean);
}

/**
 * Automatically inspects a tracking number string and detects the most likely carrier,
 * with checksum verification and confidence scoring.
 *
 * Detection is driven entirely by the rule table in `types/carriers.js`: rules
 * are evaluated in priority order and the first match wins, contributing its
 * confidence and (optionally) its named checksum validator.
 *
 * @param {string} trackingNumber - Raw tracking string
 * @returns {{ carrierId: string, confidence: 'high' | 'medium' | 'none', carrier: Object, isValidChecksum?: boolean }}
 */
export function detectCarrier(trackingNumber) {
  const noMatch = { carrierId: 'other', confidence: 'none', carrier: getCarrier('other') };

  if (!trackingNumber || typeof trackingNumber !== 'string') return noMatch;

  const cleaned = sanitizeTrackingNumber(trackingNumber);
  if (!cleaned) return noMatch;

  // Phone numbers should never be treated as valid carrier tracking identifiers
  if (isPhoneNumber(cleaned) || isPhoneNumber(trackingNumber)) {
    return noMatch;
  }

  for (const detectionRule of DETECTION_RULES) {
    if (!detectionRule.test(cleaned)) continue;

    const result = {
      carrierId: detectionRule.carrier.id,
      confidence: detectionRule.confidence,
      carrier: detectionRule.carrier
    };

    if (detectionRule.checksum) {
      const validate = CHECKSUM_VALIDATORS[detectionRule.checksum];
      result.isValidChecksum = validate ? validate(cleaned) : false;
    }

    return result;
  }

  return noMatch;
}
