import { describe, it, expect } from 'vitest';
import { createGmailBackfillHandler } from './gmailBackfill.js';
import { GMAIL_BACKFILL_LIMITS } from './config.js';

/**
 * Same minimal in-memory Firestore double as guards.test.js — covers
 * exactly what checkAndIncrementUsage and getGmailConnection use:
 * collection().doc(), and a transaction with get()/set(merge).
 */
function createFakeDb({ connection } = {}) {
  const store = new Map();
  return {
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          if (name === 'gmailConnections') {
            return {
              async get() {
                return { exists: Boolean(connection), data: () => connection };
              }
            };
          }
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
    }
  };
}

describe('createGmailBackfillHandler', () => {
  it('rejects unauthenticated callers', async () => {
    const handler = createGmailBackfillHandler({ db: createFakeDb(), clientSecret: 'x' });
    await expect(handler({ auth: null })).rejects.toThrow(/sign in/i);
  });

  it('rejects when the user has no connected Gmail account, after passing the rate limit', async () => {
    const handler = createGmailBackfillHandler({ db: createFakeDb({ connection: null }), clientSecret: 'x' });
    await expect(handler({ auth: { uid: 'u1' } })).rejects.toThrow(/no connected gmail account/i);
  });

  it('rejects further calls once the per-user daily limit is reached', async () => {
    const db = createFakeDb({ connection: null });
    const handler = createGmailBackfillHandler({ db, clientSecret: 'x' });

    for (let i = 0; i < GMAIL_BACKFILL_LIMITS.PER_USER_DAILY_CALLS; i++) {
      await expect(handler({ auth: { uid: 'u1' } })).rejects.toThrow(/no connected gmail account/i);
    }

    await expect(handler({ auth: { uid: 'u1' } })).rejects.toThrow(/daily gmail sync limit/i);
  });

  it('does not let one user\'s calls count against another user\'s limit', async () => {
    const db = createFakeDb({ connection: null });
    const handler = createGmailBackfillHandler({ db, clientSecret: 'x' });

    for (let i = 0; i < GMAIL_BACKFILL_LIMITS.PER_USER_DAILY_CALLS; i++) {
      await expect(handler({ auth: { uid: 'u1' } })).rejects.toThrow(/no connected gmail account/i);
    }

    // u1 is now rate-limited, but u2 has made no calls yet.
    await expect(handler({ auth: { uid: 'u2' } })).rejects.toThrow(/no connected gmail account/i);
  });
});
