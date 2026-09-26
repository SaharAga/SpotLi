import { describe, it, expect, vi } from 'vitest';
import { createPubSubOidcVerifier } from './pubsubPushAuth.js';
import { createGmailPushHandler } from './gmailPushHandler.js';

const SA = 'gmail-push@project.iam.gserviceaccount.com';
const AUD = 'https://us-central1-project.cloudfunctions.net/gmailPushNotification';

function clientReturning(payload, { fail = false } = {}) {
  return {
    verifyIdToken: vi.fn(async () => {
      if (fail) throw new Error('bad signature');
      return { getPayload: () => payload };
    })
  };
}

const validPayload = { iss: 'https://accounts.google.com', email: SA, email_verified: true, aud: AUD };

describe('createPubSubOidcVerifier', () => {
  it('is disabled (null) until both audience and service account are configured', () => {
    expect(createPubSubOidcVerifier({ audience: AUD })).toBeNull();
    expect(createPubSubOidcVerifier({ serviceAccountEmail: SA })).toBeNull();
  });

  it('accepts a Google-signed token for our service account and audience', async () => {
    const client = clientReturning(validPayload);
    const verify = createPubSubOidcVerifier({ audience: AUD, serviceAccountEmail: SA, client });
    await expect(verify('Bearer abc.def.ghi')).resolves.toBe(true);
    expect(client.verifyIdToken).toHaveBeenCalledWith({ idToken: 'abc.def.ghi', audience: AUD });
  });

  it('rejects tokens for another service account, unverified email, or foreign issuer', async () => {
    for (const payload of [
      { ...validPayload, email: 'attacker@evil.iam.gserviceaccount.com' },
      { ...validPayload, email_verified: false },
      { ...validPayload, iss: 'https://evil.example' }
    ]) {
      const verify = createPubSubOidcVerifier({ audience: AUD, serviceAccountEmail: SA, client: clientReturning(payload) });
      await expect(verify('Bearer t')).resolves.toBe(false);
    }
  });

  it('rejects a missing header or a token that fails signature/audience checks', async () => {
    const verify = createPubSubOidcVerifier({ audience: AUD, serviceAccountEmail: SA, client: clientReturning(validPayload, { fail: true }) });
    await expect(verify(undefined)).resolves.toBe(false);
    await expect(verify('Basic abc')).resolves.toBe(false);
    await expect(verify('Bearer t')).resolves.toBe(false);
  });
});

describe('gmailPushHandler auth', () => {
  const res = () => ({ status: vi.fn().mockReturnThis(), send: vi.fn() });
  // No message data → handler returns 200 right after auth, no Firestore needed.
  const req = (extra) => ({ method: 'POST', query: {}, headers: {}, body: {}, ...extra });

  it('accepts a valid OIDC token without any query token', async () => {
    const handler = createGmailPushHandler({ db: null, pushToken: 'legacy', verifyOidc: async () => true });
    const r = res();
    await handler(req({ headers: { authorization: 'Bearer t' } }), r);
    expect(r.status).toHaveBeenCalledWith(200);
  });

  it('still accepts the legacy query token while OIDC is not required', async () => {
    const handler = createGmailPushHandler({ db: null, pushToken: 'legacy', verifyOidc: async () => false });
    const r = res();
    await handler(req({ query: { token: 'legacy' } }), r);
    expect(r.status).toHaveBeenCalledWith(200);
  });

  it('rejects the legacy query token once OIDC is required', async () => {
    const handler = createGmailPushHandler({ db: null, pushToken: 'legacy', verifyOidc: async () => false, requireOidc: true });
    const r = res();
    await handler(req({ query: { token: 'legacy' } }), r);
    expect(r.status).toHaveBeenCalledWith(401);
  });
});
