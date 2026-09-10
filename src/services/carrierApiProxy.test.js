import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  inferStageFromText, 
  getCachedTracking, 
  setCachedTracking, 
  fetchLiveCarrierTracking,
  isLiveTrackingSupported,
  LIVE_TRACKING_CARRIERS
} from './carrierApiProxy';
import { CARRIERS, CARRIER_LIST } from '../types/carriers';

describe('carrierApiProxy Service', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    };
    vi.restoreAllMocks();
  });

  describe('inferStageFromText', () => {
    it('infers delivered stage correctly in Hebrew and English', () => {
      expect(inferStageFromText('החבילה נמסרה ליעדה בהצלחה')).toBe('delivered');
      expect(inferStageFromText('Package delivered to front door')).toBe('delivered');
      expect(inferStageFromText('נאסף מהלוקר')).toBe('delivered');
    });

    it('infers out_for_delivery for locker, pickup and collection', () => {
      expect(inferStageFromText('ממתין לאיסוף בנקודת שירות')).toBe('out_for_delivery');
      expect(inferStageFromText('הוכנס ללוקר שופרסל')).toBe('out_for_delivery');
      expect(inferStageFromText('קוד איסוף נשלח ב-SMS')).toBe('out_for_delivery');
      expect(inferStageFromText('Ready for collection at store')).toBe('out_for_delivery');
    });

    it('infers customs and clearance events', () => {
      expect(inferStageFromText('מעוכב לבדיקת מכס')).toBe('customs');
      expect(inferStageFromText('Held by customs authorities')).toBe('customs');
    });

    it('infers out for delivery stage', () => {
      expect(inferStageFromText('השליח יצא לחלוקה')).toBe('out_for_delivery');
      expect(inferStageFromText('Out for delivery today')).toBe('out_for_delivery');
    });

    it('defaults to in_transit for generic events', () => {
      expect(inferStageFromText('הגיע למוקד מיון תל אביב')).toBe('in_transit');
      expect(inferStageFromText('Departed transit hub')).toBe('in_transit');
    });
  });

  describe('2-Hour Caching Mechanism', () => {
    it('stores and retrieves cached tracking within 2-hour window', () => {
      const sample = {
        carrier: 'israel-post',
        status: 'in_transit',
        checkpoints: [{ id: '1', title: 'Test event' }]
      };

      setCachedTracking('RS123456789IL', sample);
      const retrieved = getCachedTracking('RS123456789IL');

      expect(retrieved).not.toBeNull();
      expect(retrieved.carrier).toBe('israel-post');
      expect(retrieved.status).toBe('in_transit');
    });

    it('returns null for non-existent cache keys', () => {
      expect(getCachedTracking('NON_EXISTENT')).toBeNull();
    });
  });

  describe('fetchLiveCarrierTracking', () => {
    it('returns an explicit untracked record for a carrier with no integration', async () => {
      const res = await fetchLiveCarrierTracking('CH10849201', 'chita', true);
      expect(res.carrier).toBe('chita');
      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('carrier-unsupported');
      expect(res.checkpoints).toEqual([]);
      expect(res.status).toBeNull();
      expect(res.estimatedDelivery).toBeNull();
    });

    it('never fabricates checkpoints for any unsupported carrier', async () => {
      const carriers = ['chita', 'hfd', 'boxit', 'dhl', 'fedex', 'ups', 'usps', 'other'];

      for (const carrierId of carriers) {
        const res = await fetchLiveCarrierTracking('XX123456789XX', carrierId, true);
        expect(res.tracked).toBe(false);
        expect(res.checkpoints).toEqual([]);
        expect(res.estimatedDelivery).toBeNull();
      }
    });

    it('serves a supported carrier from cache when a prior lookup succeeded', async () => {
      const cachedData = {
        carrier: 'israel-post',
        tracked: true,
        status: 'out_for_delivery',
        checkpoints: []
      };
      setCachedTracking('RS948219481IL', cachedData);

      const res = await fetchLiveCarrierTracking('RS948219481IL', 'israel-post', false);
      expect(res.isFromCache).toBe(true);
      expect(res.status).toBe('out_for_delivery');
    });

    it('does not cache a failed lookup', async () => {
      await fetchLiveCarrierTracking('RS777777777IL', 'israel-post', true);
      expect(getCachedTracking('RS777777777IL')).toBeNull();
    });

    it('identifies which carriers have a live integration', () => {
      expect(isLiveTrackingSupported('israel-post')).toBe(true);
      expect(isLiveTrackingSupported('gaash')).toBe(true);
      expect(isLiveTrackingSupported('exelot')).toBe(true);
      expect(isLiveTrackingSupported('cainiao')).toBe(true);
      expect(isLiveTrackingSupported('dhl')).toBe(false);
      expect(isLiveTrackingSupported('other')).toBe(false);
    });
  });

  describe('live-tracking capability comes from the carrier table', () => {
    it('treats a carrier as live-trackable exactly when the table gives it a liveTracking config', () => {
      for (const carrier of CARRIER_LIST) {
        expect(isLiveTrackingSupported(carrier.id)).toBe(Boolean(carrier.liveTracking));
      }
    });

    it('keeps LIVE_TRACKING_CARRIERS derived from the table', () => {
      expect([...LIVE_TRACKING_CARRIERS]).toEqual(
        CARRIER_LIST.filter((c) => c.liveTracking).map((c) => c.id)
      );
      expect(LIVE_TRACKING_CARRIERS).toContain('israel-post');
    });

    it('reports unknown carrier ids as unsupported rather than throwing', () => {
      expect(isLiveTrackingSupported('no-such-carrier')).toBe(false);
      expect(isLiveTrackingSupported(undefined)).toBe(false);
    });

    it('gives every live-tracking entry an endpoint builder and a parser', () => {
      for (const carrier of CARRIER_LIST.filter((c) => c.liveTracking)) {
        expect(typeof carrier.liveTracking.endpoint).toBe('function');
        expect(typeof carrier.liveTracking.parse).toBe('function');
        expect(carrier.liveTracking.endpoint('RS948219481IL')).toContain('RS948219481IL');
      }
    });

    it('returns null from a parser when the gateway has nothing, so no data is fabricated', () => {
      const { parse } = CARRIERS['israel-post'].liveTracking;
      expect(parse(null, 'RS948219481IL', { inferStageFromText })).toBeNull();
      expect(parse({}, 'RS948219481IL', { inferStageFromText })).toBeNull();
    });

    it('builds a tracked record from a real gateway payload', () => {
      const { parse } = CARRIERS['israel-post'].liveTracking;
      const record = parse(
        { itemcode: 'RS948219481IL', laststatus: 'נמסר ליעדו', unitname: 'תל אביב' },
        'RS948219481IL',
        { inferStageFromText }
      );
      expect(record.tracked).toBe(true);
      expect(record.carrier).toBe('israel-post');
      expect(record.status).toBe('delivered');
      expect(record.location).toBe('תל אביב');
      expect(record.checkpoints).toHaveLength(1);
    });

    it('builds a full checkpoint timeline when itemhistory is an array of events', () => {
      const { parse } = CARRIERS['israel-post'].liveTracking;
      const record = parse(
        {
          itemcode: 'RS948219481IL',
          laststatus: 'נמסר ליעדו',
          unitname: 'תל אביב',
          itemhistory: [
            { status: 'התקבל למשלוח', unitname: 'ירושלים', date: '2026-08-01T08:00:00Z' },
            { status: 'בדרך', unitname: 'מרכז מיון', date: '2026-08-02T08:00:00Z' },
            { status: 'נמסר ליעדו', unitname: 'תל אביב', date: '2026-08-03T08:00:00Z' }
          ]
        },
        'RS948219481IL',
        { inferStageFromText }
      );
      expect(record.checkpoints).toHaveLength(3);
      expect(record.checkpoints[0].title).toBe('התקבל למשלוח');
      expect(record.checkpoints[0].location).toBe('ירושלים');
      expect(record.checkpoints[2].title).toBe('נמסר ליעדו');
      expect(record.status).toBe('delivered');
    });

    it('falls back to a single laststatus checkpoint when itemhistory is a plain string', () => {
      const { parse } = CARRIERS['israel-post'].liveTracking;
      const record = parse(
        { itemcode: 'RS948219481IL', laststatus: 'בדרך', itemhistory: 'some free text log' },
        'RS948219481IL',
        { inferStageFromText }
      );
      expect(record.checkpoints).toHaveLength(1);
      expect(record.checkpoints[0].title).toBe('בדרך');
      expect(record.checkpoints[0].description).toBe('some free text log');
    });

    it('extracts shelfNumber, pickupDeadline, and customsDetails from israel-post gateway', () => {
      const { parse } = CARRIERS['israel-post'].liveTracking;
      const record = parse(
        {
          itemcode: 'RS948219481IL',
          laststatus: 'ממתין לאיסוף בסוכנות הדואר',
          unitname: 'סוכנות דואר מרכז',
          Madaf: 'ג693',
          PickupDaysLeft: 5,
          CustomsPaymentLink: 'https://mypost.israelpost.co.il/customs/pay?id=123',
          CustomsAmount: 48.5
        },
        'RS948219481IL',
        { inferStageFromText }
      );
      expect(record.shelfNumber).toBe('ג693');
      expect(record.pickupDeadline).toBe('5 days');
      expect(record.customsDetails).toEqual({
        required: true,
        amount: 48.5,
        currency: 'ILS',
        paymentUrl: 'https://mypost.israelpost.co.il/customs/pay?id=123',
        status: 'pending'
      });
    });

    it('parses Exelot liveTracking payload and resolves local carrier handover', () => {
      const { parse } = CARRIERS['exelot'].liveTracking;
      const record = parse(
        {
          data: {
            currentStatus: 'מוכן לאיסוף בלוקר',
            lastMileProvider: 'Buzzr',
            lastMileTrackingNumber: 'BZR9842109',
            current_pudo_name: 'לוקר באזר סוקולוב 12',
            shelfNumber: '412',
            events: [
              { statusDescription: 'מוכן לאיסוף בלוקר', eventDate: '2026-08-04T12:00:00Z' },
              { statusDescription: 'הגיע לנקודת חלוקה', eventDate: '2026-08-04T10:00:00Z' }
            ]
          }
        },
        'XLT124778035',
        { inferStageFromText }
      );
      expect(record.tracked).toBe(true);
      expect(record.carrier).toBe('exelot');
      expect(record.localCarrier).toBe('buzzr');
      expect(record.localTrackingNumber).toBe('BZR9842109');
      expect(record.shelfNumber).toBe('412');
      expect(record.pickupLocation).toBe('לוקר באזר סוקולוב 12');
      expect(record.checkpoints).toHaveLength(2);
      expect(record.status).toBe('out_for_delivery');
    });

    it('parses Cainiao liveTracking payload and resolves destination courier handover', () => {
      const { parse } = CARRIERS['cainiao'].liveTracking;
      const record = parse(
        {
          module: [
            {
              status: 'Arrived at destination country',
              destCountry: 'Israel',
              destCpList: [
                { cpCode: 'POST_IL', mailNo: 'RU0126608087Z' }
              ],
              detailList: [
                { desc: 'Out for delivery in destination country', time: 1722770000000 },
                { desc: 'Arrived in destination country', time: 1722760000000 }
              ]
            }
          ]
        },
        'LP00582910482CN',
        { inferStageFromText }
      );
      expect(record.tracked).toBe(true);
      expect(record.carrier).toBe('cainiao');
      expect(record.localCarrier).toBe('israel-post');
      expect(record.localTrackingNumber).toBe('RU0126608087Z');
      expect(record.checkpoints).toHaveLength(2);
      expect(record.status).toBe('out_for_delivery');
    });

    it('parses GAASH liveTracking payload and resolves customs and local courier handover', () => {
      const { parse } = CARRIERS['gaash'].liveTracking;
      const record = parse(
        {
          Statuses: [
            { StatusDescription: 'החבילה שוחררה מהמכס', StatusDate: '2026-09-07T12:00:00Z', Hub: 'נתב״ג' },
            { StatusDescription: 'החבילה נחתה בישראל', StatusDate: '2026-09-07T08:00:00Z', Hub: 'נתב״ג' }
          ],
          PudoDetails: {
            DeliveryCompany: 'צ\'יטה',
            LastMileTrackingNumber: 'CH123456',
            Madaf: 'A-42',
            Name: 'נקודת מסירה צ\'יטה',
            Address: 'דיזנגוף 50, תל אביב'
          },
          EstimatedDeliveryDate: '2026-09-10'
        },
        'GAA124778035',
        { inferStageFromText }
      );
      expect(record.tracked).toBe(true);
      expect(record.carrier).toBe('gaash');
      expect(record.status).toBe('customs');
      expect(record.localCarrier).toBe('chita');
      expect(record.localTrackingNumber).toBe('CH123456');
      expect(record.shelfNumber).toBe('A-42');
      expect(record.pickupLocation).toBe('נקודת מסירה צ\'יטה, דיזנגוף 50, תל אביב');
      expect(record.checkpoints).toHaveLength(2);
    });
  });
});
