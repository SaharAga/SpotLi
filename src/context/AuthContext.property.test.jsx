import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import { migrateGuestDataToUser } from './AuthContext';
import { deliveryService } from '../services/deliveryService';
import { CARRIER_LIST } from '../types/carriers';

let mockStore = {};

beforeAll(() => {
  globalThis.localStorage = {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : null),
    setItem: (key, value) => {
      mockStore[key] = String(value);
    },
    removeItem: (key) => {
      delete mockStore[key];
    },
    clear: () => {
      mockStore = {};
    }
  };
});

beforeEach(() => {
  mockStore = {};
});

const VALID_STATUSES = ['ordered', 'shipped', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'exception', 'returned_to_sender', 'archived'];
const VALID_CARRIERS = CARRIER_LIST.map((c) => c.id);

// Fast-check generator for arbitrary valid package objects
const packageArbitrary = (customId = null) =>
  fc.record({
    id: customId ? fc.constant(customId) : fc.uuid(),
    title: fc.stringMatching(/^[A-Za-z0-9 א-ת_-]{1,40}$/).filter((s) => s.trim().length > 0),
    trackingNumber: fc.stringMatching(/^[A-Z0-9]{8,24}$/),
    carrier: fc.constantFrom(...VALID_CARRIERS),
    status: fc.constantFrom(...VALID_STATUSES),
    notes: fc.stringMatching(/^[A-Za-z0-9 א-ת ,.!-]{0,80}$/),
    createdAt: fc
      .integer({ min: 1577836800000, max: 1893456000000 })
      .map((epoch) => new Date(epoch).toISOString())
  });

describe('AuthContext - Property-Based High-Assurance Verification (fast-check)', () => {
  describe('Non-Destructive Migration Theorem', () => {
    it('Theorem 1: Zero Data Loss - transfers 100% of guest packages to target user with exact status & notes preservation (>= 1,000 iterations)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z0-9_-]{5,30}$/),
          fc.uniqueArray(
            fc.record({
              id: fc.uuid(),
              title: fc.stringMatching(/^[A-Za-z0-9 א-ת_-]{1,30}$/).filter((s) => s.trim().length > 0),
              trackingNumber: fc.stringMatching(/^[A-Z0-9]{8,20}$/),
              carrier: fc.constantFrom(...VALID_CARRIERS),
              status: fc.constantFrom(...VALID_STATUSES),
              notes: fc.stringMatching(/^[A-Za-z0-9 א-ת ,.!-]{0,80}$/),
              createdAt: fc
                .integer({ min: 1577836800000, max: 1893456000000 })
                .map((epoch) => new Date(epoch).toISOString())
            }),
            {
              selector: (pkg) => pkg.trackingNumber,
              minLength: 1,
              maxLength: 25
            }
          ).map((packages) =>
            packages.map((pkg, idx) => ({
              ...pkg,
              id: `pkg-guest-${idx}-${pkg.trackingNumber}`
            }))
          ),
          async (targetUserId, guestPackages) => {
            mockStore = {};
            // Set guest packages in localStorage
            localStorage.setItem('deliveree_packages_guest', JSON.stringify(guestPackages));
            localStorage.removeItem(`deliveree_packages_${targetUserId}`);

            const migrated = await migrateGuestDataToUser(targetUserId);

            // Invariant 1: Cardinality preservation (100% transfer)
            expect(migrated.length).toBe(guestPackages.length);

            // Invariant 2: Guest storage is wiped
            expect(localStorage.getItem('deliveree_packages_guest')).toBeNull();

            // Invariant 3: Target user partition contains the exact packages
            const userStored = JSON.parse(localStorage.getItem(`deliveree_packages_${targetUserId}`));
            expect(userStored.length).toBe(guestPackages.length);

            // Invariant 4: Exact status, tracking number, notes, and carrier preservation
            const guestMap = new Map(guestPackages.map((p) => [p.trackingNumber, p]));
            for (const pkg of migrated) {
              expect(pkg.userId).toBe(targetUserId);
              const original = guestMap.get(pkg.trackingNumber);
              expect(original).toBeDefined();
              expect(pkg.status).toBe(original.status);
              expect(pkg.carrier).toBe(original.carrier);
              expect(pkg.title).toBe(original.title.trim());
              expect(pkg.notes).toBe(original.notes.trim());
            }
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('Theorem 2: Idempotence & Deduplication - Merging arbitrary guest packages with existing user packages produces ZERO duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z0-9_-]{5,20}$/),
          fc.uniqueArray(
            fc.record({
              id: fc.uuid(),
              title: fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/).filter((s) => s.trim().length > 0),
              trackingNumber: fc.stringMatching(/^[A-Z0-9]{8,15}$/),
              carrier: fc.constantFrom(...VALID_CARRIERS),
              status: fc.constantFrom(...VALID_STATUSES),
              notes: fc.stringMatching(/^[A-Za-z0-9 ,.!-]{0,50}$/),
              createdAt: fc.constant(new Date().toISOString())
            }),
            { selector: (p) => p.trackingNumber, minLength: 0, maxLength: 10 }
          ).map((packages) =>
            packages.map((pkg, idx) => ({
              ...pkg,
              id: `pkg-user-${idx}-${pkg.trackingNumber}`
            }))
          ),
          fc.uniqueArray(
            fc.record({
              id: fc.uuid(),
              title: fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/).filter((s) => s.trim().length > 0),
              trackingNumber: fc.stringMatching(/^[A-Z0-9]{8,15}$/),
              carrier: fc.constantFrom(...VALID_CARRIERS),
              status: fc.constantFrom(...VALID_STATUSES),
              notes: fc.stringMatching(/^[A-Za-z0-9 ,.!-]{0,50}$/),
              createdAt: fc.constant(new Date().toISOString())
            }),
            { selector: (p) => p.trackingNumber, minLength: 1, maxLength: 10 }
          ).map((packages) =>
            packages.map((pkg, idx) => ({
              ...pkg,
              id: `pkg-guest-${idx}-${pkg.trackingNumber}`
            }))
          ),
          async (targetUserId, existingUserPackages, incomingGuestPackages) => {
            mockStore = {};
            // Prepare initial state
            if (existingUserPackages.length > 0) {
              deliveryService.savePackages(existingUserPackages, targetUserId);
            }
            deliveryService.savePackages(incomingGuestPackages, null);

            const merged = await migrateGuestDataToUser(targetUserId);

            // Invariant 1: Tracking Number Uniqueness (no duplicates)
            const trackingNumbers = merged.map((p) => p.trackingNumber).filter(Boolean);
            const uniqueTracking = new Set(trackingNumbers);
            expect(uniqueTracking.size).toBe(trackingNumbers.length);

            // Invariant 2: Package ID Uniqueness (no duplicate IDs)
            const ids = merged.map((p) => p.id).filter(Boolean);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // Invariant 3: All existing user packages remain intact
            for (const existingPkg of existingUserPackages) {
              const found = merged.find((p) => p.trackingNumber === existingPkg.trackingNumber || p.id === existingPkg.id);
              expect(found).toBeDefined();
            }

            // Invariant 4: Guest storage is cleaned up
            expect(localStorage.getItem('deliveree_packages_guest')).toBeNull();
          }
        ),
        { numRuns: 300 }
      );
    });

    it('Theorem 3: Migration Safety Under Invalid Input - Invalid targetUserId preserves guest data without corruption', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant(12345),
            fc.constant({})
          ),
          fc.array(packageArbitrary(), { minLength: 1, maxLength: 5 }),
          async (invalidUserId, guestPackages) => {
            mockStore = {};
            localStorage.setItem('deliveree_packages_guest', JSON.stringify(guestPackages));

            const result = await migrateGuestDataToUser(invalidUserId);
            expect(result).toEqual([]);

            // Guest data must remain completely intact
            const preserved = JSON.parse(localStorage.getItem('deliveree_packages_guest'));
            expect(preserved.length).toBe(guestPackages.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
