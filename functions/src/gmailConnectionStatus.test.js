import { describe, it, expect } from 'vitest';
import { createGmailConnectionStatusHandler } from './gmailConnectionStatus.js';

function fakeDb(connections) {
  return {
    collection: () => ({
      where: (field, op, val) => ({
        get: async () => {
          const matching = Object.entries(connections)
            .filter(([, data]) => data[field] === val)
            .map(([id, data]) => ({
              id,
              data: () => data
            }));
          return { docs: matching, empty: matching.length === 0 };
        }
      }),
      doc: (uid) => ({
        get: async () => ({
          exists: Boolean(connections[uid]),
          data: () => connections[uid]
        })
      })
    })
  };
}

describe('createGmailConnectionStatusHandler', () => {
  it('rejects unauthenticated callers', async () => {
    const handler = createGmailConnectionStatusHandler({ db: fakeDb({}) });
    await expect(handler({ auth: null })).rejects.toThrow(/Sign in required/);
  });

  it('reports not connected when there is no stored connection', async () => {
    const handler = createGmailConnectionStatusHandler({ db: fakeDb({}) });
    const result = await handler({ auth: { uid: 'u1' } });
    expect(result).toEqual({ connected: false });
  });

  it('reports not connected when the doc has no refresh token', async () => {
    const handler = createGmailConnectionStatusHandler({
      db: fakeDb({ u1: { emailAddress: 'a@gmail.com' } })
    });
    const result = await handler({ auth: { uid: 'u1' } });
    expect(result).toEqual({ connected: false });
  });

  it('reports connected with email/connectedAt and accounts array but never the refresh token', async () => {
    const handler = createGmailConnectionStatusHandler({
      db: fakeDb({
        u1: {
          refreshToken: 'secret-token',
          emailAddress: 'a@gmail.com',
          connectedAt: '2026-01-01T00:00:00.000Z'
        }
      })
    });
    const result = await handler({ auth: { uid: 'u1' } });
    expect(result).toEqual({
      connected: true,
      emailAddress: 'a@gmail.com',
      connectedAt: '2026-01-01T00:00:00.000Z',
      lastRenewalError: null,
      accounts: [
        {
          email: 'a@gmail.com',
          emailAddress: 'a@gmail.com',
          connectedAt: '2026-01-01T00:00:00.000Z',
          status: 'active',
          lastRenewalError: null
        }
      ]
    });
    expect(result.refreshToken).toBeUndefined();
  });

  it('surfaces multiple connected inboxes for the user', async () => {
    const handler = createGmailConnectionStatusHandler({
      db: fakeDb({
        u1__personal_gmail_com: {
          uid: 'u1',
          refreshToken: 'token-1',
          emailAddress: 'personal@gmail.com',
          connectedAt: '2026-01-01T00:00:00.000Z',
          status: 'active'
        },
        u1__work_gmail_com: {
          uid: 'u1',
          refreshToken: 'token-2',
          emailAddress: 'work@gmail.com',
          connectedAt: '2026-01-02T00:00:00.000Z',
          status: 'active'
        }
      })
    });
    const result = await handler({ auth: { uid: 'u1' } });
    expect(result.connected).toBe(true);
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts.map((a) => a.email)).toEqual(['personal@gmail.com', 'work@gmail.com']);
  });

  it('surfaces a persistent watch renewal failure to the client', async () => {
    const handler = createGmailConnectionStatusHandler({
      db: fakeDb({
        u1: {
          refreshToken: 'secret-token',
          emailAddress: 'a@gmail.com',
          connectedAt: '2026-01-01T00:00:00.000Z',
          lastRenewalError: 'invalid_grant'
        }
      })
    });
    const result = await handler({ auth: { uid: 'u1' } });
    expect(result.lastRenewalError).toBe('invalid_grant');
  });
});
