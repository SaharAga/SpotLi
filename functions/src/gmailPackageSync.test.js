import { describe, it, expect } from 'vitest';
import {
  looksAlreadyDelivered,
  isDuplicateTrackingNumber,
  extractSubjectAndBodyFromGmailMessage,
  buildPackageFromGmailMessage,
  buildPackagesFromGmailMessage,
  buildPackageFromGmailMessageWithAiFallback,
  buildPackagesFromGmailMessageWithAiFallback,
  buildOrderStatusUpdateFromGmailMessage,
  buildStatusUpdateFromGmailMessage
} from './gmailPackageSync.js';

function makeGmailMessage({ id = 'msg1', subject = '', text = '', from = '' } = {}) {
  const headers = [{ name: 'Subject', value: subject }];
  if (from) headers.push({ name: 'From', value: from });
  return {
    id,
    payload: {
      headers,
      mimeType: 'text/plain',
      body: { data: Buffer.from(text, 'utf8').toString('base64url') }
    },
    snippet: text.slice(0, 50)
  };
}

function createFakeDb() {
  const store = new Map();
  return {
    collection(name) {
      return {
        doc(id) {
          return { key: `${name}/${id}` };
        },
        add() {
          return Promise.resolve();
        }
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const data = store.get(ref.key);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data, opts) {
          const existing = opts?.merge ? store.get(ref.key) || {} : {};
          store.set(ref.key, { ...existing, ...data });
        }
      };
      return fn(tx);
    }
  };
}

describe('looksAlreadyDelivered', () => {
  it('detects delivered language', () => {
    expect(looksAlreadyDelivered('Your package was delivered', '')).toBe(true);
    expect(looksAlreadyDelivered('', 'נמסרה בהצלחה אתמול')).toBe(true);
  });

  it('returns false for normal shipping updates', () => {
    expect(looksAlreadyDelivered('Your order has shipped', 'tracking RR123456789IL')).toBe(false);
  });
});

describe('isDuplicateTrackingNumber', () => {
  it('is case-insensitive', () => {
    const set = new Set(['RR123456789IL']);
    expect(isDuplicateTrackingNumber(set, 'rr123456789il')).toBe(true);
  });

  it('returns false when tracking number is missing', () => {
    expect(isDuplicateTrackingNumber(new Set(), null)).toBe(false);
  });
});

describe('extractSubjectAndBodyFromGmailMessage', () => {
  it('decodes a text/plain part', () => {
    const msg = makeGmailMessage({ subject: 'Order shipped', text: 'Tracking RR123456789IL' });
    const { subject, body } = extractSubjectAndBodyFromGmailMessage(msg);
    expect(subject).toBe('Order shipped');
    expect(body).toBe('Tracking RR123456789IL');
  });

  it('falls back to snippet when no parts have data', () => {
    const msg = { id: 'x', payload: { headers: [] }, snippet: 'fallback text' };
    const { body } = extractSubjectAndBodyFromGmailMessage(msg);
    expect(body).toBe('fallback text');
  });
});

describe('buildPackageFromGmailMessage', () => {
  it('builds a package when a tracking number is found and not a duplicate', () => {
    const msg = makeGmailMessage({ subject: 'Your order shipped', text: 'Tracking: RR000000005IL' });
    const pkg = buildPackageFromGmailMessage({
      gmailMessage: msg,
      userId: 'uid1',
      existingTrackingNumbers: new Set()
    });
    expect(pkg).not.toBeNull();
    expect(pkg.trackingNumber).toBe('RR000000005IL');
    expect(pkg.userId).toBe('uid1');
    expect(pkg.source).toBe('gmail_sync');
  });

  it('returns null when no tracking number found', () => {
    const msg = makeGmailMessage({ subject: 'Hello', text: 'no tracking here' });
    expect(
      buildPackageFromGmailMessage({ gmailMessage: msg, userId: 'uid1', existingTrackingNumbers: new Set() })
    ).toBeNull();
  });

  it('returns null for a probable candidate because Gmail sync has no confirmation step', () => {
    const msg = makeGmailMessage({ subject: 'Update', text: '1Z999AA10123456784' });
    expect(buildPackageFromGmailMessage({
      gmailMessage: msg, userId: 'uid1', existingTrackingNumbers: new Set()
    })).toBeNull();
  });

  it('returns null when tracking number is a duplicate', () => {
    const msg = makeGmailMessage({ subject: 'Shipped', text: 'RR123456789IL' });
    const pkg = buildPackageFromGmailMessage({
      gmailMessage: msg,
      userId: 'uid1',
      existingTrackingNumbers: new Set(['RR123456789IL'])
    });
    expect(pkg).toBeNull();
  });

  it('skips already-delivered-looking messages when skipDelivered is set', () => {
    const msg = makeGmailMessage({ subject: 'Delivered', text: 'RR123456789IL was delivered' });
    const pkg = buildPackageFromGmailMessage({
      gmailMessage: msg,
      userId: 'uid1',
      existingTrackingNumbers: new Set(),
      skipDelivered: true
    });
    expect(pkg).toBeNull();
  });

  it('creates nothing when a known store ships but gives no carrier tracking number', () => {
    const msg = makeGmailMessage({
      id: 'ali-msg-1',
      subject: 'Your order has shipped',
      text: 'Your order 1122283942717219 has shipped and is on its way.'
    });
    msg.payload.headers.push({ name: 'From', value: 'AliExpress <no-reply@aliexpress.com>' });

    const pkg = buildPackageFromGmailMessage({
      gmailMessage: msg,
      userId: 'uid1',
      existingTrackingNumbers: new Set()
    });

    // This used to produce an order-status card: no tracking number, carrier
    // "other", and nothing tying it to the shipment whose tracking number
    // arrives later. The user is shown a store name and a six-stage tracker
    // they cannot act on or match to any of their orders. The shipping email
    // that carries a real tracking number creates the package instead.
    expect(pkg).toBeNull();
  });

  it('still returns null for an order-confirmation email with no known store and no tracking number', () => {
    const msg = makeGmailMessage({ subject: 'Hello', text: 'no tracking here' });
    expect(
      buildPackageFromGmailMessage({ gmailMessage: msg, userId: 'uid1', existingTrackingNumbers: new Set() })
    ).toBeNull();
  });
});

describe('buildStatusUpdateFromGmailMessage', () => {
  it('extracts status update and locker PIN from delivery notice email', () => {
    const msg = makeGmailMessage({
      subject: 'חבילה ממתינה לאיסוף בלוקר אי-פוסט',
      text: 'חבילתך RR000000005IL הגיעה ללוקר סופר-פארם דיזנגוף. קוד איסוף: 9482'
    });
    const update = buildStatusUpdateFromGmailMessage({ gmailMessage: msg });
    expect(update).not.toBeNull();
    expect(update.trackingNumber).toBe('RR000000005IL');
    expect(update.status).toBe('ready_for_pickup');
    expect(update.lockerPin).toBe('9482');
  });

  it('extracts out for delivery status without locker pin', () => {
    const msg = makeGmailMessage({
      subject: 'Your order is out for delivery',
      text: 'Your package RR000000005IL is with courier Aviad today.'
    });
    const update = buildStatusUpdateFromGmailMessage({ gmailMessage: msg });
    expect(update).not.toBeNull();
    expect(update.trackingNumber).toBe('RR000000005IL');
    expect(update.status).toBe('out_for_delivery');
    expect(update.lockerPin).toBeUndefined();
  });

  it('returns null when tracking number is absent or unverified', () => {
    const msg = makeGmailMessage({
      subject: 'No tracking here',
      text: 'Hello, your receipt is attached.'
    });
    expect(buildStatusUpdateFromGmailMessage({ gmailMessage: msg })).toBeNull();
  });
});

describe('buildOrderStatusUpdateFromGmailMessage', () => {
  it('extracts a store + status update from a follow-up order-status email', () => {
    const msg = makeGmailMessage({
      subject: 'AliExpress - is out for delivery',
      text: 'Your order is out for delivery today.',
      from: 'AliExpress <no-reply@aliexpress.com>'
    });
    const update = buildOrderStatusUpdateFromGmailMessage({ gmailMessage: msg });
    expect(update).toEqual({ store: 'AliExpress', status: 'out_for_delivery', title: expect.any(String) });
  });

  it('returns null when the message carries a verified carrier tracking number instead', () => {
    const msg = makeGmailMessage({
      subject: 'Your order has shipped',
      text: 'Tracking: RR000000005IL',
      from: 'AliExpress <no-reply@aliexpress.com>'
    });
    expect(buildOrderStatusUpdateFromGmailMessage({ gmailMessage: msg })).toBeNull();
  });

  it('returns null for an email with no known store', () => {
    const msg = makeGmailMessage({ subject: 'Random newsletter', text: 'nothing relevant' });
    expect(buildOrderStatusUpdateFromGmailMessage({ gmailMessage: msg })).toBeNull();
  });
});

describe('buildPackageFromGmailMessageWithAiFallback', () => {
  it('behaves exactly like the sync version when no ai deps are supplied', async () => {
    const msg = makeGmailMessage({ subject: 'Your order shipped', text: 'Tracking: RR000000005IL' });
    const pkg = await buildPackageFromGmailMessageWithAiFallback({
      gmailMessage: msg,
      userId: 'uid1',
      existingTrackingNumbers: new Set()
    });
    expect(pkg.trackingNumber).toBe('RR000000005IL');
    expect(pkg.source).toBe('gmail_sync');
  });

  it('resolves a probable-but-unverified candidate via the AI fallback when it confirms it', async () => {
    // Same fixture the sync-only test above proves returns null on its own —
    // a real UPS-shaped token with no surrounding "tracking number" label,
    // so the deterministic scorer lands it below the verified bar.
    const msg = makeGmailMessage({
      subject: 'Your package has shipped',
      text: '1Z999AA10123456784',
      from: 'noreply@ups.com'
    });
    const db = createFakeDb();
    const pkg = await buildPackageFromGmailMessageWithAiFallback({
      gmailMessage: msg,
      userId: 'uid1',
      existingTrackingNumbers: new Set(),
      ai: {
        db,
        apiKey: 'test-key',
        parseFn: async () => ({
          confidence: 'high',
          trackingNumber: '1Z999AA10123456784',
          carrier: 'ups',
          title: 'UPS Package'
        })
      }
    });

    expect(pkg).not.toBeNull();
    expect(pkg.trackingNumber).toBe('1Z999AA10123456784');
    expect(pkg.carrier).toBe('ups');
    expect(pkg.source).toBe('gmail_sync_ai');
    expect(pkg.confidence).toBe('high');
  });

  it('falls back to the sync behavior (order-status or null) when the AI candidate is not resolvable', async () => {
    const msg = makeGmailMessage({ subject: 'Hello', text: 'no tracking here', from: 'a@b.com' });
    const db = createFakeDb();
    const pkg = await buildPackageFromGmailMessageWithAiFallback({
      gmailMessage: msg,
      userId: 'uid1',
      existingTrackingNumbers: new Set(),
      ai: { db, apiKey: 'test-key', parseFn: async () => ({ confidence: 'none' }) }
    });
    expect(pkg).toBeNull();
  });

  it('bypasses AI fallback when Schema.org JSON-LD in HTML yields a verified candidate', async () => {
    const htmlContent = `
      <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "ParcelDelivery",
        "trackingNumber": "1Z9999999999999999",
        "carrier": "UPS"
      }
      </script>
    `;
    const msg = {
      id: 'msg-schema-ai',
      payload: {
        headers: [{ name: 'Subject', value: 'Order dispatched' }],
        parts: [
          { mimeType: 'text/html', body: { data: Buffer.from(htmlContent, 'utf8').toString('base64url') } }
        ]
      }
    };

    let aiCalled = false;
    const pkg = await buildPackageFromGmailMessageWithAiFallback({
      gmailMessage: msg,
      userId: 'user-1',
      existingTrackingNumbers: new Set(),
      ai: {
        db: createFakeDb(),
        apiKey: 'test-key',
        parseFn: async () => {
          aiCalled = true;
          return { confidence: 'none' };
        }
      }
    });

    expect(aiCalled).toBe(false);
    expect(pkg).not.toBeNull();
    expect(pkg.trackingNumber).toBe('1Z9999999999999999');
    expect(pkg.carrier).toBe('ups');
    expect(pkg.source).toBe('gmail_sync');
  });

  it('builds package from multipart Gmail message with plain preview and Schema.org HTML', () => {
    const plainText = 'Order confirmation: please check details online.';
    const htmlContent = `
      <div>
        <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "ParcelDelivery",
          "trackingNumber": "1Z9999999999999999",
          "carrier": "UPS",
          "itemShipped": { "name": "4K Gaming Monitor" },
          "partOfOrder": { "merchant": "Amazon" },
          "deliveryStatus": "http://schema.org/InTransit"
        }
        </script>
      </div>
    `;

    const msg = {
      id: 'msg-multipart-1',
      payload: {
        headers: [
          { name: 'Subject', value: 'Your order has shipped!' },
          { name: 'From', value: 'ship-confirm@amazon.com' }
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: Buffer.from(plainText, 'utf8').toString('base64url') }
          },
          {
            mimeType: 'text/html',
            body: { data: Buffer.from(htmlContent, 'utf8').toString('base64url') }
          }
        ]
      }
    };

    const pkg = buildPackageFromGmailMessage({
      gmailMessage: msg,
      userId: 'user-multi',
      existingTrackingNumbers: new Set()
    });

    expect(pkg).not.toBeNull();
    expect(pkg.trackingNumber).toBe('1Z9999999999999999');
    expect(pkg.carrier).toBe('ups');
    expect(pkg.title).toBe('4K Gaming Monitor');
    expect(pkg.status).toBe('in_transit');
  });

  it('builds package with pickup location, hours, phone, and redirect details', () => {
    const msg = makeGmailMessage({
      subject: 'חבילתך הועברה לנקודת איסוף חלופית',
      text: 'בשל עומס בלוקר סנטר, חבילתך RR000000005IL הועברה לנקודת איסוף מכולת השכונה. קוד איסוף: 1234. שעות פעילות: א-ה 08:00-20:00. טלפון: 03-5554321.'
    });

    const pkg = buildPackageFromGmailMessage({
      gmailMessage: msg,
      userId: 'user-pickup',
      existingTrackingNumbers: new Set()
    });

    expect(pkg).not.toBeNull();
    expect(pkg.trackingNumber).toBe('RR000000005IL');
    expect(pkg.pickupLocation).toBe('מכולת השכונה');
    expect(pkg.lockerPin).toBe('1234');
    expect(pkg.pickupHours).toBe('א-ה 08:00-20:00');
    expect(pkg.pickupPhone).toBe('03-5554321');
    expect(pkg.isRedirected).toBe(true);
    expect(pkg.originalPickupLocation).toBe('סנטר');
    expect(pkg.redirectReason).toBe('locker_capacity');
  });

  it('builds status update with pickup location, hours, phone, and redirect details', () => {
    const msg = makeGmailMessage({
      subject: 'עדכון: חבילתך הועברה לנקודת איסוף',
      text: 'בשל עומס בלוקר עזריאלי, חבילתך RR000000005IL הועברה לנקודת איסוף סופר פארם השלום. שעות פתיחה: 08:00-22:00. טלפון: 054-1234567.'
    });

    const update = buildStatusUpdateFromGmailMessage({ gmailMessage: msg });
    expect(update).not.toBeNull();
    expect(update.trackingNumber).toBe('RR000000005IL');
    expect(update.pickupLocation).toBe('סופר פארם השלום');
    expect(update.pickupHours).toBe('08:00-22:00');
    expect(update.pickupPhone).toBe('054-1234567');
    expect(update.isRedirected).toBe(true);
    expect(update.originalPickupLocation).toBe('עזריאלי');
  });

  it('buildPackagesFromGmailMessage disaggregates email with multiple parcels', () => {
    const msg = makeGmailMessage({
      id: 'order-multi-123',
      subject: 'Your Amazon order has shipped in 2 packages',
      text: 'Package 1 tracking: 1Z9999999999999999\nPackage 2 tracking: RR000000005IL',
      from: 'ship-confirm@amazon.com'
    });

    const pkgs = buildPackagesFromGmailMessage({
      gmailMessage: msg,
      userId: 'user-multi',
      existingTrackingNumbers: new Set()
    });

    expect(pkgs).toHaveLength(2);
    expect(pkgs[0].id).toBe('pkg-gmail-order-multi-123-1');
    expect(pkgs[0].trackingNumber).toBe('1Z9999999999999999');
    expect(pkgs[0].carrier).toBe('ups');

    expect(pkgs[1].id).toBe('pkg-gmail-order-multi-123-2');
    expect(pkgs[1].trackingNumber).toBe('RR000000005IL');
    expect(pkgs[1].carrier).toBe('israel-post');
  });

  it('buildPackagesFromGmailMessageWithAiFallback handles multi-parcel email without invoking AI', async () => {
    const msg = makeGmailMessage({
      id: 'order-multi-456',
      subject: 'Your Amazon order has shipped in 2 packages',
      text: 'Package 1 tracking: 1Z9999999999999999\nPackage 2 tracking: RR000000005IL',
      from: 'ship-confirm@amazon.com'
    });

    let aiCalled = false;
    const pkgs = await buildPackagesFromGmailMessageWithAiFallback({
      gmailMessage: msg,
      userId: 'user-multi',
      existingTrackingNumbers: new Set(),
      ai: {
        db: createFakeDb(),
        apiKey: 'test-key',
        parseFn: async () => {
          aiCalled = true;
          return { confidence: 'none' };
        }
      }
    });

    expect(aiCalled).toBe(false);
    expect(pkgs).toHaveLength(2);
    expect(pkgs[0].trackingNumber).toBe('1Z9999999999999999');
    expect(pkgs[1].trackingNumber).toBe('RR000000005IL');
  });
});


