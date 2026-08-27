import { getCarrier } from '../types/carriers';
import { STAGES } from '../types/stages';

/**
 * Supported currency keys and their display symbols / metadata
 */
export const SUPPORTED_CURRENCIES = Object.freeze({
  ILS: { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', hebrewName: 'שקל ישראלי' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', hebrewName: 'דולר ארה״ב' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', hebrewName: 'אירו' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', hebrewName: 'פאונד בריטי' }
});

/**
 * Currency detection regex patterns for notes/titles extraction
 */
const CURRENCY_PATTERNS = [
  { code: 'ILS', regex: /(?:₪|ILS|NIS|ש"ח|שח|שקל|שקלים)\s*(\d+(?:[.,]\d+)?)/i },
  { code: 'ILS', regex: /(\d+(?:[.,]\d+)?)\s*(?:₪|ILS|NIS|ש"ח|שח|שקל|שקלים)/i },
  { code: 'USD', regex: /(?:\$|USD|דולר)\s*(\d+(?:[.,]\d+)?)/i },
  { code: 'USD', regex: /(\d+(?:[.,]\d+)?)\s*(?:\$|USD|דולר)/i },
  { code: 'EUR', regex: /(?:€|EUR|אירו|יורו)\s*(\d+(?:[.,]\d+)?)/i },
  { code: 'EUR', regex: /(\d+(?:[.,]\d+)?)\s*(?:€|EUR|אירו|יורו)/i },
  { code: 'GBP', regex: /(?:£|GBP|פאונד|ליש"ט|לישט)\s*(\d+(?:[.,]\d+)?)/i },
  { code: 'GBP', regex: /(\d+(?:[.,]\d+)?)\s*(?:£|GBP|פאונד|ליש"ט|לישט)/i }
];

/**
 * Safely parses monetary value and currency from package fields (value, price, amount, currency, notes, title)
 * @param {object} pkg
 * @returns {{ amount: number, currency: 'ILS' | 'USD' | 'EUR' | 'GBP' } | null}
 */
export function extractPackageValue(pkg) {
  if (!pkg || typeof pkg !== 'object') return null;

  // 1. Explicit amount / price / value property
  const explicitAmount = pkg.value ?? pkg.price ?? pkg.amount;
  let explicitCurrency = pkg.currency;

  if (typeof explicitAmount === 'number' && !Number.isNaN(explicitAmount) && explicitAmount > 0) {
    let normalizedCurrency = 'ILS';
    if (typeof explicitCurrency === 'string') {
      const upper = explicitCurrency.toUpperCase().trim();
      if (['ILS', 'NIS', '₪'].includes(upper)) normalizedCurrency = 'ILS';
      else if (['USD', '$'].includes(upper)) normalizedCurrency = 'USD';
      else if (['EUR', '€'].includes(upper)) normalizedCurrency = 'EUR';
      else if (['GBP', '£'].includes(upper)) normalizedCurrency = 'GBP';
    }
    return { amount: Math.round(explicitAmount * 100) / 100, currency: normalizedCurrency };
  }

  if (typeof explicitAmount === 'string') {
    const parsedNum = parseFloat(explicitAmount.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(parsedNum) && parsedNum > 0) {
      let normalizedCurrency = 'ILS';
      if (explicitAmount.includes('$') || /usd/i.test(explicitAmount)) normalizedCurrency = 'USD';
      else if (explicitAmount.includes('€') || /eur/i.test(explicitAmount)) normalizedCurrency = 'EUR';
      else if (explicitAmount.includes('£') || /gbp/i.test(explicitAmount)) normalizedCurrency = 'GBP';
      else if (explicitAmount.includes('₪') || /ils|nis|ש"ח/i.test(explicitAmount)) normalizedCurrency = 'ILS';
      return { amount: Math.round(parsedNum * 100) / 100, currency: normalizedCurrency };
    }
  }

  // 2. Scan notes, notesHe, title, titleHe
  const textFields = [pkg.notes, pkg.notesHe, pkg.title, pkg.titleHe].filter(t => typeof t === 'string' && t.length > 0);
  const combinedText = textFields.join(' ');

  for (const pattern of CURRENCY_PATTERNS) {
    const match = pattern.regex.exec(combinedText);
    if (match && match[1]) {
      const rawNum = match[1].replace(',', '.');
      const val = parseFloat(rawNum);
      if (!Number.isNaN(val) && val > 0 && val < 1000000) {
        return {
          amount: Math.round(val * 100) / 100,
          currency: pattern.code
        };
      }
    }
  }

  return null;
}

/**
 * Computes turnaround duration in days for a package from shipped/orderDate to delivered/updatedAt.
 * Guaranteed to return >= 1 when valid dates exist, or null when invalid.
 * 
 * @param {object} pkg
 * @returns {number | null} Transit days
 */
export function calculatePackageTransitDays(pkg) {
  if (!pkg || typeof pkg !== 'object') return null;

  // Try shipped checkpoint timestamp or orderDate or createdAt
  let startTime = null;
  if (Array.isArray(pkg.checkpoints) && pkg.checkpoints.length > 0) {
    const shippedCp = pkg.checkpoints.find(cp => 
      cp.title?.toLowerCase().includes('ship') || 
      cp.title?.toLowerCase().includes('dispatch') ||
      cp.titleHe?.includes('נשלח') ||
      cp.titleHe?.includes('יצא')
    );
    if (shippedCp?.timestamp) {
      const parsed = new Date(shippedCp.timestamp).getTime();
      if (!Number.isNaN(parsed)) startTime = parsed;
    }
  }

  if (!startTime && pkg.orderDate) {
    const parsed = new Date(pkg.orderDate).getTime();
    if (!Number.isNaN(parsed)) startTime = parsed;
  }

  if (!startTime && pkg.createdAt) {
    const parsed = new Date(pkg.createdAt).getTime();
    if (!Number.isNaN(parsed)) startTime = parsed;
  }

  if (!startTime) return null;

  let endTime = null;
  if (pkg.status === 'delivered') {
    if (Array.isArray(pkg.checkpoints) && pkg.checkpoints.length > 0) {
      const deliveredCp = pkg.checkpoints.find(cp => 
        cp.title?.toLowerCase().includes('deliver') || 
        cp.titleHe?.includes('נמסר') ||
        cp.titleHe?.includes('הגיע')
      );
      if (deliveredCp?.timestamp) {
        const parsed = new Date(deliveredCp.timestamp).getTime();
        if (!Number.isNaN(parsed)) endTime = parsed;
      }
    }
    if (!endTime && pkg.updatedAt) {
      const parsed = new Date(pkg.updatedAt).getTime();
      if (!Number.isNaN(parsed)) endTime = parsed;
    }
    if (!endTime) endTime = Date.now();
  } else {
    // In transit - calculate current transit days up to now
    endTime = Date.now();
  }

  const diffMs = endTime - startTime;
  if (diffMs < 0) return 1; // Safeguard against clock skew

  const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  return days;
}

/**
 * Computes transit days once for every delivered package and returns a lookup
 * keyed by the package object itself.
 *
 * `calculateDeliveryMetrics` and `calculateCarrierTurnaroundLeaderboard` both
 * need the same number for the same packages. Computing it here once and
 * handing the map to both spares a second checkpoint scan and a second round of
 * `Date` parsing per delivered package. Only delivered packages are computed,
 * exactly matching the set the two aggregators ask for.
 *
 * The key is the package object reference rather than `pkg.id`, so duplicate or
 * missing ids cannot collide.
 *
 * @param {Array<object>} packages
 * @returns {Map<object, number | null>}
 */
export function buildTransitDaysMap(packages = []) {
  const map = new Map();
  if (!Array.isArray(packages)) return map;
  for (const pkg of packages) {
    if (!pkg || typeof pkg !== 'object') continue;
    if (pkg.status !== 'delivered') continue;
    if (map.has(pkg)) continue;
    map.set(pkg, calculatePackageTransitDays(pkg));
  }
  return map;
}

/**
 * Reads a package's transit days from a prepared map, falling back to computing
 * it when no map (or no entry) was supplied.
 *
 * @param {object} pkg
 * @param {Map<object, number | null> | null | undefined} transitDays
 * @returns {number | null}
 */
function resolveTransitDays(pkg, transitDays) {
  if (transitDays instanceof Map && transitDays.has(pkg)) {
    return transitDays.get(pkg);
  }
  return calculatePackageTransitDays(pkg);
}

/**
 * Calculates Courier Turnaround Leaderboard:
 * Average transit duration (days) grouped by carrier, ranked fastest to slowest.
 * 
 * @param {Array<object>} packages
 * @param {Map<object, number | null>} [transitDays] Optional precomputed transit-day lookup (see buildTransitDaysMap)
 * @returns {Array<{ carrierId: string, carrierName: string, carrierHebrewName: string, avgDays: number, totalDelivered: number, totalActive: number, totalPackages: number, color: string }>}
 */
export function calculateCarrierTurnaroundLeaderboard(packages = [], transitDays = null) {
  if (!Array.isArray(packages) || packages.length === 0) return [];

  /** @type {Record<string, { totalDays: number, deliveredCount: number, activeCount: number }>} */
  const carrierMap = {};

  for (const pkg of packages) {
    if (!pkg || typeof pkg !== 'object') continue;
    const cid = pkg.carrier || 'other';

    if (!carrierMap[cid]) {
      carrierMap[cid] = { totalDays: 0, deliveredCount: 0, activeCount: 0 };
    }

    if (pkg.status === 'delivered') {
      carrierMap[cid].deliveredCount += 1;
      const days = resolveTransitDays(pkg, transitDays);
      if (days !== null) {
        carrierMap[cid].totalDays += days;
      }
    } else {
      carrierMap[cid].activeCount += 1;
    }
  }

  const leaderboard = Object.entries(carrierMap).map(([carrierId, stats]) => {
    const carrierDef = getCarrier(carrierId);
    const avgDays = stats.deliveredCount > 0
      ? Math.round((stats.totalDays / stats.deliveredCount) * 10) / 10
      : 0;

    return {
      carrierId,
      carrierName: carrierDef.name,
      carrierHebrewName: carrierDef.hebrewName,
      avgDays,
      totalDelivered: stats.deliveredCount,
      totalActive: stats.activeCount,
      totalPackages: stats.deliveredCount + stats.activeCount,
      color: carrierDef.color || 'from-slate-500 to-slate-700'
    };
  });

  // Sort: carriers with delivered packages and faster turnaround first, then by total volume
  return leaderboard.sort((a, b) => {
    if (a.avgDays > 0 && b.avgDays > 0) return a.avgDays - b.avgDays;
    if (a.avgDays > 0) return -1;
    if (b.avgDays > 0) return 1;
    return b.totalPackages - a.totalPackages;
  });
}

/**
 * Calculates Multi-Currency Spending Breakdown (partitioned by ILS, USD, EUR, GBP).
 * 
 * @param {Array<object>} packages
 * @returns {{
 *   currencies: Record<'ILS' | 'USD' | 'EUR' | 'GBP', { count: number, total: number, symbol: string, code: string, name: string, hebrewName: string }>,
 *   totalValuedPackages: number,
 *   hasValues: boolean
 * }}
 */
export function calculateMultiCurrencyBreakdown(packages = []) {
  const result = {
    ILS: { count: 0, total: 0, symbol: '₪', code: 'ILS', name: 'Israeli Shekel', hebrewName: 'שקל ישראלי' },
    USD: { count: 0, total: 0, symbol: '$', code: 'USD', name: 'US Dollar', hebrewName: 'דולר ארה״ב' },
    EUR: { count: 0, total: 0, symbol: '€', code: 'EUR', name: 'Euro', hebrewName: 'אירו' },
    GBP: { count: 0, total: 0, symbol: '£', code: 'GBP', name: 'British Pound', hebrewName: 'פאונד בריטי' }
  };

  if (!Array.isArray(packages) || packages.length === 0) {
    return { currencies: result, totalValuedPackages: 0, hasValues: false };
  }

  let totalValuedPackages = 0;

  for (const pkg of packages) {
    const val = extractPackageValue(pkg);
    if (val && result[val.currency]) {
      result[val.currency].count += 1;
      result[val.currency].total += val.amount;
      totalValuedPackages += 1;
    }
  }

  // Round totals to 2 decimals
  for (const code of Object.keys(result)) {
    result[code].total = Math.round(result[code].total * 100) / 100;
  }

  return {
    currencies: result,
    totalValuedPackages,
    hasValues: totalValuedPackages > 0
  };
}

/**
 * Calculates Delivery Success & Performance Metrics (on-time rate, success rate, stage distribution)
 * 
 * @param {Array<object>} packages
 * @param {Map<object, number | null>} [transitDays] Optional precomputed transit-day lookup (see buildTransitDaysMap)
 * @returns {{
 *   totalCount: number,
 *   deliveredCount: number,
 *   activeCount: number,
 *   customsCount: number,
 *   exceptionCount: number,
 *   deliverySuccessRate: number,
 *   onTimeRate: number,
 *   avgTransitDays: number,
 *   carrierDistribution: Record<string, { count: number, percentage: number }>,
 *   stageDistribution: Record<string, number>
 * }}
 */
export function calculateDeliveryMetrics(packages = [], transitDays = null) {
  if (!Array.isArray(packages) || packages.length === 0) {
    return {
      totalCount: 0,
      deliveredCount: 0,
      activeCount: 0,
      customsCount: 0,
      exceptionCount: 0,
      deliverySuccessRate: 100,
      onTimeRate: 100,
      avgTransitDays: 0,
      carrierDistribution: {},
      stageDistribution: {}
    };
  }

  const totalCount = packages.length;
  let deliveredCount = 0;
  let customsCount = 0;
  let exceptionCount = 0;
  let onTimeDeliveredCount = 0;
  const transitTimes = [];
  const carrierCounts = {};
  const stageDistribution = {};

  for (const s of STAGES) {
    stageDistribution[s.id] = 0;
  }

  for (const pkg of packages) {
    if (!pkg || typeof pkg !== 'object') continue;

    const cid = pkg.carrier || 'other';
    carrierCounts[cid] = (carrierCounts[cid] || 0) + 1;

    const status = pkg.status || 'in_transit';
    stageDistribution[status] = (stageDistribution[status] || 0) + 1;

    if (status === 'delivered') {
      deliveredCount += 1;
      const days = resolveTransitDays(pkg, transitDays);
      if (days !== null) transitTimes.push(days);

      // On-time calculation against expectedDeliveryDate
      if (pkg.expectedDeliveryDate && (pkg.updatedAt || pkg.orderDate)) {
        const expectedTime = new Date(pkg.expectedDeliveryDate).getTime();
        const deliveredTime = pkg.updatedAt ? new Date(pkg.updatedAt).getTime() : Date.now();
        if (!Number.isNaN(expectedTime) && !Number.isNaN(deliveredTime)) {
          if (deliveredTime <= expectedTime + (24 * 60 * 60 * 1000)) {
            onTimeDeliveredCount += 1;
          }
        } else {
          onTimeDeliveredCount += 1;
        }
      } else {
        onTimeDeliveredCount += 1;
      }
    } else if (status === 'customs') {
      customsCount += 1;
    } else if (status === 'exception') {
      exceptionCount += 1;
    }
  }

  const activeCount = totalCount - deliveredCount;
  const deliverySuccessRate = totalCount > 0 
    ? Math.round(((totalCount - exceptionCount) / totalCount) * 100)
    : 100;

  const onTimeRate = deliveredCount > 0
    ? Math.round((onTimeDeliveredCount / deliveredCount) * 100)
    : 100;

  const avgTransitDays = transitTimes.length > 0
    ? Math.round((transitTimes.reduce((a, b) => a + b, 0) / transitTimes.length) * 10) / 10
    : (packages.length > 0 ? 8 : 0);

  const carrierDistribution = {};
  for (const [cid, cnt] of Object.entries(carrierCounts)) {
    carrierDistribution[cid] = {
      count: cnt,
      percentage: totalCount > 0 ? Math.round((cnt / totalCount) * 100) : 0
    };
  }

  return {
    totalCount,
    deliveredCount,
    activeCount,
    customsCount,
    exceptionCount,
    deliverySuccessRate,
    onTimeRate,
    avgTransitDays,
    carrierDistribution,
    stageDistribution
  };
}
