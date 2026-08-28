/**
 * Utilities for calculating and formatting pickup & return deadline countdowns.
 */

/**
 * Calculates countdown and urgency status for locker / store pickup holding deadlines.
 *
 * @param {string|number|Date|undefined|null} deadlineStr
 * @param {Date} [now=new Date()]
 * @returns {{
 *   hasDeadline: boolean,
 *   isExpired: boolean,
 *   hoursRemaining: number,
 *   daysRemaining: number,
 *   urgency: 'critical' | 'warning' | 'normal' | 'expired',
 *   formattedHe: string,
 *   formattedEn: string
 * }}
 */
export function getPickupCountdown(deadlineStr, now = new Date()) {
  if (!deadlineStr) {
    return {
      hasDeadline: false,
      isExpired: false,
      hoursRemaining: 0,
      daysRemaining: 0,
      urgency: 'normal',
      formattedHe: '',
      formattedEn: ''
    };
  }

  const deadlineDate = new Date(deadlineStr);
  if (isNaN(deadlineDate.getTime())) {
    return {
      hasDeadline: false,
      isExpired: false,
      hoursRemaining: 0,
      daysRemaining: 0,
      urgency: 'normal',
      formattedHe: '',
      formattedEn: ''
    };
  }

  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return {
      hasDeadline: true,
      isExpired: true,
      hoursRemaining: 0,
      daysRemaining: 0,
      urgency: 'expired',
      formattedHe: 'פג תוקף האיסוף (סכנת החזרה לשולח)',
      formattedEn: 'Pickup expired (Return to sender risk)'
    };
  }

  if (diffHours <= 24) {
    return {
      hasDeadline: true,
      isExpired: false,
      hoursRemaining: diffHours,
      daysRemaining: diffDays,
      urgency: 'critical',
      formattedHe: diffHours === 1 ? 'שעה אחת נותרה לאיסוף!' : `נותרו ${diffHours} שעות לאיסוף!`,
      formattedEn: diffHours === 1 ? '1 hour left to pick up!' : `${diffHours} hours left to pick up!`
    };
  }

  if (diffHours <= 48) {
    return {
      hasDeadline: true,
      isExpired: false,
      hoursRemaining: diffHours,
      daysRemaining: diffDays,
      urgency: 'warning',
      formattedHe: `נותרו ${diffHours} שעות לאיסוף`,
      formattedEn: `${diffHours} hours left to pick up`
    };
  }

  return {
    hasDeadline: true,
    isExpired: false,
    hoursRemaining: diffHours,
    daysRemaining: diffDays,
    urgency: 'normal',
    formattedHe: diffDays === 1 ? 'נותר יום אחד לאיסוף' : `נותרו ${diffDays} ימים לאיסוף`,
    formattedEn: diffDays === 1 ? '1 day left to pick up' : `${diffDays} days left to pick up`
  };
}

/**
 * Calculates countdown and urgency status for post-delivery e-commerce return windows.
 *
 * @param {string|number|Date|undefined|null} returnDeadlineStr
 * @param {Date} [now=new Date()]
 * @returns {{
 *   hasDeadline: boolean,
 *   isExpired: boolean,
 *   daysRemaining: number,
 *   urgency: 'critical' | 'warning' | 'normal' | 'expired',
 *   formattedHe: string,
 *   formattedEn: string
 * }}
 */
export function getReturnCountdown(returnDeadlineStr, now = new Date()) {
  if (!returnDeadlineStr) {
    return {
      hasDeadline: false,
      isExpired: false,
      daysRemaining: 0,
      urgency: 'normal',
      formattedHe: '',
      formattedEn: ''
    };
  }

  const deadlineDate = new Date(returnDeadlineStr);
  if (isNaN(deadlineDate.getTime())) {
    return {
      hasDeadline: false,
      isExpired: false,
      daysRemaining: 0,
      urgency: 'normal',
      formattedHe: '',
      formattedEn: ''
    };
  }

  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return {
      hasDeadline: true,
      isExpired: true,
      daysRemaining: 0,
      urgency: 'expired',
      formattedHe: 'חלון ההחזרה הסתיים',
      formattedEn: 'Return window closed'
    };
  }

  if (diffDays <= 3) {
    return {
      hasDeadline: true,
      isExpired: false,
      daysRemaining: diffDays,
      urgency: 'critical',
      formattedHe: diffDays === 1 ? 'יום אחרון להחזרה לחנות!' : `נותרו ${diffDays} ימים אחרונים להחזרה!`,
      formattedEn: diffDays === 1 ? 'Last day to return item!' : `${diffDays} days left to return!`
    };
  }

  if (diffDays <= 7) {
    return {
      hasDeadline: true,
      isExpired: false,
      daysRemaining: diffDays,
      urgency: 'warning',
      formattedHe: `נותרו ${diffDays} ימים להחזרה`,
      formattedEn: `${diffDays} days left to return`
    };
  }

  return {
    hasDeadline: true,
    isExpired: false,
    daysRemaining: diffDays,
    urgency: 'normal',
    formattedHe: `נותרו ${diffDays} ימים להחזרה`,
    formattedEn: `${diffDays} days left to return`
  };
}

/**
 * Calculates a default return deadline ISO date (YYYY-MM-DD) from a base delivery date.
 *
 * @param {string|Date} [deliveryDate]
 * @param {number} [windowDays=14]
 * @returns {string} ISO Date string YYYY-MM-DD
 */
export function calculateDefaultReturnDeadline(deliveryDate, windowDays = 14) {
  const base = deliveryDate ? new Date(deliveryDate) : new Date();
  const validBase = isNaN(base.getTime()) ? new Date() : base;
  const target = new Date(validBase.getTime() + windowDays * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}
