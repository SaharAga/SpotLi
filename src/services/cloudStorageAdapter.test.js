import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { CloudStorageAdapter } from './cloudStorageAdapter';

describe('CloudStorageAdapter', () => {
  let adapter;
  let mockStore = {};

  beforeAll(() => {
    globalThis.localStorage = {
      getItem: (key) => mockStore[key] || null,
      setItem: (key, value) => { mockStore[key] = String(value); },
      removeItem: (key) => { delete mockStore[key]; },
      clear: () => { mockStore = {}; }
    };
  });

  beforeEach(() => {
    localStorage.clear();
    adapter = new CloudStorageAdapter({ mode: 'local' });
  });

  it('returns empty array when storage is empty', async () => {
    const packages = await adapter.getPackages();
    expect(Array.isArray(packages)).toBe(true);
    expect(packages.length).toBe(0);
  });

  it('upserts a new package and notifies subscribers', async () => {
    const subscriber = vi.fn();
    const unsubscribe = adapter.subscribe(subscriber);

    const newPkg = {
      id: 'pkg-test-999',
      trackingNumber: 'IL123456789IL',
      title: 'Test Delivery Item',
      carrierId: 'israel-post',
      stageId: 'in_transit'
    };

    const savedList = await adapter.upsertPackage(newPkg);
    expect(savedList.some(p => p.id === 'pkg-test-999')).toBe(true);
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('deletes a package by ID', async () => {
    const newPkg = {
      id: 'pkg-delete-123',
      trackingNumber: 'IL999999999IL',
      title: 'Package to Delete',
      carrierId: 'israel-post',
      stageId: 'in_transit'
    };

    await adapter.upsertPackage(newPkg);
    const initialList = await adapter.getPackages();
    expect(initialList.length).toBe(1);

    const remaining = await adapter.deletePackage('pkg-delete-123');
    expect(remaining.some(p => p.id === 'pkg-delete-123')).toBe(false);
  });


  it('records a tombstone when deleting a package and filters tombstoned packages on getPackages', async () => {
    const pkg1 = { id: 'pkg-101', trackingNumber: 'TRK101', title: 'P1', carrier: 'other', status: 'in_transit' };
    const pkg2 = { id: 'pkg-102', trackingNumber: 'TRK102', title: 'P2', carrier: 'other', status: 'in_transit' };

    await adapter.upsertPackage(pkg1);
    await adapter.upsertPackage(pkg2);

    expect((await adapter.getPackages()).length).toBe(2);

    await adapter.deletePackage('pkg-101');
    expect(adapter.isDeleted('pkg-101')).toBe(true);

    const afterDelete = await adapter.getPackages();
    expect(afterDelete.length).toBe(1);
    expect(afterDelete[0].id).toBe('pkg-102');
  });

  it('caps tombstones at MAX_TOMBSTONES (200) with LRU eviction', () => {
    for (let i = 0; i < 250; i++) {
      adapter.recordTombstone(`tomb-${i}`);
    }
    expect(adapter.tombstones.size).toBe(200);
    // First 50 should have been evicted
    expect(adapter.isDeleted('tomb-0')).toBe(false);
    expect(adapter.isDeleted('tomb-49')).toBe(false);
    // Items 50-249 should still be retained
    expect(adapter.isDeleted('tomb-50')).toBe(true);
    expect(adapter.isDeleted('tomb-249')).toBe(true);
  });

  describe('upsertPackageRemote / deletePackageRemote (SYNC-08 replay path)', () => {
    it('throws rather than silently no-op-ing when userId is missing, so a caller (e.g. the sync queue replay loop) sees a real failure instead of a false success', async () => {
      await expect(adapter.upsertPackageRemote({ id: 'pkg-1', title: 'X', trackingNumber: 'T1' }, undefined))
        .rejects.toThrow(/userId/i);
      await expect(adapter.deletePackageRemote('pkg-1', undefined))
        .rejects.toThrow(/userId/i);
      await expect(adapter.upsertPackageRemote({ id: 'pkg-1', title: 'X', trackingNumber: 'T1' }, ''))
        .rejects.toThrow(/userId/i);
    });
  });
});
