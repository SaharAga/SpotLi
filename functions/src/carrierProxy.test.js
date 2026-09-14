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

    /**
     * Sending a number with no carrier code is how 17TRACK is asked to work
     * out the carrier itself — the only route open to the twelve Israeli
     * couriers absent from TRACK17_CARRIER_MAP. Its answer used to be thrown
     * away here: the response echoed back `carrier: carrierId`, whatever the
     * client had guessed going in, so a package stayed filed under a carrier
     * the number's shape had merely suggested.
     */
    it('reports the carrier 17TRACK identified, mapped to our id when we have one', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            accepted: [
              {
                number: '1234567890',
                track_info: {
                  latest_status: { status: 'InTransit' },
                  tracking: {
                    providers: [
                      { provider: { key: 100003, name: 'FedEx' }, events: [] }
                    ]
                  }
                }
              }
            ]
          }
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await query17TrackApi('1234567890', 'other', 'valid_test_key');
      expect(res.detectedCarrier).toBe('fedex');
      expect(res.detectedCarrierName).toBe('FedEx');
      // `carrier` still reports what was asked about, so the two claims stay
      // distinguishable: one is the client's belief, the other the network's.
      expect(res.carrier).toBe('other');

      vi.unstubAllGlobals();
    });

    it('keeps the reported name when the detected carrier has no id on our side', async () => {
      // Tapuz and most of the Israeli last mile are not in the catalogue map.
      // A name with no id is still worth surfacing; inventing an id is not.
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            accepted: [
              {
                number: '7989423526',
                track_info: {
                  latest_status: { status: 'Delivered' },
                  tracking: {
                    providers: [
                      { provider: { key: 100999, name: 'Tapuz Delivery' }, events: [] }
                    ]
                  }
                }
              }
            ]
          }
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await query17TrackApi('7989423526', 'other', 'valid_test_key');
      expect(res.detectedCarrier).toBeNull();
      expect(res.detectedCarrierName).toBe('Tapuz Delivery');

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

    it('rejects with resource-exhausted when daily carrier tracking limit is reached', async () => {
      const mockDb = {
        collection: () => ({ doc: () => ({}) }),
        runTransaction: async (fn) => fn({
          get: async () => ({ exists: true, data: () => ({ count: 50 }) }),
          set: () => {}
        })
      };

      const handler = createCarrierTrackingHandler({ db: mockDb, track17ApiKey: 'test-key' });
      await expect(handler({
        auth: { uid: 'spammer_user' },
        data: { trackingNumber: 'RR123456789IL', carrierId: 'israel-post' }
      })).rejects.toThrow(/limit reached/i);
    });
  });
});
