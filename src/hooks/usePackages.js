import { useState, useEffect, useMemo } from 'react';
import { deliveryService } from '../services/deliveryService';
import { cloudAdapter } from '../services/cloudStorageAdapter';
import { syncQueueService, MUTATION_TYPES } from '../services/syncQueueService';
import { INITIAL_PACKAGES } from '../data/initialMockData';

/**
 * Owns the package list and reconciles it across the app's four sources of
 * truth: localStorage (via deliveryService), the cross-tab StorageEvent,
 * the Firestore realtime subscription (cloudAdapter), and demo mode.
 *
 * Whichever source fires last wins — there is no merge policy here, only
 * "the most recent event replaces state". That matches the behavior this
 * hook was extracted from; it does not introduce conflict resolution that
 * didn't exist before.
 *
 * @param {{ id: string } | null | undefined} user
 * @param {() => void} triggerCloudSync - called after any write this hook
 *   makes, so the caller's sync-status UI stays accurate.
 */
export function usePackages(user, triggerCloudSync) {
  const isDemoUrl = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === 'true' || window.location.hash === '#demo';
  }, []);

  const [isDemoMode, setIsDemoMode] = useState(isDemoUrl);

  const [packages, setPackages] = useState(() => {
    if (isDemoUrl) {
      return INITIAL_PACKAGES;
    }
    return deliveryService.getPackages(user?.id || null);
  });

  // Automatically disable demo mode upon user authentication
  useEffect(() => {
    if (user?.id) {
      setIsDemoMode(false);
    }
  }, [user?.id]);

  // Load packages scoped by user or guest; guest-to-user migration is handled by AuthContext
  useEffect(() => {
    if (isDemoMode) {
      setPackages(INITIAL_PACKAGES);
    } else if (user?.id) {
      setPackages(deliveryService.getPackages(user.id));
    } else {
      setPackages(deliveryService.getPackages(null));
    }
  }, [user?.id, isDemoMode]);

  // Multi-tab package synchronization via StorageEvent
  useEffect(() => {
    if (typeof window === 'undefined' || isDemoMode) return;

    const handlePackageStorageChange = (e) => {
      const currentStorageKey = deliveryService.getStorageKey(user?.id || null);
      if (e.key === currentStorageKey) {
        if (!e.newValue) {
          setPackages([]);
        } else {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              const validated = deliveryService.getPackages(user?.id || null);
              setPackages(validated);
            }
          } catch (err) {
            console.warn('[usePackages] Multi-tab package sync error:', err);
          }
        }
      }
    };

    window.addEventListener('storage', handlePackageStorageChange);
    return () => window.removeEventListener('storage', handlePackageStorageChange);
  }, [user?.id, isDemoMode]);

  // Real-time Cloud Synchronization listener
  useEffect(() => {
    if (isDemoMode || !user?.id) return;
    const unsubscribe = cloudAdapter.subscribe((updatedPackages) => {
      if (Array.isArray(updatedPackages)) {
        setPackages(updatedPackages);
      }
    });
    return () => unsubscribe();
  }, [user?.id, isDemoMode]);

  useEffect(() => {
    if (isDemoUrl && !isDemoMode && !user) {
      setIsDemoMode(true);
      setPackages(INITIAL_PACKAGES);
    }
  }, [isDemoUrl, isDemoMode, user]);

  // Sync with LocalStorage & Cloud (bulk — use for batch operations only, e.g. import/batch-refresh).
  // Deliberately NOT routed through syncQueueService: enqueue() auto-triggers a replay per call, and
  // a tight synchronous loop of N enqueue() calls only picks up the first item's replay pass (the
  // queue snapshot is captured before the loop's later calls land) — bulk writes go straight to
  // cloudAdapter's own batched Firestore write instead, which handles the whole list atomically.
  const updatePackagesState = (newPackages) => {
    setPackages(newPackages);
    deliveryService.savePackages(newPackages, user?.id || null);
    if (user?.id && cloudAdapter.isFirestoreActive?.()) {
      cloudAdapter.savePackages(newPackages);
    }
    triggerCloudSync();
  };

  // Single-package mutation: writes one Firestore doc instead of batch-writing the full list (quota-efficient).
  // The cloud write goes through syncQueueService instead of calling cloudAdapter directly, so a failed
  // or offline write is retried with backoff and dead-lettered (not silently dropped) instead of just
  // logging a console.warn.
  const upsertSinglePackage = (updatedPackages, changedPkg) => {
    setPackages(updatedPackages);
    deliveryService.savePackages(updatedPackages, user?.id || null);
    if (user?.id && cloudAdapter.isFirestoreActive?.()) {
      syncQueueService.enqueue(MUTATION_TYPES.UPDATE, changedPkg, user.id);
    }
    triggerCloudSync();
  };

  const removeSinglePackage = (updatedPackages, packageId) => {
    setPackages(updatedPackages);
    deliveryService.savePackages(updatedPackages, user?.id || null);
    if (user?.id && cloudAdapter.isFirestoreActive?.()) {
      syncQueueService.enqueue(MUTATION_TYPES.DELETE, { id: packageId }, user.id);
    }
    triggerCloudSync();
  };

  // Enters demo mode with the sample dataset — used by the "try a live demo" CTA.
  const startDemoMode = () => {
    setIsDemoMode(true);
    setPackages(INITIAL_PACKAGES);
  };

  return {
    packages,
    setPackages,
    isDemoMode,
    setIsDemoMode,
    startDemoMode,
    updatePackagesState,
    upsertSinglePackage,
    removeSinglePackage
  };
}
