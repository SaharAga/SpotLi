import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { deliveryService, canTransition, TRANSITION_MATRIX, findPackageByAnyTrackingNumber } from './deliveryService';
import { exportToJSON, exportRawToJSON } from '../utils/exportUtils';

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

  it('getRawPackages passes a legacy/externally-written blob through unrepaired', () => {
    // savePackages validates before writing, so this version cannot produce
    // such a blob. It is reachable from an older release or from storage
    // edited outside the app, and that is the case this accessor exists for.
    const unrepaired = [
      {
        id: 'unrepaired-1',
        title: '',
        trackingNumber: 'lower case/tracking#',
        carrier: 'not_a_known_carrier',
        status: 'not_a_known_status'
      }
    ];
    localStorage.setItem('deliveree_packages_guest', JSON.stringify(unrepaired));

    expect(deliveryService.getRawPackages()).toEqual(unrepaired);

    // The repairing read is deliberately left alone.
    const repaired = deliveryService.getPackages();
    expect(repaired[0].carrier).not.toBe('not_a_known_carrier');
  });

  it('getRawPackages returns [] for absent or malformed storage', () => {
    expect(deliveryService.getRawPackages()).toEqual([]);
    localStorage.setItem('deliveree_packages_guest', '{not json');
    expect(deliveryService.getRawPackages()).toEqual([]);
    localStorage.setItem('deliveree_packages_guest', '{"a":1}');
    expect(deliveryService.getRawPackages()).toEqual([]);
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

  it('imports the full list without a silent 1,000-item truncation (#52)', () => {
    const manyPackages = Array.from({ length: 1200 }, (_, i) => ({
      id: `pkg-${i}`,
      title: `Package ${i}`,
      trackingNumber: `TRK${i}`,
      carrier: 'other',
      status: 'in_transit'
    }));

    const result = deliveryService.importData(JSON.stringify(manyPackages));
    expect(result.success).toBe(true);
    expect(result.packages.length).toBe(1200);
    expect(result.packages[1199].id).toBe('pkg-1199');
  });

  it('round-trips the REAL export path: exportToJSON -> importData (#52)', () => {
    // Not a synthetic stringify/parse cycle: this is the exporter the app
    // ships and the importer App.jsx calls, back to back.
    const originals = Array.from({ length: 1200 }, (_, i) => ({
      id: `rt-${i}`,
      title: `Round Trip ${i}`,
      titleHe: `הלוך ושוב ${i}`,
      trackingNumber: `RT${i}`,
      carrier: 'other',
      status: 'in_transit'
    }));

    const json = exportToJSON(originals);
    const result = deliveryService.importData(json);

    expect(result.success).toBe(true);
    expect(result.packages.length).toBe(originals.length);
    expect(result.packages[1199].id).toBe('rt-1199');
    expect(result.packages[1199].titleHe).toBe('הלוך ושוב 1199');

    // And the restore is what actually landed in storage.
    expect(deliveryService.getPackages().length).toBe(originals.length);
  });

  it('round-trips the backup path: getRawPackages -> exportRawToJSON -> importData', () => {
    const stored = [
      {
        id: 'raw-rt-1',
        title: 'Widget',
        titleHe: 'ווידג׳ט',
        notes: 'plain',
        notesHe: 'הערות',
        trackingNumber: 'RR123456789IL',
        carrier: 'israel_post',
        status: 'in_transit',
        checkpoints: [{ id: 'cp-1', status: 'in_transit', location: 'Haifa', timestamp: '2026-08-01T00:00:00.000Z' }]
      }
    ];
    localStorage.setItem('deliveree_packages_guest', JSON.stringify(stored));

    const backup = exportRawToJSON(deliveryService.getRawPackages());
    const parsedBackup = JSON.parse(backup);
    expect(parsedBackup.packages).toEqual(stored);
    expect(parsedBackup.scope).toBe('all');
    expect(parsedBackup.schemaVersion).toBe(1);

    const result = deliveryService.importData(backup);
    expect(result.success).toBe(true);
    expect(result.packages[0].titleHe).toBe('ווידג׳ט');
    expect(result.packages[0].notesHe).toBe('הערות');
    expect(result.packages[0].checkpoints).toHaveLength(1);
  });

  it('restores into the user storage partition when userId is provided (#56)', () => {
    const userPackages = [
      {
        id: 'user-pkg-1',
        title: 'User Secret Item',
        trackingNumber: 'USR123456',
        carrier: 'dhl',
        status: 'in_transit'
      }
    ];
    const guestPackages = [
      {
        id: 'guest-pkg-1',
        title: 'Guest Existing Item',
        trackingNumber: 'GST123456',
        carrier: 'fedex',
        status: 'ordered'
      }
    ];

    // Seed guest partition
    localStorage.setItem('deliveree_packages_guest', JSON.stringify(guestPackages));

    const json = JSON.stringify(userPackages);
    const result = deliveryService.importData(json, 'user-42');

    expect(result.success).toBe(true);
    // User key contains the restored item
    expect(deliveryService.getPackages('user-42')).toHaveLength(1);
    expect(deliveryService.getPackages('user-42')[0].id).toBe('user-pkg-1');

    // Guest partition is completely untouched and was NOT overwritten
    expect(deliveryService.getPackages(null)).toHaveLength(1);
    expect(deliveryService.getPackages(null)[0].id).toBe('guest-pkg-1');
  });

  describe('export manifest validation and scope rejection (#57)', () => {
    it('successfully imports a full manifest backup (scope: all)', () => {
      const manifest = {
        schemaVersion: 1,
        exportedAt: '2026-08-26T20:00:00.000Z',
        appVersion: '0.16.0',
        scope: 'all',
        packageCount: 1,
        packages: [
          {
            id: 'manifest-pkg-1',
            title: 'Manifest Package',
            trackingNumber: 'MNF123',
            carrier: 'cainiao',
            status: 'shipped'
          }
        ]
      };

      const result = deliveryService.importData(JSON.stringify(manifest));
      expect(result.success).toBe(true);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].id).toBe('manifest-pkg-1');
    });

    it('rejects partial export manifests with scope delivered', () => {
      const partialManifest = {
        schemaVersion: 1,
        exportedAt: '2026-08-26T20:00:00.000Z',
        appVersion: '0.16.0',
        scope: 'delivered',
        packageCount: 1,
        packages: [
          {
            id: 'partial-pkg-1',
            title: 'Delivered Item Only',
            trackingNumber: 'DEL123',
            carrier: 'israel_post',
            status: 'delivered'
          }
        ]
      };

      const result = deliveryService.importData(JSON.stringify(partialManifest));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot restore partial export (scope: "delivered")');
    });

    it('rejects partial export manifests with scope active', () => {
      const partialManifest = {
        schemaVersion: 1,
        exportedAt: '2026-08-26T20:00:00.000Z',
        appVersion: '0.16.0',
        scope: 'active',
        packageCount: 1,
        packages: [
          {
            id: 'partial-pkg-2',
            title: 'Active Item Only',
            trackingNumber: 'ACT123',
            carrier: 'israel_post',
            status: 'in_transit'
          }
        ]
      };

      const result = deliveryService.importData(JSON.stringify(partialManifest));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot restore partial export (scope: "active")');
    });

    it('rejects manifest without packages array', () => {
      const invalidManifest = {
        schemaVersion: 1,
        scope: 'all',
        packages: 'not-an-array'
      };

      const result = deliveryService.importData(JSON.stringify(invalidManifest));
      expect(result.success).toBe(false);
      expect(result.error).toContain('packages must be an array');
    });
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
    expect(mockAnchor.download).toMatch(/^spotli_backup_/);
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

    it('allows transitioning to exception, returned_to_sender, and archive from any active stage', () => {
      const stages = ['ordered', 'shipped', 'in_transit', 'customs', 'out_for_delivery'];
      for (const st of stages) {
        expect(canTransition(st, 'exception')).toBe(true);
        expect(canTransition(st, 'returned_to_sender')).toBe(true);
        expect(canTransition(st, 'archived')).toBe(true);
      }
    });

    it('allows transitions from delivered state back to active states, returned_to_sender, and archive', () => {
      expect(canTransition('delivered', 'ordered')).toBe(true);
      expect(canTransition('delivered', 'shipped')).toBe(true);
      expect(canTransition('delivered', 'in_transit')).toBe(true);
      expect(canTransition('delivered', 'customs')).toBe(true);
      expect(canTransition('delivered', 'out_for_delivery')).toBe(true);
      expect(canTransition('delivered', 'exception')).toBe(true);
      expect(canTransition('delivered', 'returned_to_sender')).toBe(true);
      expect(canTransition('delivered', 'archived')).toBe(true);
    });

    it('allows all active stages (ordered, shipped, in_transit, customs, exception) to transition directly to delivered and archived', () => {
      const activeStages = ['ordered', 'shipped', 'in_transit', 'customs', 'exception'];
      for (const stage of activeStages) {
        expect(canTransition(stage, 'delivered')).toBe(true);
        expect(canTransition(stage, 'archived')).toBe(true);
      }
    });

    it('allows returned_to_sender transitions', () => {
      expect(canTransition('returned_to_sender', 'returned_to_sender')).toBe(true);
      expect(canTransition('returned_to_sender', 'archived')).toBe(true);
      expect(canTransition('returned_to_sender', 'in_transit')).toBe(true);
      expect(canTransition('returned_to_sender', 'delivered')).toBe(true);
    });

    it('normalizes tracking numbers and finds packages cleanly', () => {
      expect(deliveryService.normalizeTrackingNumber("  RS-123 456-789 IL  ")).toBe("RS123456789IL");
      expect(deliveryService.normalizeTrackingNumber(null)).toBe("");

      const pkgs = [
        { id: "pkg-1", trackingNumber: "RS 123 456 789 IL" },
        { id: "pkg-2", trackingNumber: "LP-001-998", localTrackingNumber: "RU0126608087Z", aliases: ["AE123456"] }
      ];

      expect(deliveryService.findPackageByTrackingNumber(pkgs, "rs123456789il")).toEqual(pkgs[0]);
      expect(deliveryService.findPackageByTrackingNumber(pkgs, "LP001998")).toEqual(pkgs[1]);
      expect(deliveryService.findPackageByTrackingNumber(pkgs, "RU0126608087Z")).toEqual(pkgs[1]);
      expect(deliveryService.findPackageByTrackingNumber(pkgs, "ae-123-456")).toEqual(pkgs[1]);
      expect(deliveryService.findPackageByTrackingNumber(pkgs, "rs-123-456-789-il", "pkg-1")).toBeNull();
      expect(deliveryService.findPackageByTrackingNumber(pkgs, "NONEXISTENT")).toBeNull();
    });

    it('merges domestic courier data and shelf number into existing global shipment via mergePackageData', () => {
      const existing = {
        id: 'pkg-global-1',
        title: 'AliExpress order',
        trackingNumber: 'LP00582910482CN',
        carrier: 'cainiao',
        status: 'in_transit',
        aliases: []
      };

      const incoming = {
        trackingNumber: 'RU0126608087Z',
        carrier: 'israel-post',
        status: 'out_for_delivery',
        shelfNumber: 'ג693',
        pickupLocation: 'סוכנות דואר גבעתיים'
      };

      const merged = deliveryService.mergePackageData(existing, incoming);
      expect(merged.id).toBe('pkg-global-1');
      expect(merged.trackingNumber).toBe('LP00582910482CN');
      expect(merged.carrier).toBe('cainiao');
      expect(merged.localCarrier).toBe('israel-post');
      expect(merged.localTrackingNumber).toBe('RU0126608087Z');
      expect(merged.shelfNumber).toBe('ג693');
      expect(merged.pickupLocation).toBe('סוכנות דואר גבעתיים');
      expect(merged.status).toBe('out_for_delivery');
      expect(merged.aliases).toContain('RU0126608087Z');
    });

    it('upgrades generic title to specific item title and preserves orderNumber in mergePackageData', () => {
      const existing = {
        id: 'pkg-1',
        title: 'AliExpress Order',
        trackingNumber: 'LP00582910482CN',
        carrier: 'cainiao',
        status: 'in_transit'
      };
      const incoming = {
        title: 'Mechanical Keyboard',
        orderNumber: '818274917401'
      };
      const merged = deliveryService.mergePackageData(existing, incoming);
      expect(merged.title).toBe('Mechanical Keyboard');
      expect(merged.orderNumber).toBe('818274917401');

      // Does not downgrade a specific title with a generic incoming title
      const incomingGeneric = {
        title: 'Package LP00582910482CN',
        status: 'out_for_delivery'
      };
      const merged2 = deliveryService.mergePackageData(merged, incomingGeneric);
      expect(merged2.title).toBe('Mechanical Keyboard');
      expect(merged2.orderNumber).toBe('818274917401');
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

    it('rejects invalid status transitions in updatePackageStatus for unknown states', () => {
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
        'invalid_nonexistent_status'
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
      expect(res.reason).not.toBe('carrier-unsupported');
      // Chita is queried like any other carrier now, but a lookup that comes
      // back with nothing must leave the package exactly as saved — inventing
      // progress here is what made refresh untrustworthy in the first place.
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
      expect(saved.packages.length).toBe(1200);
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
        // Plain result object: the validated list lives on `.packages`.
        expect(Array.isArray(saved)).toBe(false);
        expect(Array.isArray(saved.packages)).toBe(true);
        expect(saved.packages[0].id).toBe('quota-1');
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

describe('findPackageByAnyTrackingNumber', () => {
  const packages = [
    { id: 'a', trackingNumber: '19611199', aliases: [] },
    { id: 'b', trackingNumber: 'RS948219481IL', aliases: ['LOCAL-77'] }
  ];

  it('returns the first number that matches, in the order given', () => {
    // Order is the caller's ranking, so a better candidate must win even when a
    // weaker one later in the list also matches something.
    expect(findPackageByAnyTrackingNumber(packages, ['RS948219481IL', '19611199'])?.id).toBe('b');
    expect(findPackageByAnyTrackingNumber(packages, ['19611199', 'RS948219481IL'])?.id).toBe('a');
  });

  it('falls through an unknown number to a later one that matches', () => {
    expect(findPackageByAnyTrackingNumber(packages, ['GAIH50911204', '19611199'])?.id).toBe('a');
  });

  it('still searches each package aliases and local tracking number', () => {
    expect(findPackageByAnyTrackingNumber(packages, ['local 77'])?.id).toBe('b');
  });

  it('ignores empty, null and duplicate entries', () => {
    expect(findPackageByAnyTrackingNumber(packages, [null, '', undefined, '19611199'])?.id).toBe('a');
    expect(findPackageByAnyTrackingNumber(packages, ['NOPE', 'NOPE'])).toBeNull();
  });

  it('honours excludeId so editing a package is not a duplicate of itself', () => {
    expect(findPackageByAnyTrackingNumber(packages, ['19611199'], 'a')).toBeNull();
  });

  it('accepts a bare string as well as a list', () => {
    expect(findPackageByAnyTrackingNumber(packages, '19611199')?.id).toBe('a');
  });

  it('returns null for a non-list of packages', () => {
    expect(findPackageByAnyTrackingNumber(null, ['19611199'])).toBeNull();
  });
});
