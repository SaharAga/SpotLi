import { describe, it, expect } from 'vitest';
import {
  sanitizeEmailHtml,
  isFalsePositive,
  detectStore,
  extractTrackingDetails,
  inferDeliveryStatus,
  generateCleanTitle
} from './trackingExtraction.js';

describe('inferDeliveryStatus', () => {
  it('infers ready_for_pickup correctly from English and Hebrew phrases', () => {
    expect(inferDeliveryStatus('AliExpress - Package EP903057886 is ready for pickup', '')).toBe('ready_for_pickup');
    expect(inferDeliveryStatus('חבילתך ממתינה לאיסוף בלוקר אי-פוסט', '')).toBe('ready_for_pickup');
    expect(inferDeliveryStatus('Your package is available for collection', '')).toBe('ready_for_pickup');
    expect(inferDeliveryStatus('החבילה מוכנה לאיסוף בנקודת חלוקה', '')).toBe('ready_for_pickup');
  });

  it('infers out_for_delivery correctly', () => {
    expect(inferDeliveryStatus('Your package is out for delivery today', '')).toBe('out_for_delivery');
    expect(inferDeliveryStatus('השליח בדרך אליך עם החבילה', '')).toBe('out_for_delivery');
  });

  it('infers delivered correctly', () => {
    expect(inferDeliveryStatus('Your package has been delivered', '')).toBe('delivered');
    expect(inferDeliveryStatus('החבילה נמסרה בהצלחה ליעד', '')).toBe('delivered');
  });

  it('infers exception correctly', () => {
    expect(inferDeliveryStatus('AliExpress - Delivery issue for your package', '')).toBe('exception');
    expect(inferDeliveryStatus('עיכוב במכס עבור משלוח', '')).toBe('exception');
  });

  it('infers in_transit correctly', () => {
    expect(inferDeliveryStatus('Your package has shipped and is on its way', '')).toBe('in_transit');
    expect(inferDeliveryStatus('ההזמנה שלך בדרך', '')).toBe('in_transit');
  });
});

describe('generateCleanTitle', () => {
  it('cleans AliExpress status and boilerplate to store order', () => {
    const title = generateCleanTitle('AliExpress - Package EP903057886 is ready for pickup', 'AliExpress', 'hfd');
    expect(title).toBe('AliExpress Order');
  });

  it('cleans delivery issue boilerplate to store order', () => {
    const title = generateCleanTitle('AliExpress - Delivery issue for package EP903057886', 'AliExpress', 'hfd');
    expect(title).toBe('AliExpress Order');
  });

  it('preserves real product title in quotes', () => {
    const title = generateCleanTitle('Your Amazon order for "Wireless Earbuds Pro" has shipped', 'Amazon', 'amazon');
    expect(title).toBe('Amazon - Wireless Earbuds Pro');
  });

  it('cleans Hebrew boilerplate when no store detected', () => {
    const title = generateCleanTitle('חבילה EP903057886 ממתינה לאיסוף מ-HFD', null, 'hfd');
    expect(title).toBe('Package via HFD');
  });
});

describe('sanitizeEmailHtml', () => {
  it('strips tags and scripts and styles', () => {
    const html = '<style>.x{color:red}</style><div>Order &amp; <b>Shipped</b></div><script>alert(1)</script>';
    expect(sanitizeEmailHtml(html)).toBe('Order & Shipped');
  });
});

describe('isFalsePositive', () => {
  it('identifies Israeli phone numbers as false positives', () => {
    expect(isFalsePositive('0541234567')).toBe(true);
    expect(isFalsePositive('0509876543')).toBe(true);
    expect(isFalsePositive('0771234567')).toBe(true);
    expect(isFalsePositive('972541234567')).toBe(true);
    expect(isFalsePositive('+972541234567')).toBe(true);
  });

  it('identifies dates and prices as false positives', () => {
    expect(isFalsePositive('2026-08-28')).toBe(true);
    expect(isFalsePositive('28/08/2026')).toBe(true);
    expect(isFalsePositive('129.90 ₪')).toBe(true);
  });

  it('allows valid tracking numbers', () => {
    expect(isFalsePositive('RR123456789IL')).toBe(false);
    expect(isFalsePositive('1Z9999999999999999')).toBe(false);
    expect(isFalsePositive('LP12345678901234')).toBe(false);
    expect(isFalsePositive('TBA123456789012')).toBe(false);
    expect(isFalsePositive('CH12345678')).toBe(false);
  });
});

describe('detectStore', () => {
  it('detects stores from sender email or text', () => {
    expect(detectStore('auto-confirm@amazon.com', '')).toBe('Amazon');
    expect(detectStore('orders@shein.com', '')).toBe('SHEIN');
    expect(detectStore('transaction@notice.aliexpress.com', '')).toBe('AliExpress');
    expect(detectStore('service@ksp.co.il', '')).toBe('KSP');
    expect(detectStore('info@ivory.co.il', '')).toBe('Ivory');
    expect(detectStore('', 'ההזמנה שלך מסופר-פארם יצאה לדרך')).toBe('Super-Pharm');
  });
});

describe('extractTrackingDetails', () => {
  it('extracts Amazon order with TBA tracking and product name in title', () => {
    const subject = 'Your Amazon.com order of "Sony WH-1000XM5 Headphones" has shipped!';
    const from = 'shipment-tracking@amazon.com';
    const body = 'Your package is on its way. Tracking ID: TBA123456789012';
    const result = extractTrackingDetails(subject, body, from);
    expect(result.store).toBe('Amazon');
    expect(result.trackingNumber).toBe('TBA123456789012');
    expect(result.carrier).toBe('amazon');
    expect(result.title).toBe('Amazon - Sony WH-1000XM5 Headphones');
  });

  it('extracts Israel Post international tracking number', () => {
    const subject = 'חבילה בדרך לישראל';
    const from = 'updates@aliexpress.com';
    const body = 'החבילה שלך נשלחה עם מספר מעקב: RR987654321IL';
    const result = extractTrackingDetails(subject, body, from);
    expect(result.store).toBe('AliExpress');
    expect(result.trackingNumber).toBe('RR987654321IL');
    expect(result.carrier).toBe('israel-post');
  });

  it('extracts Chita tracking number and does not confuse with phone numbers in footer', () => {
    const subject = 'ההזמנה מ-KSP נשלחה באמצעות חברת צ\'יטה';
    const from = 'service@ksp.co.il';
    const body = 'שלום, החבילה שלך נשלחה! מספר משלוח בצ\'יטה: CH99887766. לשירות לקוחות חייגו 0541234567.';
    const result = extractTrackingDetails(subject, body, from);
    expect(result.store).toBe('KSP');
    expect(result.trackingNumber).toBe('CH99887766');
    expect(result.carrier).toBe('chita');
  });

  it('extracts UPS tracking number', () => {
    const subject = 'UPS Shipment Notification, Tracking Number 1Z999AA10123456784';
    const from = 'pkginfo@ups.com';
    const body = 'Your package is scheduled for delivery.';
    const result = extractTrackingDetails(subject, body, from);
    expect(result.trackingNumber).toBe('1Z999AA10123456784');
    expect(result.carrier).toBe('ups');
    expect(result.confidence).toBe('high');
  });

  it('extracts tracking number embedded only inside HTML anchor tags', () => {
    const subject = 'החבילה שלך בדרך!';
    const from = 'info@terminalx.com';
    const htmlBody = `
      <html>
        <body>
          <h2>שלום סהר,</h2>
          <p>החבילה שלך מטרמינל איקס נשלחה!</p>
          <p><a href="https://chtr.co.il/t/CH98765432">לחצו כאן למעקב אחר המשלוח</a></p>
        </body>
      </html>
    `;
    const result = extractTrackingDetails(subject, htmlBody, from);
    expect(result.store).toBe('Terminal X');
    expect(result.trackingNumber).toBe('CH98765432');
    expect(result.carrier).toBe('chita');
    expect(result.confidence).toBe('high');
  });

  it('suppresses 6-digit OTP verification codes from being mistaken as tracking numbers', () => {
    const subject = 'קוד אימות לחשבון שלך';
    const from = 'security@service.com';
    const body = 'קוד אימות חד-פעמי שלך הוא: 582910. אין להעביר קוד זה לאיש.';
    const result = extractTrackingDetails(subject, body, from);
    expect(result.trackingNumber).toBe(null);
  });

  it('extracts E-Post / HFD tracking from link', () => {
    const subject = 'חבילתך ממתינה בלוקר';
    const from = 'no-reply@hfd.co.il';
    const htmlBody = '<a href="https://epost.co.il/tracking?num=HFD998877">לחץ למעקב</a>';
    const result = extractTrackingDetails(subject, htmlBody, from);
    expect(result.trackingNumber).toBe('HFD998877');
    expect(result.carrier).toBe('hfd');
  });
});

