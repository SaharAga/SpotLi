/**
 * Service for parsing, resolving, and evaluating live store and pickup point operating hours,
 * with full Israeli calendar & Shabbat schedule intelligence.
 *
 * Module Layering: Pure leaf module (utils/); does not import components, hooks, or context.
 */

import { sanitizeString } from './packageValidator.js';

/**
 * Common Israeli holiday eve (Erev Chag) and Chag / statutory closure dates.
 * Format: 'YYYY-MM-DD'
 */
const ISRAELI_HOLIDAYS = {
  // 2026
  '2026-03-03': { nameHe: 'ערב פורים', nameEn: 'Erev Purim', isErev: true },
  '2026-03-04': { nameHe: 'פורים', nameEn: 'Purim', isChag: true },
  '2026-04-01': { nameHe: 'ערב פסח', nameEn: 'Erev Pesach', isErev: true, earlyClosure: '13:00' },
  '2026-04-02': { nameHe: 'פסח (יום א׳)', nameEn: 'Pesach Day 1', isChag: true },
  '2026-04-07': { nameHe: 'ערב שביעי של פסח', nameEn: 'Erev 7th of Pesach', isErev: true, earlyClosure: '13:00' },
  '2026-04-08': { nameHe: 'שביעי של פסח', nameEn: '7th of Pesach', isChag: true },
  '2026-04-21': { nameHe: 'יום הזיכרון (ערב יום העצמאות)', nameEn: 'Yom HaZikaron', isErev: true, earlyClosure: '14:00' },
  '2026-04-22': { nameHe: 'יום העצמאות', nameEn: 'Yom HaAtzmaut', isChag: true },
  '2026-05-21': { nameHe: 'ערב שבועות', nameEn: 'Erev Shavuot', isErev: true, earlyClosure: '13:00' },
  '2026-05-22': { nameHe: 'שבועות', nameEn: 'Shavuot', isChag: true },
  '2026-09-11': { nameHe: 'ערב ראש השנה', nameEn: 'Erev Rosh Hashana', isErev: true, earlyClosure: '12:30' },
  '2026-09-12': { nameHe: 'ראש השנה (יום א׳)', nameEn: 'Rosh Hashana Day 1', isChag: true },
  '2026-09-13': { nameHe: 'ראש השנה (יום ב׳)', nameEn: 'Rosh Hashana Day 2', isChag: true },
  '2026-09-20': { nameHe: 'ערב יום כיפור', nameEn: 'Erev Yom Kippur', isErev: true, earlyClosure: '12:00' },
  '2026-09-21': { nameHe: 'יום כיפור', nameEn: 'Yom Kippur', isChag: true },
  '2026-09-25': { nameHe: 'ערב סוכות', nameEn: 'Erev Sukkot', isErev: true, earlyClosure: '13:00' },
  '2026-09-26': { nameHe: 'סוכות (יום א׳)', nameEn: 'Sukkot Day 1', isChag: true },
  '2026-10-02': { nameHe: 'ערב שמחת תורה', nameEn: 'Erev Simchat Torah', isErev: true, earlyClosure: '13:00' },
  '2026-10-03': { nameHe: 'שמחת תורה', nameEn: 'Simchat Torah', isChag: true },
  // 2027
  '2027-04-21': { nameHe: 'ערב פסח', nameEn: 'Erev Pesach', isErev: true, earlyClosure: '13:00' },
  '2027-04-22': { nameHe: 'פסח', nameEn: 'Pesach', isChag: true },
  '2027-10-01': { nameHe: 'ערב ראש השנה', nameEn: 'Erev Rosh Hashana', isErev: true, earlyClosure: '12:30' },
  '2027-10-10': { nameHe: 'ערב יום כיפור', nameEn: 'Erev Yom Kippur', isErev: true, earlyClosure: '12:00' },
  '2027-10-11': { nameHe: 'יום כיפור', nameEn: 'Yom Kippur', isChag: true }
};

/** Last date the ISRAELI_HOLIDAYS table has an entry for — review/extend this table past this date. */
const ISRAELI_HOLIDAYS_LAST_KNOWN_DATE = '2027-10-11';
let hasWarnedStaleHolidayTable = false;

/**
 * Returns the calendar date key (YYYY-MM-DD) for a given instant, in Israel local time —
 * not UTC, so holiday/Shabbat checks near local midnight resolve to the correct day.
 */
function getIsraeliDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(date);
}

/**
 * Known Israeli Post & Pickup Directories for Tier 2 matching.
 */
export const KNOWN_HUB_DIRECTORIES = [
  {
    matchRegex: /(?:דואר\s*ישראל|סניף\s*דואר|סוכנות\s*דואר|israel\s*post)/i,
    hoursHe: 'א׳, ג׳, ה׳ 08:00-18:00, ב׳, ד׳ 08:00-13:30, ו׳ 08:00-12:30',
    hoursEn: 'Sun, Tue, Thu 08:00-18:00, Mon, Wed 08:00-13:30, Fri 08:00-12:30',
    type: 'post_office'
  },
  {
    matchRegex: /(?:לוקר|עמדה\s*אוטומטית|boxit|בוקסיט|yellow\s*box|24\/7)/i,
    hoursHe: '24/7 (פתוח תמיד)',
    hoursEn: '24/7 (Always Open)',
    type: 'locker',
    is24_7: true
  },
  {
    matchRegex: /(?:עזריאלי|azrieli|דיזנגוף\s*סנטר|dizengoff\s*center|קניון|mall)/i,
    hoursHe: 'א׳-ה׳ 09:30-22:00, ו׳ 09:00-15:00, מוצ״ש 19:30-23:00',
    hoursEn: 'Sun-Thu 09:30-22:00, Fri 09:00-15:00, Sat 19:30-23:00',
    type: 'mall'
  },
  {
    matchRegex: /(?:סופר-?פארם|super-?pharm|be\s*pharm)/i,
    hoursHe: 'א׳-ה׳ 08:30-22:00, ו׳ 08:30-15:00, מוצ״ש 19:00-23:00',
    hoursEn: 'Sun-Thu 08:30-22:00, Fri 08:30-15:00, Sat 19:00-23:00',
    type: 'pharmacy'
  }
];

/**
 * Standard default fallback schedule for Israeli commercial shops / pickup kiosks.
 */
export const DEFAULT_ISRAELI_RETAIL_HOURS = {
  hoursHe: 'א׳-ה׳ 09:00-20:00, ו׳ 09:00-14:00',
  hoursEn: 'Sun-Thu 09:00-20:00, Fri 09:00-14:00',
  isEstimated: true
};

/**
 * Extracts opening hours string from raw courier SMS or email text.
 *
 * @param {string} text
 * @returns {string} Extracted hours string or empty
 */
export function extractOpeningHours(text) {
  if (!text || typeof text !== 'string') return '';

  const patterns = [
    /(?:שעות\s*פתיחה|שעות\s*פעילות|שעות\s*מסירה|שעות\s*קבלת\s*קהל|זמני\s*פתיחה|שעות)[\s:-]+([^\r\n,;]+(?:,[^\r\n,;]+)?)/i,
    /(?:opening\s*hours|business\s*hours|hours\s*of\s*operation|hours)[\s:-]+([^\r\n,;]+(?:,[^\r\n,;]+)?)/i,
    /\b(24\/7(?:\s*\([^)]+\))?|תמיד\s*פתוח|פתוח\s*24\s*שעות)\b/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const cleaned = sanitizeString(match[1].trim(), 200);
      if (cleaned && cleaned.length >= 4 && !/^(?:http|https|www)$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return '';
}

/**
 * Implements the 3-Tier Opening Hours Resolution hierarchy.
 * Tier 1: Explicitly provided hours (e.g. from SMS/email)
 * Tier 2: Directory match for known hubs (Israel Post branches, Malls, 24/7 BoxIt lockers)
 * Tier 3: Carrier & Location Heuristic fallback (e.g. standard Israeli retail hours)
 *
 * @param {string} locationName
 * @param {string} [explicitHours='']
 * @param {string} [carrier='']
 * @returns {{
 *   hoursHe: string,
 *   hoursEn: string,
 *   source: 'explicit' | 'directory' | 'heuristic',
 *   is24_7: boolean,
 *   isEstimated: boolean
 * }}
 */
export function resolveStoreHours(locationName = '', explicitHours = '', carrier = '') {
  const cleanExplicit = (explicitHours || '').trim();
  if (cleanExplicit) {
    const is24_7 = is24_7Hours(cleanExplicit);
    return {
      hoursHe: cleanExplicit,
      hoursEn: cleanExplicit,
      source: 'explicit',
      is24_7,
      isEstimated: false
    };
  }

  const cleanLocation = (locationName || '').trim();
  const searchCorpus = `${cleanLocation} ${carrier}`;

  // Tier 2: Known Directory Match
  for (const hub of KNOWN_HUB_DIRECTORIES) {
    if (hub.matchRegex.test(searchCorpus)) {
      return {
        hoursHe: hub.hoursHe,
        hoursEn: hub.hoursEn,
        source: 'directory',
        is24_7: Boolean(hub.is24_7),
        isEstimated: false
      };
    }
  }

  // Tier 3: Standard Israeli Retail Heuristic
  return {
    hoursHe: DEFAULT_ISRAELI_RETAIL_HOURS.hoursHe,
    hoursEn: DEFAULT_ISRAELI_RETAIL_HOURS.hoursEn,
    source: 'heuristic',
    is24_7: false,
    isEstimated: true
  };
}

/**
 * Checks if a given hours string represents a 24/7 locker or always-open location.
 * @param {string} hoursStr
 * @returns {boolean}
 */
export function is24_7Hours(hoursStr) {
  if (!hoursStr || typeof hoursStr !== 'string') return false;
  return /24\/7|תמיד\s*פתוח|always\s*open|24\s*שעות|open\s*24/i.test(hoursStr);
}

/**
 * Converts a time string "HH:MM" to minutes from midnight (0..1439).
 * @param {string} timeStr
 * @returns {number|null}
 */
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Formats minutes from midnight to "HH:MM".
 * @param {number} minutes
 * @returns {string}
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parses days ranges into an array of JS day numbers (0 = Sun, 1 = Mon, ..., 6 = Sat).
 * @param {string} dayStr
 * @returns {number[]}
 */
function parseDayTokens(dayStr) {
  const d = dayStr.toLowerCase().trim();
  const days = [];

  // Hebrew Ranges (e.g. א-ה, א׳-ה׳, א'-ה')
  if (/^[אa]-?[הe]/i.test(d) || /^[אa]['׳`״]?-[הe]['׳`״]?/i.test(d) || /sun(?:day)?-thu(?:rsday)?/i.test(d)) {
    return [0, 1, 2, 3, 4];
  }
  // Hebrew Friday (ו, ו׳, ו', שישי, fri, friday)
  if (/^[וw]['׳`״]?$/i.test(d) || /שישי|יום\s*ו|fri(?:day)?/i.test(d)) {
    return [5];
  }
  // Saturday / Motzash (ש, שבת, מוצ"ש, מוצ״ש, sat, saturday)
  if (/^ש['׳`״]?$|שבת|מוצ[״"׳']ש|sat(?:urday)?/i.test(d)) {
    return [6];
  }
  // Individual Hebrew days: א, ב, ג, ד, ה
  if (/^[אa]['׳`״]?$|ראשון|sun/i.test(d)) days.push(0);
  if (/^[בb]['׳`״]?$|שני|mon/i.test(d)) days.push(1);
  if (/^[גc]['׳`״]?$|שלישי|tue/i.test(d)) days.push(2);
  if (/^[דd]['׳`״]?$|רביעי|wed/i.test(d)) days.push(3);
  if (/^[הe]['׳`״]?$|חמישי|thu/i.test(d)) days.push(4);

  return days;
}

/**
 * Parses unstructured or semi-structured weekly hours strings into structured daily intervals.
 *
 * @param {string} hoursStr
 * @returns {Record<number, Array<{ open: number, close: number }>>} Map of day (0..6) -> open/close minutes
 */
export function parseOpeningHours(hoursStr) {
  const schedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  if (!hoursStr || typeof hoursStr !== 'string') return schedule;

  if (is24_7Hours(hoursStr)) {
    for (let day = 0; day <= 6; day++) {
      schedule[day].push({ open: 0, close: 1439 });
    }
    return schedule;
  }

  // Split by comma or semicolon or newline
  const segments = hoursStr.split(/[,;\n]+/);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // Look for times: e.g. 08:00-19:00 or 08:00 - 19:00
    const timeMatch = trimmed.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
    if (!timeMatch) continue;

    const openMin = timeToMinutes(timeMatch[1]);
    const closeMin = timeToMinutes(timeMatch[2]);
    if (openMin === null || closeMin === null) continue;

    // Day prefix before the time
    const dayPrefix = trimmed.slice(0, timeMatch.index).trim();
    let targetDays = parseDayTokens(dayPrefix);

    if (targetDays.length === 0) {
      // If segment mentions Sun-Thu or א-ה explicitly
      if (/(?:א|sun).*?(?:ה|thu)/i.test(trimmed)) targetDays = [0, 1, 2, 3, 4];
      else if (/(?:ו|fri)/i.test(trimmed)) targetDays = [5];
      else if (/(?:ש|sat)/i.test(trimmed)) targetDays = [6];
      else targetDays = [0, 1, 2, 3, 4]; // Default to work week
    }

    for (const d of targetDays) {
      schedule[d].push({ open: openMin, close: closeMin });
    }
  }

  // If no intervals were extracted at all, populate with standard Israeli retail fallback
  const hasAnyInterval = Object.values(schedule).some(arr => arr.length > 0);
  if (!hasAnyInterval) {
    for (let day = 0; day <= 4; day++) {
      schedule[day].push({ open: 540, close: 1200 }); // 09:00 - 20:00
    }
    schedule[5].push({ open: 540, close: 840 }); // 09:00 - 14:00 (Friday)
  }

  return schedule;
}

/**
 * Checks Israeli statutory holiday schedule notice for a given date.
 *
 * @param {Date} [date=new Date()]
 * @returns {{ isHoliday: boolean, isErev: boolean, holidayNameHe: string, holidayNameEn: string, earlyClosureTime?: string }|null}
 */
export function getIsraeliHolidayNotice(date = new Date()) {
  const dateKey = getIsraeliDateKey(date);
  if (dateKey > ISRAELI_HOLIDAYS_LAST_KNOWN_DATE) {
    if (!hasWarnedStaleHolidayTable) {
      hasWarnedStaleHolidayTable = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[openingHoursService] ISRAELI_HOLIDAYS table has no entries past ${ISRAELI_HOLIDAYS_LAST_KNOWN_DATE}; ` +
        'holiday/Shabbat closures cannot be detected for this date. Extend the table.'
      );
    }
    return null;
  }
  const holiday = ISRAELI_HOLIDAYS[dateKey];
  if (!holiday) return null;

  return {
    isHoliday: Boolean(holiday.isChag),
    isErev: Boolean(holiday.isErev),
    holidayNameHe: holiday.nameHe,
    holidayNameEn: holiday.nameEn,
    earlyClosureTime: holiday.earlyClosure
  };
}

/**
 * Evaluates live Open/Closed status, next state transitions, Friday Shabbat alerts, and badge styles.
 *
 * @param {string} hoursStr
 * @param {{ now?: Date, locationName?: string, carrier?: string }} [options={}]
 * @returns {{
 *   isOpen: boolean,
 *   is24_7: boolean,
 *   state: 'open' | 'closing_soon' | 'closed' | 'opens_soon' | 'shabbat_closed' | 'holiday_closed',
 *   badgeTextHe: string,
 *   badgeTextEn: string,
 *   nextChangeHe: string,
 *   nextChangeEn: string,
 *   warningHe?: string,
 *   warningEn?: string,
 *   badgeClass: string
 * }}
 */
export function getLiveStoreStatus(hoursStr = '', options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const locationName = options.locationName || '';
  const carrier = options.carrier || '';

  // Resolve hours through 3-tier hierarchy if raw string is missing
  const resolved = resolveStoreHours(locationName, hoursStr, carrier);
  const effectiveHours = resolved.hoursHe;
  const is24_7 = resolved.is24_7;

  if (is24_7) {
    return {
      isOpen: true,
      is24_7: true,
      state: 'open',
      badgeTextHe: 'פתוח 24/7',
      badgeTextEn: 'Open 24/7',
      nextChangeHe: 'עמדת איסוף אוטומטית פתוחה תמיד',
      nextChangeEn: 'Automated locker always open',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    };
  }

  const currentDay = now.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const schedule = parseOpeningHours(effectiveHours);

  // Check Holiday Notice
  const holidayNotice = getIsraeliHolidayNotice(now);
  if (holidayNotice && holidayNotice.isHoliday) {
    return {
      isOpen: false,
      is24_7: false,
      state: 'holiday_closed',
      badgeTextHe: `סגור (${holidayNotice.holidayNameHe})`,
      badgeTextEn: `Closed (${holidayNotice.holidayNameEn})`,
      nextChangeHe: `סגור לרגל ${holidayNotice.holidayNameHe}`,
      nextChangeEn: `Closed for ${holidayNotice.holidayNameEn}`,
      warningHe: `נקודת האיסוף סגורה היום לרגל ${holidayNotice.holidayNameHe}.`,
      warningEn: `Pickup location is closed today for ${holidayNotice.holidayNameEn}.`,
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    };
  }

  // Check Saturday / Shabbat Closure
  if (currentDay === 6) {
    const saturdaySlots = schedule[6] || [];
    const isSaturdayOpen = saturdaySlots.some(s => currentMinutes >= s.open && currentMinutes < s.close);

    if (!isSaturdayOpen) {
      const sundaySlots = schedule[0] || [];
      const sundayOpenTime = sundaySlots[0] ? minutesToTime(sundaySlots[0].open) : '08:30';
      return {
        isOpen: false,
        is24_7: false,
        state: 'shabbat_closed',
        badgeTextHe: 'סגור לרגל שבת',
        badgeTextEn: 'Closed for Shabbat',
        nextChangeHe: `ייפתח ביום ראשון ב-${sundayOpenTime}`,
        nextChangeEn: `Opens Sunday at ${sundayOpenTime}`,
        warningHe: 'סגור בשבת. מומלץ לתכנן את האיסוף ליום ראשון בבוקר.',
        warningEn: 'Closed on Shabbat. Plan pickup for Sunday morning.',
        badgeClass: 'bg-slate-800 text-slate-300 border-slate-700'
      };
    }
  }

  const todaySlots = schedule[currentDay] || [];
  let isCurrentlyOpen = false;
  let activeSlot = null;
  let nextSlotToday = null;

  for (const slot of todaySlots) {
    if (currentMinutes >= slot.open && currentMinutes < slot.close) {
      isCurrentlyOpen = true;
      activeSlot = slot;
      break;
    } else if (currentMinutes < slot.open && (!nextSlotToday || slot.open < nextSlotToday.open)) {
      nextSlotToday = slot;
    }
  }

  // Friday Erev Shabbat Warning Logic
  let fridayWarningHe = undefined;
  let fridayWarningEn = undefined;
  if (currentDay === 5 && todaySlots.length > 0) {
    const fridayClose = minutesToTime(todaySlots[0].close);
    fridayWarningHe = `סגירה מוקדמת היום לרגל שבת (${fridayClose}). אספו בהקדם!`;
    fridayWarningEn = `Early Friday Shabbat closure today (${fridayClose}). Collect early!`;
  }

  // 1. OPEN NOW
  if (isCurrentlyOpen && activeSlot) {
    const minutesToClose = activeSlot.close - currentMinutes;
    const closeTimeStr = minutesToTime(activeSlot.close);

    if (minutesToClose <= 45) {
      return {
        isOpen: true,
        is24_7: false,
        state: 'closing_soon',
        badgeTextHe: `נסגר בקרוב (${closeTimeStr})`,
        badgeTextEn: `Closes Soon (${closeTimeStr})`,
        nextChangeHe: `נסגר בעוד ${minutesToClose} דקות (${closeTimeStr})`,
        nextChangeEn: `Closes in ${minutesToClose} min (${closeTimeStr})`,
        warningHe: fridayWarningHe,
        warningEn: fridayWarningEn,
        badgeClass: 'bg-amber-500/25 text-amber-300 border-amber-500/40 animate-pulse'
      };
    }

    return {
      isOpen: true,
      is24_7: false,
      state: 'open',
      badgeTextHe: 'פתוח עכשיו',
      badgeTextEn: 'Open Now',
      nextChangeHe: `נסגר ב-${closeTimeStr}`,
      nextChangeEn: `Closes at ${closeTimeStr}`,
      warningHe: fridayWarningHe,
      warningEn: fridayWarningEn,
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    };
  }

  // 2. OPENS SOON TODAY
  if (nextSlotToday) {
    const minutesToOpen = nextSlotToday.open - currentMinutes;
    const openTimeStr = minutesToTime(nextSlotToday.open);

    if (minutesToOpen <= 45) {
      return {
        isOpen: false,
        is24_7: false,
        state: 'opens_soon',
        badgeTextHe: `נפתח בקרוב (${openTimeStr})`,
        badgeTextEn: `Opens Soon (${openTimeStr})`,
        nextChangeHe: `נפתח בעוד ${minutesToOpen} דקות (${openTimeStr})`,
        nextChangeEn: `Opens in ${minutesToOpen} min (${openTimeStr})`,
        badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      };
    }

    return {
      isOpen: false,
      is24_7: false,
      state: 'closed',
      badgeTextHe: 'סגור כעת',
      badgeTextEn: 'Closed',
      nextChangeHe: `ייפתח היום ב-${openTimeStr}`,
      nextChangeEn: `Opens today at ${openTimeStr}`,
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700'
    };
  }

  // 3. CLOSED FOR THE REST OF THE DAY -> Find next day's opening
  let nextDay = (currentDay + 1) % 7;
  let nextOpeningStrHe = 'מחר';
  let nextOpeningStrEn = 'tomorrow';

  if (nextDay === 6 && (schedule[6] || []).length === 0) {
    nextDay = 0; // Skip Saturday to Sunday
    nextOpeningStrHe = 'ביום ראשון';
    nextOpeningStrEn = 'on Sunday';
  } else if (nextDay === 0) {
    nextOpeningStrHe = 'ביום ראשון';
    nextOpeningStrEn = 'on Sunday';
  }

  const nextDaySlots = schedule[nextDay] || [];
  const nextOpenTime = nextDaySlots[0] ? minutesToTime(nextDaySlots[0].open) : '08:30';

  return {
    isOpen: false,
    is24_7: false,
    state: 'closed',
    badgeTextHe: 'סגור כעת',
    badgeTextEn: 'Closed',
    nextChangeHe: `ייפתח ${nextOpeningStrHe} ב-${nextOpenTime}`,
    nextChangeEn: `Opens ${nextOpeningStrEn} at ${nextOpenTime}`,
    warningHe: currentDay === 5 ? 'הסניף נסגר לסופ״ש. ייפתח מחדש ביום ראשון.' : undefined,
    warningEn: currentDay === 5 ? 'Branch closed for the weekend. Re-opens Sunday.' : undefined,
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700'
  };
}
