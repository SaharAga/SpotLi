import { describe, it, expect } from 'vitest';
import {
  extractOpeningHours,
  resolveStoreHours,
  is24_7Hours,
  parseOpeningHours,
  getIsraeliHolidayNotice,
  getLiveStoreStatus
} from './openingHoursService.js';

describe('openingHoursService Unit Tests', () => {
  describe('extractOpeningHours', () => {
    it('extracts Hebrew hours phrase from SMS', () => {
      const sms = 'החבילה שלך מחכה בנקודת איסוף מינימרקט שלום. שעות פתיחה: א׳-ה׳ 08:00-20:00, ו׳ 08:00-13:30. קוד: 4920';
      const extracted = extractOpeningHours(sms);
      expect(extracted).toContain('08:00-20:00');
    });

    it('extracts 24/7 locker signature', () => {
      const text = 'החבילה הגיעה ללוקר בוקסיט תחנת דלק פז. לוקר 24/7 (פתוח תמיד).';
      const extracted = extractOpeningHours(text);
      expect(extracted).toContain('24/7');
    });

    it('returns empty string when no hours are present', () => {
      expect(extractOpeningHours('החבילה יצאה לחלוקה עם שליח')).toBe('');
      expect(extractOpeningHours(null)).toBe('');
    });
  });

  describe('is24_7Hours', () => {
    it('identifies 24/7 signatures accurately', () => {
      expect(is24_7Hours('24/7')).toBe(true);
      expect(is24_7Hours('פתוח 24/7 (תמיד פתוח)')).toBe(true);
      expect(is24_7Hours('Sun-Thu 08:00-20:00')).toBe(false);
    });
  });

  describe('resolveStoreHours (3-Tier Hierarchy)', () => {
    it('Tier 1: uses explicit hours when provided', () => {
      const res = resolveStoreHours('Mini-market', 'א-ה 10:00-18:00', 'hfd');
      expect(res.source).toBe('explicit');
      expect(res.hoursHe).toBe('א-ה 10:00-18:00');
    });

    it('Tier 2: matches Israel Post branches when location name matches', () => {
      const res = resolveStoreHours('סניף דואר ישראל מרכזי', '', 'israel-post');
      expect(res.source).toBe('directory');
      expect(res.hoursHe).toContain('08:00-18:00');
    });

    it('Tier 2: matches 24/7 BoxIt lockers', () => {
      const res = resolveStoreHours('לוקר בוקסיט תחנת רכבת', '', 'boxit');
      expect(res.source).toBe('directory');
      expect(res.is24_7).toBe(true);
    });

    it('Tier 3: falls back to standard Israeli retail heuristic when unknown', () => {
      const res = resolveStoreHours('חנות צעצועים המרכז', '', 'other');
      expect(res.source).toBe('heuristic');
      expect(res.isEstimated).toBe(true);
      expect(res.hoursHe).toContain('09:00-20:00');
    });
  });

  describe('parseOpeningHours', () => {
    it('parses Sun-Thu and Friday slots into day indexes correctly', () => {
      const schedule = parseOpeningHours('Sun-Thu 08:00-19:00, Fri 08:00-13:00');
      // Sunday (0)
      expect(schedule[0]).toHaveLength(1);
      expect(schedule[0][0]).toEqual({ open: 480, close: 1140 }); // 08:00 (480) - 19:00 (1140)
      // Friday (5)
      expect(schedule[5]).toHaveLength(1);
      expect(schedule[5][0]).toEqual({ open: 480, close: 780 }); // 08:00 (480) - 13:00 (780)
      // Saturday (6)
      expect(schedule[6]).toHaveLength(0);
    });
  });

  describe('getLiveStoreStatus', () => {
    it('returns Open 24/7 for automated lockers', () => {
      const status = getLiveStoreStatus('24/7 (Always Open)');
      expect(status.isOpen).toBe(true);
      expect(status.is24_7).toBe(true);
      expect(status.badgeTextHe).toBe('פתוח 24/7');
      expect(status.badgeClass).toContain('bg-blue-500');
    });

    it('detects Open state during business hours on Tuesday afternoon', () => {
      // 2026-09-01 is a Tuesday at 14:00 (840 min)
      const tuesdayNoon = new Date('2026-09-01T14:00:00');
      const status = getLiveStoreStatus('Sun-Thu 08:00-20:00, Fri 08:00-14:00', { now: tuesdayNoon });

      expect(status.isOpen).toBe(true);
      expect(status.state).toBe('open');
      expect(status.badgeTextHe).toBe('פתוח עכשיו');
      expect(status.nextChangeHe).toBe('נסגר ב-20:00');
    });

    it('detects Closing Soon (<= 45 min) before closing time', () => {
      // Tuesday at 19:30 (closes at 20:00 -> 30 min left)
      const tuesdayEvening = new Date('2026-09-01T19:30:00');
      const status = getLiveStoreStatus('Sun-Thu 08:00-20:00, Fri 08:00-14:00', { now: tuesdayEvening });

      expect(status.isOpen).toBe(true);
      expect(status.state).toBe('closing_soon');
      expect(status.badgeTextHe).toContain('נסגר בקרוב (20:00)');
      expect(status.badgeClass).toContain('bg-amber-500');
    });

    it('detects Closed state after evening closing time and announces next opening', () => {
      // Tuesday at 21:30 (closed)
      const tuesdayNight = new Date('2026-09-01T21:30:00');
      const status = getLiveStoreStatus('Sun-Thu 08:00-20:00, Fri 08:00-14:00', { now: tuesdayNight });

      expect(status.isOpen).toBe(false);
      expect(status.state).toBe('closed');
      expect(status.badgeTextHe).toBe('סגור כעת');
      expect(status.nextChangeHe).toContain('08:00');
    });

    it('detects Friday Erev Shabbat early closure warning', () => {
      // 2026-09-04 is a Friday at 11:00 (closes at 13:00)
      const fridayMorning = new Date('2026-09-04T11:00:00');
      const status = getLiveStoreStatus('Sun-Thu 08:00-20:00, Fri 08:00-13:00', { now: fridayMorning });

      expect(status.isOpen).toBe(true);
      expect(status.warningHe).toContain('סגירה מוקדמת היום לרגל שבת');
    });

    it('detects Saturday / Shabbat closure and announces Sunday reopening', () => {
      // 2026-09-05 is a Saturday
      const saturdayAfternoon = new Date('2026-09-05T14:00:00');
      const status = getLiveStoreStatus('Sun-Thu 08:00-20:00, Fri 08:00-13:00', { now: saturdayAfternoon });

      expect(status.isOpen).toBe(false);
      expect(status.state).toBe('shabbat_closed');
      expect(status.badgeTextHe).toBe('סגור לרגל שבת');
      expect(status.nextChangeHe).toContain('יום ראשון');
    });

    it('detects Yom Kippur statutory closure', () => {
      // 2026-09-21 is Yom Kippur
      const yomKippur = new Date('2026-09-21T10:00:00');
      const status = getLiveStoreStatus('Sun-Thu 08:00-20:00', { now: yomKippur });

      expect(status.isOpen).toBe(false);
      expect(status.state).toBe('holiday_closed');
      expect(status.badgeTextHe).toContain('יום כיפור');
    });
  });
});
