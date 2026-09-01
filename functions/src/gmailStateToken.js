/**
 * Short-lived signed state tokens carrying {uid, returnOrigin, nonce, exp}
 * through the Google OAuth `state` param, so the callback can verify who
 * initiated the flow (CSRF protection) and which origin to redirect back to
 * — the app can be reached from more than one origin (production, the
 * staging Hosting channel), and the OAuth round trip has no other way to
 * remember which one the user started from.
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
 * @param {{ uid: string, secret: string, returnOrigin?: string }} params
 * @returns {string} opaque state token
 */
export function createStateToken({ uid, secret, returnOrigin }) {
  const payload = {
    uid,
    returnOrigin: returnOrigin || null,
    nonce: Math.random().toString(36).slice(2),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/**
 * @param {{ token: string, secret: string }} params
 * @returns {{ uid: string, returnOrigin: string|null }|null} the payload if
 *   valid and unexpired, else null
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
    return { uid: payload.uid, returnOrigin: typeof payload.returnOrigin === 'string' ? payload.returnOrigin : null };
  } catch {
    return null;
  }
}
