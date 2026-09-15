import { describe, it, expect } from 'vitest';
import { isStandalonePwa } from './displayMode';

const fakeWindow = ({ standalone, modes = [], throwOnQuery = false } = {}) => ({
  navigator: standalone === undefined ? {} : { standalone },
  matchMedia: (query) => {
    if (throwOnQuery) throw new Error('unknown media feature');
    return { matches: modes.some((mode) => query === `(display-mode: ${mode})`) };
  }
});

describe('isStandalonePwa', () => {
  it('detects an iOS home-screen app', () => {
    // The case that matters: this is the context where a popup sign-in hangs
    // forever instead of failing, so auth must pick redirect before starting.
    expect(isStandalonePwa(fakeWindow({ standalone: true }))).toBe(true);
  });

  it('detects an installed app in any display mode a manifest can ask for', () => {
    for (const mode of ['standalone', 'fullscreen', 'minimal-ui']) {
      expect(isStandalonePwa(fakeWindow({ modes: [mode] }))).toBe(true);
    }
  });

  it('is false in an ordinary browser tab', () => {
    expect(isStandalonePwa(fakeWindow({ standalone: false, modes: ['browser'] }))).toBe(false);
    expect(isStandalonePwa(fakeWindow())).toBe(false);
  });

  it('survives a window that cannot answer, rather than throwing into the caller', () => {
    expect(isStandalonePwa(fakeWindow({ throwOnQuery: true }))).toBe(false);
    expect(isStandalonePwa({})).toBe(false);
    expect(isStandalonePwa(undefined)).toBe(false);
  });
});
