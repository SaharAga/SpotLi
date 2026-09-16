import { describe, it, expect, vi } from 'vitest';
import { formatPushTitleAndBody, formatUpdatePushTitleAndBody, getUserLanguage } from './pushPayload.js';

/**
 * Every string here used to be emitted as `Hebrew | English` in one
 * notification, both halves always, whichever language the reader had chosen.
 * These tests pass a language and assert the other one is absent — the absence
 * is the fix, so asserting only that the right words appear would pass on the
 * old code too.
 */
const HEBREW = /[֐-׿]/;
const SEPARATOR = '|';

describe('formatPushTitleAndBody', () => {
  it('writes English only for an English reader', () => {
    const { title, body } = formatPushTitleAndBody(
      { title: 'Amazon order', trackingNumber: 'ABC123', carrier: 'ups' },
      'en'
    );
    expect(title).toBe('New Package Detected!');
    expect(body).toContain('ABC123');
    expect(body).toContain('UPS');
    expect(title + body).not.toMatch(HEBREW);
    expect(title + body).not.toContain(SEPARATOR);
  });

  it('writes Hebrew only for a Hebrew reader', () => {
    const { title, body } = formatPushTitleAndBody(
      { title: 'הזמנה מאמזון', trackingNumber: 'ABC123', carrier: 'ups' },
      'he'
    );
    expect(title).toBe('חבילה חדשה זוהתה!');
    expect(body).toContain('ABC123');
    expect(title).not.toMatch(/New Package|Detected/);
    expect(title + body).not.toContain(SEPARATOR);
  });

  it('falls back to Hebrew for an unknown or missing language', () => {
    // An Israeli app: a Hebrew notification to an English reader is a smaller
    // failure than none at all.
    for (const lang of [undefined, null, '', 'fr', 'EN ']) {
      expect(formatPushTitleAndBody({ title: 'x' }, lang).title).toMatch(HEBREW);
    }
  });

  it('falls back to the package title when there is no tracking number', () => {
    expect(formatPushTitleAndBody({ title: 'AliExpress order confirmed' }, 'en').body)
      .toContain('AliExpress order confirmed');
  });

  it('never crashes on a minimal package', () => {
    expect(() => formatPushTitleAndBody({})).not.toThrow();
    expect(() => formatPushTitleAndBody({}, 'en')).not.toThrow();
  });
});

describe('formatUpdatePushTitleAndBody', () => {
  const readyForPickup = [
    { status: 'in_transit' },
    {
      title: 'ASOS order',
      trackingNumber: '123456',
      status: 'ready_for_pickup',
      pickupLocation: 'Super-Pharm Dizengoff',
      lockerPin: '9988'
    }
  ];

  it('formats ready for pickup with locker PIN and location, in English only', () => {
    const { title, body } = formatUpdatePushTitleAndBody(...readyForPickup, 'en');
    expect(title).toBe('Ready for Pickup! 📍');
    expect(body).toContain('Super-Pharm Dizengoff');
    expect(body).toContain('9988');
    expect(body).toContain('ASOS order');
    expect(title + body).not.toMatch(HEBREW);
  });

  it('formats the same update in Hebrew only', () => {
    const { title, body } = formatUpdatePushTitleAndBody(...readyForPickup, 'he');
    expect(title).toBe('מוכן לאיסוף! 📍');
    expect(body).toContain('9988');
    expect(body).not.toMatch(/ready for pickup/i);
  });

  it.each([
    ['out for delivery', { status: 'in_transit' }, { title: 'Zara', status: 'out_for_delivery' }, 'Out for Delivery Today! 🚚'],
    ['delivered', { status: 'out_for_delivery' }, { title: 'Zara', status: 'delivered' }, 'Package Delivered! ✅'],
    ['exception', { status: 'in_transit' }, { title: 'Zara', status: 'exception' }, 'Important Shipment Update ⚠️'],
    ['rerouted', { isRedirected: false }, { title: 'Zara', isRedirected: true }, 'Package Rerouted!'],
    ['generic status change', { status: 'ordered' }, { title: 'Zara', status: 'in_transit' }, 'Shipment Status Update']
  ])('formats %s with no Hebrew for an English reader', (_label, before, after, expectedTitle) => {
    const { title, body } = formatUpdatePushTitleAndBody(before, after, 'en');
    expect(title).toBe(expectedTitle);
    expect(title + body).not.toMatch(HEBREW);
  });

  it('keeps the branch priority order — a reroute outranks a pickup code', () => {
    const { title } = formatUpdatePushTitleAndBody(
      { isRedirected: false },
      { isRedirected: true, status: 'ready_for_pickup', lockerPin: '1111' },
      'en'
    );
    expect(title).toBe('Package Rerouted!');
  });

  it('never crashes on minimal before/after objects', () => {
    expect(() => formatUpdatePushTitleAndBody({}, {})).not.toThrow();
    expect(() => formatUpdatePushTitleAndBody({}, {}, 'en')).not.toThrow();
  });
});

describe('getUserLanguage', () => {
  const dbReturning = (data) => ({
    collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => data }) }) })
  });

  it('reads the account screen preference', async () => {
    expect(await getUserLanguage(dbReturning({ preferences: { language: 'en' } }), 'u1')).toBe('en');
    expect(await getUserLanguage(dbReturning({ preferences: { language: 'he' } }), 'u1')).toBe('he');
  });

  it('falls back to Hebrew when the user has no stored preference', async () => {
    expect(await getUserLanguage(dbReturning({}), 'u1')).toBe('he');
  });

  it('never throws, so a lookup failure cannot silence a notification', async () => {
    const angry = {
      collection: () => ({ doc: () => ({ get: async () => { throw new Error('offline'); } }) })
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await getUserLanguage(angry, 'u1')).toBe('he');
    expect(await getUserLanguage(null, 'u1')).toBe('he');
    expect(await getUserLanguage(dbReturning({}), null)).toBe('he');
    warn.mockRestore();
  });
});
