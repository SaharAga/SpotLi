import { describe, it, expect } from 'vitest';
import { createGmailDisconnectHandler } from './gmailDisconnect.js';

describe('gmailDisconnect', () => {
  function createTestDb(connections) {
    const store = new Map(Object.entries(connections));
    return {
      _store: store,
      collection: () => ({
        doc: (docId) => ({
          get: async () => ({
            id: docId,
            exists: store.has(docId),
            data: () => store.get(docId)
          }),
          delete: async () => {
            store.delete(docId);
          }
        }),
        where: (field, op, val) => ({
          get: async () => {
            const matches = [];
            for (const [id, data] of store.entries()) {
              if (data[field] === val) {
                matches.push({ id, data: () => data });
              }
            }
            return { docs: matches, empty: matches.length === 0 };
          }
        })
      }),
      batch: () => {
        const ops = [];
        return {
          delete: (docRef) => ops.push(() => docRef.delete()),
          commit: async () => {
            for (const op of ops) op();
          }
        };
      }
    };
  }

  it('rejects unauthenticated caller', async () => {
    const handler = createGmailDisconnectHandler({ db: createTestDb({}), clientSecret: 'sec' });
    await expect(handler({ auth: null })).rejects.toThrow(/Sign in required/);
  });

  it('disconnects a single account when emailAddress is provided', async () => {
    const db = createTestDb({
      user1__acc1_gmail_com: {
        uid: 'user1',
        emailAddress: 'acc1@gmail.com',
        refreshToken: 'ref1',
        status: 'active'
      },
      user1__acc2_gmail_com: {
        uid: 'user1',
        emailAddress: 'acc2@gmail.com',
        refreshToken: 'ref2',
        status: 'active'
      }
    });

    const handler = createGmailDisconnectHandler({ db, clientSecret: 'sec' });
    const res = await handler({
      auth: { uid: 'user1' },
      data: { emailAddress: 'acc1@gmail.com' }
    });

    expect(res).toEqual({ ok: true });
    expect(db._store.has('user1__acc1_gmail_com')).toBe(false);
    expect(db._store.has('user1__acc2_gmail_com')).toBe(true);
  });

  it('disconnects all accounts when no emailAddress is passed or emailAddress is "all"', async () => {
    const db = createTestDb({
      user1__acc1_gmail_com: {
        uid: 'user1',
        emailAddress: 'acc1@gmail.com',
        refreshToken: 'ref1'
      },
      user1__acc2_gmail_com: {
        uid: 'user1',
        emailAddress: 'acc2@gmail.com',
        refreshToken: 'ref2'
      }
    });

    const handler = createGmailDisconnectHandler({ db, clientSecret: 'sec' });
    const res = await handler({
      auth: { uid: 'user1' },
      data: {}
    });

    expect(res).toEqual({ ok: true });
    expect(db._store.has('user1__acc1_gmail_com')).toBe(false);
    expect(db._store.has('user1__acc2_gmail_com')).toBe(false);
  });
});
