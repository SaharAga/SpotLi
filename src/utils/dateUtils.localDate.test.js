import { describe, it, expect, vi, afterEach } from 'vitest';
import { toLocalISODate, todayISO } from './dateUtils';

/**
 * These tests exist for one specific bug: `toISOString().slice(0, 10)` is UTC,
 * and Israel is UTC+2/+3. Between local midnight and 02:00/03:00 the UTC date
 * is still *yesterday*, so "today" was a day early — on the default order date
 * of every new package, on deadline arithmetic, and on the smart parser's
 * today/tomorrow resolution.
 *
 * The window is what matters, so each case sits inside it.
 */
describe('toLocalISODate', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns the local calendar date, not the UTC one', () => {
    // 01:30 on the 5th in Israel is 22:30 on the 4th in UTC.
    const earlyHours = new Date('2026-09-05T01:30:00+03:00');
    expect(earlyHours.toISOString().slice(0, 10)).toBe('2026-09-04'); // the old behaviour
    expect(toLocalISODate(earlyHours)).toBe('2026-09-05');            // the calendar date
  });

  it('agrees with the UTC form outside the offset window', () => {
    const midday = new Date('2026-09-05T12:00:00+03:00');
    expect(toLocalISODate(midday)).toBe(midday.toISOString().slice(0, 10));
  });

  it('pads single-digit months and days', () => {
    expect(toLocalISODate(new Date(2026, 0, 3, 12, 0, 0))).toBe('2026-01-03');
  });

  it('handles a date across a month boundary in the early hours', () => {
    const firstOfMonth = new Date('2026-10-01T00:30:00+03:00');
    expect(firstOfMonth.toISOString().slice(0, 10)).toBe('2026-09-30');
    expect(toLocalISODate(firstOfMonth)).toBe('2026-10-01');
  });

  it('returns an empty string for an invalid date rather than throwing', () => {
    expect(toLocalISODate(new Date('nonsense'))).toBe('');
    expect(toLocalISODate('not a date')).toBe('');
  });

  it('accepts a parseable string', () => {
    expect(toLocalISODate('2026-03-14T12:00:00+02:00')).toBe('2026-03-14');
  });

  it('todayISO() reports the local date in the early hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T01:30:00+03:00'));
    expect(todayISO()).toBe('2026-09-05');
  });
});
