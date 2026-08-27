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
    it('rejects non-POST requests with 405', async () => {
      const handler = createInboundEmailHandler({ db: null });
      const req = { method: 'GET' };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('rejects missing or invalid user recipient with 400', async () => {
      const handler = createInboundEmailHandler({ db: null });
      const req = {
        method: 'POST',
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
      const handler = createInboundEmailHandler({ db: null });
      const req = {
        method: 'POST',
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

      const handler = createInboundEmailHandler({ db: dbMock });
      const req = {
        method: 'POST',
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
      expect(docSetMock).toHaveBeenCalledTimes(2);
      const [savedDoc] = docSetMock.mock.calls[0];
      expect(savedDoc.userId).toBe('user123');
      expect(savedDoc.trackingNumber).toBe('LP00512345678901');
      expect(savedDoc.carrier).toBe('cainiao');
      expect(savedDoc.source).toBe('email_forwarding');
    });

  });
});
