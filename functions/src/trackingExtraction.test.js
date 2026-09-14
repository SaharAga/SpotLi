import { describe, it, expect } from 'vitest';
import {
  sanitizeEmailHtml,
  isFalsePositive,
  detectStore,
  extractTrackingDetails,
  inferDeliveryStatus,
  generateCleanTitle,
  extractOrderStatusDetails,
  shouldAdvanceStatus,
  unwrapRedirectUrl,
  extractSchemaOrgData,
  extractPickupLocation,
  extractOpeningHours,
  extractPickupPhone,
  extractRedirectInfo,
  extractAllTrackingDetails,
  resolveStoreName,
  extractShippedItemName
} from './trackingExtraction.js';

describe('shouldAdvanceStatus', () => {
  it('advances status forward along standard lifecycle', () => {
    expect(shouldAdvanceStatus('ordered', 'shipped')).toBe(true);
    expect(shouldAdvanceStatus('shipped', 'in_transit')).toBe(true);
    expect(shouldAdvanceStatus('in_transit', 'customs')).toBe(true);
    expect(shouldAdvanceStatus('customs', 'out_for_delivery')).toBe(true);
    expect(shouldAdvanceStatus('out_for_delivery', 'ready_for_pickup')).toBe(true);
    expect(shouldAdvanceStatus('ready_for_pickup', 'delivered')).toBe(true);
    expect(shouldAdvanceStatus('in_transit', 'ready_for_pickup')).toBe(true);
  });

  it('rejects status regressions to prevent downgrades', () => {
    expect(shouldAdvanceStatus('shipped', 'ordered')).toBe(false);
    expect(shouldAdvanceStatus('customs', 'in_transit')).toBe(false);
    expect(shouldAdvanceStatus('ready_for_pickup', 'ordered')).toBe(false);
    expect(shouldAdvanceStatus('out_for_delivery', 'in_transit')).toBe(false);
    expect(shouldAdvanceStatus('delivered', 'in_transit')).toBe(false);
    expect(shouldAdvanceStatus('ready_for_pickup', 'ready_for_pickup')).toBe(false);
  });

  it('handles exception state transitions safely', () => {
    expect(shouldAdvanceStatus('in_transit', 'exception')).toBe(true);
    expect(shouldAdvanceStatus('exception', 'out_for_delivery')).toBe(true);
    expect(shouldAdvanceStatus('exception', 'ready_for_pickup')).toBe(true);
    expect(shouldAdvanceStatus('exception', 'delivered')).toBe(true);
    expect(shouldAdvanceStatus('exception', 'in_transit')).toBe(false);
  });

  it('rejects invalid or unknown statuses', () => {
    expect(shouldAdvanceStatus('unknown_state', 'in_transit')).toBe(false);
    expect(shouldAdvanceStatus('ordered', 'invalid_status')).toBe(false);
  });
});

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

describe('resolveStoreName', () => {
  it('prefers the sender over a brand name mentioned in the body', () => {
    // The real bug: a "report a bug" footer link made every shop look like Bug.
    const body = 'Your order shipped. Questions? report a bug at bug.co.il';
    expect(resolveStoreName('SEESTARZ <noreply@seestarz.com>', body)).toBe('SEESTARZ');
  });

  it('falls back to the sender display name, then the mailbox domain', () => {
    expect(resolveStoreName('Kaspit Store <no-reply@kaspit-shop.com>', '')).toBe('Kaspit Store');
    expect(resolveStoreName('no-reply@kaspit-shop.com', '')).toBe('Kaspit-shop');
  });

  it('still lets a known store signature in the sender win', () => {
    expect(resolveStoreName('auto-confirm@amazon.com', '')).toBe('Amazon');
  });
});

describe('extractShippedItemName', () => {
  it('takes the item name from the shipment list', () => {
    const body = 'Items in this shipment\nRosewater Cream Blouse \u00d7 1\nXL';
    expect(extractShippedItemName(body)).toBe('Rosewater Cream Blouse');
  });

  it('skips a size or colour line standing on its own', () => {
    const body = 'Items in this shipment\nXL\nRosewater Cream Blouse \u00d7 1';
    expect(extractShippedItemName(body)).toBe('Rosewater Cream Blouse');
  });

  it('finds the name when the HTML body has been collapsed to one line', () => {
    const body = 'Items in this shipment Rosewater Cream Blouse \u00d7 1 XL report a bug';
    expect(extractShippedItemName(body)).toBe('Rosewater Cream Blouse');
  });

  it('returns empty when there is no item list', () => {
    expect(extractShippedItemName('Hello, your order shipped.')).toBe('');
  });
});

describe('extractTrackingDetails', () => {
  it('titles a shipping email with the sender shop and the shipped item', () => {
    // Regression: a "report a bug" footer link made the store "Bug" and the
    // subject-derived title "Bug - update for".
    const body = [
      'Your order is on its way!',
      'Items in this shipment',
      'Rosewater Cream Blouse \u00d7 1',
      'XL',
      'Tracking number: 48094292',
      'Track at https://mytapuz.co.il/tracking?n=48094292',
      'report a bug'
    ].join('\n');
    const result = extractTrackingDetails(
      'Shipping update for order 469417',
      body,
      'SEESTARZ <noreply@seestarz.com>'
    );
    expect(result.store).toBe('SEESTARZ');
    expect(result.title).toBe('SEESTARZ - Rosewater Cream Blouse');
    expect(result.trackingNumber).toBe('48094292');
  });

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

  it('accepts a USPS IMpb number only when its generated mod10-31 checksum passes', () => {
    const result = extractTrackingDetails(
      'USPS shipment update',
      'Tracking number: 9400100000000000000006'
    );

    expect(result.trackingNumber).toBe('9400100000000000000006');
    expect(result.carrier).toBe('usps');
    expect(result.selectedCandidate?.checksum).toBe('pass');
    expect(result.status).toBe('verified');
  });

  it('marks a USPS IMpb candidate with a bad mod10-31 check digit as unverified', () => {
    const result = extractTrackingDetails(
      'USPS shipment update',
      'Tracking number: 9400100000000000000007'
    );

    expect(result.trackingNumber).toBe('9400100000000000000007');
    expect(result.selectedCandidate?.checksum).toBe('fail');
    expect(result.status).not.toBe('verified');
    expect(result.confidence).not.toBe('high');
  });

  it('keeps UPU S10 validation behavior alongside the IMpb checksum', () => {
    const valid = extractTrackingDetails('', 'Tracking number: RS948219483IL');
    const invalid = extractTrackingDetails('', 'Tracking number: RS948219481IL');

    expect(valid.selectedCandidate?.checksum).toBe('pass');
    expect(valid.status).toBe('verified');
    expect(invalid.selectedCandidate?.checksum).toBe('fail');
    expect(invalid.status).not.toBe('verified');
  });
});

describe('extractOrderStatusDetails', () => {
  it('extracts a store + status for an order-only email with no carrier tracking number', () => {
    const result = extractOrderStatusDetails(
      'Your order has shipped',
      'Order 1122283942717219 has shipped and is on its way.',
      'AliExpress <no-reply@aliexpress.com>'
    );
    expect(result).toEqual({
      store: 'AliExpress',
      status: 'in_transit',
      title: expect.any(String),
      orderNumber: '1122283942717219'
    });
  });

  it('returns null when no known store is detected', () => {
    const result = extractOrderStatusDetails('Your order has shipped', 'Order 12345 has shipped.', 'someone@example.com');
    expect(result).toBeNull();
  });

  it('returns null when a store is known but no explicit lifecycle phrase is present (e.g. a newsletter)', () => {
    const result = extractOrderStatusDetails(
      '20% off everything this weekend',
      'Check out our new arrivals!',
      'AliExpress <no-reply@aliexpress.com>'
    );
    expect(result).toBeNull();
  });
});

describe('unwrapRedirectUrl', () => {
  it('unwraps SendGrid click redirect URLs', () => {
    const raw = 'https://ct.sendgrid.net/ls/click?upn=abc123xyz&url=https%3A%2F%2Fwww.ups.com%2Ftrack%3Ftracknum%3D1Z9999999999999999';
    expect(unwrapRedirectUrl(raw)).toBe('https://www.ups.com/track?tracknum=1Z9999999999999999');
  });

  it('unwraps Klaviyo redirect URLs', () => {
    const raw = 'https://trk.klaviyo.com/mpss/c/4AA/xyz123?dest=https%3A%2F%2Ftracking.hfd.co.il%2F%3Ft%3DHFD90481029';
    expect(unwrapRedirectUrl(raw)).toBe('https://tracking.hfd.co.il/?t=HFD90481029');
  });

  it('unwraps AliExpress and Shein redirect URLs', () => {
    const ali = 'https://click.aliexpress.com/e/_oF123?target=https%3A%2F%2Fglobal.cainiao.com%2Fdetail.htm%3FmailNoList%3DLP00123456789012';
    expect(unwrapRedirectUrl(ali)).toBe('https://global.cainiao.com/detail.htm?mailNoList=LP00123456789012');

    const shein = 'https://links.shein.com/a/track?redirect=https%3A%2F%2Fmypost.israelpost.co.il%2Fitemtrace%2FRR000000005IL';
    expect(unwrapRedirectUrl(shein)).toBe('https://mypost.israelpost.co.il/itemtrace/RR000000005IL');
  });

  it('handles double-encoded redirect parameters gracefully', () => {
    const double = 'https://email.store.com/r?target=https%253A%252F%252Fwww.fedex.com%252Ffedextrack%252F%253Ftrknbr%253D123456789012';
    expect(unwrapRedirectUrl(double)).toBe('https://www.fedex.com/fedextrack/?trknbr=123456789012');
  });

  it('returns null for non-redirect standard URLs', () => {
    expect(unwrapRedirectUrl('https://www.google.com/search?q=tracking')).toBeNull();
    expect(unwrapRedirectUrl('not-a-url')).toBeNull();
    expect(unwrapRedirectUrl('')).toBeNull();
  });
});

describe('extractSchemaOrgData', () => {
  it('extracts ParcelDelivery structured data from Amazon JSON-LD fixture', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "http://schema.org",
            "@type": "ParcelDelivery",
            "trackingNumber": "1Z9999999999999999",
            "trackingUrl": "https://www.ups.com/track?tracknum=1Z9999999999999999",
            "carrier": {
              "@type": "Organization",
              "name": "UPS"
            },
            "itemShipped": {
              "@type": "Product",
              "name": "Sony WH-1000XM5 Headphones"
            },
            "partOfOrder": {
              "@type": "Order",
              "orderNumber": "114-8291029-1928301",
              "merchant": {
                "@type": "Organization",
                "name": "Amazon"
              }
            },
            "deliveryStatus": "http://schema.org/InTransit"
          }
          </script>
        </head>
        <body>Order details</body>
      </html>
    `;

    const shipments = extractSchemaOrgData(html);
    expect(shipments).toHaveLength(1);
    expect(shipments[0].trackingNumber).toBe('1Z9999999999999999');
    expect(shipments[0].carrier).toBe('UPS');
    expect(shipments[0].title).toBe('Sony WH-1000XM5 Headphones');
    expect(shipments[0].store).toBe('Amazon');
    expect(shipments[0].orderNumber).toBe('114-8291029-1928301');
    expect(shipments[0].status).toBe('in_transit');
  });

  it('extracts Order with orderDelivery from AliExpress JSON-LD fixture', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Order",
        "orderNumber": "8127391823",
        "seller": {
          "@type": "Organization",
          "name": "AliExpress"
        },
        "orderDelivery": {
          "@type": "ParcelDelivery",
          "trackingNumber": "LP00123456789012",
          "carrier": "Cainiao",
          "itemShipped": {
            "name": "Magnetic Phone Holder"
          }
        }
      }
      </script>
    `;

    const shipments = extractSchemaOrgData(html);
    expect(shipments).toHaveLength(1);
    expect(shipments[0].trackingNumber).toBe('LP00123456789012');
    expect(shipments[0].carrier).toBe('Cainiao');
    expect(shipments[0].title).toBe('Magnetic Phone Holder');
    expect(shipments[0].store).toBe('AliExpress');
  });

  it('extracts from @graph array format', () => {
    const json = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ParcelDelivery',
          trackingNumber: 'RR000000005IL',
          carrier: 'Israel Post'
        }
      ]
    });

    const shipments = extractSchemaOrgData(json);
    expect(shipments).toHaveLength(1);
    expect(shipments[0].trackingNumber).toBe('RR000000005IL');
    expect(shipments[0].carrier).toBe('Israel Post');
  });
});

describe('extractTrackingDetails - Schema.org and ESP unwrap integration', () => {
  it('extracts verified tracking and item title from HTML with Schema.org JSON-LD', () => {
    const html = `
      <div>
        <p>Your order is on the way!</p>
        <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "ParcelDelivery",
          "trackingNumber": "1Z9999999999999999",
          "carrier": "UPS",
          "itemShipped": {
            "name": "Mechanical Keyboard RGB"
          },
          "partOfOrder": {
            "merchant": "Amazon"
          }
        }
        </script>
      </div>
    `;

    const res = extractTrackingDetails('Your Amazon order has shipped', html, 'Amazon <ship-confirm@amazon.com>');
    expect(res.trackingNumber).toBe('1Z9999999999999999');
    expect(res.carrier).toBe('ups');
    expect(res.title).toBe('Mechanical Keyboard RGB');
    expect(res.store).toBe('Amazon');
    expect(res.status).toBe('verified');
    expect(res.confidence).toBe('high');
  });

  it('unwraps ESP redirect links embedded in HTML buttons to detect tracking number', () => {
    const html = `
      <html>
        <body>
          <h2>Your shipment has been dispatched</h2>
          <a href="https://ct.sendgrid.net/ls/click?upn=abc123xyz&url=https%3A%2F%2Fwww.ups.com%2Ftrack%3Ftracknum%3D1Z9999999999999999">
            Track Your Package
          </a>
        </body>
      </html>
    `;

    const res = extractTrackingDetails('Your order has shipped', html, 'Orders <orders@mystore.com>');
    expect(res.trackingNumber).toBe('1Z9999999999999999');
    expect(res.carrier).toBe('ups');
    expect(res.status).toBe('verified');
  });
});

describe('extractPickupLocation', () => {
  it('extracts Hebrew pickup point from SMS/email notification', () => {
    const text = 'שלום, חבילתך מחכה לך בנקודת איסוף: סופר פארם קניון עזריאלי. קוד איסוף: 4819';
    expect(extractPickupLocation(text)).toBe('סופר פארם קניון עזריאלי');
  });

  it('extracts locker location and trims hours/phone suffixes', () => {
    const text = 'החבילה הגיעה ללוקר שופרסל דיזנגוף סנטר - שעות פתיחה: א-ה 08:00-22:00';
    expect(extractPickupLocation(text)).toBe('שופרסל דיזנגוף סנטר');
  });

  it('extracts English pickup location', () => {
    const text = 'Your parcel is waiting at the pickup point: MailBoxes Etc High Street. PIN: 9021';
    expect(extractPickupLocation(text)).toBe('MailBoxes Etc High Street');
  });

  it('returns empty string when no pickup location exists', () => {
    expect(extractPickupLocation('Your order has shipped via FedEx.')).toBe('');
    expect(extractPickupLocation('')).toBe('');
  });
});

describe('extractOpeningHours', () => {
  it('extracts Hebrew opening hours', () => {
    const text = 'נקודת איסוף: סופר פארם. שעות פתיחה: א-ה 08:00-20:00, ו 08:00-14:00';
    expect(extractOpeningHours(text)).toBe('א-ה 08:00-20:00, ו 08:00-14:00');
  });

  it('extracts 24/7 hours indicator', () => {
    const text = 'איסוף מלוקר פתוח 24/7 (כל שעות היממה)';
    expect(extractOpeningHours(text)).toContain('24/7');
  });

  it('extracts English business hours', () => {
    const text = 'Pickup location: Downtown Locker. Opening hours: Mon-Fri 9am-6pm';
    expect(extractOpeningHours(text)).toBe('Mon-Fri 9am-6pm');
  });
});

describe('extractPickupPhone', () => {
  it('extracts Israeli mobile phone number', () => {
    const text = 'לשאלות ובירורים, טלפון ליצירת קשר: 054-9876543';
    expect(extractPickupPhone(text)).toBe('054-9876543');
  });

  it('extracts Israeli landline with prefix', () => {
    const text = 'נקודת שירות. טלפון סניף: 03-6123456';
    expect(extractPickupPhone(text)).toBe('03-6123456');
  });

  it('extracts 1-700 / 1-800 courier support numbers', () => {
    const text = 'בירורים במוקד: 1-700-500-123';
    expect(extractPickupPhone(text)).toBe('1-700-500-123');
  });
});

describe('extractRedirectInfo', () => {
  it('detects overflow rerouting with prefix reason and original location', () => {
    const text = 'בשל עומס בלוקר דיזנגוף סנטר, חבילתך RR000000005IL הועברה לנקודת איסוף מכולת העיר בוגרשוב 12. קוד: 8192.';
    const res = extractRedirectInfo(text);
    expect(res.isRedirected).toBe(true);
    expect(res.newPickupLocation).toBe('מכולת העיר בוגרשוב 12');
    expect(res.originalPickupLocation).toBe('דיזנגוף סנטר');
    expect(res.redirectReason).toBe('locker_capacity');
  });

  it('detects redirected pickup location pattern', () => {
    const text = 'הודעה: חבילתך הועברה לנקודת איסוף חלופית: סופר פארם אבן גבירול. שעות פתיחה: 08:00-22:00';
    const res = extractRedirectInfo(text);
    expect(res.isRedirected).toBe(true);
    expect(res.newPickupLocation).toBe('סופר פארם אבן גבירול');
  });

  it('returns isRedirected false for regular delivery notices', () => {
    const text = 'חבילתך ממתינה לאיסוף בלוקר סנטר';
    expect(extractRedirectInfo(text)).toEqual({ isRedirected: false });
  });
});

describe('extractTrackingDetails - pickup and redirect parity integration', () => {
  it('extracts tracking number, pickup location, hours, and redirect metadata simultaneously', () => {
    const text = `
      שלום, עקב עומס בלוקר עזריאלי, חבילתך במספר RR000000005IL הועברה לנקודת איסוף מכולת השכונה שדרות ירושלים 10.
      קוד איסוף: 5544
      שעות פתיחה: א-ה 07:00-21:00
      טלפון: 03-5551234
    `;
    const res = extractTrackingDetails('חבילתך הועברה לנקודת איסוף', text, 'דואר ישראל <service@israelpost.co.il>');
    expect(res.trackingNumber).toBe('RR000000005IL');
    expect(res.carrier).toBe('israel-post');
    expect(res.status).toBe('verified');
    expect(res.pickupLocation).toBe('מכולת השכונה שדרות ירושלים 10');
    expect(res.lockerPin).toBe('5544');
    expect(res.pickupHours).toBe('א-ה 07:00-21:00');
    expect(res.pickupPhone).toBe('03-5551234');
    expect(res.isRedirected).toBe(true);
    expect(res.redirectReason).toBe('locker_capacity');
  });
});

describe('extractAllTrackingDetails', () => {
  it('disaggregates multiple verified tracking numbers from labeled patterns in text', () => {
    const text = `
      Your order from Amazon has shipped in 2 packages:
      Package 1: tracking number 1Z9999999999999999 via UPS
      Package 2: tracking number RR000000005IL via Israel Post
    `;
    const pkgs = extractAllTrackingDetails('Your Amazon order has shipped', text, 'ship-confirm@amazon.com');
    expect(pkgs).toHaveLength(2);

    expect(pkgs[0].trackingNumber).toBe('1Z9999999999999999');
    expect(pkgs[0].carrier).toBe('ups');
    expect(pkgs[0].status).toBe('verified');

    expect(pkgs[1].trackingNumber).toBe('RR000000005IL');
    expect(pkgs[1].carrier).toBe('israel-post');
    expect(pkgs[1].status).toBe('verified');
  });

  it('disaggregates multi-parcel shipment from Schema.org JSON-LD graph', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "ParcelDelivery",
            "trackingNumber": "1Z9999999999999999",
            "carrier": "UPS",
            "itemShipped": { "name": "Mechanical Keyboard" }
          },
          {
            "@type": "ParcelDelivery",
            "trackingNumber": "RR000000005IL",
            "carrier": "Israel Post",
            "itemShipped": { "name": "Desk Mat XXL" }
          }
        ]
      }
      </script>
    `;
    const pkgs = extractAllTrackingDetails('Your order has shipped', html, 'Amazon <ship@amazon.com>');
    expect(pkgs).toHaveLength(2);

    expect(pkgs[0].trackingNumber).toBe('1Z9999999999999999');
    expect(pkgs[0].title).toBe('Mechanical Keyboard');
    expect(pkgs[0].carrier).toBe('ups');

    expect(pkgs[1].trackingNumber).toBe('RR000000005IL');
    expect(pkgs[1].title).toBe('Desk Mat XXL');
    expect(pkgs[1].carrier).toBe('israel-post');
  });

  it('returns single package for email with single tracking number', () => {
    const text = 'Your package 1Z9999999999999999 has shipped.';
    const pkgs = extractAllTrackingDetails('Order shipped', text, 'UPS <noreply@ups.com>');
    expect(pkgs).toHaveLength(1);
    expect(pkgs[0].trackingNumber).toBe('1Z9999999999999999');
  });

  it('falls back to order status record when no tracking numbers found', () => {
    const text = 'Your order is out for delivery today.';
    const pkgs = extractAllTrackingDetails('AliExpress - out for delivery', text, 'AliExpress <no-reply@aliexpress.com>');
    expect(pkgs).toHaveLength(1);
    expect(pkgs[0].isOrderStatusOnly).toBe(true);
    expect(pkgs[0].store).toBe('AliExpress');
    expect(pkgs[0].deliveryStatus).toBe('out_for_delivery');
  });

  it('ignores promotional developer onboarding emails like 17TRACK API newsletters', () => {
    const subject = '❣️Day1:  Get to know our supported carriers, shall we? ❯';
    const body = `
      17TRACK
      ALL-IN-ONE PACKAGE TRACKING
      Dear developer!
      For a great tracking API, you want to look for trackability, accuracy and timliness ~😊

      The good news is, We support the tracking of 3502 mainstream carriers worldwide.
      including 99.9% of UPU members and commercial services such as DHL and FedEx.

      Our tracking info is identical to the carrier's website, for 100% authenticity!
      We push tracking updates automatically, no need for repeated quiries.

      List of Carriers Supported
      https://t.17track.net/en#nums=
      https://api.17track.net/
    `;
    const from = '17TRACK <api@17track.net>';
    const pkgs = extractAllTrackingDetails(subject, body, from);
    expect(pkgs).toEqual([]);
  });

  it('does not capture common words following bare tracking as tracking numbers', () => {
    const text = 'We push tracking updates automatically and provide tracking information for all users.';
    const pkgs = extractAllTrackingDetails('Newsletter', text, 'info@example.com');
    expect(pkgs).toEqual([]);
  });
});



