/**
 * Application-level encryption for Gmail OAuth refresh tokens at rest.
 *
 * Firestore rules already deny every client access to `gmailConnections`, but
 * a refresh token for the restricted `gmail.readonly` scope is the most
 * sensitive thing this project stores: anyone holding it can read the user's
 * mail until it is revoked. Encrypting it means a Firestore export, a
 * mis-scoped IAM grant or a leaked backup does not also leak mailbox access —
 * the key lives only in Secret Manager (`GMAIL_TOKEN_KEY`).
 *
 * AES-256-GCM, a fresh 96-bit IV per value, and the owner's uid as
 * additional authenticated data, so a ciphertext copied onto another user's
 * connection doc fails to decrypt instead of granting that user's mailbox.
 *
 * Stored form: `enc:v1:<iv base64url>:<ciphertext+tag base64url>`. Anything
 * without that prefix is a legacy plaintext token and is returned as-is;
 * gmailWatchRenewal re-encrypts those on its next daily run.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Reads the key from the environment (Firebase injects declared secrets as
 * env vars). Must decode to exactly 32 bytes — generate with
 * `openssl rand -base64 32`.
 * @returns {Buffer | null}
 */
export function getTokenKey(raw = process.env.GMAIL_TOKEN_KEY) {
  if (!raw) return null;
  const key = Buffer.from(String(raw).trim(), 'base64');
  if (key.length !== 32) {
    throw new Error('GMAIL_TOKEN_KEY must be 32 bytes, base64-encoded.');
  }
  return key;
}

export function isEncryptedToken(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * @param {string} plaintext
 * @param {{ aad: string, key?: Buffer | null }} options
 * @returns {string}
 */
export function encryptToken(plaintext, { aad, key = getTokenKey() }) {
  if (typeof plaintext !== 'string' || !plaintext) return plaintext;
  if (isEncryptedToken(plaintext)) return plaintext;
  if (!key) {
    // Fail loudly: silently storing plaintext is exactly what this prevents.
    throw new Error('GMAIL_TOKEN_KEY is not configured; refusing to store a plaintext refresh token.');
  }
  if (!aad) throw new Error('encryptToken requires an aad (the owner uid).');

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return `${PREFIX}${iv.toString('base64url')}:${body.toString('base64url')}`;
}

/**
 * @param {string} stored
 * @param {{ aad: string, key?: Buffer | null }} options
 * @returns {string}
 */
export function decryptToken(stored, { aad, key = getTokenKey() }) {
  if (!isEncryptedToken(stored)) return stored;
  if (!key) throw new Error('GMAIL_TOKEN_KEY is not configured; cannot decrypt refresh token.');

  const [ivPart, bodyPart] = stored.slice(PREFIX.length).split(':');
  const iv = Buffer.from(ivPart || '', 'base64url');
  const body = Buffer.from(bodyPart || '', 'base64url');
  if (iv.length !== IV_BYTES || body.length <= TAG_BYTES) {
    throw new Error('Malformed encrypted refresh token.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad || '', 'utf8'));
  decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
  return Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()]).toString('utf8');
}
