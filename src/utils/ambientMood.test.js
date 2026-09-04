import { describe, it, expect } from 'vitest';
import { deriveMood } from './ambientMood';

const NOW = new Date('2026-09-03T10:00:00Z');
const hoursFromNow = (h) => new Date(NOW.getTime() + h * 60 * 60 * 1000).toISOString();

describe('deriveMood', () => {
  it('returns calm for an empty or missing list', () => {
    expect(deriveMood([], NOW)).toBe('calm');
    expect(deriveMood(null, NOW)).toBe('calm');
    expect(deriveMood(undefined, NOW)).toBe('calm');
  });

  it('returns calm when everything is merely in transit', () => {
    const packages = [
      { id: '1', status: 'in_transit' },
      { id: '2', status: 'shipped' },
      { id: '3', status: 'delivered' }
    ];
    expect(deriveMood(packages, NOW)).toBe('calm');
  });

  it('returns today for a package out for delivery', () => {
    expect(deriveMood([{ id: '1', status: 'out_for_delivery' }], NOW)).toBe('today');
  });

  it('returns today for a pickup deadline inside 24 hours', () => {
    const packages = [{ id: '1', status: 'in_transit', pickupDeadline: hoursFromNow(6) }];
    expect(deriveMood(packages, NOW)).toBe('today');
  });

  it('returns today for an already-expired pickup deadline', () => {
    const packages = [{ id: '1', status: 'in_transit', pickupDeadline: hoursFromNow(-3) }];
    expect(deriveMood(packages, NOW)).toBe('today');
  });

  it('stays calm for a deadline more than 24 hours out', () => {
    // A 36h deadline is `warning`, deliberately not promoted to today — see
    // TODAY_URGENCIES. Without this the chrome would sit amber most of the week.
    const packages = [{ id: '1', status: 'in_transit', pickupDeadline: hoursFromNow(36) }];
    expect(deriveMood(packages, NOW)).toBe('calm');
  });

  it('returns stuck for customs and for exception', () => {
    expect(deriveMood([{ id: '1', status: 'customs' }], NOW)).toBe('stuck');
    expect(deriveMood([{ id: '1', status: 'exception' }], NOW)).toBe('stuck');
  });

  it('lets stuck outrank today regardless of list order', () => {
    const todayFirst = [
      { id: '1', status: 'out_for_delivery' },
      { id: '2', status: 'customs' }
    ];
    const stuckFirst = [
      { id: '1', status: 'customs' },
      { id: '2', status: 'out_for_delivery' }
    ];
    expect(deriveMood(todayFirst, NOW)).toBe('stuck');
    expect(deriveMood(stuckFirst, NOW)).toBe('stuck');
  });

  it('ignores archived packages entirely', () => {
    const packages = [
      { id: '1', status: 'customs', isArchived: true },
      { id: '2', status: 'out_for_delivery', isArchived: true },
      { id: '3', status: 'in_transit' }
    ];
    expect(deriveMood(packages, NOW)).toBe('calm');
  });

  it('skips null entries without throwing', () => {
    expect(deriveMood([null, undefined, { id: '1', status: 'customs' }], NOW)).toBe('stuck');
  });
});
