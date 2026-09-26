import { describe, it, expect } from 'vitest';
import { decryptToken, encryptToken, getTokenKey, isEncryptedToken } from './tokenCipher.js';
import { decodeConnection, setGmailConnection } from './gmailAuth.js';

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);

describe('tokenCipher', () => {
  it('round-trips any token for the same uid', () => {
    const samples = [
      ['1//0gLongRefreshTokenValue-with_symbols', 'abcdefghijklmnopqrstuvwxyz12'],
      ['x', 'u'],
      ['טוקן:with:colons', 'uid__with__underscores'],
      ['a'.repeat(2048), 'u2']
    ];
    for (const [token, uid] of samples) {
      const stored = encryptToken(token, { aad: uid, key: KEY });
      expect(isEncryptedToken(stored)).toBe(true);
      if (token.length > 8) expect(stored).not.toContain(token);
      expect(decryptToken(stored, { aad: uid, key: KEY })).toBe(token);
    }
  });

  it('uses a fresh IV, so equal tokens never produce equal ciphertexts', () => {
    const a = encryptToken('1//refresh', { aad: 'u1', key: KEY });
    const b = encryptToken('1//refresh', { aad: 'u1', key: KEY });
    expect(a).not.toBe(b);
  });

  it('refuses a ciphertext moved onto another user\'s connection', () => {
    const stored = encryptToken('1//refresh', { aad: 'victim', key: KEY });
    expect(() => decryptToken(stored, { aad: 'attacker', key: KEY })).toThrow();
  });

  it('refuses the wrong key and tampered ciphertext', () => {
    const stored = encryptToken('1//refresh', { aad: 'u1', key: KEY });
    expect(() => decryptToken(stored, { aad: 'u1', key: OTHER_KEY })).toThrow();
    const tampered = stored.slice(0, -2) + (stored.endsWith('A') ? 'BB' : 'AA');
    expect(() => decryptToken(tampered, { aad: 'u1', key: KEY })).toThrow();
  });

  it('passes legacy plaintext tokens through unchanged', () => {
    expect(decryptToken('1//legacy', { aad: 'u1', key: KEY })).toBe('1//legacy');
    expect(decryptToken('1//legacy', { aad: 'u1', key: null })).toBe('1//legacy');
  });

  it('refuses to store plaintext when no key is configured', () => {
    expect(() => encryptToken('1//refresh', { aad: 'u1', key: null })).toThrow(/GMAIL_TOKEN_KEY/);
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => getTokenKey(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
    expect(getTokenKey('')).toBeNull();
  });
});

describe('gmailAuth storage boundary', () => {
  it('encrypts on write and decrypts on read', async () => {
    const writes = [];
    const db = {
      collection: () => ({
        doc: (id) => ({ set: async (data) => { writes.push({ id, data }); } })
      })
    };
    await setGmailConnection({ db, uid: 'u1', data: { refreshToken: '1//secret', emailAddress: 'a@gmail.com' } });

    const { id, data } = writes[0];
    expect(isEncryptedToken(data.refreshToken)).toBe(true);
    expect(JSON.stringify(data)).not.toContain('1//secret');
    expect(decodeConnection(id, data).refreshToken).toBe('1//secret');
  });
});

describe('gmailWatchRenewal legacy-token migration', () => {
  it('re-encrypts a plaintext token it finds on an active connection', async () => {
    const { createGmailWatchRenewalHandler } = await import('./gmailWatchRenewal.js');
    const docs = new Map([
      ['u1__a_gmail_com', { uid: 'u1', status: 'active', refreshToken: '1//plain', watchExpiration: Date.now() + 7 * 86400000 }]
    ]);
    const db = {
      collection: (name) => ({
        where: () => ({
          get: async () => ({
            size: docs.size,
            docs: [...docs.entries()].map(([id, data]) => ({ id, data: () => data }))
          })
        }),
        doc: (id) => ({ set: async (data) => { if (name === 'gmailConnections') docs.set(id, { ...docs.get(id), ...data }); } }),
        add: async () => {}
      })
    };
    process.env.GMAIL_PUBSUB_TOPIC = 'projects/p/topics/t';
    try {
      await createGmailWatchRenewalHandler({ db, clientSecret: 'sec' })();
    } finally {
      delete process.env.GMAIL_PUBSUB_TOPIC;
    }
    const stored = docs.get('u1__a_gmail_com').refreshToken;
    expect(isEncryptedToken(stored)).toBe(true);
    expect(decodeConnection('u1__a_gmail_com', docs.get('u1__a_gmail_com')).refreshToken).toBe('1//plain');
  });
});
