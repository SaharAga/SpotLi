/**
 * Cached Intl.DateTimeFormat instances.
 *
 * Constructing an Intl formatter is one of the most expensive operations in the
 * JS runtime relative to calling .format(). These helpers are invoked once per
 * package card / table row / checkpoint, so a re-render of 50 packages would
 * otherwise build 50 formatters. Cache them at module scope, keyed by locale.
 */
const DATE_FORMAT_OPTIONS = {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
};

const DATE_TIME_FORMAT_OPTIONS = {
  ...DATE_FORMAT_OPTIONS,
  hour: '2-digit',
  minute: '2-digit'
};

const dateFormatterCache = new Map();
const dateTimeFormatterCache = new Map();

function resolveIntlLocale(locale) {
  return locale === 'he' ? 'he-IL' : 'en-US';
}

function getCachedFormatter(cache, locale, options) {
  const intlLocale = resolveIntlLocale(locale);
  let formatter = cache.get(intlLocale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocale, options);
    cache.set(intlLocale, formatter);
  }
  return formatter;
}

/**
 * Formats a Date as a LOCAL calendar date (YYYY-MM-DD).
 *
 * Deliberately not `toISOString().slice(0, 10)`, which is what this and ~20
 * inlined copies used to do. `toISOString()` is UTC, and Israel is UTC+2/+3 —
 * so between midnight and 02:00/03:00 local, "today" came back as *yesterday*.
 * That fed the default order date on every new package, the date pickers,
 * deadline arithmetic, and the smart parser's today/tomorrow resolution, so a
 * package added at 01:00 was silently dated a day early.
 *
 * The date this returns is the date on the user's wall calendar, which is what
 * every caller actually meant.
 *
 * @param {Date} [date=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function toLocalISODate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Returns today's date as a local ISO date-only string (YYYY-MM-DD).
 * @returns {string}
 */
export function todayISO() {
  return toLocalISODate();
}

/**
 * Formats a date string into a friendly localized display
 */
export function formatDate(dateString, locale = 'en') {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return getCachedFormatter(dateFormatterCache, locale, DATE_FORMAT_OPTIONS).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Formats full timestamp with time
 */
export function formatDateTime(dateString, locale = 'en') {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return getCachedFormatter(dateTimeFormatterCache, locale, DATE_TIME_FORMAT_OPTIONS).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Calculates days remaining until expected delivery date
 */
export function getDaysRemaining(expectedDateString, locale = 'en') {
  if (!expectedDateString) return null;
  try {
    const target = new Date(expectedDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { days: 0, text: locale === 'he' ? 'מגיע היום!' : 'Arriving today!', isUrgent: true, isLate: false };
    } else if (diffDays === 1) {
      return { days: 1, text: locale === 'he' ? 'מחר' : 'Tomorrow', isUrgent: true, isLate: false };
    } else if (diffDays > 1) {
      return {
        days: diffDays,
        text: locale === 'he' ? `עוד ${diffDays} ימים` : `In ${diffDays} days`,
        isUrgent: false,
        isLate: false
      };
    } else {
      const lateDays = Math.abs(diffDays);
      return {
        days: diffDays,
        text: locale === 'he' ? `באיחור של ${lateDays} ימים` : `${lateDays} days overdue`,
        isUrgent: true,
        isLate: true
      };
    }
  } catch {
    return null;
  }
}
