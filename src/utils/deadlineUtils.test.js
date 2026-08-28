import { describe, it, expect } from 'vitest';
import {
  getPickupCountdown,
  getReturnCountdown,
  calculateDefaultReturnDeadline
} from './deadlineUtils';

describe('deadlineUtils', () => {
  const fixedNow = new Date('2026-08-28T12:00:00.000Z');

  describe('getPickupCountdown', () => {
    it('returns empty info when deadline is missing or invalid', () => {
      expect(getPickupCountdown(null, fixedNow)).toEqual(expect.objectContaining({
        hasDeadline: false,
        isExpired: false
      }));
      expect(getPickupCountdown('invalid-date', fixedNow)).toEqual(expect.objectContaining({
        hasDeadline: false
      }));
    });

    it('identifies expired pickup holding deadlines', () => {
      const pastDeadline = '2026-08-28T10:00:00.000Z';
      const res = getPickupCountdown(pastDeadline, fixedNow);
      expect(res.hasDeadline).toBe(true);
      expect(res.isExpired).toBe(true);
      expect(res.urgency).toBe('expired');
      expect(res.formattedHe).toContain('סכנת החזרה');
    });

    it('flags critical urgency when less than 24 hours remain', () => {
      const deadline18h = '2026-08-29T06:00:00.000Z'; // 18h from fixedNow
      const res = getPickupCountdown(deadline18h, fixedNow);
      expect(res.isExpired).toBe(false);
      expect(res.urgency).toBe('critical');
      expect(res.hoursRemaining).toBe(18);
      expect(res.formattedHe).toBe('נותרו 18 שעות לאיסוף!');
      expect(res.formattedEn).toBe('18 hours left to pick up!');
    });

    it('flags warning urgency when 24-48 hours remain', () => {
      const deadline36h = '2026-08-30T00:00:00.000Z'; // 36h from fixedNow
      const res = getPickupCountdown(deadline36h, fixedNow);
      expect(res.isExpired).toBe(false);
      expect(res.urgency).toBe('warning');
      expect(res.hoursRemaining).toBe(36);
      expect(res.formattedHe).toBe('נותרו 36 שעות לאיסוף');
    });

    it('flags normal urgency when more than 48 hours remain', () => {
      const deadline4Days = '2026-09-01T12:00:00.000Z'; // 4 days from fixedNow
      const res = getPickupCountdown(deadline4Days, fixedNow);
      expect(res.isExpired).toBe(false);
      expect(res.urgency).toBe('normal');
      expect(res.daysRemaining).toBe(4);
      expect(res.formattedHe).toBe('נותרו 4 ימים לאיסוף');
    });
  });

  describe('getReturnCountdown', () => {
    it('returns empty info when return deadline is missing or invalid', () => {
      expect(getReturnCountdown(null, fixedNow)).toEqual(expect.objectContaining({
        hasDeadline: false
      }));
      expect(getReturnCountdown('not-a-date', fixedNow)).toEqual(expect.objectContaining({
        hasDeadline: false
      }));
    });

    it('identifies expired return window', () => {
      const past = '2026-08-20';
      const res = getReturnCountdown(past, fixedNow);
      expect(res.hasDeadline).toBe(true);
      expect(res.isExpired).toBe(true);
      expect(res.urgency).toBe('expired');
      expect(res.formattedHe).toBe('חלון ההחזרה הסתיים');
    });

    it('flags critical return window when 3 or fewer days remain', () => {
      const deadline2Days = '2026-08-30T12:00:00.000Z';
      const res = getReturnCountdown(deadline2Days, fixedNow);
      expect(res.isExpired).toBe(false);
      expect(res.urgency).toBe('critical');
      expect(res.daysRemaining).toBe(2);
      expect(res.formattedHe).toBe('נותרו 2 ימים אחרונים להחזרה!');
    });

    it('flags warning return window when 4-7 days remain', () => {
      const deadline5Days = '2026-09-02T12:00:00.000Z';
      const res = getReturnCountdown(deadline5Days, fixedNow);
      expect(res.isExpired).toBe(false);
      expect(res.urgency).toBe('warning');
      expect(res.daysRemaining).toBe(5);
    });

    it('flags normal return window when more than 7 days remain', () => {
      const deadline14Days = '2026-09-11T12:00:00.000Z';
      const res = getReturnCountdown(deadline14Days, fixedNow);
      expect(res.isExpired).toBe(false);
      expect(res.urgency).toBe('normal');
      expect(res.daysRemaining).toBe(14);
    });
  });

  describe('calculateDefaultReturnDeadline', () => {
    it('calculates return deadline 14 days from delivery date', () => {
      const result = calculateDefaultReturnDeadline('2026-08-28', 14);
      expect(result).toBe('2026-09-11');
    });

    it('calculates custom return window 30 days from delivery date', () => {
      const result = calculateDefaultReturnDeadline('2026-08-01', 30);
      expect(result).toBe('2026-08-31');
    });
  });
});
