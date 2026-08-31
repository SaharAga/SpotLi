import { describe, it, expect } from 'vitest';
import { computeSyncQueueHealth } from './syncQueueService';

describe('computeSyncQueueHealth', () => {
  const now = Date.parse('2026-08-31T12:00:00.000Z');

  it('returns zeroes/null for empty queues', () => {
    expect(computeSyncQueueHealth([], [], now)).toEqual({
      pendingCount: 0,
      oldestPendingAgeMs: null,
      deadLetterCount: 0
    });
  });

  it('reports pending count and the oldest pending age', () => {
    const queue = [
      { timestamp: new Date(now - 5 * 60000).toISOString() },
      { timestamp: new Date(now - 30 * 60000).toISOString() }
    ];
    const result = computeSyncQueueHealth(queue, [], now);
    expect(result.pendingCount).toBe(2);
    expect(result.oldestPendingAgeMs).toBe(30 * 60000);
  });

  it('reports dead-letter count independently of the pending queue', () => {
    const result = computeSyncQueueHealth([], [{ id: '1' }, { id: '2' }], now);
    expect(result.deadLetterCount).toBe(2);
    expect(result.pendingCount).toBe(0);
  });

  it('ignores entries with a missing or unparsable timestamp for age purposes', () => {
    const queue = [{ timestamp: 'not-a-date' }, {}];
    const result = computeSyncQueueHealth(queue, [], now);
    expect(result.pendingCount).toBe(2);
    expect(result.oldestPendingAgeMs).toBeNull();
  });

  it('handles non-array input defensively', () => {
    expect(computeSyncQueueHealth(null, undefined, now)).toEqual({
      pendingCount: 0,
      oldestPendingAgeMs: null,
      deadLetterCount: 0
    });
  });
});
