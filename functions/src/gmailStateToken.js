/**
 * Short-lived signed state tokens carrying {uid, nonce, exp} through the
 * Google OAuth `state` param, so the callback can verify who initiated the
 * flow without trusting a bare uid query param (CSRF protection).
 *
 * Signed with the same GMAIL_OAUTH_CLIENT_SECRET already required for the
 * OAuth exchange — no extra secret to provision.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes — just long enough for the consent redirect round trip

function sign(payloadB64, secret) {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

/**
 * @param {{ uid: string, secret: string }} params
 * @returns {string} opaque state token
 */
export function createStateToken({ uid, secret }) {
  const payload = {
    uid,
    nonce: Math.random().toString(36).slice(2),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/**
 * @param {{ token: string, secret: string }} params
 * @returns {string|null} the uid if valid and unexpired, else null
 */
export function verifyStateToken({ token, secret }) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expectedSig = sign(payloadB64, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.uid || typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload.uid;
  } catch {
    return null;
  }
}
