import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, getDaysRemaining, todayISO } from './dateUtils';

describe('Date Utilities', () => {
  it('formats dates consistently in EN and HE locales', () => {
    const isoString = '2026-08-25T12:00:00.000Z';
    const formattedEn = formatDate(isoString, 'en');
    const formattedHe = formatDate(isoString, 'he');

    expect(formattedEn).toBeTruthy();
    expect(formattedHe).toBeTruthy();
  });

  it('returns empty string when date is falsy', () => {
    expect(formatDate('', 'en')).toBe('');
    expect(formatDate(null, 'en')).toBe('');
  });

  it('calculates remaining days accurately', () => {
    const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const info = getDaysRemaining(futureDate, 'en');

    expect(info).not.toBeNull();
    expect(info.isLate).toBe(false);
    expect(info.days).toBeGreaterThanOrEqual(4);
    expect(info.text).toContain('In');
  });

  it('detects overdue packages correctly', () => {
    const pastDate = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const info = getDaysRemaining(pastDate, 'en');

    expect(info).not.toBeNull();
    expect(info.isLate).toBe(true);
    expect(info.isUrgent).toBe(true);
    expect(info.text).toContain('overdue');
  });

  it('reuses cached Intl formatters across calls (identical output, stable locale mapping)', () => {
    const iso = '2026-08-25T12:00:00.000Z';
    expect(formatDate(iso, 'en')).toBe(formatDate(iso, 'en'));
    expect(formatDateTime(iso, 'he')).toBe(formatDateTime(iso, 'he'));
    expect(formatDate(iso, 'he')).not.toBe(formatDate(iso, 'en'));
    // date-only vs date-time caches must stay separate
    expect(formatDateTime(iso, 'en')).not.toBe(formatDate(iso, 'en'));
  });

  it('preserves invalid-date and empty guards after caching', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });

  it('todayISO() returns a YYYY-MM-DD string equal to the inlined expression', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayISO()).toBe(new Date().toISOString().slice(0, 10));
  });
});
