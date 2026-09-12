/**
 * Firebase Cloud Function: Live Carrier Tracking Proxy.
 *
 * Provides server-to-server tracking resolution without browser CORS restrictions.
 *
 * ARCHITECTURAL DESIGN:
 * 1. GAASH Worldwide (Group A - Direct Open Gateway):
 *    - Fully functional at $0 cost via direct WordPress REST API (gaashAdapter.js).
 *    - Fetches live checkpoints, customs clearance, and domestic courier handovers.
 *
 * 2. Israel Post, GCX, and 30+ Global Couriers (Group D - 17TRACK Aggregator):
 *    - Couriers protected by enterprise anti-bot firewalls (Radware PerimeterX on Israel Post,
 *      Cloudflare Turnstile on GCX) block direct datacenter scrapers with HTTP 403.
 *    - Powered by the official 17TRACK REST API (v2.2).
 *    - Handles two-step registration: calls /gettrackinfo; if unregistered (-18019902),
 *      calls /register then re-queries /gettrackinfo.
 *    - Normalizes checkpoints and stages into Deliveree schema.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { fetchGaashTracking } from './gaashAdapter.js';
import { assertAuthenticated, checkAndIncrementUsage } from './guards.js';
import { CARRIER_TRACKING_LIMITS } from './config.js';

const TRACK17_GET_INFO_URL = 'https://api.17track.net/track/v2.2/gettrackinfo';
const TRACK17_REGISTER_URL = 'https://api.17track.net/track/v2.2/register';
const FETCH_TIMEOUT_MS = 6000;

/**
 * Fetch with strict timeout controller to prevent Cloud Function worker hangs.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * 17TRACK carrier ID mapping for top Israeli and international couriers
 */
export const TRACK17_CARRIER_MAP = {
  'israel-post': 9061,
  'cainiao': 190094,
  'dhl': 100001,
  'fedex': 100003,
  'ups': 100002,
  'usps': 21051,
  'royal-mail': 12011,
  '4px': 190008,
  'yunexpress': 190012,
  'yanwen': 190002,
  'aramex': 100014
};

/**
 * Stage mapping from 17TRACK package status to unified Deliveree stage
 * @param {string} track17Status
 * @returns {'delivered' | 'out_for_delivery' | 'customs' | 'in_transit' | 'shipped' | 'ordered' | 'exception' | 'returned_to_sender'}
 */
export function inferStageFrom17Track(track17Status = '') {
  const clean = String(track17Status || '').toLowerCase();
  switch (clean) {
    case 'delivered':
      return 'delivered';
    case 'outfordelivery':
    case 'availableforpickup':
      return 'out_for_delivery';
    case 'customs':
      return 'customs';
    case 'intransit':
    case 'departure':
    case 'arrival':
      return 'in_transit';
    case 'inforeceived':
    case 'ordered':
      return 'ordered';
    case 'notfound':
      return 'ordered';
    case 'alert':
    case 'undelivered':
    case 'expired':
      return 'exception';
    case 'returned':
    case 'returning':
      return 'returned_to_sender';
    default:
      return 'in_transit';
  }
}

/**
 * Register a tracking number with 17TRACK API
 * @param {string} trackingNumber
 * @param {number|undefined} carrierCode
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
export async function registerWith17Track(trackingNumber, carrierCode, apiKey) {
  try {
    const payload = [{ number: trackingNumber }];
    if (carrierCode) {
      payload[0].carrier = carrierCode;
    }

    const res = await fetchWithTimeout(TRACK17_REGISTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return false;
    const json = await res.json();
    return json.code === 0 && Array.isArray(json.data?.accepted) && json.data.accepted.length > 0;
  } catch (err) {
    console.warn('[CarrierProxy] 17TRACK registration error:', err.message);
    return false;
  }
}

/**
 * Query 17TRACK API when API key is available
 * @param {string} trackingNumber
 * @param {string} carrierId
 * @param {string} apiKey
 * @returns {Promise<object>}
 */
export async function query17TrackApi(trackingNumber, carrierId, apiKey) {
  if (!apiKey) {
    return {
      carrier: carrierId,
      tracked: false,
      reason: 'api-key-required',
      message: '17TRACK API key is not configured.'
    };
  }

  const carrierCode = TRACK17_CARRIER_MAP[carrierId] || undefined;
  const payload = [{ number: trackingNumber }];
  if (carrierCode) {
    payload[0].carrier = carrierCode;
  }

  try {
    let res = await fetchWithTimeout(TRACK17_GET_INFO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      return {
        carrier: carrierId,
        tracked: false,
        reason: `upstream-17track-http-${res.status}`
      };
    }

    let data = await res.json();

    // Check if rejected because not registered (-18019902: not registered)
    const rejected = data?.data?.rejected?.[0];
    if (rejected?.error?.code === -18019902) {
      const registered = await registerWith17Track(trackingNumber, carrierCode, apiKey);
      if (registered) {
        // Re-query after registration
        res = await fetchWithTimeout(TRACK17_GET_INFO_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            '17token': apiKey
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          data = await res.json();
        } else {
          return {
            carrier: carrierId,
            tracked: false,
            reason: `upstream-17track-http-${res.status}`
          };
        }
      }
    }

    const accepted = data?.data?.accepted?.[0];
    if (!accepted || !accepted.track_info) {
      // If package was successfully registered but has no tracking events yet
      if (data?.data?.rejected?.length === 0 || !rejected) {
        return {
          carrier: carrierId,
          tracked: true,
          status: 'ordered',
          checkpoints: [],
          location: null,
          estimatedDelivery: null,
          message: 'Package registered with tracking network. Awaiting initial courier scan.'
        };
      }

      return {
        carrier: carrierId,
        tracked: false,
        reason: 'not-found',
        message: rejected?.error?.message || 'No tracking details found in 17TRACK catalog'
      };
    }

    const trackInfo = accepted.track_info;
    const events = trackInfo.tracking?.providers?.[0]?.events || [];
    const checkpoints = events.map((ev, idx) => ({
      id: `cp-17t-${trackingNumber}-${idx}`.slice(0, 100),
      title: ev.description || '',
      description: ev.description || '',
      descriptionHe: ev.description || '',
      location: ev.location || '',
      timestamp: ev.time_iso || ev.time_utc || new Date().toISOString(),
      isCompleted: true
    }));

    const rawStatus = trackInfo.latest_status?.status;
    const status = inferStageFrom17Track(rawStatus);

    return {
      carrier: carrierId,
      tracked: true,
      status,
      checkpoints,
      location: checkpoints[0]?.location || null,
      estimatedDelivery: trackInfo.time_metrics?.estimated_delivery_date?.from || null
    };
  } catch (err) {
    console.warn('[CarrierProxy] 17TRACK request failed:', err.message);
    return {
      carrier: carrierId,
      tracked: false,
      reason: 'upstream-error',
      message: err.message
    };
  }
}

/**
 * Creates the onCall carrier tracking handler
 * @param {object} options
 * @param {object} [options.db] - Optional Firestore instance
 * @param {string} [options.track17ApiKey] - Optional 17TRACK API key
 */
export function createCarrierTrackingHandler({ db, track17ApiKey = '' } = {}) {
  return async (request) => {
    const userId = assertAuthenticated(request);

    const data = request.data || {};
    const trackingNumber = String(data.trackingNumber || '').trim();
    const carrierId = String(data.carrierId || '').trim();

    if (!trackingNumber) {
      return {
        carrier: carrierId || 'unknown',
        tracked: false,
        reason: 'missing-tracking-number',
        status: null,
        checkpoints: []
      };
    }

    if (trackingNumber.length > 100) {
      throw new HttpsError('invalid-argument', 'trackingNumber exceeds 100 characters.');
    }

    const isGaash = carrierId === 'gaash' || /^GAA[A-Z0-9]{7,15}$/i.test(trackingNumber);
    if (!isGaash && !track17ApiKey) {
      return {
        carrier: carrierId || 'other',
        tracked: false,
        reason: 'api-key-required',
        message: 'Direct live query for this carrier requires a 17TRACK API key.',
        status: null,
        checkpoints: []
      };
    }

    // Rate-limit check only runs for valid, actionable requests
    if (db && typeof db.runTransaction === 'function') {
      const usage = await checkAndIncrementUsage(db, userId, {
        collection: 'carrierUsage',
        userLimit: CARRIER_TRACKING_LIMITS.PER_USER_DAILY_CALLS,
        globalLimit: CARRIER_TRACKING_LIMITS.GLOBAL_DAILY_CALLS
      });

      if (!usage.allowed) {
        throw new HttpsError(
          'resource-exhausted',
          usage.reason === 'user-limit'
            ? 'Daily live carrier tracking limit reached for your account.'
            : 'Daily live carrier tracking limit reached for SpotLi.'
        );
      }
    }

    // 1. Direct Open Carrier: GAASH Worldwide ($0, No API Key, No Bot Blockers)
    if (isGaash) {
      return fetchGaashTracking(trackingNumber);
    }

    // 2. Carriers requiring 17TRACK API (Israel Post, GCX, DHL, FedEx, etc.)
    return query17TrackApi(trackingNumber, carrierId, track17ApiKey);
  };
}
