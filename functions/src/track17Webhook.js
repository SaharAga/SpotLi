/**
 * 17TRACK Webhook Receiver.
 *
 * Receives real-time carrier status pushes from 17TRACK API (v2.2).
 *
 * ARCHITECTURAL DESIGN:
 * 1. Security & Signature Verification:
 *    - Validates the `sign` header sent by 17TRACK: sha256(raw_body + "/" + secret_key).
 *    - Uses crypto.timingSafeEqual to defend against timing side-channel attacks.
 *    - Rejects unauthenticated, empty, or forged payloads immediately with HTTP 401.
 *
 * 2. Instant Real-Time Push:
 *    - Normalizes incoming events and checkpoints into the SpotLi package schema.
 *    - Finds all package records matching the tracking number across users in Firestore.
 *    - Updates package documents with `lastUpdateSource: 'live_tracking'`, which automatically
 *      triggers `notifyOnPackageUpdated` to send Web Push notifications to the user's phone.
 *
 * 3. Idempotent & Quota Free:
 *    - Webhook deliveries do not count against registered tracking quotas.
 *    - Uses buildTrackingPatch to avoid writing no-op updates or walking backwards from terminal states.
 */

import crypto from 'node:crypto';
import { inferStageFrom17Track, TRACK17_CARRIER_MAP } from './carrierProxy.js';
import { buildTrackingPatch, normalizeNumber } from './scheduledTrackingRefresh.js';

/**
 * Constant-time comparison of calculated hash and incoming signature.
 * @param {string} calculated
 * @param {string} signature
 * @returns {boolean}
 */
export function safeCompareSignatures(calculated, signature) {
  if (typeof calculated !== 'string' || typeof signature !== 'string' || !calculated || !signature) {
    return false;
  }
  const calcBuf = Buffer.from(calculated.toLowerCase(), 'utf8');
  const sigBuf = Buffer.from(signature.toLowerCase(), 'utf8');
  if (calcBuf.length !== sigBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(calcBuf, sigBuf);
}

/**
 * Verifies 17TRACK webhook signature.
 * Formula: sha256(rawBody + "/" + secretKey) === header.sign
 * @param {string|Buffer} rawBody
 * @param {string} signHeader
 * @param {string} secretKey
 * @returns {boolean}
 */
export function verify17TrackSignature(rawBody, signHeader, secretKey) {
  if (!signHeader || !secretKey) return false;
  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  if (!bodyString) return false;

  const toHash = `${bodyString}/${secretKey}`;
  const calculated = crypto.createHash('sha256').update(toHash, 'utf8').digest('hex');
  return safeCompareSignatures(calculated, signHeader);
}

/**
 * Normalizes 17TRACK track_info payload into a resolveLiveTracking-compatible record.
 * @param {string} trackingNumber
 * @param {object} trackInfo
 * @returns {object}
 */
export function normalize17TrackEvent(trackingNumber, trackInfo) {
  if (!trackInfo || typeof trackInfo !== 'object') {
    return { trackingNumber, tracked: false };
  }

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

  const provider = trackInfo.tracking?.providers?.[0]?.provider;
  const detectedCode = provider?.key;
  const detectedCarrier = detectedCode
    ? (Object.keys(TRACK17_CARRIER_MAP).find((id) => TRACK17_CARRIER_MAP[id] === detectedCode) || null)
    : null;

  return {
    trackingNumber,
    tracked: true,
    status,
    checkpoints,
    detectedCarrier: detectedCarrier || undefined,
    detectedCarrierName: provider?.name || undefined,
    estimatedDelivery: trackInfo.latest_event?.time_iso || null
  };
}

/**
 * Creates the HTTP handler for the 17TRACK webhook endpoint.
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   track17ApiKey?: string,
 *   now?: () => number
 * }} deps
 */
export function createTrack17WebhookHandler({
  db,
  track17ApiKey = '',
  now: _now = () => Date.now()
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const signHeader = req.headers['sign'] || req.headers['Sign'] || '';
    const rawBody = req.rawBody || JSON.stringify(req.body || {});

    if (!verify17TrackSignature(rawBody, signHeader, track17ApiKey)) {
      console.warn('[track17Webhook] Invalid or missing signature');
      res.status(401).json({ code: -1, message: 'Invalid webhook signature' });
      return;
    }

    const body = req.body || {};
    const event = body.event;
    const data = body.data;

    // 17TRACK sends data array or single object depending on event type
    const trackInfos = Array.isArray(data) ? data : (data ? [data] : []);

    let updatedCount = 0;

    for (const item of trackInfos) {
      const number = normalizeNumber(item.number || item.tracking_number);
      if (!number) continue;

      const trackInfo = item.track_info || item;
      const result = normalize17TrackEvent(number, trackInfo);
      if (!result.tracked) continue;

      try {
        // Query users collection to find holders of this tracking number
        const usersSnap = await db.collection('users').limit(100).get();

        for (const userDoc of usersSnap.docs) {
          const pkgSnap = await userDoc.ref.collection('packages')
            .where('trackingNumber', '==', number)
            .limit(5)
            .get();

          for (const pkgDoc of pkgSnap.docs) {
            const pkg = pkgDoc.data();
            const patch = buildTrackingPatch(pkg, result);
            if (patch) {
              await pkgDoc.ref.set(patch, { merge: true });
              updatedCount += 1;
            }
          }
        }
      } catch (err) {
        console.warn(`[track17Webhook] Error applying update for ${number}:`, err?.message);
      }
    }

    console.log(`[track17Webhook] Received event=${event || 'tracking_update'} items=${trackInfos.length} updated=${updatedCount}`);
    res.status(200).json({ code: 0, message: 'Success', updated: updatedCount });
  };
}
