import { cloudAdapter } from './cloudStorageAdapter';
import { deliveryService } from './deliveryService';
import { STORAGE_KEYS } from '../constants/storageKeys';

export const QUEUE_STORAGE_KEY = STORAGE_KEYS.OFFLINE_SYNC_QUEUE;
export const DEAD_LETTER_STORAGE_KEY = 'deliveree_offline_sync_dead_letter';
export const MAX_RETRY_COUNT = 5;
/**
 * Ordering-chain key shared by every mutation whose target package cannot be
 * determined. See `SyncQueueService.orderingKey`.
 */
export const UNKEYED_ORDERING_KEY = '__unkeyed__';
export const MUTATION_TYPES = Object.freeze({
  ADD: 'ADD',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE'
});

/**
 * Creates a unique cryptographically random idempotency token.
 * @returns {string}
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Offline Sync Queue Service
 * Manages queued offline mutations with idempotency tokens and replays them when network is restored.
 */
export class SyncQueueService {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.isReplaying = false;
    this.listeners = new Set();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  handleNetworkChange(onlineStatus) {
    this.isOnline = Boolean(onlineStatus);
    this.notifyListeners({ isOnline: this.isOnline, queueSize: this.getQueue().length });
    if (this.isOnline) {
      this.replayQueue();
    }
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(state) {
    for (const cb of this.listeners) {
      try {
        cb(state);
      } catch (err) {
        console.error('[SyncQueueService] Listener error:', err);
      }
    }
  }

  /**
   * Retrieves all pending mutations from storage.
   * @returns {Array<object>}
   */
  getQueue() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return [];
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('[SyncQueueService] Failed to read sync queue:', err);
    }
    return [];
  }

  /**
   * Saves mutations list to storage.
   * @param {Array<object>} queue
   */
  saveQueue(queue) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return;
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      this.notifyListeners({ isOnline: this.isOnline, queueSize: queue.length });
    } catch (err) {
      console.warn('[SyncQueueService] Failed to persist sync queue:', err);
    }
  }

  /**
   * Enqueues an offline mutation.
   * @param {'ADD'|'UPDATE'|'DELETE'|'STATUS_CHANGE'} type
   * @param {object} payload
   * @param {string|null} [userId=null]
   * @returns {object} The queued mutation record
   */
  enqueue(type, payload, userId = null) {
    if (!MUTATION_TYPES[type]) {
      throw new Error(`Invalid mutation type: ${type}`);
    }

    const mutation = {
      id: generateIdempotencyKey(),
      type,
      payload,
      userId,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    const currentQueue = this.getQueue();
    // Avoid exact duplicate payloads if already enqueued
    const deduplicated = currentQueue.filter(
      (m) => !(m.type === type && m.payload?.id === payload?.id && m.type !== MUTATION_TYPES.STATUS_CHANGE)
    );

    deduplicated.push(mutation);
    this.saveQueue(deduplicated);

    // If online, immediately attempt replay
    if (this.isOnline && !this.isReplaying) {
      this.replayQueue();
    }

    return mutation;
  }

  /**
   * Clears the sync queue.
   */
  clearQueue() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.removeItem(QUEUE_STORAGE_KEY);
      }
      this.notifyListeners({ isOnline: this.isOnline, queueSize: 0 });
    } catch {}
  }

  /**
   * Retrieves all mutations that exhausted their retry budget.
   * @returns {Array<object>}
   */
  getDeadLetterQueue() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return [];
      const stored = localStorage.getItem(DEAD_LETTER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('[SyncQueueService] Failed to read dead-letter queue:', err);
    }
    return [];
  }

  /**
   * Saves the dead-letter queue to storage.
   * @param {Array<object>} deadLetterQueue
   */
  saveDeadLetterQueue(deadLetterQueue) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return;
      localStorage.setItem(DEAD_LETTER_STORAGE_KEY, JSON.stringify(deadLetterQueue));
      this.notifyListeners({
        isOnline: this.isOnline,
        queueSize: this.getQueue().length,
        deadLetterSize: deadLetterQueue.length
      });
    } catch (err) {
      console.warn('[SyncQueueService] Failed to persist dead-letter queue:', err);
    }
  }

  /**
   * Moves a mutation that exhausted its retry budget into the dead-letter queue.
   * @param {object} mutation
   * @param {unknown} err
   */
  moveToDeadLetter(mutation, err) {
    const deadLetterQueue = this.getDeadLetterQueue();
    deadLetterQueue.push({
      ...mutation,
      failedAt: new Date().toISOString(),
      lastError: err instanceof Error ? err.message : String(err)
    });
    this.saveDeadLetterQueue(deadLetterQueue);
  }

  /**
   * Clears the dead-letter queue.
   */
  clearDeadLetterQueue() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.removeItem(DEAD_LETTER_STORAGE_KEY);
      }
      this.notifyListeners({ isOnline: this.isOnline, queueSize: this.getQueue().length, deadLetterSize: 0 });
    } catch {}
  }

  /**
   * Re-queues a dead-lettered mutation for another replay attempt, resetting its retry count.
   * @param {string} mutationId
   * @returns {object|null} The re-queued mutation, or null if not found
   */
  retryDeadLetterMutation(mutationId) {
    const deadLetterQueue = this.getDeadLetterQueue();
    const index = deadLetterQueue.findIndex((m) => m.id === mutationId);
    if (index === -1) return null;

    const [mutation] = deadLetterQueue.splice(index, 1);
    this.saveDeadLetterQueue(deadLetterQueue);

    const { failedAt: _failedAt, lastError: _lastError, ...requeued } = mutation;
    requeued.retryCount = 0;

    const currentQueue = this.getQueue();
    currentQueue.push(requeued);
    this.saveQueue(currentQueue);

    if (this.isOnline && !this.isReplaying) {
      this.replayQueue();
    }

    return requeued;
  }

  /**
   * The package a mutation acts on. Mutations sharing a key must replay in queue
   * order relative to each other; mutations with different keys are independent.
   *
   * @param {object} mutation
   * @returns {string}
   */
  static orderingKey(mutation) {
    const { type, payload, userId } = mutation;
    let packageId;
    if (type === MUTATION_TYPES.DELETE) {
      packageId = payload?.id ?? payload;
    } else if (type === MUTATION_TYPES.STATUS_CHANGE) {
      packageId = payload?.packageId;
    } else {
      packageId = payload?.id;
    }

    if (packageId === undefined || packageId === null || packageId === '') {
      // `enqueue` is public, so a payload can arrive without a recognisable id.
      // Giving such a mutation its own key would let it run *concurrently* with
      // the real chain for the package it actually touches — silent reordering.
      // They all share one chain instead: the failure mode is slow, not wrong.
      console.warn(
        `[SyncQueueService] Mutation ${mutation.id} (${type}) has no recognisable package id; ` +
        'replaying it serially against every other unkeyed mutation.'
      );
      return UNKEYED_ORDERING_KEY;
    }

    // Scope by user too: the same package id under two users is two documents.
    return `${userId ?? ''}::${String(packageId)}`;
  }

  /**
   * Replays pending mutations against local & cloud adapters.
   *
   * Mutations touching the *same* package replay strictly in queue order — an
   * UPDATE must not overtake the ADD that created the row, and two
   * STATUS_CHANGEs must go through the transition matrix in the order the user
   * made them. Mutations touching *different* packages are independent writes to
   * distinct documents, so those chains run concurrently rather than paying one
   * network round trip each. This is the path a user hits the instant they come
   * back online with a backlog.
   *
   * A STATUS_CHANGE's local read-modify-write stays *synchronous and adjacent*,
   * completed before the network await, exactly as it was before. `savePackages`
   * overwrites the whole stored list, and this replay is not the only writer of
   * it — the cloud adapter's `onSnapshot` handler (which our own remote upserts
   * provoke) and every add/edit/delete in the app write it too. Holding a list
   * snapshot across replay's network I/O and flushing it at the end would
   * silently clobber any of those writes. Replay must never overwrite a write it
   * did not observe, so the window stays as narrow as the original's.
   *
   * @returns {Promise<{ processed: number, failed: number, remaining: number }>}
   */
  async replayQueue() {
    if (this.isReplaying) return { processed: 0, failed: 0, remaining: this.getQueue().length };
    const queue = this.getQueue();
    if (queue.length === 0) return { processed: 0, failed: 0, remaining: 0 };

    this.isReplaying = true;
    let processed = 0;
    let failed = 0;
    // Track outcomes by mutation id rather than building `remainingQueue` positionally — a
    // mutation can be enqueue()'d by another caller while this loop is mid-flight (awaiting a
    // network call), landing in storage after our `queue` snapshot was taken. Reconciling by id
    // against the *live* queue at save time (below) means that mutation survives instead of being
    // silently wiped out by an unconditional overwrite built only from the stale snapshot.
    const settledIds = new Set();
    const retriedMutations = new Map();

    const applyMutation = async (mutation) => {
      const { type, payload, userId } = mutation;

      if (type === MUTATION_TYPES.ADD || type === MUTATION_TYPES.UPDATE) {
        await cloudAdapter.upsertPackageRemote(payload, userId);
      } else if (type === MUTATION_TYPES.DELETE) {
        await cloudAdapter.deletePackageRemote(payload.id || payload, userId);
      } else if (type === MUTATION_TYPES.STATUS_CHANGE) {
        // Read, modify and write with no await in between, so no other writer
        // can land between the read and the save.
        const pkgs = deliveryService.getPackages(userId);
        const target = pkgs.find(p => p.id === payload.packageId);
        if (target && deliveryService.canTransition(target.status, payload.newStatus)) {
          const updated = {
            ...target,
            status: payload.newStatus,
            updatedAt: new Date().toISOString()
          };
          const updatedList = pkgs.map((p) => (p.id === updated.id ? updated : p));
          deliveryService.savePackages(updatedList, userId);
          await cloudAdapter.upsertPackageRemote(updated, userId);
        }
      }
    };

    // Group by target package, preserving queue order inside each group.
    /** @type {Map<string, Array<object>>} */
    const chains = new Map();
    for (const mutation of queue) {
      const key = SyncQueueService.orderingKey(mutation);
      const chain = chains.get(key);
      if (chain) chain.push(mutation);
      else chains.set(key, [mutation]);
    }

    await Promise.allSettled(Array.from(chains.values()).map(async (chain) => {
      for (const mutation of chain) {
        try {
          await applyMutation(mutation);
          processed++;
          settledIds.add(mutation.id);
        } catch (err) {
          console.warn(`[SyncQueueService] Failed to replay mutation ${mutation.id}:`, err);
          mutation.retryCount = (mutation.retryCount || 0) + 1;
          if (mutation.retryCount < MAX_RETRY_COUNT) {
            retriedMutations.set(mutation.id, mutation);
          } else {
            this.moveToDeadLetter(mutation, err);
            settledIds.add(mutation.id);
          }
          failed++;
        }
      }
    }));

    const remainingQueue = this.getQueue()
      .filter((m) => !settledIds.has(m.id))
      .map((m) => retriedMutations.get(m.id) || m);

    this.saveQueue(remainingQueue);
    this.isReplaying = false;

    return {
      processed,
      failed,
      remaining: remainingQueue.length
    };
  }
}

export const syncQueueService = new SyncQueueService();
