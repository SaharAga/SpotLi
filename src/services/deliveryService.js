import { parsePackageList } from '../schemas/packageSchema';
import { notificationService } from './notificationService';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { APP_NAME } from '../constants/app';

/**
 * Builds the result of a save attempt.
 *
 * A plain object — NOT the array itself. An earlier revision returned the
 * validated array with non-enumerable status properties attached; those flags
 * do not survive spread, `.map`, `.filter`, `JSON.parse(JSON.stringify(...))`,
 * `structuredClone`, or a Firestore round trip. Because the signal was the
 * *absence* of `ok`, any caller that transformed the array first read a
 * successful save as a failure. This shape fails in neither direction.
 *
 * @param {Array<object>} packages
 * @param {{ ok: boolean, error?: Error|null, overflow?: boolean }} status
 * @returns {{ ok: boolean, packages: Array<object>, error: Error|null, overflow: boolean }}
 */
function makeSaveResult(packages, { ok, error = null, overflow = false }) {
  return { ok, packages, error, overflow };
}

function getStorageKey(userId) {
  if (userId) {
    return `${STORAGE_KEYS.PACKAGES_USER_PREFIX}${userId}`;
  }
  return STORAGE_KEYS.PACKAGES_GUEST;
}

/**
 * State machine transition matrix governing allowed package status transitions.
 */
export const TRANSITION_MATRIX = Object.freeze({
  ordered: ['ordered', 'shipped', 'in_transit', 'delivered', 'exception', 'archived'],
  shipped: ['shipped', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'exception', 'archived'],
  in_transit: ['in_transit', 'customs', 'out_for_delivery', 'delivered', 'exception', 'archived'],
  customs: ['customs', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'archived'],
  out_for_delivery: ['out_for_delivery', 'delivered', 'exception', 'archived'],
  delivered: ['delivered', 'archived'],
  exception: ['exception', 'in_transit', 'out_for_delivery', 'delivered', 'archived'],
  archived: ['archived', 'ordered', 'shipped', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'exception']
});

/**
 * Normalizes a tracking number by stripping all whitespace, hyphens, and converting to uppercase.
 *
 * @param {string|null|undefined} trackingNumber
 * @returns {string} Normalized tracking number
 */
export function normalizeTrackingNumber(trackingNumber) {
  if (typeof trackingNumber !== 'string') return '';
  return trackingNumber.replace(/[\s-]+/g, '').toUpperCase();
}

/**
 * Finds an existing package by normalized tracking number, optionally excluding a specific package ID.
 *
 * @param {Array<object>} packages - List of package objects
 * @param {string} trackingNumber - Tracking number to look for
 * @param {string|null} [excludeId=null] - Optional ID to exclude from search (e.g. self when editing)
 * @returns {object|null} Matching package or null
 */
export function findPackageByTrackingNumber(packages, trackingNumber, excludeId = null) {
  if (!Array.isArray(packages) || !trackingNumber) return null;
  const canonical = normalizeTrackingNumber(trackingNumber);
  if (!canonical) return null;

  return packages.find(pkg => {
    if (!pkg || (excludeId && pkg.id === excludeId)) return false;
    return normalizeTrackingNumber(pkg.trackingNumber) === canonical;
  }) || null;
}

/**
 * Checks whether transitioning from `fromStatus` to `toStatus` is permitted by the state machine.
 *
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Desired new status
 * @returns {boolean} True if transition is valid
 */
export function canTransition(fromStatus, toStatus) {
  if (typeof fromStatus !== 'string' || typeof toStatus !== 'string') return false;
  if (!fromStatus || !toStatus) return false;
  if (fromStatus === toStatus) return true;
  if (!Object.prototype.hasOwnProperty.call(TRANSITION_MATRIX, fromStatus)) return false;
  const allowed = TRANSITION_MATRIX[fromStatus];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(toStatus);
}

export const MAX_IMPORT_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export const deliveryService = {
  /**
   * State machine transition helper
   */
  canTransition,
  TRANSITION_MATRIX,
  normalizeTrackingNumber,
  findPackageByTrackingNumber,
  /**
   * Helper to derive the storage key for a user or guest
   */
  getStorageKey,

  /**
   * Loads packages from localStorage scoped by userId or guest
   */
  getPackages: (userId = null) => {
    try {
      const key = getStorageKey(userId);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsePackageList(parsed).packages;
        }
      }
    } catch (e) {
      console.error('Failed to load packages from localStorage', e);
    }
    return [];
  },

  /**
   * Reads the persisted package blob **verbatim** - no repair pass.
   *
   * `getPackages` runs every record through `parsePackageList`, which rewrites
   * unknown carriers and statuses, fills empty titles and dates and normalises
   * tracking numbers.
   *
   * Note what this does and does not buy. `savePackages` is the only writer of
   * a package key and it validates before writing (the cloud adapter routes
   * through it too), so for anything *this* version wrote the two readers
   * return identical content. The difference appears only for a blob written
   * by an older version or modified outside the app: there, this accessor
   * hands the backup path the stored bytes rather than a repaired copy of
   * them. Repair-on-read stays exactly as it was — the app must not crash on
   * corrupt stored data.
   *
   * @param {string|null} [userId=null]
   * @returns {Array<object>} The stored array as-is, or `[]` if absent/unreadable.
   */
  getRawPackages: (userId = null) => {
    try {
      const key = getStorageKey(userId);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to read raw packages from localStorage', e);
    }
    return [];
  },

  /**
   * Saves the validated package list to localStorage scoped by userId or guest.
   *
   * Returns a plain result object (see `makeSaveResult`) whose `packages` field
   * holds the validated array and whose `ok` / `error` / `overflow` fields are
   * ordinary enumerable properties, so a failed write (e.g. quota exhaustion)
   * is distinguishable from a successful one (P0.3) and the status survives
   * spread, cloning and serialisation.
   *
   * @param {unknown} packages
   * @param {string|null} [userId=null]
   * @returns {{ ok: boolean, packages: Array<object>, error: Error|null, overflow: boolean }}
   */
  savePackages: (packages, userId = null) => {
    const { packages: validated, overflow } = parsePackageList(packages);
    try {
      const key = getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(validated));
    } catch (e) {
      console.error('Failed to save packages to localStorage', e);
      return makeSaveResult(validated, { ok: false, error: e, overflow });
    }
    return makeSaveResult(validated, { ok: true, overflow });
  },

  /**
   * Resets data to empty state scoped by userId or guest
   */
  resetToDemo: (userId = null) => {
    try {
      const key = getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify([]));
    } catch {
      // Storage unavailable or quota exceeded
    }
    return [];
  },

  /**
   * Clears specific user packages and returns empty array
   */
  clearUserPackages: (userId = null) => {
    try {
      const key = getStorageKey(userId);
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to clear user packages from localStorage', e);
    }
    return [];
  },

  /**
   * Exports data as JSON string for download using memory-efficient Blob URL
   */
  exportData: (packages) => {
    const { packages: safePackages } = parsePackageList(packages);
    const blob = new Blob([JSON.stringify(safePackages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `${APP_NAME.toLowerCase()}_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Imports data from a JSON string with a strict payload-size limit, manifest inspection,
   * and schema validation. Scoped by userId to ensure user-scoped persistence (#56).
   *
   * Accepts both manifest objects ({ schemaVersion, scope, packages, ... }) and legacy
   * bare arrays. Rejects partial export scopes to prevent accidental data loss (#57).
   *
   * @param {string} jsonString - JSON payload
   * @param {string|null} [userId=null] - Scoped user ID
   * @returns {{ success: boolean, packages?: Array<object>, error?: string }}
   */
  importData: (jsonString, userId = null) => {
    if (typeof jsonString !== 'string') {
      return { success: false, error: 'Invalid input (must be a JSON string)' };
    }

    const payloadSize = typeof Blob !== 'undefined'
      ? new Blob([jsonString]).size
      : jsonString.length;

    if (payloadSize > MAX_IMPORT_SIZE_BYTES) {
      return { success: false, error: 'Import payload exceeds 2MB maximum size limit' };
    }

    try {
      const parsed = JSON.parse(jsonString);
      let rawPackages;

      if (Array.isArray(parsed)) {
        // Legacy bare array format
        rawPackages = parsed;
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Manifest format
        if (parsed.scope && parsed.scope !== 'all') {
          return {
            success: false,
            error: `Cannot restore partial export (scope: "${parsed.scope}"). Only full backups ("all") can be imported.`
          };
        }
        if (!Array.isArray(parsed.packages)) {
          return { success: false, error: 'Invalid JSON structure (packages must be an array)' };
        }
        rawPackages = parsed.packages;
      } else {
        return { success: false, error: 'Invalid JSON structure (must be an array of packages or an export manifest)' };
      }

      // No count cap. Exports are uncapped, so capping here silently turned a
      // complete backup into an incomplete restore with nothing said about
      // it. The 2MB payload limit above is the only bound, and it reports.
      const { packages: validated } = parsePackageList(rawPackages);
      if (validated.length === 0 && rawPackages.length > 0) {
        return { success: false, error: 'Imported items failed schema validation' };
      }
      const saved = deliveryService.savePackages(validated, userId);
      if (!saved.ok) {
        return { success: false, error: 'Import could not be persisted (storage write failed)' };
      }
      return { success: true, packages: validated };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Safely updates a package's status with state machine transition guard and validation.
   *
   * @param {import('../types/deliveree').Package[]} packages - Current package list
   * @param {string} packageId - ID of package to update
   * @param {import('../types/deliveree').DeliveryStageId} newStatus - New status
   * @param {import('../types/deliveree').Checkpoint|null} [newCheckpoint=null] - Optional checkpoint to append
   * @param {string|null} [userId=null] - Scoped user ID
   * @returns {{ success: boolean, packages: import('../types/deliveree').Package[], error?: string, package?: import('../types/deliveree').Package }}
   */
  updatePackageStatus: (packages, packageId, newStatus, newCheckpoint = null, userId = null) => {
    if (!Array.isArray(packages) || !packageId || !newStatus) {
      return { success: false, packages: packages || [], error: 'Invalid arguments' };
    }

    const targetPkg = packages.find(p => p.id === packageId);
    if (!targetPkg) {
      return { success: false, packages, error: 'Package not found' };
    }

    if (!canTransition(targetPkg.status, newStatus)) {
      return {
        success: false,
        packages,
        error: `Cannot transition from ${targetPkg.status} to ${newStatus}`
      };
    }

    const updatedCheckpoints = newCheckpoint
      ? [newCheckpoint, ...(targetPkg.checkpoints || [])]
      : (targetPkg.checkpoints || []);

    const updatedPkg = {
      ...targetPkg,
      status: newStatus,
      checkpoints: updatedCheckpoints,
      updatedAt: new Date().toISOString()
    };

    const updatedList = packages.map(p => (p.id === packageId ? updatedPkg : p));
    const saved = deliveryService.savePackages(updatedList, userId);

    if (!saved.ok) {
      return {
        success: false,
        packages,
        error: 'Failed to persist package status update'
      };
    }

    const savedPkg = saved.packages.find(p => p.id === packageId);

    if (targetPkg.status !== newStatus) {
      notificationService.notifyStatusChange(savedPkg || updatedPkg, targetPkg.status, newStatus);
    }

    return {
      success: true,
      packages: saved.packages,
      package: savedPkg
    };
  },

  /**
   * Refreshes tracking checkpoints & status for a package using trackingService.
   *
   * @param {import('../types/deliveree').Package} pkg - Package entity
   * @param {string|null} [userId=null] - Scoped user ID
   * @param {boolean} [bypassRateLimit=false] - Force fetch
   * @returns {Promise<{ success: boolean, updatedPackage?: import('../types/deliveree').Package, error?: string, rateLimited?: boolean, tracked?: boolean, reason?: string }>}
   */
  refreshPackageTracking: async (pkg, userId = null, bypassRateLimit = false) => {
    if (!pkg || !pkg.trackingNumber) {
      return { success: false, error: 'Invalid package data' };
    }

    const { trackingService } = await import('./trackingService');
    const res = await trackingService.fetchTrackingUpdates(pkg.trackingNumber, pkg.carrier, bypassRateLimit);

    if (!res.success) {
      return {
        success: false,
        rateLimited: res.rateLimited,
        error: res.error || 'Failed to refresh tracking'
      };
    }

    // Lookup succeeded but there is no live data for this carrier. Leave the
    // package exactly as the user entered it — inventing progress here is what
    // made refresh untrustworthy in the first place.
    if (res.tracked === false) {
      return {
        success: true,
        tracked: false,
        reason: res.reason,
        updatedPackage: pkg
      };
    }

    const existingIds = new Set((pkg.checkpoints || []).map(cp => cp.id));
    const newCheckpoints = (res.checkpoints || []).filter(cp => !existingIds.has(cp.id));
    const mergedCheckpoints = [...newCheckpoints, ...(pkg.checkpoints || [])];

    let targetStatus = pkg.status;
    if (res.status && canTransition(pkg.status, res.status)) {
      targetStatus = res.status;
    }

    const updated = {
      ...pkg,
      status: targetStatus,
      checkpoints: mergedCheckpoints,
      expectedDeliveryDate: res.expectedDeliveryDate || pkg.expectedDeliveryDate,
      updatedAt: new Date().toISOString()
    };

    const currentList = deliveryService.getPackages(userId);
    const updatedList = currentList.some(p => p.id === pkg.id)
      ? currentList.map(p => (p.id === pkg.id ? updated : p))
      : [updated, ...currentList];

    const saved = deliveryService.savePackages(updatedList, userId);

    if (!saved.ok) {
      return {
        success: false,
        error: 'Failed to persist refreshed tracking data'
      };
    }

    const savedPkg = saved.packages.find(p => p.id === pkg.id) || updated;

    if (pkg.status !== targetStatus) {
      notificationService.notifyStatusChange(savedPkg, pkg.status, targetStatus);
    }

    return {
      success: true,
      tracked: true,
      updatedPackage: savedPkg
    };
  }
};
