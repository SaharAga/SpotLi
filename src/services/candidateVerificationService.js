import {
  fetchLiveCarrierTracking,
  isLiveTrackingSupported,
  UNTRACKED_REASONS
} from './carrierApiProxy';

/**
 * Confirms an ambiguous Smart Import candidate against the carrier itself.
 *
 * Most Israeli courier formats carry no check digit, so the parser has no way
 * to tell a real identifier from a number that merely has the right shape.
 * For the carriers with a live integration — Israel Post today — there is a
 * better answer available than more regex: ask whether the number resolves to
 * a real shipment. A confirmation is ground truth, not another heuristic.
 *
 * Deliberately narrow:
 * - Only runs for candidates the parser is unsure about. A `verified`
 *   candidate needs no network call, and a `none` candidate does not deserve
 *   one.
 * - Only runs for carriers with a real integration; everything else returns
 *   `unavailable` without touching the network.
 * - Never throws and never blocks the UI past its timeout — verification is an
 *   upgrade to the parse, so its failure must leave the existing result intact.
 * - Goes through `fetchLiveCarrierTracking`, so it inherits the two-hour cache
 *   and the carrier-boundary rule, and adds no new outbound call sites.
 */

/** Verification takes this long at most before the parse continues without it. */
export const VERIFICATION_TIMEOUT_MS = 4000;

/**
 * @typedef {'confirmed' | 'not-found' | 'unavailable'} VerificationOutcome
 *
 * - `confirmed`   the carrier knows this number; it is a real shipment
 * - `not-found`   the integration answered, and has no such shipment
 * - `unavailable` no integration, offline, timed out, or upstream failed —
 *                 says nothing either way about the number
 */

/**
 * Whether asking the carrier about this candidate is worthwhile.
 *
 * @param {{ status?: string }} candidate
 * @param {string} carrierId
 * @returns {boolean}
 */
export function shouldVerify(candidate, carrierId) {
  if (!candidate || !carrierId) return false;
  if (!isLiveTrackingSupported(carrierId)) return false;

  // `verified` is already settled; `none` was rejected on the evidence.
  return candidate.status === 'probable' || candidate.status === 'uncertain';
}

/**
 * Asks the carrier whether a tracking number is real.
 *
 * @param {string} trackingNumber
 * @param {string} carrierId
 * @returns {Promise<VerificationOutcome>}
 */
export async function verifyCandidate(trackingNumber, carrierId) {
  if (!trackingNumber || !carrierId) return 'unavailable';
  if (!isLiveTrackingSupported(carrierId)) return 'unavailable';

  // An offline device cannot distinguish "no such shipment" from "no network",
  // and guessing wrong in either direction is worse than not asking.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'unavailable';
  }

  try {
    const result = await Promise.race([
      fetchLiveCarrierTracking(trackingNumber, carrierId),
      new Promise((resolve) => {
        setTimeout(() => resolve({ tracked: false, reason: UNTRACKED_REASONS.UNAVAILABLE }), VERIFICATION_TIMEOUT_MS);
      })
    ]);

    if (result?.tracked) return 'confirmed';

    // Only a working integration reporting nothing is evidence of absence.
    // An upstream failure is not, and must not be allowed to discard a
    // candidate the parser had good reason to surface.
    return result?.reason === UNTRACKED_REASONS.UNAVAILABLE ? 'unavailable' : 'not-found';
  } catch {
    return 'unavailable';
  }
}

/**
 * Picks the best candidate the carrier will confirm, in parser-confidence order.
 *
 * Stops at the first confirmation, so the common case costs one request. Only
 * candidates worth asking about are asked about, and the whole thing degrades
 * to `null` — leaving the parse exactly as it was — the moment anything fails.
 *
 * @param {Array<{ value: string, status?: string, carrierCandidates?: string[] }>} candidates
 * @param {string|null} fallbackCarrier carrier detected for the message as a whole
 * @param {number} maxLookups hard ceiling on outbound requests per parse
 * @returns {Promise<{ trackingNumber: string, carrier: string } | null>}
 */
export async function findConfirmedCandidate(candidates, fallbackCarrier = null, maxLookups = 3) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  let lookups = 0;

  for (const candidate of candidates) {
    if (lookups >= maxLookups) break;

    const carrierId = candidate.carrierCandidates?.find((c) => c && c !== 'other')
      || fallbackCarrier
      || null;

    if (!shouldVerify(candidate, carrierId)) continue;

    lookups += 1;
    if (await verifyCandidate(candidate.value, carrierId) === 'confirmed') {
      return { trackingNumber: candidate.value, carrier: carrierId };
    }
  }

  return null;
}
