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
const VALID_MUTATION_TYPES = new Set(Object.values(MUTATION_TYPES));

function targetIdForIntent(type, payload) {
  return type === MUTATION_TYPES.STATUS_CHANGE ? payload?.packageId : payload?.id;
}

function validateIntent(intent) {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
    throw new Error('Invalid mutation intent');
  }
  if (!VALID_MUTATION_TYPES.has(intent.type)) {
    throw new Error(`Invalid mutation type: ${String(intent.type)}`);
  }
  if (!intent.payload || typeof intent.payload !== 'object' || Array.isArray(intent.payload)) {
    throw new Error('Mutation payload must be an object');
  }
  if (typeof intent.userId !== 'string' || intent.userId.trim() === '') {
    throw new Error('Mutation userId must be a non-empty string');
  }
  const targetId = targetIdForIntent(intent.type, intent.payload);
  if (typeof targetId !== 'string' || targetId.trim() === '') {
    throw new Error('Mutation target id must be a non-empty string');
  }
}

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

    // Coming back to the app is the other moment a stalled queue can move: a
    // phone that was backgrounded for hours never fires `online`, because it
    // never went offline as far as the page is concerned.
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.resumeIfPending('foreground');
      });
    }
  }

  /**
   * Replays whatever is already waiting, if it can.
   *
   * Until this existed, replayQueue() was only reachable from an offline→online
   * transition or a fresh enqueue. A mutation that fails while *online* — a
   * Firestore hiccup, an expired token, a rules rejection — takes its retry
   * count up by one and then has nothing left to retry it: the browser fires no
   * `online` event, because the page never went offline, and OfflineBanner
   * renders null whenever online, so its manual sync button cannot be reached
   * either. The queue stops there, silently, with the user's changes on one
   * device and not the other.
   *
   * Call it on startup once auth has settled (a replay needs a signed-in user:
   * every cloud write is scoped by userId and the rules check it) and whenever
   * the app returns to the foreground. Both are cheap — it no-ops unless
   * something is actually waiting.
   *
   * @param {string} [reason] short label for the log line
   * @returns {boolean} whether a replay was started
   */
  resumeIfPending(reason = 'resume') {
    if (!this.isOnline || this.isReplaying) return false;
    const pending = this.getQueue().length;
    if (pending === 0) return false;
    console.info(`[SyncQueueService] Resuming ${pending} pending mutation(s) (${reason}).`);
    void this.replayQueue();
    return true;
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
    return this.enqueueBatch([{ type, payload, userId }])[0];
  }

  /**
   * Atomically persists several mutations before starting one replay. This is
   * required for bulk imports: starting replay after each item can snapshot a
   * partial queue and leave later items waiting for another online event.
   *
   * @param {Array<{type: string, payload: object, userId?: string|null}>} intents
   * @returns {Array<object>} queued mutation records
   */
  enqueueBatch(intents) {
    if (!Array.isArray(intents)) throw new Error('enqueueBatch requires an array');
    for (const intent of intents) {
      validateIntent(intent);
    }
    if (intents.length === 0) return [];

    const dedupeKey = (type, payload, userId) => `${String(userId ?? '').trim()}:${type}:${targetIdForIntent(type, payload)}`;
    const latestIntentIndex = new Map();
    intents.forEach((intent, index) => {
      if (intent.type !== MUTATION_TYPES.STATUS_CHANGE) {
        latestIntentIndex.set(dedupeKey(intent.type, intent.payload, intent.userId), index);
      }
    });
    const dedupeKeys = new Set(latestIntentIndex.keys());
    let queue = this.getQueue().filter((existing) => (
      existing.type === MUTATION_TYPES.STATUS_CHANGE ||
      !dedupeKeys.has(dedupeKey(existing.type, existing.payload, existing.userId))
    ));
    const mutations = [];
    for (const [index, { type, payload, userId = null }] of intents.entries()) {
      if (type !== MUTATION_TYPES.STATUS_CHANGE && latestIntentIndex.get(dedupeKey(type, payload, userId)) !== index) continue;
      const mutation = {
        id: generateIdempotencyKey(),
        type,
        payload,
        userId,
        timestamp: new Date().toISOString(),
        retryCount: 0
      };
      queue.push(mutation);
      mutations.push(mutation);
    }
    this.saveQueue(queue);
    if (this.isOnline && !this.isReplaying) this.replayQueue();
    return mutations;
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
  async replayQueue(replayIds = null) {
    if (this.isReplaying) return { processed: 0, failed: 0, remaining: this.getQueue().length };
    const queueAtStart = this.getQueue();
    const initialIds = new Set(queueAtStart.map((mutation) => mutation.id));
    const queue = queueAtStart.filter((mutation) => !replayIds || replayIds.has(mutation.id));
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
          failed++;
          if (mutation.retryCount < MAX_RETRY_COUNT) {
            retriedMutations.set(mutation.id, mutation);
            // A retryable predecessor remains authoritative for this target.
            // Do not let a later ADD/UPDATE/DELETE in the same chain overtake
            // it during this pass; unrelated chains still run concurrently.
            break;
          } else {
            this.moveToDeadLetter(mutation, err);
            settledIds.add(mutation.id);
          }
        }
      }
    }));

    const liveQueue = this.getQueue();
    const remainingQueue = liveQueue
      .filter((m) => !settledIds.has(m.id))
      .map((m) => retriedMutations.get(m.id) || m);

    this.saveQueue(remainingQueue);
    this.isReplaying = false;

    const retainedPredecessorChains = new Set(remainingQueue
      .filter((mutation) => initialIds.has(mutation.id))
      .map((mutation) => SyncQueueService.orderingKey(mutation)));
    const newIds = new Set(liveQueue
      .filter((mutation) => !initialIds.has(mutation.id))
      .filter((mutation) => !retainedPredecessorChains.has(SyncQueueService.orderingKey(mutation)))
      .map((mutation) => mutation.id));
    if (this.isOnline && newIds.size > 0) {
      // Defer to a microtask so this is a new pass, never recursive stack
      // growth. Restricting it to new ids preserves retry cadence for failed
      // mutations from the pass that just completed.
      void Promise.resolve().then(() => this.replayQueue(newIds));
    }

    return {
      processed,
      failed,
      remaining: remainingQueue.length
    };
  }
}

/**
 * Read-only health snapshot of the offline sync queue — how long the
 * oldest pending mutation has been waiting to replay (flaky connectivity
 * vs. a real bug, per the analytics roadmap in #117), and how many
 * mutations have permanently failed. Pure function over plain arrays
 * (`getQueue()`/`getDeadLetterQueue()`'s own shape) rather than a method
 * on SyncQueueService, so it never needs to touch the replay/mutation
 * logic itself — this only ever reads.
 *
 * @param {Array<{ timestamp?: string }>} queue
 * @param {Array<object>} deadLetterQueue
 * @param {number} [now]
 * @returns {{ pendingCount: number, oldestPendingAgeMs: number | null, deadLetterCount: number }}
 */
export function computeSyncQueueHealth(queue, deadLetterQueue, now = Date.now()) {
  const pending = Array.isArray(queue) ? queue : [];
  const deadLetter = Array.isArray(deadLetterQueue) ? deadLetterQueue : [];

  let oldestPendingAgeMs = null;
  for (const mutation of pending) {
    const t = Date.parse(mutation?.timestamp || '');
    if (!Number.isFinite(t)) continue;
    const age = now - t;
    if (oldestPendingAgeMs === null || age > oldestPendingAgeMs) oldestPendingAgeMs = age;
  }

  return {
    pendingCount: pending.length,
    oldestPendingAgeMs,
    deadLetterCount: deadLetter.length
  };
}

export const syncQueueService = new SyncQueueService();
