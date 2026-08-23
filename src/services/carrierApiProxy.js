/**
 * Live Tracking Proxy Adapter.
 *
 * Israel Post is currently the only carrier with a real upstream integration
 * (see LIVE_TRACKING_CARRIERS). Every other carrier resolves to an explicit
 * untracked result — the adapter never synthesises checkpoints or delivery
 * estimates, because a fabricated timeline is indistinguishable from a real
 * one once it reaches the UI.
 *
 * Includes 2-hour client-side caching of successful lookups, timeout guards,
 * and bilingual stage normalization.
 */

import { detectCarrier, sanitizeTrackingNumber } from '../utils/carrierDetector';

const CACHE_KEY_PREFIX = 'deliveree_live_track_';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4500;

/**
 * Stage Mapping Dictionary to VALID_STATUSES
 */
const STATUS_KEYWORDS = {
  delivered: [
    'delivered', 'מסירה בוצעה', 'נמסר ליעדו', 'החבילה נמסרה', 'נמסר בהצלחה',
    'חבילה נמסרה לנמען', 'נאסף מהלוקר', 'הלקוח אסף את החבילה'
  ],
  out_for_delivery: [
    'out for delivery', 'עם השליח', 'בחלוקה', 'יצא לחלוקה', 'שליח בדרך אליך',
    'בדרך לנקודת המסירה', 'בסבב חלוקה', 'ready for pickup', 'available for pickup',
    'ממתין לאיסוף', 'מוכן לאיסוף', 'החבילה ממתינה בנקודת החלוקה', 'נמסר ללוקר',
    'הוכנס ללוקר', 'הגיע לנקודת איסוף', 'הגיע למרכז מסירה', 'קוד איסוף נשלח', 'collection'
  ],
  customs: [
    'customs', 'מכס', 'עמילות מכס', 'בדיקת מכס', 'שחרור ממכס', 'מעוכב במכס',
    'תשלום מכס נדרש', 'customs clearance', 'held by customs'
  ],
  in_transit: [
    'in transit', 'בדרך', 'במעבר', 'מועבר למוקד', 'הגיע למוקד מיון', 'בנמל התעופה',
    'הגיע לישראל', 'arrived in destination country', 'departed facility', 'transit'
  ],
  shipped: [
    'shipped', 'נשלח', 'נאסף מהשולח', 'התקבל למשלוח', 'dispatched', 'accepted', 'picked up'
  ],
  ordered: [
    'ordered', 'order placed', 'פרטי המשלוח נקלטו', 'הזמנה נוצרה'
  ]
};

/**
 * Infer unified Deliveree stage from carrier raw text
 * @param {string} text - Raw event status
 * @returns {import('../types/deliveree').DeliveryStageId}
 */
export function inferStageFromText(text = '') {
  const clean = text.toLowerCase();

  for (const [stage, keywords] of Object.entries(STATUS_KEYWORDS)) {
    for (const kw of keywords) {
      if (clean.includes(kw.toLowerCase())) {
        return stage;
      }
    }
  }

  return 'in_transit';
}

/**
 * Read cached tracking result if not expired (< 2 hours old)
 * @param {string} trackingNumber
 * @returns {any | null}
 */
export function getCachedTracking(trackingNumber) {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${trackingNumber}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < TWO_HOURS_MS) {
      return parsed.data;
    }
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${trackingNumber}`);
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

/**
 * Save tracking result to local cache
 * @param {string} trackingNumber 
 * @param {any} data 
 */
export function setCachedTracking(trackingNumber, data) {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${trackingNumber}`,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Ignore quota errors
  }
}

/**
 * Fetch wrapper with strict timeout
 * @param {string} url 
 * @param {RequestInit} options 
 * @param {number} timeoutMs 
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Carriers with a real upstream integration.
 *
 * Anything not listed here has no live data source, so the app reports the
 * package as untracked rather than inventing checkpoints for it. Add a carrier
 * here only once `fetchLiveCarrierTracking` can actually reach it.
 */
export const LIVE_TRACKING_CARRIERS = Object.freeze(['israel-post']);

/**
 * Reasons a lookup returned no tracking data.
 * - `carrier-unsupported`: no integration exists for this carrier.
 * - `carrier-unavailable`: an integration exists but the upstream call failed.
 */
export const UNTRACKED_REASONS = Object.freeze({
  UNSUPPORTED: 'carrier-unsupported',
  UNAVAILABLE: 'carrier-unavailable'
});

/**
 * @param {string} carrierId
 * @returns {boolean} true when a real upstream lookup exists for this carrier
 */
export function isLiveTrackingSupported(carrierId) {
  return LIVE_TRACKING_CARRIERS.includes(carrierId);
}

/**
 * Build an explicit "no tracking data" result.
 *
 * Deliberately carries no checkpoints, status or delivery estimate: a package
 * we cannot track must look untracked to the user, not plausibly in transit.
 *
 * @param {string} carrierId
 * @param {string} reason - one of UNTRACKED_REASONS
 * @returns {{ carrier: string, tracked: false, reason: string, status: null, checkpoints: [], estimatedDelivery: null }}
 */
export function createUntrackedRecord(carrierId, reason) {
  return {
    carrier: carrierId,
    tracked: false,
    reason,
    status: null,
    checkpoints: [],
    estimatedDelivery: null
  };
}

/**
 * Query the real Israel Post item trace gateway.
 *
 * @param {string} trackingNumber
 * @returns {Promise<object>} a tracked record, or an untracked one when the
 *   gateway is unreachable or returns nothing for this item.
 */
async function queryIsraelPostLive(trackingNumber) {
  const clean = sanitizeTrackingNumber(trackingNumber);

  // Tests never reach the network; they must not get fabricated data either.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return createUntrackedRecord('israel-post', UNTRACKED_REASONS.UNAVAILABLE);
  }

  // Israel Post Open Status Gateway
  const endpoint = `https://mypost.israelpost.co.il/umbraco/api/itemtrace/getitemtrace?itemcode=${encodeURIComponent(clean)}`;

  try {
    const res = await fetchWithTimeout(endpoint, {
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.itemcode) {
        const stage = inferStageFromText(data.itemhistory || data.laststatus || '');
        const checkpoints = [];

        if (data.laststatus) {
          checkpoints.push({
            id: `cp-ilp-${clean}-0`.slice(0, 100),
            title: data.laststatus,
            description: data.itemhistory || '',
            descriptionHe: data.laststatus,
            location: data.unitname || 'דואר ישראל',
            timestamp: new Date().toISOString(),
            isCompleted: true
          });
        }

        return {
          carrier: 'israel-post',
          tracked: true,
          status: stage,
          checkpoints,
          location: data.unitname || null,
          estimatedDelivery: null
        };
      }
    }
  } catch (err) {
    console.info('[CarrierProxy] Israel Post gateway unreachable:', err?.message);
  }

  return createUntrackedRecord('israel-post', UNTRACKED_REASONS.UNAVAILABLE);
}

/**
 * Universal Multi-Carrier Live Resolver.
 *
 * Returns `tracked: false` when no live data could be obtained — callers must
 * check that flag before merging anything into a package.
 *
 * @param {string} trackingNumber - Tracking number
 * @param {string} [carrierOverride] - Optional forced carrier
 * @param {boolean} [forceRefresh=false] - Bypass 2-hour cache
 */
export async function fetchLiveCarrierTracking(trackingNumber, carrierOverride, forceRefresh = false) {
  const cleanTrack = sanitizeTrackingNumber(trackingNumber);
  if (!cleanTrack) {
    throw new Error('Invalid tracking number');
  }

  const detected = carrierOverride || detectCarrier(cleanTrack).carrierId || 'other';

  // No integration for this carrier — say so instead of guessing.
  if (!isLiveTrackingSupported(detected)) {
    return { ...createUntrackedRecord(detected, UNTRACKED_REASONS.UNSUPPORTED), isFromCache: false };
  }

  // 1. Check 2-Hour Edge Cache
  if (!forceRefresh) {
    const cached = getCachedTracking(cleanTrack);
    if (cached) {
      return { ...cached, isFromCache: true };
    }
  }

  let result;

  // 2. Carrier-specific dispatch
  try {
    result = await queryIsraelPostLive(cleanTrack);
  } catch (err) {
    console.warn('[CarrierProxy] Upstream error:', err);
    result = createUntrackedRecord(detected, UNTRACKED_REASONS.UNAVAILABLE);
  }

  // 3. Cache successful lookups only — never cache a failure for two hours.
  if (result.tracked) {
    setCachedTracking(cleanTrack, result);
  }

  return { ...result, isFromCache: false };
}
