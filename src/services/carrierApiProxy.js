/**
 * Live Tracking Proxy Adapter.
 *
 * Which carriers can be tracked live is a property of the carrier, so it lives
 * in the carrier table: a carrier with a `liveTracking: { endpoint, parse }`
 * entry has a real upstream integration. Israel Post is currently the only
 * one. Every other carrier resolves to an explicit untracked result — the
 * adapter never synthesises checkpoints or delivery estimates, because a
 * fabricated timeline is indistinguishable from a real one once it reaches
 * the UI. Adding carrier #2 is a table entry, not a new function here.
 *
 * Includes 2-hour client-side caching of successful lookups, timeout guards,
 * and bilingual stage normalization.
 */

import { detectCarrier, sanitizeTrackingNumber } from '../utils/carrierDetector';
import { CARRIER_LIST, getCarrier } from '../types/carriers';
import { callFunction } from './callableClient';

const CACHE_KEY_PREFIX = 'deliveree_live_track_';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4500;

/**
 * Stage Mapping Dictionary to VALID_STATUSES
 */
const STATUS_KEYWORDS = {
  returned_to_sender: [
    'returned to sender', 'return to sender', 'returned', 'הוחזר לשולח',
    'מוחזר לשולח', 'לא נאסף והוחזר', 'הוחזרה לשולח', 'חזרה לשולח',
    'נשלח בחזרה לשולח', 'נשלחה בחזרה לשולח'
  ],
  exception: [
    'exception', 'delivery failed', 'undeliverable', 'address issue',
    'חריגת מסירה', 'מסירה נכשלה', 'כתובת שגויה', 'חריגה במשלוח'
  ],
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
 * Lowercased view of STATUS_KEYWORDS, computed once.
 *
 * `inferStageFromText` runs per checkpoint of every tracking response, and the
 * keyword table is a module-level literal that never changes — so the casefold
 * belongs here, not in the matching loop.
 */
const STATUS_KEYWORDS_LC = Object.freeze(
  Object.fromEntries(
    Object.entries(STATUS_KEYWORDS).map(([stage, keywords]) => [
      stage,
      keywords.map((kw) => kw.toLowerCase())
    ])
  )
);

/**
 * Infer unified SpotLi stage from carrier raw text
 * @param {string} rawStatus
 * @returns {import('../types/deliveree').DeliveryStageId}
 */
export function inferStageFromText(text = '') {
  const clean = text.toLowerCase();

  for (const [stage, keywords] of Object.entries(STATUS_KEYWORDS_LC)) {
    for (const kw of keywords) {
      if (clean.includes(kw)) {
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
 * Carriers with a real upstream integration, derived from the carrier table.
 *
 * Anything not listed here has no live data source, so the app reports the
 * package as untracked rather than inventing checkpoints for it. To add a
 * carrier, give it a `liveTracking` entry in `types/carriers.js`; it appears
 * here automatically.
 */
export const LIVE_TRACKING_CARRIERS = Object.freeze(
  CARRIER_LIST.filter((carrier) => carrier.liveTracking).map((carrier) => carrier.id)
);

/**
 * Reasons a lookup returned no tracking data.
 * - `carrier-unsupported`: the upstream could not identify this shipment.
 * - `carrier-unavailable`: an integration exists but the upstream call failed.
 */
export const UNTRACKED_REASONS = Object.freeze({
  UNSUPPORTED: 'carrier-unsupported',
  UNAVAILABLE: 'carrier-unavailable'
});

/**
 * Carriers the 17TRACK proxy carries an explicit catalogue ID for.
 *
 * Mirrors TRACK17_CARRIER_MAP in functions/src/carrierProxy.js. The two encode
 * the same fact in two packages and must be changed together — the server
 * decides what is actually queried, this copy only decides what the UI is
 * willing to promise. A carrier missing here is still queried; 17TRACK is just
 * asked to identify it from the number alone.
 */
const TRACK17_MAPPED_CARRIERS = Object.freeze(new Set([
  'israel-post', 'chita', 'hfd', 'exelot', 'gaash', 'gcx', 'ydm', 'focus',
  'cainiao', 'dhl', 'fedex', 'ups', 'usps',
  'royal-mail', '4px', 'yunexpress', 'yanwen', 'aramex'
]));

/**
 * True when this carrier has a hand-written client-side adapter.
 *
 * Only governs the direct-from-browser fallback in queryCarrierLive. It is NOT
 * "can this be tracked": every carrier now goes through the Cloud Function
 * proxy first, which reaches 17TRACK with or without a catalogue ID.
 *
 * @param {string} carrierId
 * @returns {boolean}
 */
export function hasDirectCarrierAdapter(carrierId) {
  return Boolean(getCarrier(carrierId)?.liveTracking);
}

/**
 * True when a live lookup for this carrier is backed by a named integration,
 * rather than resting on 17TRACK identifying the number on its own.
 *
 * This is what the UI may promise. It used to be `isLiveTrackingSupported`,
 * which meant "has a local adapter" — four carriers — and was also used to
 * refuse the lookup outright, so twelve Israeli couriers were told "live
 * tracking isn't available" without the app ever asking 17TRACK about them.
 *
 * @param {string} carrierId
 * @returns {boolean}
 */
export function isLiveTrackingConfirmed(carrierId) {
  return hasDirectCarrierAdapter(carrierId) || TRACK17_MAPPED_CARRIERS.has(carrierId);
}

/**
 * Translation key for a refresh that came back without tracking data.
 *
 * The proxy answers with a vocabulary of reasons, and the UI used to collapse
 * all but one of them into "live tracking isn't available for {carrier} yet".
 * That sentence says the carrier has no feed — which is a permanent fact about
 * the carrier, and was wrong for the case that actually produces it most:
 * 17TRACK was asked and simply had no record of the number. Reported from a
 * real Tapuz parcel, whose 8-digit number went up in auto-detect mode (no
 * catalogue code) and came back `not-found`; the user was told Tapuz is
 * unsupported when what happened was "nothing on this shipment yet".
 *
 * Three outcomes, three different things to do about it:
 * - nothing on record (yet)    -> try again later
 * - the carrier has no feed    -> update it by hand, permanently
 * - the lookup could not run   -> nothing changed; not the package's fault
 *
 * @param {string|null|undefined} reason - as carried on an untracked record
 * @returns {'tracking.notFound'|'tracking.notSupported'|'tracking.carrierUnavailable'}
 */
export function untrackedReasonKey(reason) {
  switch (reason) {
    // The upstream ran and returned nothing for this shipment. `no-checkpoints`
    // is the GAASH adapter's spelling of the same answer.
    case 'not-found':
    case 'no-checkpoints':
      return 'tracking.notFound';

    case UNTRACKED_REASONS.UNSUPPORTED:
      return 'tracking.notSupported';

    // Everything else is the lookup itself failing — an unreachable gateway, an
    // HTTP error from 17TRACK, a missing API key. Unknown reasons land here too:
    // "we could not check" is the honest answer for a reason we do not know,
    // where "this carrier is unsupported" would be a claim we cannot make.
    default:
      return 'tracking.carrierUnavailable';
  }
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
 * Run a carrier's `liveTracking` integration from the carrier table.
 *
 * The table owns the endpoint and the response shape; this function owns only
 * the transport concerns (test guard, timeout, error handling) and the
 * untracked fallback that every failure path must produce.
 *
 * @param {object} carrier - carrier table entry; `liveTracking` is optional
 * @param {string} trackingNumber
 * @returns {Promise<object>} a tracked record, or an untracked one when the
 *   gateway is unreachable or returns nothing for this item.
 */
async function queryCarrierLive(carrier, trackingNumber) {
  const clean = sanitizeTrackingNumber(trackingNumber);

  // Tests never reach the network; they must not get fabricated data either.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return createUntrackedRecord(carrier.id, UNTRACKED_REASONS.UNAVAILABLE);
  }

  // The proxy's own verdict, kept so a definite "no such shipment" is not
  // flattened into the same "couldn't reach anything" as a network failure.
  // Without this every unsuccessful lookup came back as carrier-unavailable
  // once the pre-refusal was removed, and carrier-unsupported — the reason
  // that says the number could not be identified at all — stopped being
  // produced by anything.
  let upstreamReason = null;

  // 1. Attempt Cloud Function proxy (which has 17TRACK API key & GAASH adapter, bypassing browser CORS and anti-bot WAFs)
  try {
    const res = await callFunction('queryCarrierTracking', {
      trackingNumber: clean,
      carrierId: carrier.id
    });
    if (res?.data?.tracked) {
      return res.data;
    }
    if (typeof res?.data?.reason === 'string') {
      upstreamReason = res.data.reason;
    }
  } catch (err) {
    // Cloud function proxy not available or failed; proceed to direct gateway fallback
  }

  // 2. Direct client fallback for open carriers
  if (carrier?.liveTracking?.endpoint && carrier?.liveTracking?.parse) {
    const { endpoint, parse, headers } = carrier.liveTracking;

    try {
      const res = await fetchWithTimeout(endpoint(clean), {
        headers: headers || { 'Accept': 'application/json, text/plain, */*' }
      });
      if (res.ok) {
        const data = await res.json();
        const record = parse(data, clean, { inferStageFromText });
        if (record) return record;
      }
    } catch (err) {
      console.info(`[CarrierProxy] ${carrier.name} gateway unreachable:`, err?.message);
    }
  }

  return createUntrackedRecord(carrier.id, upstreamReason || UNTRACKED_REASONS.UNAVAILABLE);
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

  // Every carrier is attempted. This used to bail out unless the carrier had a
  // local adapter, which meant the Cloud Function — the side that actually
  // holds the 17TRACK key — was never called for anything else, and Cheetah,
  // HFD, Buzzr and nine other Israeli couriers reported "no live tracking"
  // without a single request ever being made on their behalf. The proxy takes
  // any carrier id and omits the catalogue code when it has none, which is
  // 17TRACK's auto-detect mode; an unidentifiable number comes back untracked
  // on its own merits rather than being pre-judged here.

  // 1. Check 2-Hour Edge Cache
  if (!forceRefresh) {
    const cached = getCachedTracking(cleanTrack);
    if (cached) {
      return { ...cached, isFromCache: true };
    }
  }

  let result;

  // 2. Carrier-specific dispatch, driven by the carrier table
  try {
    result = await queryCarrierLive(getCarrier(detected), cleanTrack);
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
