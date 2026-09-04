import { toLocalISODate } from './dateUtils';

/**
 * Flattens every package's checkpoints into one chronological feed.
 *
 * The tab this backs answers a question the others don't: Status is what you
 * have, Insights is how you're doing, Activity is *what moved since you last
 * looked* — which is the reason people open a tracking app between checks.
 *
 * Archived packages are excluded, the same rule the rest of the app uses: an
 * archived package is one you have finished caring about, and its history
 * would otherwise crowd out live movement.
 */

/** Newest first, and never trust the stored order — carriers append out of order. */
export function buildActivityFeed(packages, { limit = 200 } = {}) {
  if (!Array.isArray(packages)) return [];

  const events = [];

  for (const pkg of packages) {
    if (!pkg || pkg.isArchived) continue;
    const checkpoints = Array.isArray(pkg.checkpoints) ? pkg.checkpoints : [];

    for (const cp of checkpoints) {
      if (!cp) continue;
      const time = Date.parse(cp.timestamp);
      // A checkpoint with an unparseable timestamp cannot be placed on a
      // timeline, and guessing a position for it would be worse than omitting
      // it — it would silently claim something happened when it did not.
      if (Number.isNaN(time)) continue;

      events.push({
        id: `${pkg.id}:${cp.id || time}`,
        packageId: pkg.id,
        packageTitle: pkg.title || pkg.titleHe || pkg.trackingNumber || '',
        packageTitleHe: pkg.titleHe || pkg.title || pkg.trackingNumber || '',
        trackingNumber: pkg.trackingNumber || '',
        carrier: pkg.carrier || '',
        status: pkg.status || '',
        title: cp.title || '',
        titleHe: cp.titleHe || cp.title || '',
        description: cp.description || '',
        descriptionHe: cp.descriptionHe || cp.description || '',
        location: cp.location || '',
        timestamp: cp.timestamp,
        time
      });
    }
  }

  events.sort((a, b) => b.time - a.time);
  return events.slice(0, limit);
}

/**
 * Groups the feed into local calendar days, newest first.
 *
 * Local, not UTC — a checkpoint at 01:00 belongs to the day you would say it
 * happened, which is the same reason `toLocalISODate` exists.
 */
export function groupActivityByDay(events) {
  if (!Array.isArray(events)) return [];

  const days = new Map();
  for (const event of events) {
    const key = toLocalISODate(new Date(event.time));
    if (!key) continue;
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(event);
  }

  return [...days.entries()].map(([date, items]) => ({ date, items }));
}

/** "Today", "Yesterday", or the date — relative labels only where they help. */
export function dayLabel(dateISO, language = 'en', now = new Date()) {
  const today = toLocalISODate(now);
  const yesterday = toLocalISODate(new Date(now.getTime() - 86400000));

  if (dateISO === today) return language === 'he' ? 'היום' : 'Today';
  if (dateISO === yesterday) return language === 'he' ? 'אתמול' : 'Yesterday';

  const d = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  });
}
