import { parsePackageList } from '../schemas/packageSchema';
import { notificationService } from './notificationService';

/**
 * Builds the result of a save attempt.
 *
 * Backward compatible on purpose: the returned value IS the validated package
 * array (call sites outside this PR still do `saved.find(...)`, `saved.length`,
 * `toEqual([...])`), with the save status attached as non-enumerable
 * properties so JSON serialization and deep-equality assertions are unaffected.
 *
 * @param {Array<object>} packages
 * @param {{ ok: boolean, error?: Error|null, overflow?: boolean }} status
 * @returns {Array<object> & { ok: boolean, packages: Array<object>, error: Error|null, overflow: boolean }}
 */
function makeSaveResult(packages, { ok, error = null, overflow = false }) {
  const result = packages;
  Object.defineProperties(result, {
    ok: { value: ok, enumerable: false, configurable: true },
    packages: { value: packages, enumerable: false, configurable: true },
    error: { value: error, enumerable: false, configurable: true },
    overflow: { value: overflow, enumerable: false, configurable: true }
  });
  return result;
}

function getStorageKey(userId) {
  if (userId) {
    return `deliveree_packages_${userId}`;
  }
  return 'deliveree_packages_guest';
}

/**
 * State machine transition matrix governing allowed package status transitions.
 */
export const TRANSITION_MATRIX = Object.freeze({
  ordered: ['ordered', 'shipped', 'in_transit', 'exception', 'archived'],
  shipped: ['shipped', 'in_transit', 'customs', 'out_for_delivery', 'exception', 'archived'],
  in_transit: ['in_transit', 'customs', 'out_for_delivery', 'delivered', 'exception', 'archived'],
  customs: ['customs', 'in_transit', 'out_for_delivery', 'exception', 'archived'],
  out_for_delivery: ['out_for_delivery', 'delivered', 'exception', 'archived'],
  delivered: ['delivered', 'archived'],
  exception: ['exception', 'in_transit', 'out_for_delivery', 'delivered', 'archived'],
  archived: ['archived', 'ordered', 'shipped', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'exception']
});

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
export const MAX_IMPORT_PACKAGES = 1000;

export const deliveryService = {
  /**
   * State machine transition helper
   */
  canTransition,
  TRANSITION_MATRIX,
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
   * Saves the validated package list to localStorage scoped by userId or guest.
   *
   * Returns the validated array, carrying `ok` / `error` / `overflow` status so
   * a failed write (e.g. quota exhaustion) is no longer indistinguishable from
   * a successful one (P0.3).
   *
   * @param {unknown} packages
   * @param {string|null} [userId=null]
   * @returns {Array<object> & { ok: boolean, packages: Array<object>, error: Error|null, overflow: boolean }}
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
    downloadAnchor.setAttribute("download", `deliveree_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Imports data from JSON file with strict size limits, count caps, and validation
   */
  importData: (jsonString) => {
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
      if (Array.isArray(parsed)) {
        const limited = parsed.slice(0, MAX_IMPORT_PACKAGES);
        const { packages: validated } = parsePackageList(limited);
        if (validated.length === 0 && limited.length > 0) {
          return { success: false, error: 'Imported items failed schema validation' };
        }
        const saved = deliveryService.savePackages(validated);
        if (!saved.ok) {
          return { success: false, error: 'Import could not be persisted (storage write failed)' };
        }
        return { success: true, packages: validated };
      }
      return { success: false, error: 'Invalid JSON structure (must be an array of packages)' };
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

    const savedPkg = saved.find(p => p.id === packageId);

    if (targetPkg.status !== newStatus) {
      notificationService.notifyStatusChange(savedPkg || updatedPkg, targetPkg.status, newStatus);
    }

    return {
      success: true,
      packages: saved,
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

    const savedPkg = saved.find(p => p.id === pkg.id) || updated;

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
