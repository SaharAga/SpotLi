import { describe, it, expect } from 'vitest';
import {
  looksAlreadyDelivered,
  isDuplicateTrackingNumber,
  extractSubjectAndBodyFromGmailMessage,
  buildPackageFromGmailMessage,
  buildPackageFromGmailMessageWithAiFallback,
  buildOrderStatusUpdateFromGmailMessage
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

  it('falls back to an order-status package when there is a known store and lifecycle phrase but no carrier tracking number', () => {
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

    expect(pkg).not.toBeNull();
    expect(pkg.id).toBe('pkg-gmail-order-ali-msg-1');
    expect(pkg.trackingNumber).toBe('');
    expect(pkg.source).toBe('gmail_sync_order_status');
    expect(pkg.confidence).toBe('sender_reported');
    expect(pkg.status).toBe('in_transit');
    expect(pkg.store).toBe('AliExpress');
  });

  it('still returns null for an order-confirmation email with no known store and no tracking number', () => {
    const msg = makeGmailMessage({ subject: 'Hello', text: 'no tracking here' });
    expect(
      buildPackageFromGmailMessage({ gmailMessage: msg, userId: 'uid1', existingTrackingNumbers: new Set() })
    ).toBeNull();
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
});
