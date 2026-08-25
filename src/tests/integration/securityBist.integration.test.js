import { describe, it, expect, beforeEach } from 'vitest';
import { ThrottleGuard } from '../../utils/throttleGuard';
import { runAllBistDiagnostics, runMemoryBoundsSelfTest } from '../../utils/bistDiagnostics';

describe('Integration Testbench: Security & BIST (Burst queries -> throttleGuard backoff -> BIST diagnostic probe)', () => {
  let guard;

  beforeEach(() => {
    guard = new ThrottleGuard({
      maxRequestsPerMinute: 5,
      windowMs: 1000,
      baseBackoffMs: 200,
      maxBackoffMs: 1000,
      backoffMultiplier: 2
    });
  });

  it('handles burst traffic by engaging backoff while BIST diagnostics verify system invariants', async () => {
    // 1. Send burst of 5 allowed requests
    for (let i = 0; i < 5; i++) {
      expect(guard.checkLimit().allowed).toBe(true);
      guard.recordRequest();
    }

    // 2. 6th burst request is throttled
    const burstExceeded = guard.checkLimit();
    expect(burstExceeded.allowed).toBe(false);
    expect(burstExceeded.reason).toBe('MAX_RPM_REACHED');

    // 3. Trigger 429 backoff lock
    guard.recordRateLimitError();
    const backoffCheck = guard.checkLimit();
    expect(backoffCheck.allowed).toBe(false);
    expect(backoffCheck.reason).toBe('ACTIVE_BACKOFF_LOCK');

    // 4. Run full BIST diagnostics to verify storage and regex precision remain intact
    const mockStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    };

    const bistReport = runAllBistDiagnostics({ storage: mockStorage });
    expect(bistReport.status).toBe('PASS');
    expect(bistReport.summary.passed).toBe(5);
    expect(bistReport.summary.failed).toBe(0);

    // 5. Verify package lists are reported in full rather than truncated
    const memTest = runMemoryBoundsSelfTest(1500);
    expect(memTest.status).toBe('PASS');
    expect(memTest.details.outputSize).toBe(1500);
    expect(memTest.details.truncated).toBe(false);
  });
});
