import { describe, it, expect } from 'vitest';
import {
  sanitizeEmailForDocId,
  getConnectionDocId,
  getGmailConnection,
  getGmailConnectionsForUser,
  setGmailConnection,
  deleteGmailConnection,
  findGmailConnectionByEmail,
  GMAIL_CONNECTIONS_COLLECTION
} from './gmailAuth.js';

function createMockDb() {
  const store = new Map();

  const db = {
    _store: store,
    collection: (colName) => {
      expect(colName).toBe(GMAIL_CONNECTIONS_COLLECTION);
      return {
        doc: (docId) => ({
          get: async () => ({
            id: docId,
            exists: store.has(docId),
            data: () => store.get(docId)
          }),
          set: async (data, opts) => {
            const existing = opts?.merge ? store.get(docId) || {} : {};
            store.set(docId, { ...existing, ...data });
          },
          delete: async () => {
            store.delete(docId);
          }
        }),
        where: (field, op, val) => ({
          limit: () => ({
            get: async () => {
              const matches = [];
              for (const [id, data] of store.entries()) {
                if (data[field] === val) {
                  matches.push({ id, data: () => data });
                }
              }
              return { docs: matches, empty: matches.length === 0 };
            }
          }),
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
      };
    },
    batch: () => {
      const operations = [];
      return {
        delete: (docRef) => {
          operations.push(() => docRef.delete());
        },
        commit: async () => {
          for (const op of operations) op();
        }
      };
    }
  };

  return db;
}

describe('gmailAuth', () => {
  describe('sanitizeEmailForDocId', () => {
    it('normalizes uppercase, dots, and special characters', () => {
      expect(sanitizeEmailForDocId('Test.User+1@Gmail.COM')).toBe('test_user_1_gmail_com');
    });

    it('handles empty or falsy email', () => {
      expect(sanitizeEmailForDocId('')).toBe('');
      expect(sanitizeEmailForDocId(null)).toBe('');
    });
  });

  describe('getConnectionDocId', () => {
    it('returns compound key when email is provided', () => {
      expect(getConnectionDocId('uid123', 'sahar@gmail.com')).toBe('uid123__sahar_gmail_com');
    });

    it('returns uid when email is omitted', () => {
      expect(getConnectionDocId('uid123')).toBe('uid123');
    });
  });

  describe('setGmailConnection and getGmailConnection', () => {
    it('stores with compound ID when emailAddress is in data', async () => {
      const db = createMockDb();
      const docId = await setGmailConnection({
        db,
        uid: 'user1',
        data: {
          emailAddress: 'test@gmail.com',
          refreshToken: 'token_abc',
          status: 'active'
        }
      });

      expect(docId).toBe('user1__test_gmail_com');
      const conn = await getGmailConnection({ db, uid: 'user1', emailAddress: 'test@gmail.com' });
      expect(conn).toBeTruthy();
      expect(conn.emailAddress).toBe('test@gmail.com');
      expect(conn.refreshToken).toBe('token_abc');
      expect(conn.uid).toBe('user1');
    });

    it('stores with explicit connectionId when provided', async () => {
      const db = createMockDb();
      const docId = await setGmailConnection({
        db,
        uid: 'user1',
        connectionId: 'custom_conn_id',
        data: {
          historyId: '12345'
        }
      });

      expect(docId).toBe('custom_conn_id');
      expect(db._store.get('custom_conn_id').historyId).toBe('12345');
    });

    it('reads legacy connection doc keyed directly by uid', async () => {
      const db = createMockDb();
      db._store.set('userLegacy', {
        emailAddress: 'legacy@gmail.com',
        refreshToken: 'legacy_token',
        status: 'active'
      });

      const conn = await getGmailConnection({ db, uid: 'userLegacy' });
      expect(conn).toBeTruthy();
      expect(conn.emailAddress).toBe('legacy@gmail.com');
      expect(conn.refreshToken).toBe('legacy_token');
    });
  });

  describe('getGmailConnectionsForUser', () => {
    it('retrieves multi-account connections and merges legacy doc without duplicates', async () => {
      const db = createMockDb();
      // 2 compound connections for userA
      db._store.set('userA__first_gmail_com', {
        uid: 'userA',
        emailAddress: 'first@gmail.com',
        refreshToken: 'tok1',
        status: 'active'
      });
      db._store.set('userA__second_gmail_com', {
        uid: 'userA',
        emailAddress: 'second@gmail.com',
        refreshToken: 'tok2',
        status: 'active'
      });
      // Connection for another user
      db._store.set('userB__other_gmail_com', {
        uid: 'userB',
        emailAddress: 'other@gmail.com',
        refreshToken: 'tokB'
      });

      const connections = await getGmailConnectionsForUser({ db, uid: 'userA' });
      expect(connections).toHaveLength(2);
      expect(connections.map((c) => c.emailAddress)).toEqual(['first@gmail.com', 'second@gmail.com']);
    });
  });

  describe('deleteGmailConnection', () => {
    it('deletes specific connection by emailAddress', async () => {
      const db = createMockDb();
      db._store.set('userA__first_gmail_com', {
        uid: 'userA',
        emailAddress: 'first@gmail.com',
        refreshToken: 'tok1'
      });
      db._store.set('userA__second_gmail_com', {
        uid: 'userA',
        emailAddress: 'second@gmail.com',
        refreshToken: 'tok2'
      });

      await deleteGmailConnection({ db, uid: 'userA', emailAddress: 'first@gmail.com' });
      expect(db._store.has('userA__first_gmail_com')).toBe(false);
      expect(db._store.has('userA__second_gmail_com')).toBe(true);
    });

    it('deletes all connections for user when emailAddress is "all" or omitted', async () => {
      const db = createMockDb();
      db._store.set('userA__first_gmail_com', {
        uid: 'userA',
        emailAddress: 'first@gmail.com',
        refreshToken: 'tok1'
      });
      db._store.set('userA', {
        emailAddress: 'legacy@gmail.com',
        refreshToken: 'tokLegacy'
      });

      await deleteGmailConnection({ db, uid: 'userA' });
      expect(db._store.has('userA__first_gmail_com')).toBe(false);
      expect(db._store.has('userA')).toBe(false);
    });
  });

  describe('findGmailConnectionByEmail', () => {
    it('finds connection by emailAddress case-insensitively', async () => {
      const db = createMockDb();
      db._store.set('user1__test_gmail_com', {
        uid: 'user1',
        emailAddress: 'test@gmail.com',
        refreshToken: 'tok_found'
      });

      const found = await findGmailConnectionByEmail({ db, emailAddress: 'TEST@GMAIL.COM' });
      expect(found).toBeTruthy();
      expect(found.connectionId).toBe('user1__test_gmail_com');
      expect(found.uid).toBe('user1');
      expect(found.refreshToken).toBe('tok_found');
    });

    it('returns null if not found', async () => {
      const db = createMockDb();
      const found = await findGmailConnectionByEmail({ db, emailAddress: 'missing@gmail.com' });
      expect(found).toBeNull();
    });
  });
});
