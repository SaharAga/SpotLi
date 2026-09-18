/**
 * Haptic vibration presets for tactile micro-interactions across mobile devices.
 * Durations in ms or vibration/pause sequences.
 */
export const HAPTIC_PRESETS = {
  selection: 8,
  light: 12,
  medium: 20,
  heavy: 35,
  success: [10, 40, 20],
  warning: [25, 40, 25],
  error: [30, 40, 30, 40, 30]
};

/**
 * Gentle tactile vibration helper for mobile devices
 * Safe against environments where navigator.vibrate is unsupported
 * 
 * @param {string|number|number[]} pattern - Preset name ('selection', 'light', 'medium', 'heavy', 'success', 'warning', 'error'), duration in ms, or pattern array
 */
export function triggerHapticFeedback(pattern = 'light') {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && typeof window.navigator.vibrate === 'function') {
      const resolved = typeof pattern === 'string' && HAPTIC_PRESETS[pattern] !== undefined
        ? HAPTIC_PRESETS[pattern]
        : pattern;
      window.navigator.vibrate(resolved);
    }
  } catch {
    // Gracefully ignore devices that block or lack vibration APIs
  }
}

