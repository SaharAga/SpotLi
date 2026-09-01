import { describe, it, expect } from 'vitest';
import { computeAdoptionSummary } from './featureAdoptionStatsService';

describe('computeAdoptionSummary', () => {
  it('returns an empty summary for no data', () => {
    expect(computeAdoptionSummary([])).toEqual({});
  });

  it('computes adoption rate as feature total over app-active total', () => {
    const stats = [
      { feature: '_app_active', date: '2026-08-29', uniqueUsers: 100 },
      { feature: '_app_active', date: '2026-08-30', uniqueUsers: 80 },
      { feature: 'smart_import', date: '2026-08-29', uniqueUsers: 10 },
      { feature: 'smart_import', date: '2026-08-30', uniqueUsers: 8 },
      { feature: 'gmail_sync', date: '2026-08-29', uniqueUsers: 90 }
    ];

    const summary = computeAdoptionSummary(stats);
    expect(summary._app_active).toBeUndefined(); // baseline excluded from its own summary

    expect(summary.smart_import.featureTotal).toBe(18);
    expect(summary.smart_import.appActiveTotal).toBe(180);
    expect(summary.smart_import.adoptionRate).toBeCloseTo(18 / 180);

    expect(summary.gmail_sync.featureTotal).toBe(90);
    expect(summary.gmail_sync.adoptionRate).toBeCloseTo(90 / 180);
  });

  it('returns a zero adoption rate when there is no app-active baseline', () => {
    const stats = [{ feature: 'export', date: '2026-08-30', uniqueUsers: 5 }];
    const summary = computeAdoptionSummary(stats);
    expect(summary.export.adoptionRate).toBe(0);
  });

  it('ignores malformed rows', () => {
    const stats = [null, { feature: 'export' }, { uniqueUsers: 5 }, { feature: 'export', uniqueUsers: 3 }];
    const summary = computeAdoptionSummary(stats);
    expect(summary.export.featureTotal).toBe(3);
  });
});
