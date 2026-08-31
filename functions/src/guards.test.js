import { describe, it, expect, beforeEach } from 'vitest';
import { assertAuthenticated, assertPayloadWithinLimits, checkAndIncrementUsage } from './guards.js';
import { LIMITS } from './config.js';

/**
 * A minimal in-memory Firestore double covering exactly what guards.js
 * uses: collection().doc(), and a transaction with get()/set(merge). Real
 * enough to prove the transactional read-before-write ordering and the
 * limit math are correct, without needing the Firestore emulator.
 */
function createFakeDb() {
  const store = new Map();
  return {
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return { key };
        }
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const data = store.get(ref.key);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data, opts) {
          const existing = opts?.merge ? store.get(ref.key) || {} : {};
          store.set(ref.key, { ...existing, ...data });
        }
      };
      return fn(tx);
    },
    _store: store
  };
}

describe('assertAuthenticated', () => {
  it('returns the uid when request.auth is present', () => {
    expect(assertAuthenticated({ auth: { uid: 'user-1' } })).toBe('user-1');
  });

  it('throws unauthenticated when request.auth is missing', () => {
    expect(() => assertAuthenticated({})).toThrowError(/sign in/i);
  });

  it('throws unauthenticated when auth has no uid', () => {
    expect(() => assertAuthenticated({ auth: {} })).toThrowError(/sign in/i);
  });
});

describe('assertPayloadWithinLimits', () => {
  it('accepts a valid text-fallback payload', () => {
    expect(() => assertPayloadWithinLimits({ mode: 'text-fallback', text: 'hello' })).not.toThrow();
  });

  it('rejects text-fallback with no text', () => {
    expect(() => assertPayloadWithinLimits({ mode: 'text-fallback' })).toThrowError(/text is required/i);
  });

  it('rejects text over the length cap', () => {
    const text = 'a'.repeat(LIMITS.MAX_TEXT_LENGTH + 1);
    expect(() => assertPayloadWithinLimits({ mode: 'text-fallback', text })).toThrowError(/exceeds/i);
  });

  it('accepts a valid image payload', () => {
    expect(() => assertPayloadWithinLimits({ mode: 'image', imageBase64: 'aGVsbG8=' })).not.toThrow();
  });

  it('rejects an oversized image', () => {
    const imageBase64 = 'a'.repeat(LIMITS.MAX_IMAGE_BASE64_BYTES + 1);
    expect(() => assertPayloadWithinLimits({ mode: 'image', imageBase64 })).toThrowError(/exceeds/i);
  });

  it('rejects an unknown mode', () => {
    expect(() => assertPayloadWithinLimits({ mode: 'bogus' })).toThrowError(/mode must be/i);
  });
});

describe('checkAndIncrementUsage', () => {
  let db;

  beforeEach(() => {
    db = createFakeDb();
  });

  it('allows the first call and records a count of 1 for both counters', async () => {
    const result = await checkAndIncrementUsage(db, 'user-1');
    expect(result).toEqual({ allowed: true });

    const today = new Date().toISOString().slice(0, 10);
    expect(db._store.get(`usage/user_user-1_${today}`).count).toBe(1);
    expect(db._store.get(`usage/global_${today}`).count).toBe(1);
  });

  it('denies once a single user hits their daily limit, without touching the global counter', async () => {
    for (let i = 0; i < LIMITS.PER_USER_DAILY_CALLS; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await checkAndIncrementUsage(db, 'user-1');
      expect(res.allowed).toBe(true);
    }

    const result = await checkAndIncrementUsage(db, 'user-1');
    expect(result).toEqual({ allowed: false, reason: 'user-limit' });

    const today = new Date().toISOString().slice(0, 10);
    expect(db._store.get(`usage/user_user-1_${today}`).count).toBe(LIMITS.PER_USER_DAILY_CALLS);
  });

  it('denies every user once the global daily limit is reached, even under the per-user limit', async () => {
    // Simulate many distinct users each making one call, until the global
    // cap trips — this is the backstop that holds regardless of any single
    // user's own limit.
    for (let i = 0; i < LIMITS.GLOBAL_DAILY_CALLS; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await checkAndIncrementUsage(db, `user-${i}`);
      expect(res.allowed).toBe(true);
    }

    const result = await checkAndIncrementUsage(db, 'one-more-user');
    expect(result).toEqual({ allowed: false, reason: 'global-limit' });
  });

  it('tracks separate users independently under the per-user limit', async () => {
    const a = await checkAndIncrementUsage(db, 'user-a');
    const b = await checkAndIncrementUsage(db, 'user-b');
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    expect(db._store.get(`usage/user_user-a_${today}`).count).toBe(1);
    expect(db._store.get(`usage/user_user-b_${today}`).count).toBe(1);
    expect(db._store.get(`usage/global_${today}`).count).toBe(2);
  });

  it('tracks a separate budget in a custom collection with its own limits', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const options = { collection: 'gmailAiUsage', userLimit: 1, globalLimit: 5 };

    const first = await checkAndIncrementUsage(db, 'user-1', options);
    expect(first).toEqual({ allowed: true });
    expect(db._store.get(`gmailAiUsage/user_user-1_${today}`).count).toBe(1);
    // The default "usage" collection is untouched by the custom-collection call.
    expect(db._store.has(`usage/user_user-1_${today}`)).toBe(false);

    const second = await checkAndIncrementUsage(db, 'user-1', options);
    expect(second).toEqual({ allowed: false, reason: 'user-limit' });

    // A call against the default collection/limits is independent.
    const defaultCall = await checkAndIncrementUsage(db, 'user-1');
    expect(defaultCall).toEqual({ allowed: true });
  });
});
