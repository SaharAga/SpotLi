import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  inferStageFrom17Track,
  registerWith17Track,
  query17TrackApi,
  createCarrierTrackingHandler
} from './carrierProxy.js';

describe('carrierProxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('inferStageFrom17Track', () => {
    it('infers stages accurately from 17TRACK status codes', () => {
      expect(inferStageFrom17Track('Delivered')).toBe('delivered');
      expect(inferStageFrom17Track('OutForDelivery')).toBe('out_for_delivery');
      expect(inferStageFrom17Track('AvailableForPickup')).toBe('out_for_delivery');
      expect(inferStageFrom17Track('Customs')).toBe('customs');
      expect(inferStageFrom17Track('InTransit')).toBe('in_transit');
      expect(inferStageFrom17Track('InfoReceived')).toBe('ordered');
      expect(inferStageFrom17Track('NotFound')).toBe('ordered');
      expect(inferStageFrom17Track('Alert')).toBe('exception');
      expect(inferStageFrom17Track('Returned')).toBe('returned_to_sender');
      expect(inferStageFrom17Track('UnknownStatus')).toBe('in_transit');
    });
  });

  describe('registerWith17Track', () => {
    it('returns true when registration is accepted', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: { accepted: [{ number: 'TEST1234' }] }
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await registerWith17Track('TEST1234', 9061, 'valid_key');
      expect(res).toBe(true);

      vi.unstubAllGlobals();
    });

    it('returns false when registration fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await registerWith17Track('TEST1234', 9061, 'valid_key');
      expect(res).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe('query17TrackApi', () => {
    it('returns api-key-required when apiKey is not provided', async () => {
      const res = await query17TrackApi('RS123456789IL', 'israel-post', '');
      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('api-key-required');
      expect(res.message).toContain('17TRACK API key is not configured');
    });

    it('parses valid 17TRACK payload when apiKey is present', async () => {
      const mockPayload = {
        code: 0,
        data: {
          accepted: [
            {
              number: 'RS123456789IL',
              track_info: {
                latest_status: { status: 'Delivered' },
                time_metrics: {
                  estimated_delivery_date: { from: '2026-09-07T14:00:00Z' }
                },
                tracking: {
                  providers: [
                    {
                      events: [
                        {
                          description: 'Delivered to recipient',
                          location: 'Tel Aviv',
                          time_iso: '2026-09-07T14:00:00Z'
                        }
                      ]
                    }
                  ]
                }
              }
            }
          ]
        }
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPayload
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await query17TrackApi('RS123456789IL', 'israel-post', 'valid_test_key');
      expect(res.tracked).toBe(true);
      expect(res.status).toBe('delivered');
      expect(res.checkpoints).toHaveLength(1);
      expect(res.checkpoints[0].title).toBe('Delivered to recipient');
      expect(res.estimatedDelivery).toBe('2026-09-07T14:00:00Z');

      vi.unstubAllGlobals();
    });

    it('automatically registers and re-queries if tracking number was not registered (-18019902)', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation((url) => {
        callCount++;
        if (url.includes('/gettrackinfo') && callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              code: 0,
              data: {
                accepted: [],
                rejected: [
                  {
                    number: 'RS999999999IL',
                    error: { code: -18019902, message: 'not registered' }
                  }
                ]
              }
            })
          });
        }
        if (url.includes('/register')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              code: 0,
              data: { accepted: [{ number: 'RS999999999IL' }] }
            })
          });
        }
        if (url.includes('/gettrackinfo') && callCount === 3) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              code: 0,
              data: {
                accepted: [
                  {
                    number: 'RS999999999IL',
                    track_info: {
                      latest_status: { status: 'InTransit' },
                      tracking: { providers: [{ events: [] }] }
                    }
                  }
                ]
              }
            })
          });
        }
        return Promise.reject(new Error(`Unexpected call to ${url}`));
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await query17TrackApi('RS999999999IL', 'israel-post', 'valid_test_key');
      expect(res.tracked).toBe(true);
      expect(res.status).toBe('in_transit');
      expect(callCount).toBe(3);

      vi.unstubAllGlobals();
    });

    it('handles HTTP error gracefully without throwing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await query17TrackApi('RS123456789IL', 'israel-post', 'valid_test_key');
      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('upstream-17track-http-429');

      vi.unstubAllGlobals();
    });
  });

  describe('createCarrierTrackingHandler', () => {
    it('throws unauthenticated when request.auth is missing', async () => {
      const handler = createCarrierTrackingHandler({ db: {} });
      await expect(handler({ auth: null, data: {} })).rejects.toThrow();
    });

    it('routes GAASH tracking to fetchGaashTracking directly at $0 cost', async () => {
      const handler = createCarrierTrackingHandler({ db: {} });

      const mockFetch = vi.fn().mockImplementation((url) => {
        if (url.toString() === 'https://gaashwd.com') {
          return Promise.resolve({
            ok: true,
            text: async () => '<html><script>var parcelStatusTrackerData = {"nonce":"mock123"};</script></html>'
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Statuses: [{ StatusDescription: 'במרכז מיון געש', StatusDate: '2026-09-07T10:00:00Z' }],
            PudoDetails: { Name: 'מוקד לוד' }
          })
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await handler({
        auth: { uid: 'user123' },
        data: { trackingNumber: 'GAA123456789', carrierId: 'gaash' }
      });

      expect(res.tracked).toBe(true);
      expect(res.carrier).toBe('gaash');
      expect(res.status).toBe('in_transit');

      vi.unstubAllGlobals();
    });

    it('returns honest api-key-required when 17TRACK key is not set', async () => {
      const handler = createCarrierTrackingHandler({ db: {}, track17ApiKey: '' });
      const res = await handler({
        auth: { uid: 'user123' },
        data: { trackingNumber: 'RR123456789IL', carrierId: 'israel-post' }
      });

      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('api-key-required');
    });
  });
});
