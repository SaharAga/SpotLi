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

  it('atomically queues and drains every online bulk intent in one replay', async () => {
    const upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockResolvedValue(undefined);
    const deleteSpy = vi.spyOn(cloudAdapter, 'deletePackageRemote').mockResolvedValue(undefined);
    const replaySpy = vi.spyOn(syncQueue, 'replayQueue');
    syncQueue.isOnline = true;

    syncQueue.enqueueBatch([
      { type: MUTATION_TYPES.ADD, payload: { id: 'bulk-add', title: 'Add' }, userId: 'bulk-user' },
      { type: MUTATION_TYPES.UPDATE, payload: { id: 'bulk-update', title: 'Update' }, userId: 'bulk-user' },
      { type: MUTATION_TYPES.DELETE, payload: { id: 'bulk-delete' }, userId: 'bulk-user' }
    ]);

    await vi.waitFor(() => expect(syncQueue.getQueue()).toEqual([]));
    expect(replaySpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledTimes(2);
    expect(deleteSpy).toHaveBeenCalledWith('bulk-delete', 'bulk-user');

    replaySpy.mockRestore();
    upsertSpy.mockRestore();
    deleteSpy.mockRestore();
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

    await vi.waitFor(() => expect(syncQueue.getQueue()).toEqual([]));
    expect(upsertSpy.mock.calls.some((call) => call[0]?.id === 'pkg-race-b')).toBe(true);

    upsertSpy.mockRestore();
  });

  it('does not overtake a failed mutation with a same-package arrival during replay', async () => {
    let rejectDelete;
    const pendingDelete = new Promise((_, reject) => { rejectDelete = reject; });
    const deleteSpy = vi.spyOn(cloudAdapter, 'deletePackageRemote').mockImplementation(() => pendingDelete);
    const upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockResolvedValue(undefined);
    syncQueue.isOnline = true;

    syncQueue.enqueue(MUTATION_TYPES.DELETE, { id: 'fifo-package' }, 'fifo-user');
    syncQueue.enqueue(MUTATION_TYPES.ADD, { id: 'fifo-package', title: 'Replacement' }, 'fifo-user');
    rejectDelete(new Error('temporary delete failure'));

    await vi.waitFor(() => expect(syncQueue.getQueue()).toHaveLength(2));
    await Promise.resolve();
    await Promise.resolve();
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(syncQueue.getQueue().map((mutation) => mutation.type)).toEqual([
      MUTATION_TYPES.DELETE,
      MUTATION_TYPES.ADD
    ]);

    deleteSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it('retains pre-existing same-package successors behind a retryable failed predecessor', async () => {
    const deleteSpy = vi.spyOn(cloudAdapter, 'deletePackageRemote').mockRejectedValue(new Error('temporary delete failure'));
    const upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockResolvedValue(undefined);
    syncQueue.isOnline = false;
    syncQueue.enqueue(MUTATION_TYPES.DELETE, { id: 'backlog-package' }, 'backlog-user');
    syncQueue.enqueue(MUTATION_TYPES.ADD, { id: 'backlog-package', title: 'Successor' }, 'backlog-user');

    syncQueue.isOnline = true;
    const result = await syncQueue.replayQueue();
    expect(result.failed).toBe(1);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(syncQueue.getQueue().map((mutation) => mutation.type)).toEqual([
      MUTATION_TYPES.DELETE,
      MUTATION_TYPES.ADD
    ]);

    deleteSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it('allows a same-package successor after its predecessor reaches the dead letter queue', async () => {
    const deleteSpy = vi.spyOn(cloudAdapter, 'deletePackageRemote').mockRejectedValue(new Error('permanent delete failure'));
    const upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockResolvedValue(undefined);
    syncQueue.saveQueue([
      {
        id: 'terminal-delete', type: MUTATION_TYPES.DELETE, payload: { id: 'terminal-package' },
        userId: 'terminal-user', retryCount: MAX_RETRY_COUNT - 1
      },
      {
        id: 'terminal-add', type: MUTATION_TYPES.ADD, payload: { id: 'terminal-package', title: 'Successor' },
        userId: 'terminal-user', retryCount: 0
      }
    ]);
    syncQueue.isOnline = true;

    const result = await syncQueue.replayQueue();
    expect(result.failed).toBe(1);
    expect(upsertSpy).toHaveBeenCalledWith({ id: 'terminal-package', title: 'Successor' }, 'terminal-user');
    expect(syncQueue.getQueue()).toEqual([]);
    expect(syncQueue.getDeadLetterQueue()).toEqual([expect.objectContaining({ id: 'terminal-delete' })]);

    deleteSpy.mockRestore();
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
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-dup');
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-dup');

    expect(syncQueue.getQueue().length).toBe(1);
  });

  it('retains identical package ids for different users and replays both', async () => {
    const upsertSpy = vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockResolvedValue(undefined);
    const pkg = { id: 'shared-id', title: 'Shared' };
    syncQueue.isOnline = false;
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-a');
    syncQueue.enqueue(MUTATION_TYPES.ADD, pkg, 'user-b');
    expect(syncQueue.getQueue()).toHaveLength(2);

    syncQueue.isOnline = true;
    await syncQueue.replayQueue();
    expect(upsertSpy).toHaveBeenCalledWith(pkg, 'user-a');
    expect(upsertSpy).toHaveBeenCalledWith(pkg, 'user-b');
    expect(syncQueue.getQueue()).toEqual([]);
    upsertSpy.mockRestore();
  });

  it('rejects inherited, malformed, and unscoped mutation intents before persisting', () => {
    const valid = { type: MUTATION_TYPES.ADD, payload: { id: 'valid' }, userId: 'user-valid' };
    expect(() => syncQueue.enqueueBatch([{ ...valid, type: 'constructor' }])).toThrow(/invalid mutation type/i);
    expect(() => syncQueue.enqueueBatch([{ ...valid, type: '__proto__' }])).toThrow(/invalid mutation type/i);
    expect(() => syncQueue.enqueueBatch([null])).toThrow(/invalid mutation intent/i);
    expect(() => syncQueue.enqueueBatch([{ ...valid, payload: 'bad' }])).toThrow(/payload/i);
    expect(() => syncQueue.enqueueBatch([{ ...valid, userId: '  ' }])).toThrow(/userId/i);
    expect(() => syncQueue.enqueueBatch([{ ...valid, payload: {} }])).toThrow(/target id/i);
    expect(() => syncQueue.enqueueBatch([{ type: MUTATION_TYPES.STATUS_CHANGE, payload: { packageId: '' }, userId: 'user-valid' }])).toThrow(/target id/i);
    expect(syncQueue.getQueue()).toEqual([]);
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
  describe('resumeIfPending (SYNC-07)', () => {
    it('replays a mutation that failed while online, which nothing else would retry', async () => {
      // The real bug: three mutations sat pending for five hours on a device
      // that never went offline. A failure while online bumps retryCount and
      // stops there — no `online` event fires (the page never left the
      // network), and OfflineBanner renders null while online, so its manual
      // sync button is unreachable. Nothing retried them.
      const failing = vi.spyOn(cloudAdapter, 'upsertPackageRemote')
        .mockRejectedValueOnce(new Error('Firestore unavailable'));
      syncQueue.isOnline = true;
      syncQueue.enqueue(MUTATION_TYPES.ADD, { id: 'pkg-stuck', title: 'Stuck' }, 'user-1');
      await vi.waitFor(() => {
        expect(failing).toHaveBeenCalled();
        expect(syncQueue.isReplaying).toBe(false);
      });
      expect(syncQueue.getQueue().length).toBe(1);

      failing.mockResolvedValue(undefined);
      expect(syncQueue.resumeIfPending('startup')).toBe(true);
      await vi.waitFor(() => expect(syncQueue.getQueue().length).toBe(0));

      failing.mockRestore();
    });

    it('does nothing when the queue is empty, offline, or already replaying', () => {
      syncQueue.isOnline = true;
      expect(syncQueue.resumeIfPending()).toBe(false);

      syncQueue.isOnline = false;
      syncQueue.enqueue(MUTATION_TYPES.ADD, { id: 'pkg-offline' }, 'user-1');
      expect(syncQueue.resumeIfPending()).toBe(false);

      syncQueue.isOnline = true;
      syncQueue.isReplaying = true;
      expect(syncQueue.resumeIfPending()).toBe(false);
      syncQueue.isReplaying = false;
    });

    it('leaves the retry budget intact, so a doomed mutation still dead-letters', async () => {
      const failing = vi.spyOn(cloudAdapter, 'upsertPackageRemote')
        .mockRejectedValue(new Error('Invalid payload'));
      syncQueue.isOnline = false;
      syncQueue.enqueue(MUTATION_TYPES.ADD, { id: 'pkg-doomed' }, 'user-1');
      syncQueue.isOnline = true;

      for (let i = 0; i < MAX_RETRY_COUNT; i++) {
        syncQueue.resumeIfPending('foreground');
        await vi.waitFor(() => expect(syncQueue.isReplaying).toBe(false));
      }

      expect(syncQueue.getQueue().length).toBe(0);
      expect(syncQueue.getDeadLetterQueue().length).toBe(1);
      failing.mockRestore();
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

    it('does not clobber a package written by someone else mid-replay', async () => {
      // The cloud adapter's onSnapshot handler and every add/edit in the app write
      // the same localStorage list that replay writes. Replay must never overwrite
      // a write it did not observe.
      let releaseUpsert = null;
      vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockImplementation(() => new Promise((resolve) => {
        releaseUpsert = () => resolve({ ok: true });
      }));

      const existing = {
        id: 'pkg-local-1',
        title: 'Local Item',
        trackingNumber: 'RS948219481IL',
        carrier: 'israel-post',
        status: 'ordered'
      };
      deliveryService.savePackages([existing], 'user-clobber');

      syncQueue.isOnline = false;
      syncQueue.enqueue(MUTATION_TYPES.STATUS_CHANGE, { packageId: existing.id, newStatus: 'shipped' }, 'user-clobber');

      syncQueue.isOnline = true;
      const replay = syncQueue.replayQueue();
      await Promise.resolve();

      // An external writer lands while replay is awaiting its network call.
      const external = {
        id: 'pkg-external-1',
        title: 'Arrived From Another Device',
        trackingNumber: 'RS948219482IL',
        carrier: 'dhl',
        status: 'in_transit'
      };
      deliveryService.savePackages(
        [...deliveryService.getPackages('user-clobber'), external],
        'user-clobber'
      );

      releaseUpsert();
      await replay;

      const stored = deliveryService.getPackages('user-clobber');
      expect(stored.map(p => p.id).sort()).toEqual(['pkg-external-1', 'pkg-local-1']);
      expect(stored.find(p => p.id === 'pkg-local-1').status).toBe('shipped');
    });

    it('serialises mutations whose target package cannot be identified', async () => {
      const started = [];
      let resolveCurrent = null;
      vi.spyOn(cloudAdapter, 'upsertPackageRemote').mockImplementation((pkg) => {
        started.push(pkg?.title);
        return new Promise((resolve) => { resolveCurrent = () => resolve({ ok: true }); });
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Written straight to storage: enqueue()'s dedup would collapse two ADDs
      // that both lack an id into one.
      syncQueue.saveQueue([
        { id: 'mut-a', type: MUTATION_TYPES.ADD, payload: { title: 'No Id A' }, userId: 'user-unkeyed', retryCount: 0 },
        { id: 'mut-b', type: MUTATION_TYPES.ADD, payload: { title: 'No Id B' }, userId: 'user-unkeyed', retryCount: 0 }
      ]);

      syncQueue.isOnline = true;
      const replay = syncQueue.replayQueue();
      await Promise.resolve();

      // Both share the unkeyed chain, so only the first may be in flight.
      expect(started).toEqual(['No Id A']);
      expect(console.warn).toHaveBeenCalled();

      resolveCurrent();
      await Promise.resolve();
      await Promise.resolve();
      resolveCurrent();
      await replay;
      expect(started).toEqual(['No Id A', 'No Id B']);
    });
  });
});
