/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerHapticFeedback, HAPTIC_PRESETS } from './haptics';

describe('haptics utility', () => {
  let originalVibrate;

  beforeEach(() => {
    originalVibrate = window.navigator.vibrate;
    window.navigator.vibrate = vi.fn();
  });

  afterEach(() => {
    window.navigator.vibrate = originalVibrate;
    vi.restoreAllMocks();
  });

  it('triggers default preset ("light") when called without arguments', () => {
    triggerHapticFeedback();
    expect(window.navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PRESETS.light);
  });

  it('resolves named presets accurately', () => {
    triggerHapticFeedback('selection');
    expect(window.navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PRESETS.selection);

    triggerHapticFeedback('medium');
    expect(window.navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PRESETS.medium);

    triggerHapticFeedback('heavy');
    expect(window.navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PRESETS.heavy);

    triggerHapticFeedback('success');
    expect(window.navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PRESETS.success);

    triggerHapticFeedback('warning');
    expect(window.navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PRESETS.warning);

    triggerHapticFeedback('error');
    expect(window.navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PRESETS.error);
  });

  it('passes numeric durations and custom pattern arrays through directly', () => {
    triggerHapticFeedback(25);
    expect(window.navigator.vibrate).toHaveBeenCalledWith(25);

    triggerHapticFeedback([10, 20, 30]);
    expect(window.navigator.vibrate).toHaveBeenCalledWith([10, 20, 30]);
  });

  it('gracefully handles unsupported browsers or thrown exceptions', () => {
    window.navigator.vibrate = undefined;
    expect(() => triggerHapticFeedback('light')).not.toThrow();

    window.navigator.vibrate = vi.fn(() => {
      throw new Error('NotAllowedError');
    });
    expect(() => triggerHapticFeedback('light')).not.toThrow();
  });
});
