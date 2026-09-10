import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  inferGaashStage,
  mapGaashDistributor,
  getGaashNonce,
  fetchGaashTracking,
  _resetNonceCacheForTesting
} from './gaashAdapter.js';

describe('gaashAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetNonceCacheForTesting();
  });

  describe('inferGaashStage', () => {
    it('infers delivered status', () => {
      expect(inferGaashStage('החבילה נמסרה ליעדה')).toBe('delivered');
      expect(inferGaashStage('Package delivered to recipient')).toBe('delivered');
      expect(inferGaashStage('נאסף מהלוקר')).toBe('delivered');
    });

    it('infers out_for_delivery status', () => {
      expect(inferGaashStage('המשלוח מוכן לאיסוף בנקודה')).toBe('out_for_delivery');
      expect(inferGaashStage('Out for delivery with courier')).toBe('out_for_delivery');
      expect(inferGaashStage('הוכנס ללוקר')).toBe('out_for_delivery');
    });

    it('infers customs status', () => {
      expect(inferGaashStage('מעוכב במכס נתבג')).toBe('customs');
      expect(inferGaashStage('Customs clearance in progress')).toBe('customs');
    });

    it('infers in_transit and shipped', () => {
      expect(inferGaashStage('החבילה בדרך לישראל')).toBe('in_transit');
      expect(inferGaashStage('המשלוח נקלט במרכז המיון')).toBe('shipped');
      expect(inferGaashStage('Unknown status text')).toBe('in_transit');
    });
  });

  describe('mapGaashDistributor', () => {
    it('maps domestic distributor names accurately', () => {
      expect(mapGaashDistributor('צ\'יטה שליחויות')).toBe('chita');
      expect(mapGaashDistributor('Cheetah Delivery')).toBe('chita');
      expect(mapGaashDistributor('בר הפצה')).toBe('bar-distribution');
      expect(mapGaashDistributor('Bar Express')).toBe('bar-distribution');
      expect(mapGaashDistributor('דואר ישראל')).toBe('israel-post');
      expect(mapGaashDistributor('איפוסט HFD')).toBe('hfd');
      expect(mapGaashDistributor('Buzzr באזר')).toBe('buzzr');
      expect(mapGaashDistributor('חברת שליחויות לא מוכרת')).toBeNull();
    });
  });

  describe('getGaashNonce', () => {
    it('extracts public nonce from homepage HTML and caches it', async () => {
      const mockHtml = `
        <html>
          <script>
            var parcelStatusTrackerData = {"apiUrl":"https://gaashwd.com/wp-json","nonce":"abc123nonce"};
          </script>
        </html>
      `;
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml
      });
      vi.stubGlobal('fetch', mockFetch);

      const nonce1 = await getGaashNonce(true);
      expect(nonce1).toBe('abc123nonce');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Subsequent call should use memory cache without network fetch
      const nonce2 = await getGaashNonce(false);
      expect(nonce2).toBe('abc123nonce');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });

    it('throws error if HTML does not contain nonce', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html><body>No nonce here</body></html>'
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(getGaashNonce(true)).rejects.toThrow('GAASH nonce not found');
      vi.unstubAllGlobals();
    });
  });

  describe('fetchGaashTracking', () => {
    it('returns error record for empty tracking number', async () => {
      const res = await fetchGaashTracking('');
      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('invalid-tracking-number');
    });

    it('parses valid GAASH tracking payload with checkpoints and PUDO details', async () => {
      const mockHomepage = '<html><script>var parcelStatusTrackerData = {"nonce":"mockNonce123"};</script></html>';
      const mockApiPayload = {
        TrackingNumber: 'GAA948210948',
        HAWB: 'AWB998877',
        EstimatedDeliveryDate: '2026-09-10T12:00:00Z',
        Statuses: [
          {
            StatusDescription: 'מוכן לאיסוף בנקודת החלוקה',
            Location: 'סופר פארם הרצליה',
            StatusDate: '2026-09-07T10:30:00Z'
          },
          {
            StatusDescription: 'שוחרר ממכס נתבג',
            Location: 'נתבג',
            StatusDate: '2026-09-06T14:00:00Z'
          }
        ],
        PudoDetails: {
          Name: 'סופר פארם שבעת הכוכבים',
          Address: 'שדרות שבעת הכוכבים 8, הרצליה',
          City: 'הרצליה',
          DeliveryCompany: 'צ\'יטה',
          LastMileTrackingNumber: 'CH99881122',
          Madaf: 'ג-49',
          OpeningHours: 'א-ה: 08:00-22:00, ו: 08:00-14:00'
        }
      };

      const mockFetch = vi.fn().mockImplementation((url) => {
        if (url.toString() === 'https://gaashwd.com') {
          return Promise.resolve({
            ok: true,
            text: async () => mockHomepage
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockApiPayload
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await fetchGaashTracking('GAA948210948');

      expect(res.tracked).toBe(true);
      expect(res.carrier).toBe('gaash');
      expect(res.status).toBe('out_for_delivery');
      expect(res.checkpoints).toHaveLength(2);
      expect(res.checkpoints[0].title).toBe('מוכן לאיסוף בנקודת החלוקה');
      expect(res.localCarrier).toBe('chita');
      expect(res.localTrackingNumber).toBe('CH99881122');
      expect(res.shelfNumber).toBe('ג-49');
      expect(res.pickupLocation).toBe('סופר פארם שבעת הכוכבים, שדרות שבעת הכוכבים 8, הרצליה');
      expect(res.pickupHours).toBe('א-ה: 08:00-22:00, ו: 08:00-14:00');

      vi.unstubAllGlobals();
    });

    it('handles empty Statuses gracefully as untracked', async () => {
      const mockHomepage = '<html><script>var parcelStatusTrackerData = {"nonce":"mockNonce123"};</script></html>';
      const mockFetch = vi.fn().mockImplementation((url) => {
        if (url.toString() === 'https://gaashwd.com') {
          return Promise.resolve({ ok: true, text: async () => mockHomepage });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ Statuses: null, PudoDetails: null })
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await fetchGaashTracking('GAA000000000');
      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('no-checkpoints');

      vi.unstubAllGlobals();
    });

    it('refreshes nonce on HTTP 401 and retries query', async () => {
      const mockHomepage1 = '<html><script>var parcelStatusTrackerData = {"nonce":"staleNonce"};</script></html>';
      const mockHomepage2 = '<html><script>var parcelStatusTrackerData = {"nonce":"freshNonce"};</script></html>';
      let homepageCalls = 0;
      let apiCalls = 0;

      const mockFetch = vi.fn().mockImplementation((url, opts) => {
        if (url.toString() === 'https://gaashwd.com') {
          homepageCalls++;
          return Promise.resolve({
            ok: true,
            text: async () => (homepageCalls === 1 ? mockHomepage1 : mockHomepage2)
          });
        }
        apiCalls++;
        if (opts.headers['X-WP-Nonce'] === 'staleNonce') {
          return Promise.resolve({ status: 401, ok: false });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Statuses: [{ StatusDescription: 'נמסר בהצלחה', StatusDate: '2026-09-07T12:00:00Z' }]
          })
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await fetchGaashTracking('GAA111222333');
      expect(res.tracked).toBe(true);
      expect(res.status).toBe('delivered');
      expect(homepageCalls).toBe(2);
      expect(apiCalls).toBe(2);

      vi.unstubAllGlobals();
    });
  });
});
