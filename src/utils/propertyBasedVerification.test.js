import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sanitizeString, validatePackage, validatePackageList } from './packageValidator';
import { parseSmartText, extractTrackingCandidates } from './smartParser';
import { CARRIER_LIST } from '../types/carriers';
import { GOLD_STANDARD_CARRIER_SAMPLES } from './bistDiagnostics';
import { deliveryService, TRANSITION_MATRIX, canTransition } from '../services/deliveryService';
import { trackingService } from '../services/trackingService';

const mockStore = {};
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.setItem) {
  globalThis.localStorage = {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : null),
    setItem: (key, value) => { mockStore[key] = String(value); },
    removeItem: (key) => { delete mockStore[key]; },
    clear: () => {
      for (const k of Object.keys(mockStore)) {
        delete mockStore[k];
      }
    }
  };
}

const VALID_STATUSES = ['ordered', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'customs'];
const VALID_CARRIERS = CARRIER_LIST.map(c => c.id);

describe('High-Assurance Property-Based Verification (fast-check)', () => {
  describe('Mathematical Properties of sanitizeString', () => {
    it('Idempotence: sanitizeString(sanitizeString(x)) === sanitizeString(x)', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const pass1 = sanitizeString(input, 200);
          const pass2 = sanitizeString(pass1, 200);
          expect(pass1).toBe(pass2);
        }),
        { numRuns: 500 }
      );
    });

    it('Bounded Length Invariant: len(sanitizeString(x, N)) <= N for all inputs', () => {
      fc.assert(
        fc.property(fc.string(), fc.integer({ min: 0, max: 500 }), (input, maxLen) => {
          const result = sanitizeString(input, maxLen);
          expect(result.length).toBeLessThanOrEqual(maxLen);
        }),
        { numRuns: 500 }
      );
    });

    it('XSS Script Immunity: output never contains unencoded script tags', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = sanitizeString(input, 500);
          expect(result.toLowerCase()).not.toContain('<script');
          expect(result.toLowerCase()).not.toContain('javascript:');
          expect(result.toLowerCase()).not.toContain('onload=');
        }),
        { numRuns: 500 }
      );
    });
  });



  describe('Contract & Invariant Properties of validatePackage', () => {
    it('Total Safety: Never throws runtime exceptions on arbitrary untyped input', () => {
      fc.assert(
        fc.property(fc.anything(), (arbitraryObject) => {
          expect(() => validatePackage(arbitraryObject)).not.toThrow();
        }),
        { numRuns: 500 }
      );
    });

    it('Schema Conformance Invariant: Validated package always contains valid status and carrier enums', () => {
      const packageArbitrary = fc.record({
        id: fc.option(fc.string(), { nil: undefined }),
        title: fc.option(fc.string(), { nil: undefined }),
        trackingNumber: fc.string(),
        carrier: fc.option(fc.string(), { nil: undefined }),
        status: fc.option(fc.string(), { nil: undefined }),
        notes: fc.option(fc.string(), { nil: undefined })
      });

      fc.assert(
        fc.property(packageArbitrary, (rawPkg) => {
          const validated = validatePackage(rawPkg);
          if (validated) {
            expect(VALID_STATUSES).toContain(validated.status);
            expect(VALID_CARRIERS).toContain(validated.carrier);
            expect(typeof validated.id).toBe('string');
            expect(typeof validated.title).toBe('string');
            expect(Array.isArray(validated.checkpoints)).toBe(true);
          }
        }),
        { numRuns: 500 }
      );
    });

    it('Checkpoint Timestamp Monotonicity Invariant: Validated checkpoints preserve chronological or defined order', () => {
      const checkpointArbitrary = fc.record({
        id: fc.string(),
        title: fc.string(),
        timestamp: fc.integer({ min: 946684800000, max: 1893456000000 }).map(epoch => new Date(epoch).toISOString()),
        isCompleted: fc.boolean()
      });

      const packageWithCheckpointsArbitrary = fc.record({
        title: fc.string(),
        trackingNumber: fc.string({ minLength: 5 }),
        checkpoints: fc.array(checkpointArbitrary, { minLength: 2, maxLength: 20 })
      });

      fc.assert(
        fc.property(packageWithCheckpointsArbitrary, (rawPkg) => {
          // Sort checkpoints strictly ascending by epoch timestamp
          const sortedCheckpoints = [...rawPkg.checkpoints].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          const pkg = {
            ...rawPkg,
            checkpoints: sortedCheckpoints
          };

          const validated = validatePackage(pkg);
          expect(validated).not.toBeNull();
          expect(validated.checkpoints.length).toBe(sortedCheckpoints.length);

          // Verify monotonicity is preserved across validation
          for (let i = 0; i < validated.checkpoints.length - 1; i++) {
            const currTime = new Date(validated.checkpoints[i].timestamp).getTime();
            const nextTime = new Date(validated.checkpoints[i + 1].timestamp).getTime();
            expect(currTime).toBeLessThanOrEqual(nextTime);
          }
        }),
        { numRuns: 300 }
      );
    });
  });

  describe('Completeness Property for Smart Parsing', () => {
    // Known valid tracking number formats across carriers
    const validTrackingGenerators = [
      // Only the self-identifying samples belong in the unlabeled property;
      // the all-digit ones are covered by the labeled property below.
      fc.constantFrom(...Object.values(GOLD_STANDARD_CARRIER_SAMPLES).filter((v) => /[A-Z]/i.test(v))),
      fc.stringMatching(/^[A-Z]{2}\d{9}IL$/),
      fc.stringMatching(/^1Z[0-9A-Z]{16}$/),
      fc.stringMatching(/^LP\d{14}$/),
      fc.stringMatching(/^YT\d{16}$/)
    ];

    /**
     * Bare digit runs are handled separately from the generators above.
     *
     * A ten-digit number is not self-identifying: an invoice number, a customer
     * number, a parking fine and a DHL waybill are all ten digits, and a user's
     * inbox holds far more of the former. The parser therefore requires a
     * tracking label beside a bare digit run before treating it as a shipment,
     * so completeness for these holds *given a label* — asserting it without
     * one would be asserting the false-positive behaviour itself.
     */
    const bareDigitTracking = fc.oneof(
      fc.stringMatching(/^[1-9]\d{9}$/),
      fc.constantFrom(...Object.values(GOLD_STANDARD_CARRIER_SAMPLES).filter((v) => /^\d+$/.test(v)))
    );

    it('Completeness: tracking number t is reliably extracted from noise + t + noise', () => {
      // Noise containing Hebrew and English phrases, spaces, and punctuation
      const noiseArbitrary = fc.stringMatching(/^[a-zA-Z0-9 א-ת,.:;!?-]{0,50}$/);
      const trackingArbitrary = fc.oneof(...validTrackingGenerators);

      fc.assert(
        fc.property(noiseArbitrary, trackingArbitrary, noiseArbitrary, (noisePrefix, trackingNum, noiseSuffix) => {
          // Surround tracking number with whitespace/delimiters to simulate realistic messages
          const embeddedText = `${noisePrefix} ${trackingNum} ${noiseSuffix}`;
          const parsed = parseSmartText(embeddedText);

          // The extracted tracking candidate set must contain the tracking number,
          // and parseSmartText should resolve the tracking number
          const candidates = extractTrackingCandidates(embeddedText);
          expect(candidates).toContain(trackingNum);
          expect(parsed.trackingNumber).toBe(trackingNum);
        }),
        { numRuns: 300 }
      );
    });

    it('Completeness: a labeled bare digit run is reliably extracted', () => {
      const noiseArbitrary = fc.stringMatching(/^[a-zA-Z0-9 א-ת,.:;!?-]{0,50}$/);

      fc.assert(
        fc.property(noiseArbitrary, bareDigitTracking, (noisePrefix, trackingNum) => {
          const embeddedText = `${noisePrefix} tracking number: ${trackingNum}`;
          expect(parseSmartText(embeddedText).trackingNumber).toBe(trackingNum);
        }),
        { numRuns: 200 }
      );
    });

    it('Soundness: an unlabeled bare digit run is never auto-filled', () => {
      // The counterpart property. Without a label the parser may still surface
      // the number as a low-confidence suggestion, but it must never reach
      // `verified` — the tier Smart Import fills in without asking the user.
      const noiseArbitrary = fc.stringMatching(/^[a-zA-Z0-9 א-ת,.:;!?-]{0,50}$/);

      fc.assert(
        fc.property(noiseArbitrary, bareDigitTracking, noiseArbitrary, (prefix, digits, suffix) => {
          const parsed = parseSmartText(`${prefix} ${digits} ${suffix}`);
          if (parsed.trackingNumber === digits) {
            expect(parsed.candidateStatus).not.toBe('verified');
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('List Size & Memory Conservation Invariant', () => {
    it('Non-Truncation: validatePackageList returns every valid entry, however long the list', () => {
      fc.assert(
        fc.property(fc.array(fc.record({ trackingNumber: fc.string() }), { maxLength: 1500 }), (rawList) => {
          const validated = validatePackageList(rawList);
          expect(validated.length).toBe(rawList.length);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Formal State Transition Invariants (deliveryService & TRANSITION_MATRIX)', () => {
    const ALL_STATUSES = ['ordered', 'shipped', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'exception', 'archived'];

    it('Safety: For any initial status and any sequence of status updates, updatePackageStatus NEVER allows transitions outside TRANSITION_MATRIX', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_STATUSES),
          fc.array(fc.constantFrom(...ALL_STATUSES, 'invalid_status_xyz', 'unknown', ''), { minLength: 1, maxLength: 20 }),
          (initialStatus, statusSequence) => {
            let currentPackages = [{
              id: 'pkg-inv-test-1',
              title: 'Invariant Test Package',
              trackingNumber: 'RR123456789IL',
              carrier: 'israel-post',
              status: initialStatus,
              checkpoints: []
            }];

            let currentStatus = initialStatus;

            for (const targetStatus of statusSequence) {
              const res = deliveryService.updatePackageStatus(currentPackages, 'pkg-inv-test-1', targetStatus);
              const allowed = TRANSITION_MATRIX[currentStatus] || [];
              const isValidTransition = allowed.includes(targetStatus);

              if (isValidTransition) {
                expect(res.success).toBe(true);
                expect(res.package.status).toBe(targetStatus);
                currentStatus = targetStatus;
                currentPackages = res.packages;
              } else {
                expect(res.success).toBe(false);
                expect(res.error).toBeDefined();
                expect(currentPackages[0].status).toBe(currentStatus);
              }
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('Reflexivity: canTransition(s, s) is true for all valid statuses', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_STATUSES), (status) => {
          expect(canTransition(status, status)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Checkpoint Monotonicity & Deduplication Invariants Under Concurrent/Repeated Refresh', () => {
    it('Monotonicity & ID Uniqueness: Checkpoint timestamps and IDs remain unique and schema-compliant after multiple mock refreshes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            trackingNumber: fc.constantFrom('RS948219481IL', '1Z9999999999999999', 'LP00582910482CN', 'CHITA982141', 'HFD772183'),
            carrier: fc.constantFrom('israel-post', 'ups', 'cainiao', 'chita', 'hfd')
          }),
          fc.integer({ min: 1, max: 5 }),
          async (pkgMeta, refreshRounds) => {
            const initialCheckpoints = [
              {
                id: 'cp-initial-1',
                title: 'Order Placed',
                timestamp: new Date(Date.now() - 86400000 * 10).toISOString(),
                isCompleted: true
              }
            ];

            let pkg = {
              id: 'pkg-concurrency-test',
              title: 'Concurrency Test Package',
              trackingNumber: pkgMeta.trackingNumber,
              carrier: pkgMeta.carrier,
              status: 'ordered',
              checkpoints: initialCheckpoints
            };

            for (let round = 0; round < refreshRounds; round++) {
              const res = await trackingService.fetchTrackingUpdates(pkg.trackingNumber, pkg.carrier, true);
              expect(res.success).toBe(true);

              const existingIds = new Set((pkg.checkpoints || []).map(cp => cp.id));
              const newCheckpoints = (res.checkpoints || []).filter(cp => !existingIds.has(cp.id));
              const mergedCheckpoints = [...newCheckpoints, ...(pkg.checkpoints || [])];

              let nextStatus = pkg.status;
              if (res.status && canTransition(pkg.status, res.status)) {
                nextStatus = res.status;
              }

              pkg = {
                ...pkg,
                status: nextStatus,
                checkpoints: mergedCheckpoints
              };

              // Verify Checkpoint ID uniqueness invariant
              const checkpointIds = pkg.checkpoints.map(cp => cp.id);
              const uniqueIds = new Set(checkpointIds);
              expect(uniqueIds.size).toBe(checkpointIds.length);

              // Verify each checkpoint complies with schema
              pkg.checkpoints.forEach(cp => {
                expect(typeof cp.id).toBe('string');
                expect(cp.id.length).toBeGreaterThan(0);
                expect(typeof cp.title).toBe('string');
                expect(typeof cp.timestamp).toBe('string');
                expect(isNaN(new Date(cp.timestamp).getTime())).toBe(false);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Batch Refresh Idempotence & Bounded State Verification', () => {
    it('Idempotence: Batch refreshing package list multiple times produces bounded states without memory exhaustion or duplicate IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.stringMatching(/^[A-Za-z0-9 _-]{1,30}$/).filter(s => s.trim().length > 0),
              trackingNumber: fc.constantFrom('RS948219481IL', '1Z9999999999999999', 'LP00582910482CN', 'CHITA982141', 'HFD772183'),
              carrier: fc.constantFrom('israel-post', 'ups', 'cainiao', 'chita', 'hfd'),
              status: fc.constantFrom('ordered', 'in_transit', 'shipped')
            }),
            { minLength: 1, maxLength: 8 }
          ),
          async (packages) => {
            // Reset cooldowns to ensure deterministic behavior
            trackingService.resetTrackingCooldown();

            const pass1 = await trackingService.batchRefreshTracking(packages);
            expect(pass1.updatedPackages.length).toBe(packages.length);

            // Verify each package has unique checkpoint IDs
            pass1.updatedPackages.forEach(p => {
              const ids = (p.checkpoints || []).map(cp => cp.id);
              expect(new Set(ids).size).toBe(ids.length);
              expect(ids.length).toBeLessThanOrEqual(50);
            });

            // Second pass (with cooldown bypassed for each item or standard)
            trackingService.resetTrackingCooldown();
            const pass2 = await trackingService.batchRefreshTracking(pass1.updatedPackages);
            expect(pass2.updatedPackages.length).toBe(pass1.updatedPackages.length);

            // Verify checkpoint list length did not grow unboundedly with duplicate checkpoints
            pass2.updatedPackages.forEach((p2, idx) => {
              const p1 = pass1.updatedPackages[idx];
              expect((p2.checkpoints || []).length).toBe((p1.checkpoints || []).length);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
