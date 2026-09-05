import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeEmailHtml,
  extractUserIdFromToAddress,
  extractTrackingDetails,
  createInboundEmailHandler
} from './inboundEmailHandler.js';

describe('inboundEmailHandler Unit Tests', () => {
  describe('sanitizeEmailHtml', () => {
    it('strips script and style tags and decodes html entities', () => {
      const html = '<style>.test{}</style><p>Your order &amp; tracking: <b>RR123456789IL</b></p><script>alert(1)</script>';
      const clean = sanitizeEmailHtml(html);
      expect(clean).toBe('Your order & tracking: RR123456789IL');
    });

    it('handles non-string inputs safely', () => {
      expect(sanitizeEmailHtml(null)).toBe('');
      expect(sanitizeEmailHtml(undefined)).toBe('');
    });
  });

  describe('extractUserIdFromToAddress', () => {
    it('extracts userId from CloudMailin plus-addressing format', () => {
      expect(extractUserIdFromToAddress('233b362d7b331adfde6e+usr_testuser123@cloudmailin.net')).toBe('testuser123');
      expect(extractUserIdFromToAddress('233b362d7b331adfde6e+user888@cloudmailin.net')).toBe('user888');
    });

    it('extracts userId from usr_ format', () => {
      expect(extractUserIdFromToAddress('usr_abc123@in.deliveree.app')).toBe('abc123');
      expect(extractUserIdFromToAddress('usr_user99_secrettoken@in.deliveree.app')).toBe('user99');
    });

    it('extracts userId from .pkg format', () => {
      expect(extractUserIdFromToAddress('user777.pkg@in.deliveree.app')).toBe('user777');
      expect(extractUserIdFromToAddress('user888.pkg@deliveree.app')).toBe('user888');
    });

    it('returns null on invalid formats', () => {
      expect(extractUserIdFromToAddress('notanemail')).toBeNull();
      expect(extractUserIdFromToAddress('someone@gmail.com')).toBeNull();
    });
  });

  describe('extractTrackingDetails', () => {
    it('identifies Israel Post UPU S10 tracking numbers', () => {
      const details = extractTrackingDetails('Order Shipped: Your item is on the way', 'Tracking number: RR123456789IL');
      expect(details.trackingNumber).toBe('RR123456789IL');
      expect(details.carrier).toBe('israel-post');
    });

    it('identifies DHL express 10 digit numbers', () => {
      const details = extractTrackingDetails('DHL Express Shipment', 'Waybill: 1234567890');
      expect(details.trackingNumber).toBe('1234567890');
      expect(details.carrier).toBe('dhl');
    });

    it('identifies Cainiao / AliExpress tracking', () => {
      const details = extractTrackingDetails('AliExpress Package Sent', 'Your tracking is LP00512345678901');
      expect(details.trackingNumber).toBe('LP00512345678901');
      expect(details.carrier).toBe('cainiao');
    });

    it('returns null tracking when none is found', () => {
      const details = extractTrackingDetails('Welcome to our store', 'Thank you for your business!');
      expect(details.trackingNumber).toBeNull();
    });

    it('does not mistake a phone number for a DHL tracking number when "dhl" is absent', () => {
      // Regression: a bare \d{10} match (Israeli phone numbers are exactly
      // 10 digits) used to fire the DHL pattern for any AliExpress order
      // whose shipping-address block happened to include the recipient's
      // phone number, even though the shipment has nothing to do with DHL.
      const details = extractTrackingDetails(
        'Your AliExpress order has shipped',
        'Recipient: Sahar Aga, Phone: 0501234567, Address: Tel Aviv'
      );
      expect(details.carrier).not.toBe('dhl');
      expect(details.trackingNumber).toBeNull();
    });

    it('does not tag an order as DHL just because DHL is mentioned far from the number', () => {
      const farText = 'x'.repeat(400);
      const details = extractTrackingDetails(
        'AliExpress order confirmation',
        `We ship via DHL, FedEx, or Cainiao depending on availability. ${farText} Order number: 1234567890`
      );
      expect(details.carrier).not.toBe('dhl');
    });
  });

  describe('createInboundEmailHandler', () => {
    const TEST_TOKEN = 'test-token-123';

    it('rejects with 401 Unauthorized when webhookToken is missing or unset (fails closed)', async () => {
      const handlerNoToken = createInboundEmailHandler({ db: null });
      const req = {
        method: 'POST',
        query: { token: 'any-token' },
        body: { to: 'usr_user123@in.deliveree.app' }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handlerNoToken(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });

      const handlerEmptyToken = createInboundEmailHandler({ db: null, webhookToken: '' });
      const resEmpty = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      await handlerEmptyToken(req, resEmpty);
      expect(resEmpty.status).toHaveBeenCalledWith(401);
      expect(resEmpty.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('rejects non-POST requests with 405', async () => {
      const handler = createInboundEmailHandler({ db: null, webhookToken: TEST_TOKEN });
      const req = { method: 'GET', query: { token: TEST_TOKEN } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('rejects missing or invalid user recipient with 400', async () => {
      const handler = createInboundEmailHandler({ db: null, webhookToken: TEST_TOKEN });
      const req = {
        method: 'POST',
        query: { token: TEST_TOKEN },
        body: { to: 'invalid@otherdomain.com', subject: 'Test', text: 'RR123456789IL' }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 200 with ok: false when no tracking number is present', async () => {
      const handler = createInboundEmailHandler({ db: null, webhookToken: TEST_TOKEN });
      const req = {
        method: 'POST',
        query: { token: TEST_TOKEN },
        body: { to: 'usr_user123@in.deliveree.app', subject: 'Newsletter', text: 'No tracking here' }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    });

    it('successfully processes email and writes package to Firestore', async () => {
      const docSetMock = vi.fn().mockResolvedValue(undefined);
      const dbMock = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            set: docSetMock,
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                set: docSetMock
              }))
            }))
          }))
        }))
      };

      const handler = createInboundEmailHandler({ db: dbMock, webhookToken: TEST_TOKEN });
      const req = {
        method: 'POST',
        query: { token: TEST_TOKEN },
        body: {
          to: 'usr_user123@in.deliveree.app',
          subject: 'Fwd: Your AliExpress order has shipped!',
          html: '<p>Package tracking: <b>LP00512345678901</b></p>'
        }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        trackingNumber: 'LP00512345678901',
        carrier: 'cainiao'
      }));
      expect(docSetMock).toHaveBeenCalledTimes(1);
      const [savedDoc] = docSetMock.mock.calls[0];
      expect(savedDoc.userId).toBe('user123');
      expect(savedDoc.trackingNumber).toBe('LP00512345678901');
      expect(savedDoc.carrier).toBe('cainiao');
      expect(savedDoc.source).toBe('email_forwarding');
    });

    it('acknowledges but does not persist a probable candidate', async () => {
      const set = vi.fn();
      const db = { collection: vi.fn(() => ({ doc: vi.fn(() => ({ collection: vi.fn(), set })) })) };
      const handler = createInboundEmailHandler({ db, webhookToken: TEST_TOKEN });
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler({
        method: 'POST',
        query: { token: TEST_TOKEN },
        body: {
          to: 'usr_user123@in.deliveree.app', subject: 'Update', text: '1Z999AA10123456784'
        }
      }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
      expect(set).not.toHaveBeenCalled();
    });

    it('updates existing package when tracking number is already present instead of creating a duplicate', async () => {
      const mergeSetMock = vi.fn().mockResolvedValue();
      const userPackagesDocMock = vi.fn(() => ({
        set: mergeSetMock
      }));
      const globalPackagesDocMock = vi.fn(() => ({
        set: mergeSetMock
      }));

      const existingPackageData = {
        id: 'pkg-existing-1',
        userId: 'user123',
        title: 'Original Title',
        status: 'ordered',
        trackingNumber: 'LP00512345678901'
      };

      const userPackagesColMock = {
        doc: userPackagesDocMock,
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: 'pkg-existing-1', data: () => existingPackageData }]
            })
          }))
        }))
      };

      const dbMock = {
        collection: vi.fn((name) => {
          if (name === 'users') {
            return {
              doc: vi.fn(() => ({
                collection: vi.fn(() => userPackagesColMock)
              }))
            };
          }
          return {
            doc: globalPackagesDocMock
          };
        })
      };

      const handler = createInboundEmailHandler({ db: dbMock, webhookToken: TEST_TOKEN });
      const req = {
        method: 'POST',
        query: { token: TEST_TOKEN },
        body: {
          to: 'usr_user123@in.deliveree.app',
          subject: 'AliExpress - Package LP00512345678901 is ready for pickup',
          html: '<p>Package tracking: <b>LP00512345678901</b>. קוד איסוף: 7788</p>'
        }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        packageId: 'pkg-existing-1',
        updated: true,
        trackingNumber: 'LP00512345678901'
      }));
      expect(mergeSetMock).toHaveBeenCalled();
      const [patchArg, optionsArg] = mergeSetMock.mock.calls[0];
      expect(optionsArg).toEqual({ merge: true });
      expect(patchArg.status).toBe('ready_for_pickup');
      expect(patchArg.lockerPin).toBe('7788');
      expect(patchArg.updatedAt).toBeDefined();
    });

    it('extracts and persists pickup location, hours, phone, and redirect info on inbound email', async () => {
      const docSetMock = vi.fn().mockResolvedValue();
      const userPackagesDocMock = vi.fn(() => ({
        set: docSetMock
      }));
      const globalPackagesDocMock = vi.fn(() => ({
        set: docSetMock
      }));

      const userPackagesColMock = {
        doc: userPackagesDocMock,
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
          }))
        }))
      };

      const dbMock = {
        collection: vi.fn((name) => {
          if (name === 'users') {
            return {
              doc: vi.fn(() => ({
                collection: vi.fn(() => userPackagesColMock)
              }))
            };
          }
          return {
            doc: globalPackagesDocMock
          };
        })
      };

      const handler = createInboundEmailHandler({ db: dbMock, webhookToken: TEST_TOKEN });
      const req = {
        method: 'POST',
        query: { token: TEST_TOKEN },
        body: {
          to: 'usr_user123@in.deliveree.app',
          subject: 'דואר ישראל: חבילתך הועברה לנקודת איסוף חלופית',
          text: 'בשל עומס בלוקר סנטר, חבילתך RR000000005IL הועברה לנקודת איסוף מכולת העיר. קוד איסוף: 9988. שעות פתיחה: א-ה 08:00-20:00. טלפון: 03-6789012.'
        }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(docSetMock).toHaveBeenCalled();
      const [savedDoc] = docSetMock.mock.calls[0];
      expect(savedDoc.trackingNumber).toBe('RR000000005IL');
      expect(savedDoc.pickupLocation).toBe('מכולת העיר');
      expect(savedDoc.lockerPin).toBe('9988');
      expect(savedDoc.pickupHours).toBe('א-ה 08:00-20:00');
      expect(savedDoc.pickupPhone).toBe('03-6789012');
      expect(savedDoc.isRedirected).toBe(true);
      expect(savedDoc.originalPickupLocation).toBe('סנטר');
    });

    it('disaggregates and persists multiple packages from a single inbound email', async () => {
      const docSetMock = vi.fn().mockResolvedValue();
      const userPackagesDocMock = vi.fn(() => ({
        set: docSetMock
      }));
      const globalPackagesDocMock = vi.fn(() => ({
        set: docSetMock
      }));

      const userPackagesColMock = {
        doc: userPackagesDocMock,
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
          }))
        }))
      };

      const dbMock = {
        collection: vi.fn((name) => {
          if (name === 'users') {
            return {
              doc: vi.fn(() => ({
                collection: vi.fn(() => userPackagesColMock)
              }))
            };
          }
          return {
            doc: globalPackagesDocMock
          };
        })
      };

      const handler = createInboundEmailHandler({ db: dbMock, webhookToken: TEST_TOKEN });
      const req = {
        method: 'POST',
        query: { token: TEST_TOKEN },
        body: {
          to: 'usr_user123@in.deliveree.app',
          subject: 'Your Amazon order has shipped in 2 packages',
          text: 'Package 1 tracking: 1Z9999999999999999\nPackage 2 tracking: RR000000005IL'
        }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        packages: expect.arrayContaining([
          expect.objectContaining({ trackingNumber: '1Z9999999999999999', carrier: 'ups' }),
          expect.objectContaining({ trackingNumber: 'RR000000005IL', carrier: 'israel-post' })
        ])
      }));
      // 2 packages * 1 write each (user scoped packages collection only) = 2 doc set calls
      expect(docSetMock).toHaveBeenCalledTimes(2);
    });

    it('rejects with 401 Unauthorized when webhookToken is configured and query token is missing or mismatched', async () => {
      const handler = createInboundEmailHandler({ db: {}, webhookToken: 'secret-token-123' });
      const reqMissing = {
        method: 'POST',
        query: {},
        body: { to: 'usr_user123@in.deliveree.app' }
      };
      const resMissing = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(reqMissing, resMissing);
      expect(resMissing.status).toHaveBeenCalledWith(401);
      expect(resMissing.json).toHaveBeenCalledWith({ error: 'Unauthorized' });

      const reqMismatched = {
        method: 'POST',
        query: { token: 'wrong-token' },
        body: { to: 'usr_user123@in.deliveree.app' }
      };
      const resMismatched = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(reqMismatched, resMismatched);
      expect(resMismatched.status).toHaveBeenCalledWith(401);
      expect(resMismatched.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('accepts the request when webhookToken matches query token', async () => {
      const handler = createInboundEmailHandler({ db: {}, webhookToken: 'secret-token-123' });
      const req = {
        method: 'POST',
        query: { token: 'secret-token-123' },
        body: {
          to: 'usr_testuser@in.deliveree.app',
          text: 'Hello world no tracking number here'
        }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, message: expect.stringContaining('No verified tracking') }));
    });

    describe('webhookToken authentication', () => {
      const secret = 'super-secret-token-12345';

      it('rejects request with 401 when webhookToken is configured and no token is provided', async () => {
        const handler = createInboundEmailHandler({ db: null, webhookToken: secret });
        const req = {
          method: 'POST',
          headers: {},
          query: {},
          body: { to: 'usr_user123@in.deliveree.app', subject: 'Test', text: 'RR123456789IL' }
        };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

        await handler(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('rejects request with 401 when invalid token is provided', async () => {
        const handler = createInboundEmailHandler({ db: null, webhookToken: secret });
        const req = {
          method: 'POST',
          headers: { 'x-webhook-token': 'wrong-token' },
          query: {},
          body: { to: 'usr_user123@in.deliveree.app', subject: 'Test', text: 'RR123456789IL' }
        };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

        await handler(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('authenticates successfully via query param ?token=', async () => {
        const handler = createInboundEmailHandler({ db: null, webhookToken: secret });
        const req = {
          method: 'POST',
          headers: {},
          query: { token: secret },
          body: { to: 'usr_user123@in.deliveree.app', subject: 'Order', text: 'Your Israeli tracking is RR123456789IL' }
        };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

        await handler(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('authenticates successfully via x-webhook-token header', async () => {
        const handler = createInboundEmailHandler({ db: null, webhookToken: secret });
        const req = {
          method: 'POST',
          headers: { 'x-webhook-token': secret },
          query: {},
          body: { to: 'usr_user123@in.deliveree.app', subject: 'Order', text: 'Your Israeli tracking is RR123456789IL' }
        };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

        await handler(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('authenticates successfully via Authorization: Bearer <token>', async () => {
        const handler = createInboundEmailHandler({ db: null, webhookToken: secret });
        const req = {
          method: 'POST',
          headers: { authorization: `Bearer ${secret}` },
          query: {},
          body: { to: 'usr_user123@in.deliveree.app', subject: 'Order', text: 'Your Israeli tracking is RR123456789IL' }
        };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

        await handler(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });
  });
});

