import { describe, it, expect } from 'vitest';
import { createGmailConnectionStatusHandler } from './gmailConnectionStatus.js';

function fakeDb(connections) {
  return {
    collection: () => ({
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

  it('reports connected with email/connectedAt but never the refresh token', async () => {
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
      lastRenewalError: null
    });
    expect(result.refreshToken).toBeUndefined();
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
