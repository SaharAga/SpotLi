import { describe, it, expect } from 'vitest';
import { formatPushTitleAndBody } from './pushPayload.js';

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
