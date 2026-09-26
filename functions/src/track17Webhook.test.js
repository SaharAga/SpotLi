import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  verify17TrackSignature,
  normalize17TrackEvent,
  createTrack17WebhookHandler,
  USER_PAGE_SIZE
} from './track17Webhook.js';

const indexNotReady = () => ({
  where: () => ({ get: async () => { throw Object.assign(new Error('requires an index'), { code: 9 }); } })
});

describe('track17Webhook', () => {
  const secretKey = 'test_secret_key_123';

  describe('verify17TrackSignature', () => {
    it('verifies valid sha256 signature calculated from rawBody + "/" + secretKey', () => {
      const payload = JSON.stringify({ event: 'TRACKING_UPDATED', data: [] });
      const signature = crypto.createHash('sha256').update(`${payload}/${secretKey}`).digest('hex');

      expect(verify17TrackSignature(payload, signature, secretKey)).toBe(true);
    });

    it('rejects tampered body or invalid signature', () => {
      const payload = JSON.stringify({ event: 'TRACKING_UPDATED', data: [] });
      const tampered = JSON.stringify({ event: 'TRACKING_UPDATED', data: [{ number: 'HACKED' }] });
      const signature = crypto.createHash('sha256').update(`${payload}/${secretKey}`).digest('hex');

      expect(verify17TrackSignature(tampered, signature, secretKey)).toBe(false);
      expect(verify17TrackSignature(payload, 'wrong_signature', secretKey)).toBe(false);
    });

    it('returns false when signature or secret is missing', () => {
      expect(verify17TrackSignature('{}', '', secretKey)).toBe(false);
      expect(verify17TrackSignature('{}', 'sig', '')).toBe(false);
    });
  });

  describe('normalize17TrackEvent', () => {
    it('extracts status, checkpoints, and detected carrier accurately', () => {
      const trackInfo = {
        latest_status: { status: 'Delivered' },
        latest_event: { time_iso: '2026-09-17T12:00:00Z' },
        tracking: {
          providers: [
            {
              provider: { key: 101496, name: 'Cheetah Delivery' },
              events: [
                {
                  description: 'Package delivered to recipient',
                  location: 'Tel Aviv',
                  time_iso: '2026-09-17T12:00:00Z'
                }
              ]
            }
          ]
        }
      };

      const res = normalize17TrackEvent('CH10849201', trackInfo);
      expect(res.tracked).toBe(true);
      expect(res.status).toBe('delivered');
      expect(res.detectedCarrier).toBe('chita');
      expect(res.checkpoints).toHaveLength(1);
      expect(res.checkpoints[0].title).toBe('Package delivered to recipient');
    });
  });

  describe('createTrack17WebhookHandler', () => {
    it('rejects non-POST requests with 405', async () => {
      const handler = createTrack17WebhookHandler({ db: {}, track17ApiKey: secretKey });
      const req = { method: 'GET', headers: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        json: vi.fn()
      };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('rejects invalid signature with 401', async () => {
      const handler = createTrack17WebhookHandler({ db: {}, track17ApiKey: secretKey });
      const req = {
        method: 'POST',
        headers: { sign: 'invalid_sig' },
        body: { event: 'TRACKING_UPDATED' },
        rawBody: '{"event":"TRACKING_UPDATED"}'
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('processes valid payload, updates Firestore packages, and returns 200', async () => {
      const payloadObj = {
        event: 'TRACKING_UPDATED',
        data: [
          {
            number: 'CH10849201',
            track_info: {
              latest_status: { status: 'Delivered' },
              tracking: { providers: [{ events: [] }] }
            }
          }
        ]
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = crypto.createHash('sha256').update(`${rawBody}/${secretKey}`).digest('hex');

      const mockSet = vi.fn();
      const mockPkgDoc = {
        data: () => ({
          id: 'pkg-1',
          status: 'in_transit',
          trackingNumber: 'CH10849201'
        }),
        ref: { set: mockSet }
      };

      const mockUserDoc = {
        id: 'u1',
        ref: {
          collection: () => ({
            where: () => ({
              limit: () => ({
                get: async () => ({ docs: [mockPkgDoc] })
              })
            })
          })
        }
      };

      // Index not built yet → falls back to the user walk.
      const mockDb = {
        collectionGroup: indexNotReady,
        collection: () => ({
          limit: () => ({
            get: async () => ({ docs: [mockUserDoc] })
          })
        })
      };

      const handler = createTrack17WebhookHandler({ db: mockDb, track17ApiKey: secretKey });
      const req = {
        method: 'POST',
        headers: { sign: signature },
        body: payloadObj,
        rawBody
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          lastUpdateSource: 'live_tracking'
        }),
        { merge: true }
      );
    });

    it('reaches package holders beyond the first page of users', async () => {
      const payloadObj = {
        data: [{ number: 'CH10849201', track_info: { latest_status: { status: 'Delivered' }, tracking: { providers: [{ events: [] }] } } }]
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = crypto.createHash('sha256').update(`${rawBody}/${secretKey}`).digest('hex');

      const mockSet = vi.fn();
      const users = Array.from({ length: USER_PAGE_SIZE * 2 + 5 }, (_, i) => {
        const holdsPackage = i === USER_PAGE_SIZE * 2 + 3; // on the third page
        return {
          id: `u${i}`,
          ref: {
            collection: () => ({
              where: () => ({
                limit: () => ({
                  get: async () => ({
                    docs: holdsPackage
                      ? [{ data: () => ({ status: 'in_transit', trackingNumber: 'CH10849201' }), ref: { set: mockSet } }]
                      : []
                  })
                })
              })
            })
          }
        };
      });
      const page = (start) => ({
        get: async () => ({ docs: users.slice(start, start + USER_PAGE_SIZE) }),
        startAfter: (doc) => page(users.indexOf(doc) + 1)
      });
      const mockDb = { collectionGroup: indexNotReady, collection: () => ({ limit: () => page(0) }) };

      const handler = createTrack17WebhookHandler({ db: mockDb, track17ApiKey: secretKey });
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      await handler({ method: 'POST', headers: { sign: signature }, body: payloadObj, rawBody }, res);

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ updated: 1 }));
    });

    it('uses one collection-group query when the index is live, without scanning users', async () => {
      const payloadObj = {
        data: [{ number: 'CH10849201', track_info: { latest_status: { status: 'Delivered' }, tracking: { providers: [{ events: [] }] } } }]
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = crypto.createHash('sha256').update(`${rawBody}/${secretKey}`).digest('hex');

      const mockSet = vi.fn();
      const where = vi.fn(() => ({
        get: async () => ({ docs: [{ data: () => ({ status: 'in_transit', trackingNumber: 'CH10849201' }), ref: { set: mockSet } }] })
      }));
      const collection = vi.fn();
      const mockDb = { collectionGroup: vi.fn(() => ({ where })), collection };

      const handler = createTrack17WebhookHandler({ db: mockDb, track17ApiKey: secretKey });
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      await handler({ method: 'POST', headers: { sign: signature }, body: payloadObj, rawBody }, res);

      expect(mockDb.collectionGroup).toHaveBeenCalledWith('packages');
      expect(where).toHaveBeenCalledWith('trackingNumber', '==', 'CH10849201');
      expect(collection).not.toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledTimes(1);
    });
  });
});
