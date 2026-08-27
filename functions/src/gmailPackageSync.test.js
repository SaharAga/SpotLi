import { describe, it, expect } from 'vitest';
import {
  looksAlreadyDelivered,
  isDuplicateTrackingNumber,
  extractSubjectAndBodyFromGmailMessage,
  buildPackageFromGmailMessage
} from './gmailPackageSync.js';

function makeGmailMessage({ id = 'msg1', subject = '', text = '' } = {}) {
  return {
    id,
    payload: {
      headers: [{ name: 'Subject', value: subject }],
      mimeType: 'text/plain',
      body: { data: Buffer.from(text, 'utf8').toString('base64url') }
    },
    snippet: text.slice(0, 50)
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
    const msg = makeGmailMessage({ subject: 'Your order shipped', text: 'Tracking: RR123456789IL' });
    const pkg = buildPackageFromGmailMessage({
      gmailMessage: msg,
      userId: 'uid1',
      existingTrackingNumbers: new Set()
    });
    expect(pkg).not.toBeNull();
    expect(pkg.trackingNumber).toBe('RR123456789IL');
    expect(pkg.userId).toBe('uid1');
    expect(pkg.source).toBe('gmail_sync');
  });

  it('returns null when no tracking number found', () => {
    const msg = makeGmailMessage({ subject: 'Hello', text: 'no tracking here' });
    expect(
      buildPackageFromGmailMessage({ gmailMessage: msg, userId: 'uid1', existingTrackingNumbers: new Set() })
    ).toBeNull();
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
});
