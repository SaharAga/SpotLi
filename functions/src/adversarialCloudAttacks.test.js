import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { assertAuthenticated, checkAndIncrementUsage, assertPayloadWithinLimits } from './guards.js';
import { createCarrierTrackingHandler } from './carrierProxy.js';
import { createInboundEmailHandler, safeCompareTokens } from './inboundEmailHandler.js';
import { createGmailOAuthCallbackHandler, validateReturnOrigin } from './gmailOAuthCallback.js';
import { createStateToken } from './gmailStateToken.js';

describe('Adversarial Penetration & External Abuse Simulation: Cloud Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Unauthorized Invocations & Identity Spoofing', () => {
    it('blocks external unauthenticated calls to protected API endpoints', () => {
      const unauthRequests = [
        {},
        { auth: null },
        { auth: {} },
        { auth: { uid: '' } },
        { headers: { authorization: 'Bearer fake_token' } }
      ];

      for (const req of unauthRequests) {
        expect(() => assertAuthenticated(req)).toThrow(HttpsError);
        try {
          assertAuthenticated(req);
        } catch (err) {
          expect(err.code).toBe('unauthenticated');
        }
      }
    });

    it('rejects carrier tracking requests from unauthenticated callers', async () => {
      const handler = createCarrierTrackingHandler();
      const hostileReq = {
        auth: null,
        data: { trackingNumber: 'RR123456789IL', carrierId: 'israel-post' }
      };

      await expect(handler(hostileReq)).rejects.toThrow(HttpsError);
    });
  });

  describe('2. SSRF & Malicious Target Injection Probes', () => {
    it('confines carrier proxy destination to hardcoded endpoints and prevents arbitrary network fetches', async () => {
      const originalFetch = globalThis.fetch;
      const interceptedUrls = [];

      globalThis.fetch = vi.fn(async (url) => {
        interceptedUrls.push(String(url));
        return {
          ok: true,
          status: 200,
          text: async () => '<html><body><script>"nonce":"abcdef123456"</script></body></html>',
          json: async () => ({ Statuses: [] })
        };
      });

      try {
        const handler = createCarrierTrackingHandler({ track17ApiKey: 'test-key' });
        const authReq = (trackingNumber, carrierId) => ({
          auth: { uid: 'attacker-test-uid' },
          data: { trackingNumber, carrierId }
        });

        // Hostile SSRF vectors attempting to hijack the target host
        const ssrfPayloads = [
          'http://169.254.169.254/latest/meta-data/',
          'http://localhost:8080/admin',
          'http://127.0.0.1:22',
          'file:///etc/passwd',
          '../../../../etc/passwd',
          'GAASH?param=1&url=http://evil.com',
          'GAA123456789\r\nHost: evil.com'
        ];

        for (const payload of ssrfPayloads) {
          await handler(authReq(payload, 'gaash'));
        }

        // Verify that EVERY intercepted URL targeted exclusively gaashwd.com or 17track host
        for (const url of interceptedUrls) {
          const parsed = new URL(url);
          const isAllowedHost =
            parsed.hostname === 'gaashwd.com' ||
            parsed.hostname === 'api.17track.net';
          expect(isAllowedHost, `Prohibited SSRF attempt reached unexpected host: ${parsed.hostname}`).toBe(true);
          expect(parsed.hostname).not.toBe('169.254.169.254');
          expect(parsed.hostname).not.toBe('localhost');
          expect(parsed.hostname).not.toBe('127.0.0.1');
          expect(parsed.protocol).toBe('https:');
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('3. Inbound Webhook Forgery & Timing Attack Resistance', () => {
    it('verifies safeCompareTokens prevents timing attack leaks and fails closed on falsy/tampered inputs', () => {
      const realSecret = 'super-secret-webhook-key-998877';

      expect(safeCompareTokens(realSecret, realSecret)).toBe(true);
      expect(safeCompareTokens(realSecret, 'super-secret-webhook-key-998878')).toBe(false);
      expect(safeCompareTokens(realSecret, 'super-secret')).toBe(false);
      expect(safeCompareTokens(realSecret, '')).toBe(false);
      expect(safeCompareTokens(realSecret, null)).toBe(false);
      expect(safeCompareTokens(null, realSecret)).toBe(false);
      expect(safeCompareTokens(undefined, undefined)).toBe(false);
      expect(safeCompareTokens('', '')).toBe(false);
    });

    it('rejects forged webhook requests with HTTP 401 when token is missing or incorrect', async () => {
      const handler = createInboundEmailHandler({
        db: {},
        webhookToken: 'legit-secret-token'
      });

      const mockRes = () => {
        const res = {
          statusCode: 200,
          body: null,
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(data) {
            this.body = data;
            return this;
          }
        };
        return res;
      };

      // 1. Missing token
      const res1 = mockRes();
      await handler({ method: 'POST', query: {}, headers: {}, body: {} }, res1);
      expect(res1.statusCode).toBe(401);

      // 2. Tampered token
      const res2 = mockRes();
      await handler({
        method: 'POST',
        headers: { 'x-webhook-token': 'fake-token-attempt' },
        body: {}
      }, res2);
      expect(res2.statusCode).toBe(401);

      // 3. GET method attempt (must only allow POST)
      const res3 = mockRes();
      await handler({
        method: 'GET',
        headers: { 'x-webhook-token': 'legit-secret-token' }
      }, res3);
      expect(res3.statusCode).toBe(405);
    });
  });

  describe('4. OAuth CSRF & Open-Redirect Defense', () => {
    const PROD = 'https://deliveree-app-2a938.web.app';
    const SECRET = 'oauth-secret-xyz';

    beforeEach(() => {
      process.env.APP_BASE_URL = PROD;
    });

    it('neutralizes open-redirect attempts to external phishing domains', () => {
      const hostileOrigins = [
        'https://evil-phishing-site.com',
        'https://deliveree-app-2a938.web.app.attacker.com',
        'http://deliveree-app-2a938.web.app',
        'https://attacker-project.web.app',
        'javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
      ];

      for (const origin of hostileOrigins) {
        expect(validateReturnOrigin(PROD, origin)).toBeNull();
      }
    });

    it('rejects forged or tampered state tokens during OAuth callback', async () => {
      const handler = createGmailOAuthCallbackHandler({
        db: {},
        clientSecret: SECRET
      });

      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; }
      };

      // Attacker passes forged state token
      await handler({
        query: { code: 'some-code', state: 'forged.state.token' }
      }, res);

      expect(redirectedTo).toBe(`${PROD}/?gmail=error`);
    });

    it('rejects state token signed with a different secret (signature forgery attempt)', async () => {
      const forgedState = createStateToken({
        uid: 'victim-uid',
        secret: 'attacker-different-secret',
        returnOrigin: PROD
      });

      const handler = createGmailOAuthCallbackHandler({
        db: {},
        clientSecret: SECRET // Expects genuine secret
      });

      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; }
      };

      await handler({
        query: { code: 'auth-code', state: forgedState }
      }, res);

      expect(redirectedTo).toBe(`${PROD}/?gmail=error`);
    });
  });

  describe('5. Concurrency & Rate Limit Ceiling Enforcement', () => {
    it('strictly halts burst calls when user daily limit is reached in checkAndIncrementUsage', async () => {
      let store = { count: 4 }; // User limit is 5, 1 call left

      const mockDb = {
        collection: () => ({
          doc: () => ({})
        }),
        runTransaction: async (updateFn) => {
          const fakeTx = {
            get: async () => ({
              exists: true,
              data: () => ({ count: store.count })
            }),
            set: (_ref, data) => {
              store.count = data.count;
            }
          };
          return updateFn(fakeTx);
        }
      };

      // First call consumes the last allowance
      const res1 = await checkAndIncrementUsage(mockDb, 'user-123', { userLimit: 5, globalLimit: 100 });
      expect(res1.allowed).toBe(true);
      expect(store.count).toBe(5);

      // Subsequent burst call is denied
      const res2 = await checkAndIncrementUsage(mockDb, 'user-123', { userLimit: 5, globalLimit: 100 });
      expect(res2.allowed).toBe(false);
      expect(res2.reason).toBe('user-limit');
    });

    it('enforces payload bounds and rejects oversized requests before backend invocation', () => {
      const oversizedText = 'A'.repeat(5001); // MAX_TEXT_LENGTH is 5000
      expect(() => {
        assertPayloadWithinLimits({ mode: 'text-fallback', text: oversizedText });
      }).toThrow(HttpsError);

      const oversizedImage = 'A'.repeat(1_000_001); // Exceeds 1MB base64 cap (LIMITS.MAX_IMAGE_BASE64_BYTES is 1_000_000)
      expect(() => {
        assertPayloadWithinLimits({ mode: 'image', imageBase64: oversizedImage });
      }).toThrow(HttpsError);

      expect(() => {
        assertPayloadWithinLimits({ mode: 'unknown-mode' });
      }).toThrow(HttpsError);
    });

    it('does not consume carrier tracking daily quota on invalid inputs or missing provider key', async () => {
      let transactionCount = 0;
      const mockDb = {
        collection: () => ({ doc: () => ({}) }),
        runTransaction: async (fn) => {
          transactionCount++;
          return fn({
            get: async () => ({ exists: true, data: () => ({ count: 0 }) }),
            set: () => {}
          });
        }
      };

      const handler = createCarrierTrackingHandler({ db: mockDb, track17ApiKey: '' });

      // 1. Missing tracking number should not consume quota
      const res1 = await handler({
        auth: { uid: 'test-user' },
        data: { trackingNumber: '', carrierId: 'israel-post' }
      });
      expect(res1.tracked).toBe(false);
      expect(res1.reason).toBe('missing-tracking-number');
      expect(transactionCount).toBe(0);

      // 2. Oversized tracking number (>100 chars) should throw invalid-argument without consuming quota
      await expect(handler({
        auth: { uid: 'test-user' },
        data: { trackingNumber: 'X'.repeat(101), carrierId: 'israel-post' }
      })).rejects.toThrow(HttpsError);
      expect(transactionCount).toBe(0);

      // 3. Carrier requiring 17TRACK when key is missing should not consume quota
      const res2 = await handler({
        auth: { uid: 'test-user' },
        data: { trackingNumber: 'RR123456789IL', carrierId: 'israel-post' }
      });
      expect(res2.tracked).toBe(false);
      expect(res2.reason).toBe('api-key-required');
      expect(transactionCount).toBe(0);
    });
  });
});
