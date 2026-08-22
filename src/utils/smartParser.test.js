import { describe, it, expect } from 'vitest';
import { 
  parseSmartText, 
  extractTrackingCandidates, 
  extractUrlsAndTrackings, 
  extractPickupLocation 
} from './smartParser';

describe('smartParser - extractUrlsAndTrackings', () => {
  it('extracts tracking number and carrier from Israel Post URLs', () => {
    const text1 = 'מעקב אחר חבילה: https://mypost.israelpost.co.il/itemtrace?itemcode=RS948219481IL';
    const res1 = extractUrlsAndTrackings(text1);
    expect(res1).toHaveLength(1);
    expect(res1[0].trackingNumber).toBe('RS948219481IL');
    expect(res1[0].carrierHint).toBe('israel-post');

    const text2 = 'בדוק את החבילה בקישור: https://israelpost.co.il/item/EE123456789IL';
    const res2 = extractUrlsAndTrackings(text2);
    expect(res2).toHaveLength(1);
    expect(res2[0].trackingNumber).toBe('EE123456789IL');
    expect(res2[0].carrierHint).toBe('israel-post');
  });

  it('extracts tracking from HFD / E-Post URLs', () => {
    const text = 'החבילה ממתינה עבורך: https://tracking.hfd.co.il/?t=HFD90481029 למעקב מלא';
    const res = extractUrlsAndTrackings(text);
    expect(res).toHaveLength(1);
    expect(res[0].trackingNumber).toBe('HFD90481029');
    expect(res[0].carrierHint).toBe('hfd');
  });

  it('extracts tracking from Chita Delivery URLs', () => {
    const text = 'צ\'יטה שליחויות: https://chita-il.com/runportal/tracking?b=CH10849201';
    const res = extractUrlsAndTrackings(text);
    expect(res).toHaveLength(1);
    expect(res[0].trackingNumber).toBe('CH10849201');
    expect(res[0].carrierHint).toBe('chita');
  });

  it('extracts tracking from BoxIt URLs', () => {
    const text = 'משלוח בוקסיט מחכה: https://boxit.co.il/b/BOX920194';
    const res = extractUrlsAndTrackings(text);
    expect(res).toHaveLength(1);
    expect(res[0].trackingNumber).toBe('BOX920194');
    expect(res[0].carrierHint).toBe('boxit');
  });

  it('extracts tracking from Tapuz, Cargo, ZigZag, GetPackage, Orian, Flying Cargo URLs', () => {
    expect(extractUrlsAndTrackings('https://tapuzdelivery.co.il/tracking?num=TPZ84920194')[0]).toEqual({
      trackingNumber: 'TPZ84920194',
      carrierHint: 'tapuz'
    });

    expect(extractUrlsAndTrackings('https://cargoexpress.co.il/track?tracknum=CRG9104821')[0]).toEqual({
      trackingNumber: 'CRG9104821',
      carrierHint: 'cargo'
    });

    expect(extractUrlsAndTrackings('https://zigzag24.co.il/track?code=ZZ9482019')[0]).toEqual({
      trackingNumber: 'ZZ9482019',
      carrierHint: 'zigzag'
    });

    expect(extractUrlsAndTrackings('https://getpackage.com/tracking?id=GP94820194')[0]).toEqual({
      trackingNumber: 'GP94820194',
      carrierHint: 'getpackage'
    });

    expect(extractUrlsAndTrackings('https://orian.com/track?num=OR94820194')[0]).toEqual({
      trackingNumber: 'OR94820194',
      carrierHint: 'orian'
    });

    expect(extractUrlsAndTrackings('https://www.flying-cargo.com/tracking?n=FC84920194')[0]).toEqual({
      trackingNumber: 'FC84920194',
      carrierHint: 'flying-cargo'
    });
  });

  it('extracts tracking from Global couriers (AliExpress/Cainiao, 4PX, DHL, FedEx, UPS, USPS, YunExpress, Yanwen, Royal Mail, Aramex)', () => {
    expect(extractUrlsAndTrackings('https://global.cainiao.com/newDetail.htm?mailNoList=LP00582910482CN')[0]).toEqual({
      trackingNumber: 'LP00582910482CN',
      carrierHint: 'cainiao'
    });

    expect(extractUrlsAndTrackings('https://express.4px.com/track/search?keyword=4PX300184920194')[0]).toEqual({
      trackingNumber: '4PX300184920194',
      carrierHint: '4px'
    });

    expect(extractUrlsAndTrackings('https://www.dhl.com/en/express/tracking.html?AWB=4829104821')[0]).toEqual({
      trackingNumber: '4829104821',
      carrierHint: 'dhl'
    });

    expect(extractUrlsAndTrackings('https://www.fedex.com/fedextrack/?trknbr=794820194821')[0]).toEqual({
      trackingNumber: '794820194821',
      carrierHint: 'fedex'
    });

    expect(extractUrlsAndTrackings('https://www.ups.com/track?tracknum=1Z999AA10123456784')[0]).toEqual({
      trackingNumber: '1Z999AA10123456784',
      carrierHint: 'ups'
    });

    expect(extractUrlsAndTrackings('https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000')[0]).toEqual({
      trackingNumber: '9400100000000000000000',
      carrierHint: 'usps'
    });

    expect(extractUrlsAndTrackings('https://www.yuntrack.com/parcelTracking?pNumbers=YT2109849201948201')[0]).toEqual({
      trackingNumber: 'YT2109849201948201',
      carrierHint: 'yunexpress'
    });

    expect(extractUrlsAndTrackings('https://www.yw56.com.cn/tracking?num=UY894729184YP')[0]).toEqual({
      trackingNumber: 'UY894729184YP',
      carrierHint: 'yanwen'
    });

    expect(extractUrlsAndTrackings('https://www.royalmail.com/track-your-item#/tracking-results/RN123456789GB')[0]).toEqual({
      trackingNumber: 'RN123456789GB',
      carrierHint: 'royal-mail'
    });

    expect(extractUrlsAndTrackings('https://www.aramex.com/track/results?ShipmentNumber=3094829104')[0]).toEqual({
      trackingNumber: '3094829104',
      carrierHint: 'aramex'
    });
  });

  it('extracts tracking from generic tracking query parameters on arbitrary domains', () => {
    const text = 'Please check your tracking link: https://somestore.com/order-status?track=RR987654321IL';
    const res = extractUrlsAndTrackings(text);
    expect(res).toHaveLength(1);
    expect(res[0].trackingNumber).toBe('RR987654321IL');
  });

  it('safely handles empty and malformed URLs', () => {
    expect(extractUrlsAndTrackings('')).toEqual([]);
    expect(extractUrlsAndTrackings(null)).toEqual([]);
    expect(extractUrlsAndTrackings('not a url https://')).toEqual([]);
  });
});

describe('smartParser - extractPickupLocation', () => {
  it('extracts Hebrew pickup point snippets', () => {
    expect(extractPickupLocation('החבילה שלך מחכה בלוקר דיזנגוף סנטר קומה 1')).toBe('דיזנגוף סנטר קומה 1');
    expect(extractPickupLocation('איסוף החבילה בנקודת איסוף מכולת העיר ברחוב הרצל 15, תל אביב')).toBe('מכולת העיר ברחוב הרצל 15');
    expect(extractPickupLocation('דבר הדואר הגיע בסניף דואר ראשי חיפה')).toBe('דואר ראשי חיפה');
    expect(extractPickupLocation('נמסר לחלוקה בכתובת שדרות רוטשילד 22 תל אביב')).toBe('שדרות רוטשילד 22 תל אביב');
  });

  it('extracts English pickup point snippets', () => {
    expect(extractPickupLocation('Your parcel is ready at the pickup point Central Hub, open until 8pm.')).toBe('Central Hub');
    expect(extractPickupLocation('Package delivered to locker location Dizengoff Station, code 9921.')).toBe('Dizengoff Station');
  });

  it('returns empty string when no location snippet is found', () => {
    expect(extractPickupLocation('Order has been dispatched')).toBe('');
    expect(extractPickupLocation('')).toBe('');
    expect(extractPickupLocation(null)).toBe('');
  });
});

describe('smartParser - extractTrackingCandidates', () => {
  it('extracts tracking number from explicit Hebrew SMS format', () => {
    const sms = 'שלום, החבילה שלך מחברת עליאקספרס יצאה לדרך. מספר מעקב: LP00582910482CN. לאיסוף היכנס לקישור.';
    const candidates = extractTrackingCandidates(sms);
    expect(candidates).toContain('LP00582910482CN');
  });

  it('extracts tracking from diverse Hebrew SMS phrases', () => {
    expect(extractTrackingCandidates('החבילה שלך מחכה: HFD90481029')).toContain('HFD90481029');
    expect(extractTrackingCandidates('איסוף חבילה: CH10849201')).toContain('CH10849201');
    expect(extractTrackingCandidates('קוד איסוף: BOX920194')).toContain('BOX920194');
    expect(extractTrackingCandidates('מספר משלוח: RS948219481IL')).toContain('RS948219481IL');
    expect(extractTrackingCandidates('מעקב הזמנה: YT2109849201948201')).toContain('YT2109849201948201');
    expect(extractTrackingCandidates('דבר דואר שמספרו RR123456789IL')).toContain('RR123456789IL');
    expect(extractTrackingCandidates('משלוח מספר TPZ84920194')).toContain('TPZ84920194');
    expect(extractTrackingCandidates('מס׳ מעקב: 1Z999AA10123456784')).toContain('1Z999AA10123456784');
    expect(extractTrackingCandidates('חבילתך יצאה במשלוח CRG9104821')).toContain('CRG9104821');
    expect(extractTrackingCandidates('שליח בדרך משלוח ZZ9482019')).toContain('ZZ9482019');
  });

  it('extracts tracking from diverse English email phrases', () => {
    expect(extractTrackingCandidates('Order #: 1Z999AA10123456784')).toContain('1Z999AA10123456784');
    expect(extractTrackingCandidates('Shipment #: 4829104821')).toContain('4829104821');
    expect(extractTrackingCandidates('Waybill: 794820194821')).toContain('794820194821');
    expect(extractTrackingCandidates('AWB: 4PX300184920194')).toContain('4PX300184920194');
    expect(extractTrackingCandidates('Package ID: RN123456789GB')).toContain('RN123456789GB');
  });

  it('extracts tracking number without explicit label if format matches known carrier', () => {
    const raw = 'Delivery update: YT2109849201948201 is currently in transit to Tel Aviv';
    const candidates = extractTrackingCandidates(raw);
    expect(candidates).toContain('YT2109849201948201');
  });

  it('extracts tracking from URL inside text candidates', () => {
    const raw = 'שלום, עקוב אחר החבילה בקישור: https://hfd.co.il/tracking?num=HFD90481029 יום טוב';
    const candidates = extractTrackingCandidates(raw);
    expect(candidates).toContain('HFD90481029');
  });
});

describe('smartParser - parseSmartText', () => {
  it('parses AliExpress confirmation and detects carrier and store', () => {
    const text = 'Hi Sahar, your AliExpress order has been shipped with Cainiao. Tracking: LP00582910482CN';
    const parsed = parseSmartText(text);

    expect(parsed.title).toBe('AliExpress Order');
    expect(parsed.trackingNumber).toBe('LP00582910482CN');
    expect(parsed.carrier).toBe('cainiao');
  });

  it('parses Israel Post registered parcel SMS', () => {
    const text = 'דואר ישראל: חבילה מספר RS948219481IL ממתינה בסניף הדואר הקרוב אליך.';
    const parsed = parseSmartText(text);

    expect(parsed.trackingNumber).toBe('RS948219481IL');
    expect(parsed.carrier).toBe('israel-post');
  });

  it('parses Israel Post URL SMS with pickup location', () => {
    const text = 'שלום, דבר דואר שמספרו RS948219481IL נמסר לחלוקה בסניף דיזנגוף סנטר. למעקב: https://mypost.israelpost.co.il/itemtrace?itemcode=RS948219481IL';
    const parsed = parseSmartText(text);

    expect(parsed.trackingNumber).toBe('RS948219481IL');
    expect(parsed.carrier).toBe('israel-post');
    expect(parsed.pickupLocation).toBe('דיזנגוף סנטר');
  });

  it('parses HFD SMS link with locker location', () => {
    const text = 'שלום! החבילה שלך מ-ASOS מחכה בלוקר שרונה תל אביב. לפרטים: https://tracking.hfd.co.il/?t=HFD90481029';
    const parsed = parseSmartText(text);

    expect(parsed.trackingNumber).toBe('HFD90481029');
    expect(parsed.carrier).toBe('hfd');
    expect(parsed.pickupLocation).toBe('שרונה תל אביב');
    expect(parsed.category).toBe('clothing');
  });

  it('handles empty or malformed inputs safely', () => {
    const parsed = parseSmartText(null);
    expect(parsed.title).toBe('');
    expect(parsed.trackingNumber).toBe('');
    expect(parsed.carrier).toBe('other');
    expect(parsed.pickupLocation).toBe('');
  });
});

