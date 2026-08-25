import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { deliveryService, canTransition, TRANSITION_MATRIX } from './deliveryService';

describe('Delivery Service and Storage Persistence', () => {
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
  });

  it('returns an empty array when storage is empty', () => {
    const pkgs = deliveryService.getPackages();
    expect(pkgs).toBeInstanceOf(Array);
    expect(pkgs.length).toBe(0);
  });

  it('saves and retrieves packages from storage', () => {
    const testPackage = [{
      id: 'test-1',
      title: 'Test Gadget',
      trackingNumber: 'RS123456789IL',
      carrier: 'israel-post',
      status: 'in_transit',
      category: 'electronics',
      isPinned: false,
      isArchived: false,
      checkpoints: []
    }];

    deliveryService.savePackages(testPackage);
    const loaded = deliveryService.getPackages();
    expect(loaded.length).toBe(1);
    expect(loaded[0].id).toBe('test-1');
  });

  it('exports and imports JSON data cleanly', () => {
    const testData = [{
      id: 'import-1',
      title: 'Imported Item',
      trackingNumber: 'LP99999999999CN',
      carrier: 'cainiao',
      status: 'delivered',
      isPinned: true,
      isArchived: false,
      checkpoints: []
    }];

    const jsonString = JSON.stringify(testData);
    const result = deliveryService.importData(jsonString);

    expect(result.success).toBe(true);
    expect(result.packages.length).toBe(1);
    expect(result.packages[0].title).toBe('Imported Item');
  });

  it('handles corrupted JSON import gracefully without crashing', () => {
    const invalidJson = '{ "bad_json": true, missing_bracket';
    const result = deliveryService.importData(invalidJson);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('sanitizes XSS payloads from imported packages', () => {
    const maliciousData = [{
      id: 'pkg-xss-1',
      title: 'Malicious <script>alert("hacked")</script> Package',
      notes: '<img src=x onerror=stealCookies()> Some note',
      trackingNumber: 'EVIL99999',
      carrier: 'israel-post',
      status: 'in_transit'
    }];

    const result = deliveryService.importData(JSON.stringify(maliciousData));
    expect(result.success).toBe(true);
    expect(result.packages[0].title).toBe('Malicious  Package');
    expect(result.packages[0].notes).toBe('Some note');
  });

  it('validates and normalizes missing fields and unknown carrier/status on import', () => {
    const unnormalizedData = [{
      trackingNumber: '1Z9999999999999999',
      carrier: 'unknown-fake-carrier',
      status: 'fake-status'
    }];

    const result = deliveryService.importData(JSON.stringify(unnormalizedData));
    expect(result.success).toBe(true);
    expect(result.packages[0].title).toBe('Untitled Package');
    expect(result.packages[0].carrier).toBe('other');
    expect(result.packages[0].status).toBe('in_transit');
  });

  it('rejects non-array and empty invalid import payloads', () => {
    const nonArrayJson = JSON.stringify({ title: 'Single Object' });
    const result = deliveryService.importData(nonArrayJson);
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be an array');

    const nonStringResult = deliveryService.importData(null);
    expect(nonStringResult.success).toBe(false);
  });

  it('rejects import payloads exceeding the 2MB size limit', () => {
    const bigPad = 'x'.repeat(2 * 1024 * 1024 + 100);
    const oversizedJson = JSON.stringify([{ id: 'oversized', title: bigPad, trackingNumber: 'TRK1' }]);

    const result = deliveryService.importData(oversizedJson);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2MB');
  });

  it('limits imported packages to MAX_IMPORT_PACKAGES (1000 items)', () => {
    const manyPackages = Array.from({ length: 1200 }, (_, i) => ({
      id: `pkg-${i}`,
      title: `Package ${i}`,
      trackingNumber: `TRK${i}`,
      carrier: 'other',
      status: 'in_transit'
    }));

    const result = deliveryService.importData(JSON.stringify(manyPackages));
    expect(result.success).toBe(true);
    expect(result.packages.length).toBe(1000);
  });

  it('exports packages using URL.createObjectURL and cleans up with revokeObjectURL', () => {
    let createdUrl = null;
    let revokedUrl = null;

    globalThis.URL.createObjectURL = (blob) => {
      expect(blob).toBeInstanceOf(Blob);
      createdUrl = 'blob:http://localhost/test-uuid';
      return createdUrl;
    };
    globalThis.URL.revokeObjectURL = (url) => {
      revokedUrl = url;
    };

    const mockAnchor = {
      setAttribute: (k, v) => { mockAnchor[k] = v; },
      click: () => {},
      remove: () => {}
    };

    globalThis.document = {
      createElement: (tag) => tag === 'a' ? mockAnchor : {},
      body: {
        appendChild: () => {},
        removeChild: () => {}
      }
    };

    const packages = [{
      id: 'pkg-1',
      title: 'Export Test',
      trackingNumber: 'LP123456789CN',
      carrier: 'cainiao',
      status: 'in_transit'
    }];

    deliveryService.exportData(packages);

    expect(createdUrl).toBe('blob:http://localhost/test-uuid');
    expect(revokedUrl).toBe('blob:http://localhost/test-uuid');
    expect(mockAnchor.download).toMatch(/^deliveree_backup_/);
    expect(mockAnchor.href).toBe('blob:http://localhost/test-uuid');
  });

  describe('Multi-tenant isolation and user scoping', () => {
    it('isolates packages between user A, user B, and guest', () => {
      const userAPackages = [{
        id: 'pkg-userA-1',
        title: 'User A Package',
        trackingNumber: 'IL111111111IL',
        carrier: 'israel-post',
        status: 'in_transit'
      }];

      const userBPackages = [{
        id: 'pkg-userB-1',
        title: 'User B Package',
        trackingNumber: 'IL222222222IL',
        carrier: 'dhl',
        status: 'delivered'
      }];

      const guestPackages = [{
        id: 'pkg-guest-1',
        title: 'Guest Package',
        trackingNumber: 'IL333333333IL',
        carrier: 'fedex',
        status: 'out_for_delivery'
      }];

      deliveryService.savePackages(userAPackages, 'userA');
      deliveryService.savePackages(userBPackages, 'userB');
      deliveryService.savePackages(guestPackages, null);

      const loadedA = deliveryService.getPackages('userA');
      const loadedB = deliveryService.getPackages('userB');
      const loadedGuest = deliveryService.getPackages(null);

      expect(loadedA.length).toBe(1);
      expect(loadedA[0].id).toBe('pkg-userA-1');
      expect(loadedA.some(p => p.id === 'pkg-userB-1' || p.id === 'pkg-guest-1')).toBe(false);

      expect(loadedB.length).toBe(1);
      expect(loadedB[0].id).toBe('pkg-userB-1');
      expect(loadedB.some(p => p.id === 'pkg-userA-1' || p.id === 'pkg-guest-1')).toBe(false);

      expect(loadedGuest.length).toBe(1);
      expect(loadedGuest[0].id).toBe('pkg-guest-1');
      expect(loadedGuest.some(p => p.id === 'pkg-userA-1' || p.id === 'pkg-userB-1')).toBe(false);
    });

    it('clears specific user packages without affecting other users', () => {
      const userAPackages = [{ id: 'pkg-A', title: 'A', trackingNumber: 'TRA', carrier: 'other', status: 'in_transit' }];
      const userBPackages = [{ id: 'pkg-B', title: 'B', trackingNumber: 'TRB', carrier: 'other', status: 'in_transit' }];

      deliveryService.savePackages(userAPackages, 'userA');
      deliveryService.savePackages(userBPackages, 'userB');

      const clearResult = deliveryService.clearUserPackages('userA');
      expect(clearResult).toEqual([]);

      expect(deliveryService.getPackages('userA')).toEqual([]);
      expect(deliveryService.getPackages('userB').length).toBe(1);
      expect(deliveryService.getPackages('userB')[0].id).toBe('pkg-B');
    });

    it('resets demo for specific user without affecting others', () => {
      const userAPackages = [{ id: 'pkg-A', title: 'A', trackingNumber: 'TRA', carrier: 'other', status: 'in_transit' }];
      const userBPackages = [{ id: 'pkg-B', title: 'B', trackingNumber: 'TRB', carrier: 'other', status: 'in_transit' }];

      deliveryService.savePackages(userAPackages, 'userA');
      deliveryService.savePackages(userBPackages, 'userB');

      const resetResult = deliveryService.resetToDemo('userA');
      expect(resetResult).toEqual([]);

      expect(deliveryService.getPackages('userA')).toEqual([]);
      expect(deliveryService.getPackages('userB').length).toBe(1);
    });
  });

  describe('State Machine Transition Matrix & canTransition Guard', () => {
    it('exposes the defined transition matrix for all delivery stages', () => {
      expect(TRANSITION_MATRIX).toBeDefined();
      expect(Object.keys(TRANSITION_MATRIX)).toContain('ordered');
      expect(Object.keys(TRANSITION_MATRIX)).toContain('delivered');
    });

    it('allows valid progressive lifecycle transitions', () => {
      expect(canTransition('ordered', 'shipped')).toBe(true);
      expect(canTransition('shipped', 'in_transit')).toBe(true);
      expect(canTransition('in_transit', 'customs')).toBe(true);
      expect(canTransition('in_transit', 'out_for_delivery')).toBe(true);
      expect(canTransition('customs', 'out_for_delivery')).toBe(true);
      expect(canTransition('out_for_delivery', 'delivered')).toBe(true);
    });

    it('allows self-transitions (idempotence)', () => {
      expect(canTransition('ordered', 'ordered')).toBe(true);
      expect(canTransition('delivered', 'delivered')).toBe(true);
      expect(canTransition('archived', 'archived')).toBe(true);
    });

    it('allows transitioning to exception and archive from any active stage', () => {
      const stages = ['ordered', 'shipped', 'in_transit', 'customs', 'out_for_delivery'];
      for (const st of stages) {
        expect(canTransition(st, 'exception')).toBe(true);
        expect(canTransition(st, 'archived')).toBe(true);
      }
    });

    it('blocks illegal backwards transitions from terminal delivered state', () => {
      expect(canTransition('delivered', 'ordered')).toBe(false);
      expect(canTransition('delivered', 'shipped')).toBe(false);
      expect(canTransition('delivered', 'in_transit')).toBe(false);
      expect(canTransition('delivered', 'customs')).toBe(false);
      expect(canTransition('delivered', 'out_for_delivery')).toBe(false);
      expect(canTransition('delivered', 'exception')).toBe(false);
      expect(canTransition('delivered', 'archived')).toBe(true);
    });

    it('handles null, undefined, or unknown state inputs safely', () => {
      expect(canTransition(null, 'delivered')).toBe(false);
      expect(canTransition('ordered', null)).toBe(false);
      expect(canTransition(undefined, undefined)).toBe(false);
      expect(canTransition('unknown_stage', 'delivered')).toBe(false);
      expect(canTransition('ordered', 'unknown_stage')).toBe(false);
    });
  });

  describe('updatePackageStatus & refreshPackageTracking', () => {
    it('updates package status when valid transition occurs and adds optional checkpoint', () => {
      const initialPackages = [{
        id: 'pkg-update-1',
        title: 'Status Update Test',
        trackingNumber: 'RS123456789IL',
        carrier: 'israel-post',
        status: 'in_transit',
        checkpoints: []
      }];

      const newCheckpoint = {
        id: 'cp-new-1',
        title: 'Out for Delivery',
        timestamp: new Date().toISOString(),
        isCompleted: true
      };

      const result = deliveryService.updatePackageStatus(
        initialPackages,
        'pkg-update-1',
        'out_for_delivery',
        newCheckpoint
      );

      expect(result.success).toBe(true);
      expect(result.package.status).toBe('out_for_delivery');
      expect(result.package.checkpoints.length).toBe(1);
      expect(result.package.checkpoints[0].id).toBe('cp-new-1');
    });

    it('rejects invalid status transitions in updatePackageStatus', () => {
      const initialPackages = [{
        id: 'pkg-delivered-1',
        title: 'Delivered Item',
        trackingNumber: 'RS123456789IL',
        carrier: 'israel-post',
        status: 'delivered',
        checkpoints: []
      }];

      const result = deliveryService.updatePackageStatus(
        initialPackages,
        'pkg-delivered-1',
        'in_transit'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('returns error when package ID is not found in updatePackageStatus', () => {
      const result = deliveryService.updatePackageStatus([], 'non-existent', 'delivered');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Package not found');
    });

    it('refreshes tracking safely for a package via refreshPackageTracking', async () => {
      const testPkg = {
        id: 'pkg-refresh-1',
        title: 'Refresh Test',
        trackingNumber: 'CH98765432',
        carrier: 'chita',
        status: 'in_transit',
        checkpoints: []
      };

      deliveryService.savePackages([testPkg]);

      const res = await deliveryService.refreshPackageTracking(testPkg, null, true);
      expect(res.success).toBe(true);
      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('carrier-unsupported');
      // Chita has no live feed, so the package must come back exactly as saved.
      expect(res.updatedPackage.checkpoints).toEqual([]);
      expect(res.updatedPackage.status).toBe('in_transit');
    });

    it('returns error if package is invalid in refreshPackageTracking', async () => {
      const res = await deliveryService.refreshPackageTracking(null);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid package data');
    });
  });

  describe('P0.1 — unknown fields survive persistence round trips', () => {
    it('preserves a field that is not part of the known schema', () => {
      const pkg = {
        id: 'round-trip-1',
        title: 'Future Field Package',
        trackingNumber: 'RR123456789IL',
        carrier: 'israel-post',
        status: 'in_transit',
        futureFeatureFlag: 'keep-me',
        customMetadata: { source: 'partner-api', priority: 3 }
      };

      deliveryService.savePackages([pkg]);
      const [loaded] = deliveryService.getPackages();

      expect(loaded.futureFeatureFlag).toBe('keep-me');
      expect(loaded.customMetadata).toEqual({ source: 'partner-api', priority: 3 });
      // Known fields still normalized as before
      expect(loaded.title).toBe('Future Field Package');
      expect(loaded.status).toBe('in_transit');
      expect(loaded.schemaVersion).toBe(1);
    });

    it('still strips prototype-polluting keys on the round trip', () => {
      const malicious = JSON.parse('{"id":"poison-1","title":"Poison","trackingNumber":"TRK1","__proto__":{"polluted":true}}');

      deliveryService.savePackages([malicious]);
      const [loaded] = deliveryService.getPackages();

      expect(loaded.id).toBe('poison-1');
      expect({}.polluted).toBeUndefined();
      expect(Object.prototype.polluted).toBeUndefined();
    });
  });

  describe('P0.2 — package lists are never silently truncated', () => {
    it('keeps every item past the 1,000 advisory limit and flags overflow', () => {
      const big = Array.from({ length: 1200 }, (_, i) => ({
        id: `pkg-${i}`,
        title: `Package ${i}`,
        trackingNumber: `RR${String(i).padStart(9, '0')}IL`,
        carrier: 'israel-post',
        status: 'in_transit'
      }));

      const saved = deliveryService.savePackages(big);
      expect(saved.length).toBe(1200);
      expect(saved.ok).toBe(true);
      expect(saved.overflow).toBe(true);

      // The read-then-write path must not persist a truncated list.
      const loaded = deliveryService.getPackages();
      expect(loaded.length).toBe(1200);
      expect(loaded[1199].id).toBe('pkg-1199');

      deliveryService.savePackages(loaded);
      expect(deliveryService.getPackages().length).toBe(1200);
    });

    it('does not flag overflow for ordinary list sizes', () => {
      const saved = deliveryService.savePackages([
        { id: 'a', title: 'A', trackingNumber: 'TRKA' }
      ]);
      expect(saved.overflow).toBe(false);
    });
  });

  describe('P0.3 — failed saves are reported as failures', () => {
    it('returns ok:false when localStorage throws a quota error', () => {
      const originalSetItem = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = () => {
        throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
      };

      try {
        const saved = deliveryService.savePackages([
          { id: 'quota-1', title: 'Quota', trackingNumber: 'TRKQ' }
        ]);
        expect(saved.ok).toBe(false);
        expect(saved.error).toBeInstanceOf(Error);
        // Backward compatible: still the validated array
        expect(Array.isArray(saved)).toBe(true);
        expect(saved[0].id).toBe('quota-1');
      } finally {
        globalThis.localStorage.setItem = originalSetItem;
      }
    });

    it('reports ok:true on a successful save', () => {
      const saved = deliveryService.savePackages([
        { id: 'ok-1', title: 'Fine', trackingNumber: 'TRKOK' }
      ]);
      expect(saved.ok).toBe(true);
      expect(saved.error).toBeNull();
    });

    it('surfaces a persistence failure through updatePackageStatus', () => {
      const packages = [{
        id: 'st-1',
        title: 'Status',
        trackingNumber: 'TRKST',
        status: 'in_transit',
        checkpoints: []
      }];

      const originalSetItem = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      try {
        const res = deliveryService.updatePackageStatus(packages, 'st-1', 'delivered');
        expect(res.success).toBe(false);
        expect(res.error).toBe('Failed to persist package status update');
      } finally {
        globalThis.localStorage.setItem = originalSetItem;
      }
    });

    it('reports a failed import instead of claiming success', () => {
      const json = JSON.stringify([
        { id: 'imp-1', title: 'Imported', trackingNumber: 'TRKIMP' }
      ]);

      const originalSetItem = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      try {
        const res = deliveryService.importData(json);
        expect(res.success).toBe(false);
      } finally {
        globalThis.localStorage.setItem = originalSetItem;
      }
    });
  });
});
