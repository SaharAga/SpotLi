import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  inferStageFromText, 
  getCachedTracking, 
  setCachedTracking, 
  fetchLiveCarrierTracking,
  isLiveTrackingConfirmed,
  hasDirectCarrierAdapter,
  untrackedReasonKey,
  UNTRACKED_REASONS,
  LIVE_TRACKING_CARRIERS,
  proxyFailureReason
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
    it('attempts a carrier with no local adapter instead of pre-judging it', async () => {
      // Chita has no liveTracking block, which used to mean the lookup was
      // refused outright and reported as 'carrier-unsupported' without the
      // Cloud Function — the side holding the 17TRACK key — ever being asked.
      // It now goes down the lookup path like any other carrier; what comes
      // back is whatever the attempt yields.
      const res = await fetchLiveCarrierTracking('CH10849201', 'chita', true);
      expect(res.carrier).toBe('chita');
      expect(res.reason).not.toBe('carrier-unsupported');

      // Still the property that matters: an attempt that yields nothing must
      // leave a package looking untracked, never plausibly in transit.
      expect(res.tracked).toBe(false);
      expect(res.checkpoints).toEqual([]);
      expect(res.status).toBeNull();
      expect(res.estimatedDelivery).toBeNull();
    });

    it('never fabricates checkpoints for any carrier the lookup cannot resolve', async () => {
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

    it('counts both a local adapter and a 17TRACK catalogue id as confirmed', () => {
      // Local adapters.
      expect(isLiveTrackingConfirmed('israel-post')).toBe(true);
      expect(isLiveTrackingConfirmed('gaash')).toBe(true);
      expect(isLiveTrackingConfirmed('exelot')).toBe(true);
      expect(isLiveTrackingConfirmed('cainiao')).toBe(true);
      // Mapped in the proxy's 17TRACK catalogue, so the UI may promise it even
      // with no client-side adapter. This read false before, which is why the
      // detail screen told users DHL had no live tracking.
      expect(isLiveTrackingConfirmed('dhl')).toBe(true);
      expect(isLiveTrackingConfirmed('fedex')).toBe(true);
      // Neither: still attempted via auto-detect, but nothing is promised.
      expect(isLiveTrackingConfirmed('chita')).toBe(false);
      expect(isLiveTrackingConfirmed('other')).toBe(false);
    });
  });

  describe('live-tracking capability comes from the carrier table', () => {
    it('reports a direct client adapter exactly when the table gives it a liveTracking config', () => {
      // hasDirectCarrierAdapter governs only the direct-from-browser fallback.
      // It is deliberately no longer the same question as "can this be
      // tracked", which is what conflating the two cost twelve Israeli
      // couriers.
      for (const carrier of CARRIER_LIST) {
        expect(hasDirectCarrierAdapter(carrier.id)).toBe(Boolean(carrier.liveTracking));
      }
    });

    it('keeps LIVE_TRACKING_CARRIERS derived from the table', () => {
      expect([...LIVE_TRACKING_CARRIERS]).toEqual(
        CARRIER_LIST.filter((c) => c.liveTracking).map((c) => c.id)
      );
      expect(LIVE_TRACKING_CARRIERS).toContain('israel-post');
    });

    it('reports unknown carrier ids as unconfirmed rather than throwing', () => {
      expect(isLiveTrackingConfirmed('no-such-carrier')).toBe(false);
      expect(isLiveTrackingConfirmed(undefined)).toBe(false);
      expect(hasDirectCarrierAdapter('no-such-carrier')).toBe(false);
      expect(hasDirectCarrierAdapter(undefined)).toBe(false);
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
  describe('untrackedReasonKey', () => {
    // Reported from a real Tapuz parcel: an 8-digit number with no catalogue
    // code went up in 17TRACK's auto-detect mode and came back `not-found`.
    // The UI called that "live tracking isn't available for Tapuz Delivery
    // yet" — a claim about the carrier, from an answer about the shipment.
    it('reports a shipment 17TRACK has no record of as "nothing yet"', () => {
      expect(untrackedReasonKey('not-found')).toBe('tracking.notFound');
    });

    it("treats GAASH's empty-status answer as the same 'nothing yet'", () => {
      expect(untrackedReasonKey('no-checkpoints')).toBe('tracking.notFound');
    });

    it('reserves the carrier-has-no-feed message for that reason alone', () => {
      expect(untrackedReasonKey(UNTRACKED_REASONS.UNSUPPORTED)).toBe('tracking.notSupported');
    });

    it('reports a failed lookup as unreachable, not as an unsupported carrier', () => {
      for (const reason of [
        UNTRACKED_REASONS.UNAVAILABLE,
        'upstream-error',
        'upstream-17track-http-503',
        'nonce-fetch-failed',
        'invalid-tracking-number',
        'missing-tracking-number'
      ]) {
        expect(untrackedReasonKey(reason)).toBe('tracking.carrierUnavailable');
      }
    });

    /**
     * The three causes a user can act on, each of which used to be
     * indistinguishable from a network outage.
     *
     * "Tapuz tracking is unreachable" was shown for a server with no API key,
     * for an exhausted daily quota, and for a genuine outage alike — so the
     * message was unactionable for the user and the evidence was gone before
     * anyone could diagnose it.
     */
    it('names the causes a user can do something about', () => {
      expect(untrackedReasonKey('api-key-required')).toBe('tracking.notConfigured');
      expect(untrackedReasonKey(UNTRACKED_REASONS.RATE_LIMITED)).toBe('tracking.rateLimited');
      expect(untrackedReasonKey(UNTRACKED_REASONS.NOT_SIGNED_IN)).toBe('tracking.notSignedIn');
    });

    it('maps a callable failure to a reason, or to none when it cannot tell', () => {
      // Claiming a specific cause we do not have is worse than admitting
      // ignorance, so anything unrecognised stays null and falls back to
      // "could not check".
      expect(proxyFailureReason({ code: 'functions/resource-exhausted' })).toBe(UNTRACKED_REASONS.RATE_LIMITED);
      expect(proxyFailureReason({ code: 'functions/unauthenticated' })).toBe(UNTRACKED_REASONS.NOT_SIGNED_IN);
      expect(proxyFailureReason({ code: 'functions/internal' })).toBeNull();
      expect(proxyFailureReason(new Error('boom'))).toBeNull();
      expect(proxyFailureReason(null)).toBeNull();
    });

    // An unknown reason must not be reported as a fact about the carrier: we
    // would be asserting something we did not learn.
    it('falls back to unreachable for an unrecognised or absent reason', () => {
      expect(untrackedReasonKey('something-new-from-upstream')).toBe('tracking.carrierUnavailable');
      expect(untrackedReasonKey(undefined)).toBe('tracking.carrierUnavailable');
      expect(untrackedReasonKey(null)).toBe('tracking.carrierUnavailable');
    });

    it('never returns a key the UI cannot render', async () => {
      const { translations } = await import('../i18n/translations');
      const keys = ['not-found', 'no-checkpoints', UNTRACKED_REASONS.UNSUPPORTED, 'upstream-error', 'whatever']
        .map(untrackedReasonKey);
      for (const key of new Set(keys)) {
        const leaf = key.split('.').slice(1).join('.');
        for (const lang of ['en', 'he']) {
          expect(translations[lang].tracking[leaf]).toBeTruthy();
          expect(translations[lang].tracking[leaf]).toContain('{carrier}');
        }
      }
    });
  });
});
