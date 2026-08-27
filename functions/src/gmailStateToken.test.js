import { describe, it, expect, vi } from 'vitest';
import { createStateToken, verifyStateToken } from './gmailStateToken.js';

describe('gmailStateToken', () => {
  it('round-trips a valid token back to its uid', () => {
    const token = createStateToken({ uid: 'user123', secret: 'shh' });
    expect(verifyStateToken({ token, secret: 'shh' })).toBe('user123');
  });

  it('rejects a token signed with a different secret', () => {
    const token = createStateToken({ uid: 'user123', secret: 'shh' });
    expect(verifyStateToken({ token, secret: 'other' })).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = createStateToken({ uid: 'user123', secret: 'shh' });
    const [payloadB64, sig] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ uid: 'attacker', exp: Date.now() + 100000, nonce: 'x' })).toString(
      'base64url'
    );
    expect(verifyStateToken({ token: `${tamperedPayload}.${sig}`, secret: 'shh' })).toBeNull();
    expect(payloadB64).toBeTruthy();
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = createStateToken({ uid: 'user123', secret: 'shh' });
    vi.setSystemTime(new Date('2026-01-01T00:10:00Z')); // 10 min later, past 5 min TTL
    expect(verifyStateToken({ token, secret: 'shh' })).toBeNull();
    vi.useRealTimers();
  });

  it('rejects malformed tokens', () => {
    expect(verifyStateToken({ token: 'not-a-token', secret: 'shh' })).toBeNull();
    expect(verifyStateToken({ token: '', secret: 'shh' })).toBeNull();
    expect(verifyStateToken({ token: null, secret: 'shh' })).toBeNull();
  });
});
