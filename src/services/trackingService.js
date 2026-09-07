import { fetchLiveCarrierTracking, UNTRACKED_REASONS } from './carrierApiProxy';
import { detectCarrier } from '../utils/carrierDetector';
import { parsePackage } from '../schemas/packageSchema';
import { checkRateLimit, recordTrackingFetch, resetTrackingCooldown, RATE_LIMIT_COOLDOWN_MS } from '../utils/rateLimiter';


/**
 * Cooldown duration in milliseconds per tracking number (60 seconds)
 */

/**
 * In-memory map of tracking number -> timestamp of last successful tracking fetch.
 * Maximum capacity bounded to avoid memory exhaustion attacks.
 */

/**
 * Reset all or specific cooldowns (useful for testing and manual resets)
 * @param {string} [trackingNumber]
 */

/**
 * Check if a tracking number is currently rate-limited
 * @param {string} trackingNumber
 * @returns {{ isLimited: boolean, remainingMs: number }}
 */

/**
 * Record a successful fetch timestamp for a tracking number with bounded memory cleanup.
 * @param {string} trackingNumber
 */

/**
 * Normalizes checkpoints into the schema-conforming structure
 * @param {Array<any>} rawCheckpoints
 * @param {string} trackingNumber
 * @returns {import('../types/deliveree').Checkpoint[]}
 */
export function normalizeCheckpoints(rawCheckpoints, trackingNumber = '') {
  if (!Array.isArray(rawCheckpoints)) return [];

  const safeTrack = typeof trackingNumber === 'string' ? trackingNumber.slice(0, 50) : 'trk';

  return rawCheckpoints.slice(0, 50).map((cp, idx) => {
    if (!cp || typeof cp !== 'object') {
      return {
        id: `cp-${safeTrack}-${idx}-${Date.now()}`.slice(0, 100),
        title: 'Checkpoint Update',
        description: '',
        descriptionHe: '',
        location: '',
        timestamp: new Date().toISOString(),
        isCompleted: true
      };
    }

    const id = cp.id ? String(cp.id) : `cp-${safeTrack}-${idx}-${Date.now()}`;
    const timestamp = cp.timestamp || cp.time || new Date().toISOString();
    return {
      id: String(id).slice(0, 100),
      title: String(cp.title || cp.status || cp.stage || 'Checkpoint Update').slice(0, 200),
      titleHe: cp.titleHe ? String(cp.titleHe).slice(0, 200) : undefined,
      description: cp.description || cp.details || cp.desc ? String(cp.description || cp.details || cp.desc).slice(0, 500) : '',
      descriptionHe: cp.descriptionHe || cp.detailsHe ? String(cp.descriptionHe || cp.detailsHe).slice(0, 500) : '',
      location: cp.location || cp.place ? String(cp.location || cp.place).slice(0, 150) : '',
      timestamp: String(timestamp).slice(0, 50),
      isCompleted: cp.isCompleted !== undefined ? Boolean(cp.isCompleted) : true
    };
  });
}

/**
 * Fetches tracking updates for a package with rate limiting and checkpoint normalization.
 * 
 * @param {string} trackingNumber - Tracking number
 * @param {string} [carrierId] - Optional carrier ID
 * @param {boolean} [bypassRateLimit=false] - Force fetch bypassing rate limit
 * @returns {Promise<{
 *   success: boolean,
 *   rateLimited?: boolean,
 *   remainingCooldownMs?: number,
 *   error?: string,
 *   carrier: string,
 *   tracked?: boolean,
 *   reason?: string,
 *   status?: import('../types/deliveree').DeliveryStageId,
 *   checkpoints?: import('../types/deliveree').Checkpoint[],
 *   expectedDeliveryDate?: string
 * }>}
 *
 * A `success: true` result with `tracked: false` means the lookup completed but
 * no live data exists for this carrier. Callers must not merge anything from
 * such a result into a package.
 */
export async function fetchTrackingUpdates(trackingNumber, carrierId, bypassRateLimit = false) {
  if (!trackingNumber || typeof trackingNumber !== 'string') {
    return { success: false, error: 'Invalid tracking number', carrier: 'other' };
  }

  const cleanTrack = trackingNumber.trim().toUpperCase();
  const detectedCarrier = carrierId || detectCarrier(cleanTrack).carrierId || 'other';

  if (!bypassRateLimit) {
    const rateCheck = checkRateLimit(cleanTrack);
    if (rateCheck.isLimited) {
      return {
        success: false,
        rateLimited: true,
        remainingCooldownMs: rateCheck.remainingMs,
        carrier: detectedCarrier,
        error: `Please wait ${Math.ceil(rateCheck.remainingMs / 1000)}s before refreshing this package again.`
      };
    }
  }

  try {
    const trackingData = await fetchLiveCarrierTracking(cleanTrack, detectedCarrier, bypassRateLimit);

    if (trackingData.tracked === false) {
      // Only burn the cooldown when a real upstream call was attempted;
      // an unsupported carrier costs nothing to ask about again.
      if (trackingData.reason !== UNTRACKED_REASONS.UNSUPPORTED) {
        recordTrackingFetch(cleanTrack);
      }
      return {
        success: true,
        tracked: false,
        reason: trackingData.reason,
        carrier: detectedCarrier,
        checkpoints: []
      };
    }

    recordTrackingFetch(cleanTrack);

    return {
      success: true,
      tracked: true,
      carrier: detectedCarrier,
      status: trackingData.status,
      checkpoints: trackingData.checkpoints,
      expectedDeliveryDate: trackingData.estimatedDelivery,
      shelfNumber: trackingData.shelfNumber || null,
      localTrackingNumber: trackingData.localTrackingNumber || null,
      localCarrier: trackingData.localCarrier || null,
      customsDetails: trackingData.customsDetails || null,
      pickupDeadline: trackingData.pickupDeadline || null,
      location: trackingData.location || null
    };
  } catch (err) {
    return {
      success: false,
      carrier: detectedCarrier,
      error: err instanceof Error ? err.message : 'Failed to fetch tracking data'
    };
  }
}

/**
 * Debounce helper for client performance optimization
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} wait
 * @returns {(...args: Parameters<T>) => void}
 */
export function debounce(fn, wait = 300) {
  let timeoutId = null;
  return function debounced(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Batch refreshes an array of packages with throttling and progress reporting.
 *
 * @param {import('../types/deliveree').Package[]} packages - Array of packages to refresh
 * @param {((progress: { completed: number, total: number, updatedCount: number }) => void)} [onProgress] - Optional progress callback
 * @param {number} [concurrencyLimit=3] - Maximum parallel requests
 * @returns {Promise<{
 *   updatedPackages: import('../types/deliveree').Package[],
 *   refreshedCount: number,
 *   rateLimitedCount: number,
 *   untrackedCount: number,
 *   errors: string[]
 * }>}
 */
export async function batchRefreshTracking(packages, onProgress, concurrencyLimit = 3) {
  if (!Array.isArray(packages) || packages.length === 0) {
    return { updatedPackages: [], refreshedCount: 0, rateLimitedCount: 0, untrackedCount: 0, errors: [] };
  }

  const results = [...packages];
  let completed = 0;
  let refreshedCount = 0;
  let rateLimitedCount = 0;
  let untrackedCount = 0;
  const errors = [];
  const batchCache = new Map();

  const total = packages.length;

  // Process in throttled chunks
  for (let i = 0; i < packages.length; i += concurrencyLimit) {
    const chunk = packages.slice(i, i + concurrencyLimit);
    const promises = chunk.map(async (pkg, chunkIdx) => {
      const actualIndex = i + chunkIdx;
      if (!pkg.trackingNumber || pkg.isArchived || pkg.status === 'delivered') {
        completed++;
        return;
      }

      const cleanTrack = String(pkg.trackingNumber).trim().toUpperCase();
      let res;
      if (batchCache.has(cleanTrack)) {
        res = batchCache.get(cleanTrack);
      } else {
        res = await fetchTrackingUpdates(pkg.trackingNumber, pkg.carrier, true);
        if (res.success) {
          batchCache.set(cleanTrack, res);
        }
      }

      if (res.success && res.tracked === false) {
        untrackedCount++;
      } else if (res.success && res.checkpoints) {
        // Merge checkpoints ensuring uniqueness by id
        const rawCheckpoints = Array.isArray(pkg.checkpoints) ? pkg.checkpoints : [];
        const existingIds = new Set(rawCheckpoints.map(cp => cp && cp.id));
        const newCheckpoints = res.checkpoints.filter(cp => cp && !existingIds.has(cp.id));
        const mergedCheckpoints = [...newCheckpoints, ...rawCheckpoints];

        const updatedPkg = {
          ...pkg,
          status: res.status || pkg.status,
          checkpoints: mergedCheckpoints,
          expectedDeliveryDate: res.expectedDeliveryDate || pkg.expectedDeliveryDate,
          updatedAt: new Date().toISOString()
        };

        // Route through THE single validation entry point. The old
        // `validatePackageSafe` path ran a `.strip()` schema that did not list
        // `schemaVersion`, so every refresh silently erased it along with any
        // unknown field on the record (issue #41).
        const validated = parsePackage(updatedPkg);
        if (validated) {
          results[actualIndex] = validated;
          refreshedCount++;
        }
      } else if (res.rateLimited) {
        rateLimitedCount++;
      } else if (res.error) {
        errors.push(`${pkg.trackingNumber}: ${res.error}`);
      }

      completed++;
    });

    await Promise.all(promises);

    if (onProgress) {
      onProgress({ completed, total, updatedCount: refreshedCount });
    }
  }

  return {
    updatedPackages: results,
    refreshedCount,
    rateLimitedCount,
    untrackedCount,
    errors
  };
}

export const trackingService = {
  RATE_LIMIT_COOLDOWN_MS,
  resetTrackingCooldown,
  checkRateLimit,
  recordTrackingFetch,
  normalizeCheckpoints,
  fetchTrackingUpdates,
  batchRefreshTracking,
  debounce
};
export { checkRateLimit, recordTrackingFetch, resetTrackingCooldown, RATE_LIMIT_COOLDOWN_MS };
