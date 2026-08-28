/**
 * Cooldown duration in milliseconds per tracking number (60 seconds)
 */
export const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;

/**
 * In-memory map of tracking number -> timestamp of last successful tracking fetch.
 * Maximum capacity bounded to avoid memory exhaustion attacks.
 */
export const trackingCooldownMap = new Map();
const MAX_COOLDOWN_MAP_SIZE = 1000;

/**
 * Check if a tracking number is currently rate-limited
 * @param {string} trackingNumber
 * @returns {{ isLimited: boolean, remainingMs: number }}
 */
export function checkRateLimit(trackingNumber) {
  if (!trackingNumber || typeof trackingNumber !== 'string') return { isLimited: false, remainingMs: 0 };
  const key = trackingNumber.trim().toUpperCase().slice(0, 100);
  const lastFetch = trackingCooldownMap.get(key);
  if (!lastFetch || typeof lastFetch !== 'number') {
    return { isLimited: false, remainingMs: 0 };
  }
  
  const elapsed = Date.now() - lastFetch;
  if (elapsed < RATE_LIMIT_COOLDOWN_MS) {
    return { isLimited: true, remainingMs: RATE_LIMIT_COOLDOWN_MS - elapsed };
  }
  return { isLimited: false, remainingMs: 0 };
}

/**
 * Record a successful fetch to start the cooldown
 * @param {string} trackingNumber
 */
export function recordTrackingFetch(trackingNumber) {
  if (!trackingNumber || typeof trackingNumber !== 'string') return;
  
  if (trackingCooldownMap.size >= MAX_COOLDOWN_MAP_SIZE) {
    const oldestKey = trackingCooldownMap.keys().next().value;
    trackingCooldownMap.delete(oldestKey);
  }
  
  trackingCooldownMap.set(trackingNumber.trim().toUpperCase().slice(0, 100), Date.now());
}

/**
 * Reset all or specific cooldowns (useful for testing and manual resets)
 * @param {string} [trackingNumber]
 */
export function resetTrackingCooldown(trackingNumber) {
  if (typeof trackingNumber === 'string' && trackingNumber.length > 0) {
    trackingCooldownMap.delete(trackingNumber.trim().toUpperCase().slice(0, 100));
  } else if (!trackingNumber) {
    trackingCooldownMap.clear();
  }
}
