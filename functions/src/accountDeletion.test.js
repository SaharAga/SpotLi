import { describe, it, expect, vi } from 'vitest';
import { createDeleteAccountDataHandler } from './accountDeletion.js';

const DOC_ID = Symbol('documentId');

/** Firestore double supporting field equality and document-id range queries. */
function createDb(initial) {
  const collections = new Map(
    Object.entries(initial).map(([name, docs]) => [name, new Map(Object.entries(docs))])
  );
  const col = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const docRef = (name, id) => ({ name, id, delete: async () => { col(name).delete(id); } });
  const query = (name, filters) => ({
    where: (field, op, value) => query(name, [...filters, [field, op, value]]),
    get: async () => {
      const docs = [...col(name).entries()]
        .filter(([id, data]) => filters.every(([field, op, value]) => {
          const actual = field === DOC_ID ? id : data[field];
          if (op === '==') return actual === value;
          if (op === '>=') return actual >= value;
          if (op === '<') return actual < value;
          return false;
        }))
        .map(([id]) => ({ id, ref: docRef(name, id) }));
      return { docs };
    }
  });
  return {
    _col: col,
    collection: (name) => ({ ...query(name, []), doc: (id) => docRef(name, id) }),
    recursiveDelete: vi.fn(async (ref) => { col(ref.name).delete(ref.id); })
  };
}

describe('deleteAccountData', () => {
  it('requires sign-in', async () => {
    const handler = createDeleteAccountDataHandler({ db: createDb({}), disconnectGmail: vi.fn(), documentIdField: DOC_ID });
    await expect(handler({ auth: null })).rejects.toThrow(/Sign in required/);
  });

  it('disconnects Gmail and purges only the caller\'s server-side data', async () => {
    const db = createDb({
      users: { u1: {}, u2: {} },
      pushSubscriptions: { u1: {}, u2: {} },
      trainingExamples: { a: { userId: 'u1' }, b: { userId: 'u2' } },
      gmailAiOutcomes: { a: { userId: 'u1' } },
      usageEvents: { a: { uid: 'u1' }, b: { uid: 'u2' } },
      ingestionTokens: { tok1: { uid: 'u1' }, tok2: { uid: 'u2' } },
      usage: { 'user_u1_2026-09-01': {}, 'user_u10_2026-09-01': {}, 'global_2026-09-01': {} },
      carrierUsage: { 'user_u1_2026-09-01': {} }
    });
    const disconnectGmail = vi.fn().mockResolvedValue({ ok: true });
    const handler = createDeleteAccountDataHandler({ db, disconnectGmail, documentIdField: DOC_ID });

    await expect(handler({ auth: { uid: 'u1' } })).resolves.toEqual({ ok: true });

    expect(disconnectGmail).toHaveBeenCalledWith({ auth: { uid: 'u1' }, data: { emailAddress: 'all' } });
    expect([...db._col('users').keys()]).toEqual(['u2']);
    expect([...db._col('pushSubscriptions').keys()]).toEqual(['u2']);
    expect([...db._col('trainingExamples').keys()]).toEqual(['b']);
    expect([...db._col('gmailAiOutcomes').keys()]).toEqual([]);
    expect([...db._col('usageEvents').keys()]).toEqual(['b']);
    expect([...db._col('ingestionTokens').keys()]).toEqual(['tok2']);
    // The `user_u1_` prefix must not swallow `user_u10_…`.
    expect([...db._col('usage').keys()].sort()).toEqual(['global_2026-09-01', 'user_u10_2026-09-01']);
    expect([...db._col('carrierUsage').keys()]).toEqual([]);
  });

  it('aborts before deleting anything when Gmail disconnect fails', async () => {
    const db = createDb({ users: { u1: {} } });
    const handler = createDeleteAccountDataHandler({
      db,
      disconnectGmail: vi.fn().mockRejectedValue(new Error('boom')),
      documentIdField: DOC_ID
    });
    await expect(handler({ auth: { uid: 'u1' } })).rejects.toThrow('boom');
    expect(db._col('users').has('u1')).toBe(true);
  });
});
