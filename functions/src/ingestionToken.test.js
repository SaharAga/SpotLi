import { describe, it, expect } from 'vitest';
import {
  createIngestionAddressHandler,
  parseIngestionRecipient,
  resolveIngestionRecipient,
  INGESTION_TOKENS_COLLECTION
} from './ingestionToken.js';

/** Minimal Firestore double: flat collections of { id: data }. */
function createDb(initial = {}) {
  const collections = new Map(
    Object.entries(initial).map(([name, docs]) => [name, new Map(Object.entries(docs))])
  );
  const col = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const docRef = (name, id) => ({
    id,
    get: async () => ({ exists: col(name).has(id), data: () => col(name).get(id) }),
    set: async (data) => { col(name).set(id, data); },
    delete: async () => { col(name).delete(id); }
  });
  return {
    _col: col,
    collection: (name) => ({
      doc: (id) => docRef(name, id),
      where: (field, _op, value) => ({
        get: async () => {
          const docs = [...col(name).entries()]
            .filter(([, data]) => data[field] === value)
            .map(([id, data]) => ({ id, data: () => data, ref: docRef(name, id) }));
          return { docs, empty: docs.length === 0 };
        }
      })
    })
  };
}

const TOKEN = 'abababababababababababab';

describe('parseIngestionRecipient', () => {
  it('recognizes the token form', () => {
    expect(parseIngestionRecipient(`inbox+tok_${TOKEN}@cloudmailin.net`)).toEqual({ kind: 'token', value: TOKEN });
  });

  it('still recognizes the legacy uid form', () => {
    expect(parseIngestionRecipient('inbox+usr_abc123@cloudmailin.net')).toEqual({ kind: 'uid', value: 'abc123' });
  });

  it('rejects unrelated addresses', () => {
    expect(parseIngestionRecipient('someone@gmail.com')).toBeNull();
    expect(parseIngestionRecipient(undefined)).toBeNull();
  });
});

describe('resolveIngestionRecipient', () => {
  it('maps a known token to its uid', async () => {
    const db = createDb({ [INGESTION_TOKENS_COLLECTION]: { [TOKEN]: { uid: 'u1' } } });
    await expect(resolveIngestionRecipient({ db, toAddress: `x+tok_${TOKEN}@cloudmailin.net` })).resolves.toBe('u1');
  });

  it('rejects an unknown token', async () => {
    const db = createDb();
    await expect(resolveIngestionRecipient({ db, toAddress: `x+tok_${TOKEN}@cloudmailin.net` })).resolves.toBeNull();
  });

  it('honours a legacy uid address only while the user has no token', async () => {
    const db = createDb({ users: { u1: {} } });
    const legacy = 'x+usr_u1xyz@cloudmailin.net';
    const dbLegacy = createDb({ users: { u1xyz: {} } });
    await expect(resolveIngestionRecipient({ db: dbLegacy, toAddress: legacy })).resolves.toBe('u1xyz');

    dbLegacy._col(INGESTION_TOKENS_COLLECTION).set(TOKEN, { uid: 'u1xyz' });
    await expect(resolveIngestionRecipient({ db: dbLegacy, toAddress: legacy })).resolves.toBeNull();

    // A uid with no user document is never a valid recipient.
    await expect(resolveIngestionRecipient({ db, toAddress: 'x+usr_ghost@cloudmailin.net' })).resolves.toBeNull();
  });
});

describe('createIngestionAddressHandler', () => {
  it('requires sign-in', async () => {
    const handler = createIngestionAddressHandler({ db: createDb() });
    await expect(handler({ auth: null })).rejects.toThrow(/Sign in required/);
  });

  it('issues a token once and returns the same one afterwards', async () => {
    const db = createDb();
    const handler = createIngestionAddressHandler({ db });
    const first = await handler({ auth: { uid: 'u1' }, data: {} });
    const second = await handler({ auth: { uid: 'u1' }, data: {} });
    expect(first.token).toMatch(/^[a-f0-9]{24}$/);
    expect(second.token).toBe(first.token);
  });

  it('rotation revokes the old token', async () => {
    const db = createDb();
    const handler = createIngestionAddressHandler({ db });
    const { token: oldToken } = await handler({ auth: { uid: 'u1' }, data: {} });
    const { token: newToken } = await handler({ auth: { uid: 'u1' }, data: { rotate: true } });
    expect(newToken).not.toBe(oldToken);
    await expect(resolveIngestionRecipient({ db, toAddress: `x+tok_${oldToken}@cloudmailin.net` })).resolves.toBeNull();
    await expect(resolveIngestionRecipient({ db, toAddress: `x+tok_${newToken}@cloudmailin.net` })).resolves.toBe('u1');
  });
});
