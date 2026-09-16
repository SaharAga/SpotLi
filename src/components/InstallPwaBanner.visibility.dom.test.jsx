/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

vi.mock('../services/featureUsageService', () => ({
  recordFeatureUse: vi.fn()
}));

import { InstallPwaBanner } from './InstallPwaBanner';
import { LanguageProvider } from '../context/LanguageContext';

/**
 * The banner reports whether it is on screen so App can avoid stacking a
 * second promotional banner underneath it.
 *
 * Worth pinning because the caller cannot work this out for itself: the answer
 * depends on standalone display mode, a 7-day dismissal window in localStorage
 * and the `beforeinstallprompt` event. Before this, the install prompt and the
 * feature nudge could both be up at once, and together with the demo bar, KPI
 * row, search and filter chips they pushed every package below the fold.
 */
function renderBanner() {
  const onVisibilityChange = vi.fn();
  render(
    <LanguageProvider>
      <InstallPwaBanner onVisibilityChange={onVisibilityChange} />
    </LanguageProvider>
  );
  return onVisibilityChange;
}

function mockStandalone(isStandalone) {
  window.matchMedia = (query) => ({
    matches: query === '(display-mode: standalone)' ? isStandalone : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('deliveree_lang', 'en');
  mockStandalone(false);
  delete window.navigator.standalone;
});

describe('InstallPwaBanner visibility reporting', () => {
  it('reports visible when not installed and not recently dismissed', () => {
    const onVisibilityChange = renderBanner();
    expect(onVisibilityChange).toHaveBeenCalledWith(true);
  });

  it('reports hidden when already running as an installed PWA', () => {
    mockStandalone(true);
    const onVisibilityChange = renderBanner();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('reports hidden while a dismissal is still inside the 7-day window', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    localStorage.setItem('deliveree_pwa_banner_dismissed', String(twoDaysAgo));
    const onVisibilityChange = renderBanner();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('reports visible again once the dismissal window has lapsed', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem('deliveree_pwa_banner_dismissed', String(eightDaysAgo));
    const onVisibilityChange = renderBanner();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  it('renders without the callback, so the prop stays optional', () => {
    expect(() =>
      render(
        <LanguageProvider>
          <InstallPwaBanner />
        </LanguageProvider>
      )
    ).not.toThrow();
  });
});

/**
 * The iOS Safari branch, which shipped broken and white-screened the app on
 * every iPhone.
 *
 * `checkStandalone` survived a rename to `isStandalonePwa()` in one place and
 * not the other. Because the reference sat behind `isIOSDevice && isSafari &&`,
 * JS short-circuiting meant no other platform ever evaluated it — the whole
 * suite above passed, desktop was fine, and only a real iPhone hit the
 * ReferenceError, which took down the entire render tree.
 *
 * Every test above renders under jsdom's default user agent, so none of them
 * could reach this branch. Pinning it means setting a real iOS Safari UA.
 */
function mockUserAgent(ua) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('InstallPwaBanner on iOS Safari', () => {
  it('renders without throwing', () => {
    // The regression test. Before the fix this threw
    // "ReferenceError: checkStandalone is not defined".
    mockUserAgent(IOS_SAFARI_UA);
    expect(() => renderBanner()).not.toThrow();
  });

  it('offers the add-to-home-screen guide when not installed', () => {
    mockUserAgent(IOS_SAFARI_UA);
    const onVisibilityChange = renderBanner();
    expect(onVisibilityChange).toHaveBeenCalledWith(true);
  });

  it('stays out of the way once already installed', () => {
    // The branch the broken reference was guarding: an iPhone already running
    // the installed PWA must not be told to install it again.
    mockUserAgent(IOS_SAFARI_UA);
    mockStandalone(true);
    const onVisibilityChange = renderBanner();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
  });
});
