import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { SyncQueueService, MUTATION_TYPES, MAX_RETRY_COUNT } from './syncQueueService';
import { cloudAdapter } from './cloudStorageAdapter';
import { deliveryService } from './deliveryService';

describe('SyncQueueService Unit Tests', () => {
  let syncQueue;
  let mockStore = {};

  beforeAll(() => {
    globalThis.localStorage = {
      getItem: (k) => mockStore[k] || null,
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
      clear: () => { mockStore = {}; }
    };
  });

  beforeEach(() => {
    mockStore = {};
    syncQueue = new SyncQueueService();
    syncQueue.clearQueue();
  });

  it('enqueues offline mutation with idempotency token', () => {
    const pkg = {
      id: 'pkg-offline-1',
      title: 'Offline Item',
      trackingNumber: 'RS948219481IL',
      carrier: 'israel-post',
      status: 'ordered'
    };

    syncQueue.isOnline = false;
    const mutation = syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-123');
    expect(mutation.id).toBeDefined();
    expect(mutation.type).toBe('ADD');
    expect(mutation.payload.id).toBe('pkg-offline-1');

    const queue = syncQueue.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(mutation.id);
  });

  it('replays pending mutations and empties queue upon successful execution', async () => {
    const upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockResolvedValue(undefined);

    const pkg = {
      id: 'pkg-replay-1',
      title: 'Replayed Item',
      trackingNumber: 'LP00582910482CN',
      carrier: 'cainiao',
      status: 'in_transit'
    };

    syncQueue.isOnline = false;
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-abc');
    expect(syncQueue.getQueue().length).toBe(1);

    // Simulate coming back online
    syncQueue.isOnline = true;
    const res = await syncQueue.replayQueue();
    expect(res.processed).toBe(1);
    expect(res.failed).toBe(0);
    expect(syncQueue.getQueue().length).toBe(0);
    expect(upsertSpy).toHaveBeenCalledWith(pkg, 'user-abc');

    upsertSpy.mockRestore();
  });

  it('preserves a mutation enqueued while another replay is still in flight, instead of wiping it (regression: concurrent-enqueue race)', async () => {
    // Control exactly when the first mutation's remote write resolves, so we can enqueue a
    // second mutation while replayQueue() is still awaiting the first one — reproducing the
    // race where replayQueue() used to snapshot the queue once and blindly overwrite storage
    // with only what it saw at that snapshot, discarding anything enqueued mid-flight.
    let resolveFirstWrite;
    const firstWritePromise = new Promise((resolve) => { resolveFirstWrite = resolve; });
    const upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote')
      .mockImplementationOnce(() => firstWritePromise)
      .mockImplementation(() => Promise.resolve(undefined));

    const pkgA = { id: 'pkg-race-a', title: 'A' };
    const pkgB = { id: 'pkg-race-b', title: 'B' };

    syncQueue.isOnline = true;
    // enqueue() auto-triggers replayQueue() here; it synchronously reaches the first `await`
    // (the mocked, still-pending firstWritePromise) and suspends without finishing.
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkgA, 'user-race');

    // While that replay is still in flight, enqueue a second, unrelated mutation.
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkgB, 'user-race');
    expect(syncQueue.getQueue().some((m) => m.payload.id === 'pkg-race-b')).toBe(true);

    // Let the first write resolve and the in-flight replayQueue() call finish.
    resolveFirstWrite();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Mutation B must still be present — either already replayed too, or still queued —
    // never silently dropped by A's replay pass overwriting storage with a stale snapshot.
    const stillPresent = syncQueue.getQueue().some((m) => m.payload.id === 'pkg-race-b');
    const wasReplayed = upsertSpy.mock.calls.some((call) => call[0]?.id === 'pkg-race-b');
    expect(stillPresent || wasReplayed).toBe(true);

    upsertSpy.mockRestore();
  });

  it('persists a STATUS_CHANGE mutation to local storage on replay, not just to the Firestore remote write', async () => {
    const upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockResolvedValue(undefined);

    const pkg = { id: 'pkg-status-1', title: 'Status Item', trackingNumber: 'ST1', status: 'ordered' };
    deliveryService.savePackages([pkg], 'user-status');

    syncQueue.isOnline = false;
    syncQueue.enqueue(MUTATION_TYPES.STATUS_CHANGE, { packageId: 'pkg-status-1', newStatus: 'shipped' }, 'user-status');
    syncQueue.isOnline = true;
    const res = await syncQueue.replayQueue();

    expect(res.processed).toBe(1);
    const localPackages = deliveryService.getPackages('user-status');
    const updated = localPackages.find((p) => p.id === 'pkg-status-1');
    expect(updated).toBeDefined();
    expect(updated.status).toBe('shipped');

    upsertSpy.mockRestore();
  });

  it('deduplicates identical unplayed mutations for same package', () => {
    const pkg = { id: 'pkg-dup', title: 'Dup' };
    syncQueue.isOnline = false;
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkg);
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkg);

    expect(syncQueue.getQueue().length).toBe(1);
  });

  describe('Dead-Letter Queue (SYNC-06)', () => {
    let upsertSpy;

    beforeEach(() => {
      upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockRejectedValue(new Error('Firestore quota exceeded'));
    });

    afterEach(() => {
      upsertSpy.mockRestore();
    });

    it('moves a mutation to the dead-letter queue once retryCount reaches MAX_RETRY_COUNT', async () => {
      const pkg = { id: 'pkg-dlq-1', title: 'Doomed Item' };
      syncQueue.isOnline = false;
      const mutation = syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-dlq');
      syncQueue.isOnline = true;

      for (let i = 0; i < MAX_RETRY_COUNT - 1; i++) {
        const res = await syncQueue.replayQueue();
        expect(res.failed).toBe(1);
      }
      expect(syncQueue.getQueue().length).toBe(1);
      expect(syncQueue.getDeadLetterQueue().length).toBe(0);

      const finalRes = await syncQueue.replayQueue();
      expect(finalRes.failed).toBe(1);
      expect(finalRes.remaining).toBe(0);
      expect(syncQueue.getQueue().length).toBe(0);

      const deadLetterQueue = syncQueue.getDeadLetterQueue();
      expect(deadLetterQueue.length).toBe(1);
      expect(deadLetterQueue[0].id).toBe(mutation.id);
      expect(deadLetterQueue[0].retryCount).toBe(MAX_RETRY_COUNT);
      expect(deadLetterQueue[0].lastError).toBe('Firestore quota exceeded');
      expect(deadLetterQueue[0].failedAt).toBeDefined();
    });

    it('re-queues a dead-lettered mutation with a reset retry count via retryDeadLetterMutation', async () => {
      const pkg = { id: 'pkg-dlq-2', title: 'Retriable Item' };
      syncQueue.isOnline = false;
      const mutation = syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-dlq');
      syncQueue.isOnline = true;

      for (let i = 0; i < MAX_RETRY_COUNT; i++) {
        await syncQueue.replayQueue();
      }
      expect(syncQueue.getDeadLetterQueue().length).toBe(1);

      upsertSpy.mockResolvedValue(undefined);
      // Suppress the auto-replay retryDeadLetterMutation fires on requeue, so the
      // subsequent explicit replayQueue() call below is the only one racing isReplaying.
      syncQueue.isOnline = false;
      const requeued = syncQueue.retryDeadLetterMutation(mutation.id);

      expect(requeued.retryCount).toBe(0);
      expect(requeued.lastError).toBeUndefined();
      expect(syncQueue.getDeadLetterQueue().length).toBe(0);

      syncQueue.isOnline = true;
      const res = await syncQueue.replayQueue();
      expect(res.processed).toBe(1);
      expect(syncQueue.getQueue().length).toBe(0);
    });

    it('retryDeadLetterMutation returns null for an unknown mutation id', () => {
      expect(syncQueue.retryDeadLetterMutation('does-not-exist')).toBeNull();
    });

    it('clearDeadLetterQueue empties the dead-letter store', async () => {
      const pkg = { id: 'pkg-dlq-3', title: 'Clearable Item' };
      syncQueue.isOnline = false;
      syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-dlq');
      syncQueue.isOnline = true;

      for (let i = 0; i < MAX_RETRY_COUNT; i++) {
        await syncQueue.replayQueue();
      }
      expect(syncQueue.getDeadLetterQueue().length).toBe(1);

      syncQueue.clearDeadLetterQueue();
      expect(syncQueue.getDeadLetterQueue().length).toBe(0);
    });
  });
  describe('replay concurrency and ordering', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('replays mutations for independent packages without serializing them', async () => {
      const releases = [];
      let maxInFlight = 0;
      let inFlight = 0;

      vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockImplementation(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          releases.push(() => {
            inFlight -= 1;
            resolve({ ok: true });
          });
        });
      });

      syncQueue.isOnline = false;
      for (let i = 0; i < 5; i += 1) {
        syncQueue.enqueue(MUTATION_TYPES.ADD, {
          id: `pkg-parallel-${i}`,
          title: `Parallel ${i}`,
          trackingNumber: `RS94821948${i}IL`,
          carrier: 'israel-post',
          status: 'ordered'
        }, 'user-parallel');
      }

      syncQueue.isOnline = true;
      const replay = syncQueue.replayQueue();

      // Let the five independent chains all reach their awaited cloud write.
      await Promise.resolve();
      expect(maxInFlight).toBe(5);

      releases.forEach((release) => release());
      const result = await replay;
      expect(result.processed).toBe(5);
      expect(result.remaining).toBe(0);
    });

    it('keeps mutations for the same package strictly in queue order', async () => {
      const started = [];
      let resolveCurrent = null;

      vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockImplementation((pkg) => {
        started.push(pkg.status);
        return new Promise((resolve) => {
          resolveCurrent = () => resolve({ ok: true });
        });
      });

      const pkg = {
        id: 'pkg-ordered-1',
        title: 'Ordered Item',
        trackingNumber: 'RS948219481IL',
        carrier: 'israel-post',
        status: 'ordered'
      };
      deliveryService.savePackages([pkg], 'user-ordered');

      syncQueue.isOnline = false;
      syncQueue.enqueue(MUTATION_TYPES.STATUS_CHANGE, { packageId: pkg.id, newStatus: 'shipped' }, 'user-ordered');
      syncQueue.enqueue(MUTATION_TYPES.STATUS_CHANGE, { packageId: pkg.id, newStatus: 'in_transit' }, 'user-ordered');

      syncQueue.isOnline = true;
      const replay = syncQueue.replayQueue();

      await Promise.resolve();
      // Only the first status change may be in flight; the second waits on it.
      expect(started).toEqual(['shipped']);
      resolveCurrent();
      await Promise.resolve();
      await Promise.resolve();
      resolveCurrent();

      await replay;
      expect(started).toEqual(['shipped', 'in_transit']);
      expect(deliveryService.getPackages('user-ordered')[0].status).toBe('in_transit');
    });

    it('reads and writes the local package list once for a batch of status changes', async () => {
      vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockResolvedValue({ ok: true });

      const packages = Array.from({ length: 4 }, (_, i) => ({
        id: `pkg-batch-${i}`,
        title: `Batch ${i}`,
        trackingNumber: `RS94821948${i}IL`,
        carrier: 'israel-post',
        status: 'ordered'
      }));
      deliveryService.savePackages(packages, 'user-batch');

      syncQueue.isOnline = false;
      for (const pkg of packages) {
        syncQueue.enqueue(MUTATION_TYPES.STATUS_CHANGE, { packageId: pkg.id, newStatus: 'shipped' }, 'user-batch');
      }

      const getSpy = vi.spyOn(deliveryService, 'getPackages');
      const saveSpy = vi.spyOn(deliveryService, 'savePackages');

      syncQueue.isOnline = true;
      await syncQueue.replayQueue();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      getSpy.mockRestore();
      expect(deliveryService.getPackages('user-batch').every(p => p.status === 'shipped')).toBe(true);
    });
  });
});
