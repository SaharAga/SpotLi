/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, cleanup } from '@testing-library/react';
import { usePackages } from './usePackages';
import { deliveryService } from '../services/deliveryService';
import { cloudAdapter } from '../services/cloudStorageAdapter';
import { syncQueueService } from '../services/syncQueueService';

// This hook was extracted from App.jsx specifically so the storage
// reconciliation policy — which of localStorage, cross-tab events, and the
// Firestore subscription wins when they disagree — could be tested in one
// place instead of only observed indirectly through the whole dashboard.
describe('usePackages', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads the guest package list on mount', () => {
    localStorage.setItem(
      deliveryService.getStorageKey(null),
      JSON.stringify([{ id: 'p1', title: 'Guest Pkg', trackingNumber: 'RS948219481IL', carrier: 'israel-post', status: 'in_transit', category: 'other', isPinned: false, isArchived: false, checkpoints: [] }])
    );

    const { result } = renderHook(() => usePackages(null, vi.fn()));
    expect(result.current.packages).toHaveLength(1);
    expect(result.current.packages[0].id).toBe('p1');
  });

  it('reloads the scoped list when the signed-in user changes', () => {
    localStorage.setItem(
      deliveryService.getStorageKey('user-1'),
      JSON.stringify([{ id: 'u1', title: 'User Pkg', trackingNumber: 'RS948219481IL', carrier: 'israel-post', status: 'in_transit', category: 'other', isPinned: false, isArchived: false, checkpoints: [] }])
    );

    const { result, rerender } = renderHook(
      ({ user }) => usePackages(user, vi.fn()),
      { initialProps: { user: null } }
    );
    expect(result.current.packages).toHaveLength(0);

    rerender({ user: { id: 'user-1' } });
    expect(result.current.packages).toHaveLength(1);
    expect(result.current.packages[0].id).toBe('u1');
  });

  it('picks up a same-key change from another tab via the storage event', () => {
    const { result } = renderHook(() => usePackages(null, vi.fn()));
    expect(result.current.packages).toHaveLength(0);

    const pkg = { id: 'p2', title: 'From another tab', trackingNumber: 'RS948219481IL', carrier: 'israel-post', status: 'in_transit', category: 'other', isPinned: false, isArchived: false, checkpoints: [] };
    localStorage.setItem(deliveryService.getStorageKey(null), JSON.stringify([pkg]));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: deliveryService.getStorageKey(null),
        newValue: JSON.stringify([pkg])
      }));
    });

    expect(result.current.packages).toHaveLength(1);
    expect(result.current.packages[0].id).toBe('p2');
  });

  it('applies a cloud push from cloudAdapter.subscribe', () => {
    const { result } = renderHook(() => usePackages({ id: 'user-1' }, vi.fn()));

    const pushed = [{ id: 'cloud-1', title: 'From Firestore', trackingNumber: 'RS948219481IL', carrier: 'israel-post', status: 'delivered', category: 'other', isPinned: false, isArchived: false, checkpoints: [] }];
    act(() => {
      cloudAdapter.notifyListeners(pushed);
    });

    expect(result.current.packages).toEqual(pushed);
  });

  it('startDemoMode loads the sample dataset and flips isDemoMode', () => {
    const { result } = renderHook(() => usePackages(null, vi.fn()));
    act(() => {
      result.current.startDemoMode();
    });
    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.packages.length).toBeGreaterThan(0);
  });

  it('updatePackagesState persists locally and calls triggerCloudSync', () => {
    const triggerCloudSync = vi.fn();
    const { result } = renderHook(() => usePackages(null, triggerCloudSync));

    const next = [{ id: 'p3', title: 'Bulk', trackingNumber: 'RS948219481IL', carrier: 'israel-post', status: 'in_transit', category: 'other', isPinned: false, isArchived: false, checkpoints: [] }];
    act(() => {
      result.current.updatePackagesState(next);
    });

    expect(result.current.packages).toEqual(next);
    // getPackages runs the persisted data back through schema validation,
    // which fills in defaulted fields — compare on identity, not deep equality.
    const persisted = deliveryService.getPackages(null);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe('p3');
    expect(triggerCloudSync).toHaveBeenCalledTimes(1);
  });

  it('upsertSinglePackage enqueues an UPDATE mutation only when Firestore is active', () => {
    const enqueueSpy = vi.spyOn(syncQueueService, 'enqueue').mockImplementation(() => {});
    vi.spyOn(cloudAdapter, 'isFirestoreActive').mockReturnValue(true);

    const { result } = renderHook(() => usePackages({ id: 'user-1' }, vi.fn()));
    const changed = { id: 'p4', title: 'Solo update', trackingNumber: 'RS948219481IL', carrier: 'israel-post', status: 'in_transit', category: 'other', isPinned: false, isArchived: false, checkpoints: [] };

    act(() => {
      result.current.upsertSinglePackage([changed], changed);
    });

    expect(enqueueSpy).toHaveBeenCalledWith('UPDATE', changed, 'user-1');
  });

  it('removeSinglePackage does not touch the sync queue when Firestore is inactive', () => {
    const enqueueSpy = vi.spyOn(syncQueueService, 'enqueue').mockImplementation(() => {});
    // isFirestoreActive defaults to false: Firebase is unconfigured in tests.
    const { result } = renderHook(() => usePackages({ id: 'user-1' }, vi.fn()));

    act(() => {
      result.current.removeSinglePackage([], 'p5');
    });

    expect(enqueueSpy).not.toHaveBeenCalled();
    expect(result.current.packages).toEqual([]);
  });

  describe('local save failures reach the UI', () => {
    const quotaThrower = () => {
      throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    };

    it('exposes saveError and invokes onSaveError when the write is rejected', () => {
      const onSaveError = vi.fn();
      const { result } = renderHook(() => usePackages(null, vi.fn(), onSaveError));
      expect(result.current.saveError).toBeNull();

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quotaThrower);

      act(() => {
        result.current.updatePackagesState([
          { id: 'q1', title: 'Quota', trackingNumber: 'TRKQ' }
        ]);
      });

      expect(result.current.saveError).not.toBeNull();
      expect(result.current.saveError.message).toMatch(/could not be saved/i);
      expect(result.current.saveError.cause).toBeInstanceOf(Error);
      expect(onSaveError).toHaveBeenCalledTimes(1);
      // In-memory state still updates so the user does not lose their edit.
      expect(result.current.packages).toHaveLength(1);
    });

    it('reports the failure for single-package mutations too', () => {
      const onSaveError = vi.fn();
      const { result } = renderHook(() => usePackages(null, vi.fn(), onSaveError));

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quotaThrower);

      act(() => {
        result.current.upsertSinglePackage(
          [{ id: 'q2', title: 'One', trackingNumber: 'TRK2' }],
          { id: 'q2' }
        );
      });
      expect(result.current.saveError).not.toBeNull();

      act(() => {
        result.current.removeSinglePackage([], 'q2');
      });
      expect(onSaveError).toHaveBeenCalledTimes(2);
    });

    it('clears saveError once a later save succeeds', () => {
      const { result } = renderHook(() => usePackages(null, vi.fn()));

      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quotaThrower);
      act(() => {
        result.current.updatePackagesState([{ id: 'q3', title: 'X', trackingNumber: 'TRK3' }]);
      });
      expect(result.current.saveError).not.toBeNull();

      setItem.mockRestore();
      act(() => {
        result.current.updatePackagesState([{ id: 'q3', title: 'X', trackingNumber: 'TRK3' }]);
      });
      expect(result.current.saveError).toBeNull();
    });

    it('clearSaveError dismisses the banner', () => {
      const { result } = renderHook(() => usePackages(null, vi.fn()));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quotaThrower);

      act(() => {
        result.current.updatePackagesState([{ id: 'q4', title: 'Y', trackingNumber: 'TRK4' }]);
      });
      expect(result.current.saveError).not.toBeNull();

      act(() => result.current.clearSaveError());
      expect(result.current.saveError).toBeNull();
    });
  });
});
