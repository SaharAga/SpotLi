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
