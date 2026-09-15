import { describe, it, expect } from 'vitest';
import { 
  parseSmartText, 
  extractTrackingCandidates, 
  extractUrlsAndTrackings, 
  extractPickupLocation,
  unwrapRedirectUrl,
  extractAllTrackingDetails
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
  it('takes the order number from a Tapuz SMS, not the opaque CRM token in its link', () => {
    // Reported from the live app. Two separate faults in one message: the
    // "נקלטה" veto stopped the order-number scan from ever running, and the
    // CRM link's 36-character session token was accepted as a tracking number
    // because it sat on a carrier domain and contained a digit. The result was
    // a package filed under a token that identifies nothing — and, since the
    // same parcel had arrived by email the day before under 48094292, a second
    // copy of a package the list already held.
    const sms = 'היי Sahar Aga, הזמנתך מס\' 48094292 מSeestarz online, נקלטה בתפוז ותסופק בימים'
      + ' הקרובים. לינק למעקב https://crm.tapuzdelivery.co.il/Cs/client/delivery-status/'
      + 'GQCYRVZLABK9PR8IRVUWHMCXR8A5WNMHUMYP. המשך יום נעים';
    const parsed = parseSmartText(sms);

    expect(parsed.trackingNumber).toBe('48094292');
    expect(parsed.carrier).toBe('tapuz');
    expect(parsed.candidateStatus).toBe('verified');
    // The token must not survive anywhere as a candidate.
    expect((parsed.candidates || []).map((c) => c.value))
      .not.toContain('GQCYRVZLABK9PR8IRVUWHMCXR8A5WNMHUMYP');
  });

  it('still takes a short id from a carrier link path', () => {
    // The guard above is a length bound, not a ban on path ids: a courier that
    // keys its link by the number itself must keep working.
    const parsed = parseSmartText('הזמנתך יצאה למשלוח https://mytapuz.co.il/t/3094829104');
    expect(parsed.trackingNumber).toBe('3094829104');
  });

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

  it('exposes a scored candidate tier without changing the legacy tracking field', () => {
    const parsed = parseSmartText('Tracking: RR000000005IL');
    expect(parsed.trackingNumber).toBe('RR000000005IL');
    expect(parsed.candidateStatus).toBe('verified');
    expect(parsed.candidates[0]).toMatchObject({ id: 'cand_1', value: 'RR000000005IL', status: 'verified' });
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

  it('detects courier rerouting/redirects with original location in SMS text', () => {
    const text = 'שלום! עקב עומס בלוקר, החבילה מס׳ HFD90481029 הועברה לנקודת איסוף סופר פארם דיזנגוף 50 (במקום לוקר כיכר רבין). קוד איסוף: 4892';
    const parsed = parseSmartText(text);

    expect(parsed.trackingNumber).toBe('HFD90481029');
    expect(parsed.isRedirected).toBe(true);
    expect(parsed.pickupLocation).toBe('סופר פארם דיזנגוף 50');
    expect(parsed.originalPickupLocation).toBe('לוקר כיכר רבין');
    expect(parsed.lockerPin).toBe('4892');
  });

  it('detects English courier reroute notices', () => {
    const text = 'Due to locker capacity, shipment RR948219483IL was redirected to pickup point Super Yuda Ben Yehuda 45 instead of Dizengoff Locker. PIN: 9912';
    const parsed = parseSmartText(text);

    expect(parsed.isRedirected).toBe(true);
    expect(parsed.pickupLocation).toBe('Super Yuda Ben Yehuda 45');
    expect(parsed.originalPickupLocation).toBe('Dizengoff Locker');
    expect(parsed.lockerPin).toBe('9912');
  });

  it('extracts Israeli store phone number from pickup notice text', () => {
    const text = 'החבילה מחכה בסניף סופר יודה בן יהודה 45. לבירורים טלפון: 03-5123456. שעות פעילות: 08:00-22:00';
    const parsed = parseSmartText(text);

    expect(parsed.pickupLocation).toBe('סופר יודה בן יהודה 45');
    expect(parsed.pickupPhone).toBe('03-5123456');
  });

  it('classifies ASOS HFD SMS as verified candidate and extracts all fields', () => {
    const text = 'שלום! החבילה שלך מ-ASOS (מס׳ HFD90481029) הגיעה ומחכה לך בסניף סופר יודה בן יהודה 45 תל אביב.\nקוד לאיסוף: 4892. שעות פתיחה: 08:00 - 22:00. לבירורים טלפון: 03-5123456.';
    const parsed = parseSmartText(text);

    expect(parsed.trackingNumber).toBe('HFD90481029');
    expect(parsed.carrier).toBe('hfd');
    expect(parsed.candidateStatus).toBe('verified');
    expect(parsed.pickupLocation).toBe('סופר יודה בן יהודה 45 תל אביב');
    expect(parsed.lockerPin).toBe('4892');
    expect(parsed.pickupPhone).toBe('03-5123456');
  });

  describe('ESP redirect unwrapping and Schema.org structured data in Smart Parser', () => {
    it('unwraps SendGrid and Klaviyo redirect URLs directly', () => {
      const sg = 'https://ct.sendgrid.net/ls/click?upn=abc123xyz&url=https%3A%2F%2Fwww.ups.com%2Ftrack%3Ftracknum%3D1Z9999999999999999';
      expect(unwrapRedirectUrl(sg)).toBe('https://www.ups.com/track?tracknum=1Z9999999999999999');

      const klaviyo = 'https://trk.klaviyo.com/mpss/c/4AA/xyz123?dest=https%3A%2F%2Ftracking.hfd.co.il%2F%3Ft%3DHFD90481029';
      expect(unwrapRedirectUrl(klaviyo)).toBe('https://tracking.hfd.co.il/?t=HFD90481029');
    });

    it('extracts carrier and tracking from SendGrid redirect URL in extractUrlsAndTrackings', () => {
      const text = 'Track your package: https://ct.sendgrid.net/ls/click?upn=xyz&url=https%3A%2F%2Fwww.ups.com%2Ftrack%3Ftracknum%3D1Z9999999999999999';
      const res = extractUrlsAndTrackings(text);
      expect(res).toHaveLength(1);
      expect(res[0].trackingNumber).toBe('1Z9999999999999999');
      expect(res[0].carrierHint).toBe('ups');
    });

    it('extracts tracking candidate from HTML anchor with redirect URL', () => {
      const html = '<a href="https://trk.klaviyo.com/mpss/c/4AA/xyz?dest=https%3A%2F%2Ftracking.hfd.co.il%2F%3Ft%3DHFD90481029">View Status</a>';
      const candidates = extractTrackingCandidates(html);
      expect(candidates).toContain('HFD90481029');
    });

    it('extracts tracking candidate from Schema.org JSON-LD in pasted HTML', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "ParcelDelivery",
          "trackingNumber": "1Z9999999999999999",
          "carrier": "UPS"
        }
        </script>
      `;
      const candidates = extractTrackingCandidates(html);
      expect(candidates).toContain('1Z9999999999999999');
    });
  });

  describe('extractAllTrackingDetails disaggregation in Smart Parser', () => {
    it('disaggregates multiple verified tracking numbers from pasted email text', () => {
      const text = 'Your Amazon order has shipped in 2 packages:\nPackage 1: 1Z9999999999999999 via UPS\nPackage 2: RR000000005IL via Israel Post';
      const pkgs = extractAllTrackingDetails(text);
      expect(pkgs).toHaveLength(2);
      expect(pkgs[0].trackingNumber).toBe('1Z9999999999999999');
      expect(pkgs[0].carrier).toBe('ups');
      expect(pkgs[1].trackingNumber).toBe('RR000000005IL');
      expect(pkgs[1].carrier).toBe('israel-post');
    });

    it('returns single package for single tracking text', () => {
      const text = 'Tracking: 1Z9999999999999999 via UPS';
      const pkgs = extractAllTrackingDetails(text);
      expect(pkgs).toHaveLength(1);
      expect(pkgs[0].trackingNumber).toBe('1Z9999999999999999');
    });

    it('extracts specific item name and order number from pasted order confirmation text', () => {
      const text = 'AliExpress Order #818274917401\nYour order for "Keychron K2 Keyboard" has shipped!\nTracking: LP00582910482CN';
      const res = parseSmartText(text);
      expect(res.trackingNumber).toBe('LP00582910482CN');
      expect(res.title).toBe('AliExpress - Keychron K2 Keyboard');
      expect(res.orderNumber).toBe('818274917401');
    });

    it('extracts Hebrew item name from label text', () => {
      const text = 'ההזמנה שלך מאליאקספרס מספר הזמנה: 9988776655\nמוצר: אוזניות בלוטוס אלחוטיות\nמספר מעקב: RU0126608087Z';
      const res = parseSmartText(text);
      expect(res.trackingNumber).toBe('RU0126608087Z');
      expect(res.title).toContain('אוזניות בלוטוס אלחוטיות');
      expect(res.orderNumber).toBe('9988776655');
    });
  });
});

