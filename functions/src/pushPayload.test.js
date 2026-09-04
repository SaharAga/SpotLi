import { describe, it, expect } from 'vitest';
import { formatPushTitleAndBody, formatUpdatePushTitleAndBody } from './pushPayload.js';

describe('formatPushTitleAndBody', () => {
  it('includes tracking number and carrier when present', () => {
    const { title, body } = formatPushTitleAndBody({
      title: 'Amazon order',
      trackingNumber: 'ABC123',
      carrier: 'ups'
    });
    expect(title).toContain('New Package Detected');
    expect(body).toContain('ABC123');
    expect(body).toContain('UPS');
    expect(body).toContain('Amazon order');
  });

  it('falls back to the package title when there is no tracking number', () => {
    const { body } = formatPushTitleAndBody({ title: 'AliExpress order confirmed', carrier: 'other' });
    expect(body).toContain('AliExpress order confirmed');
  });

  it('never crashes on a minimal package', () => {
    expect(() => formatPushTitleAndBody({})).not.toThrow();
  });
});

describe('formatUpdatePushTitleAndBody', () => {
  it('formats ready for pickup with locker PIN and location', () => {
    const { title, body } = formatUpdatePushTitleAndBody(
      { status: 'in_transit' },
      {
        title: 'ASOS order',
        trackingNumber: '123456',
        status: 'ready_for_pickup',
        pickupLocation: 'Super-Pharm Dizengoff',
        lockerPin: '9988'
      }
    );
    expect(title).toContain('Ready for Pickup');
    expect(body).toContain('Super-Pharm Dizengoff');
    expect(body).toContain('9988');
    expect(body).toContain('ASOS order');
  });

  it('formats out for delivery status change', () => {
    const { title, body } = formatUpdatePushTitleAndBody(
      { status: 'in_transit' },
      { title: 'Zara Package', status: 'out_for_delivery' }
    );
    expect(title).toContain('Out for Delivery');
    expect(body).toContain('Zara Package');
  });

  it('formats delivered status change', () => {
    const { title, body } = formatUpdatePushTitleAndBody(
      { status: 'out_for_delivery' },
      { title: 'Zara Package', status: 'delivered' }
    );
    expect(title).toContain('Package Delivered');
    expect(body).toContain('Zara Package');
  });

  it('formats rerouted delivery notice', () => {
    const { title, body } = formatUpdatePushTitleAndBody(
      { isRedirected: false },
      {
        title: 'Chita parcel',
        isRedirected: true,
        pickupLocation: 'Alternate Locker Tel Aviv'
      }
    );
    expect(title).toContain('Package Rerouted');
    expect(body).toContain('Alternate Locker Tel Aviv');
  });

  it('never crashes on minimal before/after objects', () => {
    expect(() => formatUpdatePushTitleAndBody({}, {})).not.toThrow();
  });
});

