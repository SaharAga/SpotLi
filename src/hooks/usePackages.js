export { MUTATION_TYPES } from "../services/syncQueueService";
import { useState, useEffect, useMemo, useCallback, useRef, useReducer } from 'react';
import { deliveryService } from '../services/deliveryService';
import { cloudAdapter } from '../services/cloudStorageAdapter';
import { syncQueueService, MUTATION_TYPES } from '../services/syncQueueService';
import { parsePackageList } from '../schemas/packageSchema';

function mutationPackageId(mutation) {
  if (mutation?.type === MUTATION_TYPES.STATUS_CHANGE) return mutation.payload?.packageId;
  return mutation?.payload?.id;
}

/** Pending local mutations are authoritative until the queue replays them. */
function pendingMutationsForUser(userId) {
  return new Map(
    syncQueueService.getQueue()
      .filter((mutation) => mutation.userId === userId)
      .map((mutation) => [mutationPackageId(mutation), mutation])
      .filter(([id]) => Boolean(id))
  );
}

function packageTime(pkg) {
  const time = Date.parse(pkg?.updatedAt || '');
  return Number.isFinite(time) ? time : 0;
}

function sortPackages(packages) {
  return [...packages].sort((a, b) => packageTime(b) - packageTime(a));
}

function applyMutation(state, mutation) {
  let nextState = [...state];
  if (mutation.type === MUTATION_TYPES.UPDATE || mutation.type === MUTATION_TYPES.ADD) {
    const idx = nextState.findIndex(p => p.id === mutation.payload.id);
    if (idx >= 0) nextState[idx] = { ...nextState[idx], ...mutation.payload };
    else nextState.push(mutation.payload);
  } else if (mutation.type === MUTATION_TYPES.DELETE) {
    nextState = nextState.filter(p => p.id !== mutation.payload.id);
  } else if (mutation.type === 'UPDATE_ALL') {
    nextState = mutation.payload;
  }
  return sortPackages(nextState);
}

function packagesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function enqueueBulkDelta(previous, next, userId) {
  const previousById = new Map(previous.map((pkg) => [pkg.id, pkg]));
  const nextById = new Map(next.map((pkg) => [pkg.id, pkg]));

  for (const pkg of next) {
    const previousPkg = previousById.get(pkg.id);
    if (!previousPkg) syncQueueService.enqueue(MUTATION_TYPES.ADD, pkg, userId);
    else if (!packagesEqual(previousPkg, pkg)) syncQueueService.enqueue(MUTATION_TYPES.UPDATE, pkg, userId);
  }
  for (const id of previousById.keys()) {
    if (!nextById.has(id)) syncQueueService.enqueue(MUTATION_TYPES.DELETE, { id }, userId);
  }
}

function reconcileSnapshot(state, incoming, origin, userId) {
  const validated = parsePackageList(incoming).packages;
  if (origin === 'demo' || origin === 'init') return validated;

  const pending = pendingMutationsForUser(userId);
  const stateMap = new Map(state.map(pkg => [pkg.id, pkg]));
  const incomingIds = new Set(validated.map(pkg => pkg.id));
  const merged = [];

  for (const remote of validated) {
    const local = stateMap.get(remote.id);
    const mutation = pending.get(remote.id);
    // A queued delete must not be resurrected by an older snapshot.
    if (mutation?.type === MUTATION_TYPES.DELETE) continue;
    // Queue order is the conflict policy: unsynced local intent wins. Otherwise
    // last-write-wins by updatedAt so a newer cross-tab write is retained.
    if (local && (mutation || packageTime(local) > packageTime(remote))) merged.push(local);
    else merged.push(remote);
  }

  for (const [id, local] of stateMap) {
    if (incomingIds.has(id)) continue;
    const mutation = pending.get(id);
    if (mutation && mutation.type !== MUTATION_TYPES.DELETE) merged.push(local);
  }

  return sortPackages(merged);
}

function packageReducer(state, action) {
  const { type, incoming, origin, mutation, userId } = action;

  if (type === 'SYNC') {
    if (!Array.isArray(incoming)) return state;
    return reconcileSnapshot(state, incoming, origin, userId);
  }

  if (type === 'MUTATE') {
    return applyMutation(state, mutation);
  }

  if (type === 'SET') return incoming;

  return state;
}

export function usePackages(user, triggerCloudSync, onSaveError) {
  const isDemoUrl = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === 'true' || window.location.hash === '#demo';
  }, []);

  const [isDemoMode, setIsDemoMode] = useState(isDemoUrl);
  const [saveError, setSaveError] = useState(null);

  const onSaveErrorRef = useRef(onSaveError);
  useEffect(() => {
    onSaveErrorRef.current = onSaveError;
  }, [onSaveError]);

  const [packages, dispatch] = useReducer(packageReducer, [], () => {
    return deliveryService.getPackages(user?.id || null);
  });
  const packagesRef = useRef(packages);

  const dispatchSnapshot = useCallback((incoming, origin) => {
    const next = reconcileSnapshot(packagesRef.current, incoming, origin, user?.id || null);
    packagesRef.current = next;
    dispatch({ type: 'SET', incoming: next });
  }, [user?.id]);

  // Async load mock data if demo mode
  useEffect(() => {
    let cancelled = false;
    if (isDemoMode) {
      import('../data/initialMockData').then(mod => {
        if (!cancelled) dispatchSnapshot(mod.INITIAL_PACKAGES, 'demo');
      });
    }
    return () => { cancelled = true; };
  }, [isDemoMode, dispatchSnapshot]);

  useEffect(() => {
    if (user?.id) setIsDemoMode(false);
  }, [user?.id]);

  useEffect(() => {
    if (!isDemoMode) {
      dispatchSnapshot(deliveryService.getPackages(user?.id || null), 'init');
    }
  }, [user?.id, isDemoMode, dispatchSnapshot]);

  // StorageEvent listener
  useEffect(() => {
    if (typeof window === 'undefined' || isDemoMode) return;
    const handlePackageStorageChange = (e) => {
      const currentStorageKey = deliveryService.getStorageKey(user?.id || null);
      if (e.key === currentStorageKey) {
        try {
          // `newValue === null` is a deliberate clear from another tab.
          const parsed = e.newValue === null ? [] : JSON.parse(e.newValue);
          if (Array.isArray(parsed)) dispatchSnapshot(parsed, 'storage');
        } catch (err) {
          console.warn('[usePackages] Multi-tab package sync error:', err);
        }
      }
    };
    window.addEventListener('storage', handlePackageStorageChange);
    return () => window.removeEventListener('storage', handlePackageStorageChange);
  }, [user?.id, isDemoMode, dispatchSnapshot]);

  // Cloud listener
  useEffect(() => {
    if (isDemoMode || !user?.id) return;
    const unsubscribe = cloudAdapter.subscribe((updatedPackages) => {
      if (Array.isArray(updatedPackages)) {
        dispatchSnapshot(updatedPackages, 'cloud');
      }
    });
    return () => unsubscribe();
  }, [user?.id, isDemoMode, dispatchSnapshot]);

  useEffect(() => {
    packagesRef.current = packages;
  }, [packages]);

  const commit = useCallback((mutation) => {
    // 1. Compute next state synchronously to persist it locally
    const previousState = packagesRef.current;
    const nextState = applyMutation(previousState, mutation);
    // React may batch multiple commits. Advance the authoritative value before
    // dispatching so a second commit cannot persist from an older render.
    packagesRef.current = nextState;

    // 2. Persist locally
    const result = deliveryService.savePackages(nextState, user?.id || null);
    if (!result || !result.ok) {
      const failure = {
        message: 'Changes could not be saved to this device (storage is full).',
        cause: (result && result.error) || null
      };
      setSaveError(failure);
      if (onSaveErrorRef.current) onSaveErrorRef.current(failure);
    } else {
      setSaveError(null);
    }

    // 3. Update React state
    dispatch({ type: 'SET', incoming: nextState });

    // 4. Persist to cloud
    if (user?.id && cloudAdapter.isFirestoreActive?.()) {
      if (mutation.type === 'UPDATE_ALL') {
        enqueueBulkDelta(previousState, nextState, user.id);
      } else {
        syncQueueService.enqueue(mutation.type, mutation.payload, user.id);
      }
    }
    triggerCloudSync();
    return true;
  }, [user?.id, triggerCloudSync]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  const startDemoMode = useCallback(() => {
    setIsDemoMode(true);
  }, []);

  return {
    packages,
    isDemoMode,
    setIsDemoMode,
    startDemoMode,
    commit,
    saveError,
    clearSaveError
  };
}
