import { describe, it, expect } from 'vitest';
import { buildActivityFeed, groupActivityByDay, dayLabel } from './activityFeed';

const pkg = (id, title, checkpoints, extra = {}) => ({
  id, title, trackingNumber: `TRK${id}`, checkpoints, ...extra
});

describe('buildActivityFeed', () => {
  it('merges checkpoints from every package into one newest-first feed', () => {
    const feed = buildActivityFeed([
      pkg('a', 'Headphones', [
        { id: '1', title: 'Shipped', timestamp: '2026-09-01T10:00:00Z' },
        { id: '2', title: 'In transit', timestamp: '2026-09-03T10:00:00Z' }
      ]),
      pkg('b', 'Kettle', [
        { id: '3', title: 'Out for delivery', timestamp: '2026-09-02T10:00:00Z' }
      ])
    ]);

    expect(feed.map((e) => e.title)).toEqual(['In transit', 'Out for delivery', 'Shipped']);
  });

  it('sorts by time rather than trusting the stored order', () => {
    // Carriers append checkpoints out of order often enough that relying on
    // array position would show a package moving backwards.
    const feed = buildActivityFeed([
      pkg('a', 'Out of order', [
        { id: '1', title: 'Newer', timestamp: '2026-09-05T10:00:00Z' },
        { id: '2', title: 'Older', timestamp: '2026-09-01T10:00:00Z' }
      ])
    ]);
    expect(feed.map((e) => e.title)).toEqual(['Newer', 'Older']);
  });

  it('excludes archived packages', () => {
    const feed = buildActivityFeed([
      pkg('a', 'Live', [{ id: '1', title: 'Moving', timestamp: '2026-09-03T10:00:00Z' }]),
      pkg('b', 'Done', [{ id: '2', title: 'Delivered', timestamp: '2026-09-04T10:00:00Z' }], { isArchived: true })
    ]);
    expect(feed).toHaveLength(1);
    expect(feed[0].title).toBe('Moving');
  });

  it('drops checkpoints with an unusable timestamp rather than guessing a position', () => {
    const feed = buildActivityFeed([
      pkg('a', 'Mixed', [
        { id: '1', title: 'Good', timestamp: '2026-09-03T10:00:00Z' },
        { id: '2', title: 'Bad', timestamp: 'not a date' },
        { id: '3', title: 'Missing' }
      ])
    ]);
    expect(feed.map((e) => e.title)).toEqual(['Good']);
  });

  it('carries the package identity onto each event', () => {
    const [event] = buildActivityFeed([
      pkg('a', 'Headphones', [{ id: '1', title: 'Shipped', timestamp: '2026-09-03T10:00:00Z' }])
    ]);
    expect(event.packageId).toBe('a');
    expect(event.packageTitle).toBe('Headphones');
    expect(event.trackingNumber).toBe('TRKa');
  });

  it('survives malformed input', () => {
    expect(buildActivityFeed(null)).toEqual([]);
    expect(buildActivityFeed([null, undefined])).toEqual([]);
    expect(buildActivityFeed([pkg('a', 'No checkpoints', undefined)])).toEqual([]);
    expect(buildActivityFeed([pkg('a', 'Nulls', [null])])).toEqual([]);
  });

  it('caps the feed', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: String(i), title: `cp${i}`, timestamp: `2026-09-0${(i % 9) + 1}T10:00:00Z`
    }));
    expect(buildActivityFeed([pkg('a', 'Many', many)], { limit: 10 })).toHaveLength(10);
  });
});

describe('groupActivityByDay', () => {
  it('groups by local calendar day, newest day first', () => {
    const feed = buildActivityFeed([
      pkg('a', 'X', [
        { id: '1', title: 'A', timestamp: '2026-09-03T09:00:00+03:00' },
        { id: '2', title: 'B', timestamp: '2026-09-03T18:00:00+03:00' },
        { id: '3', title: 'C', timestamp: '2026-09-01T09:00:00+03:00' }
      ])
    ]);
    const days = groupActivityByDay(feed);
    expect(days.map((d) => d.date)).toEqual(['2026-09-03', '2026-09-01']);
    expect(days[0].items).toHaveLength(2);
  });

  it('puts an after-midnight event on the day it locally happened', () => {
    // 01:30 on the 5th in Israel is still the 4th in UTC — the same bug the
    // date utils exist to prevent, and it would misfile events by a day.
    const feed = buildActivityFeed([
      pkg('a', 'X', [{ id: '1', title: 'Late', timestamp: '2026-09-05T01:30:00+03:00' }])
    ]);
    expect(groupActivityByDay(feed)[0].date).toBe('2026-09-05');
  });
});

describe('dayLabel', () => {
  const now = new Date('2026-09-05T12:00:00+03:00');

  it('uses relative labels only where they help', () => {
    expect(dayLabel('2026-09-05', 'en', now)).toBe('Today');
    expect(dayLabel('2026-09-04', 'en', now)).toBe('Yesterday');
    expect(dayLabel('2026-09-05', 'he', now)).toBe('היום');
    expect(dayLabel('2026-09-04', 'he', now)).toBe('אתמול');
  });

  it('falls back to a date for anything older', () => {
    expect(dayLabel('2026-09-01', 'en', now)).toMatch(/1 Sep/);
  });

  it('returns the input unchanged when it is not a date', () => {
    expect(dayLabel('nonsense', 'en', now)).toBe('nonsense');
  });
});
