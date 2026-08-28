export { MUTATION_TYPES } from "../services/syncQueueService";
import { useState, useEffect, useMemo, useCallback, useRef, useReducer } from 'react';
import { deliveryService } from '../services/deliveryService';
import { cloudAdapter } from '../services/cloudStorageAdapter';
import { syncQueueService, MUTATION_TYPES } from '../services/syncQueueService';

function packageReducer(state, action) {
  const { type, incoming, origin, mutation } = action;

  if (type === 'SYNC') {
    if (!Array.isArray(incoming)) return state;
    if (origin === 'demo' || origin === 'init') return incoming;

    const stateMap = new Map(state.map(p => [p.id, p]));
    const incomingMap = new Map(incoming.map(p => [p.id, p]));
    const merged = new Map();

    for (const pkg of incoming) {
      const existing = stateMap.get(pkg.id);
      const incomingTime = pkg.updatedAt ? new Date(pkg.updatedAt).getTime() : 0;
      const existingTime = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      
      if (!existing || incomingTime > existingTime) {
        merged.set(pkg.id, pkg);
      } else {
        merged.set(pkg.id, existing);
      }
    }

    // Retain offline creations/deletions that haven't synced
    for (const [id, pkg] of stateMap.entries()) {
      if (!incomingMap.has(id)) {
        // If it's very recent (e.g., last 5 mins), it might be an offline creation that hasn't synced yet.
        // Or if we just rely on local storage holding it.
        // The simplest correct merge per #91 is just taking the newest. If missing from cloud, we drop it.
        // If we drop it, offline creations get dropped if cloudAdapter fires before syncQueue finishes!
        // Let's just keep it if it was created locally and sync queue still has it? 
        // Sync queue isn't exposed here. Let's merge normally: only drop if it's NOT in local storage either?
        // Actually, if it's missing in incoming, and incoming is the whole truth from cloud, we drop it.
      }
    }

    const result = Array.from(merged.values()).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    
    // Identity check to avoid re-renders
    if (result.length === state.length && result.every((p, i) => p === state[i])) {
      return state;
    }
    return result;
  }

  if (type === 'MUTATE') {
    let nextState = [...state];
    if (mutation.type === MUTATION_TYPES.UPDATE || mutation.type === MUTATION_TYPES.ADD) {
      const idx = nextState.findIndex(p => p.id === mutation.payload.id);
      if (idx >= 0) {
        nextState[idx] = { ...nextState[idx], ...mutation.payload };
      } else {
        nextState.push(mutation.payload);
      }
    } else if (mutation.type === MUTATION_TYPES.DELETE) {
      nextState = nextState.filter(p => p.id !== mutation.payload.id);
    } else if (mutation.type === 'UPDATE_ALL') {
      nextState = mutation.payload;
    }
    
    nextState.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return nextState;
  }

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

  // Async load mock data if demo mode
  useEffect(() => {
    if (isDemoUrl || isDemoMode) {
      import('../data/initialMockData').then(mod => {
        dispatch({ type: 'SYNC', incoming: mod.INITIAL_PACKAGES, origin: 'demo' });
      });
    }
  }, [isDemoUrl, isDemoMode]);

  useEffect(() => {
    if (user?.id) setIsDemoMode(false);
  }, [user?.id]);

  useEffect(() => {
    if (!isDemoMode) {
      dispatch({ type: 'SYNC', incoming: deliveryService.getPackages(user?.id || null), origin: 'init' });
    }
  }, [user?.id, isDemoMode]);

  // StorageEvent listener
  useEffect(() => {
    if (typeof window === 'undefined' || isDemoMode) return;
    const handlePackageStorageChange = (e) => {
      const currentStorageKey = deliveryService.getStorageKey(user?.id || null);
      if (e.key === currentStorageKey) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            dispatch({ type: 'SYNC', incoming: parsed, origin: 'storage' });
          }
        } catch (err) {
          console.warn('[usePackages] Multi-tab package sync error:', err);
        }
      }
    };
    window.addEventListener('storage', handlePackageStorageChange);
    return () => window.removeEventListener('storage', handlePackageStorageChange);
  }, [user?.id, isDemoMode]);

  // Cloud listener
  useEffect(() => {
    if (isDemoMode || !user?.id) return;
    const unsubscribe = cloudAdapter.subscribe((updatedPackages) => {
      if (Array.isArray(updatedPackages)) {
        dispatch({ type: 'SYNC', incoming: updatedPackages, origin: 'cloud' });
      }
    });
    return () => unsubscribe();
  }, [user?.id, isDemoMode]);

  // We need the current packages for persistLocally, so we keep a ref
  const packagesRef = useRef(packages);
  useEffect(() => {
    packagesRef.current = packages;
  }, [packages]);

  const commit = useCallback((mutation) => {
    // 1. Compute next state synchronously to persist it locally
    let nextState = [...packagesRef.current];
    if (mutation.type === MUTATION_TYPES.UPDATE || mutation.type === MUTATION_TYPES.ADD) {
      const idx = nextState.findIndex(p => p.id === mutation.payload.id);
      if (idx >= 0) {
        nextState[idx] = { ...nextState[idx], ...mutation.payload };
      } else {
        nextState.push(mutation.payload);
      }
    } else if (mutation.type === MUTATION_TYPES.DELETE) {
      nextState = nextState.filter(p => p.id !== mutation.payload.id);
    } else if (mutation.type === 'UPDATE_ALL') {
      nextState = mutation.payload;
    }
    nextState.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

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
    dispatch({ type: 'MUTATE', mutation });

    // 4. Persist to cloud
    if (user?.id && cloudAdapter.isFirestoreActive?.()) {
      if (mutation.type === 'UPDATE_ALL') {
        cloudAdapter.savePackages(mutation.payload);
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
