/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { LEGAL_VERSION } from './constants/legal';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-chrome',
      email: 'u@example.com',
      legalAcceptedVersion: LEGAL_VERSION,
      preferences: {}
    },
    loading: false,
    triggerCloudSync: vi.fn(),
    logout: vi.fn(),
    updateUserPreferences: vi.fn(),
    updateAiTrainingOptIn: vi.fn(),
    deleteUserAccountAndData: vi.fn(),
    syncStatus: 'idle',
    lastSyncTime: null
  }),
  AuthProvider: ({ children }) => children
}));

vi.mock('./context/ThemeContext', () => ({
  useTheme: () => ({ isDark: true, theme: 'dark', setTheme: vi.fn() }),
  ThemeProvider: ({ children }) => children
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('./services/cloudStorageAdapter', () => ({
  cloudAdapter: {
    subscribe: () => () => {},
    isFirestoreActive: () => false,
    savePackages: vi.fn()
  }
}));

/**
 * The page must be exactly as tall as what it shows.
 *
 * BottomNav is `lg:hidden` and fixed to the bottom of the viewport, so on a
 * phone anything at the end of the document flow ends up underneath it. The
 * page footer did: 153px of height carrying a copyright line and the carrier
 * list that no mobile user could reach, sitting below a gap that read as the
 * page having run out of content early. Measured at max scroll on a 390x844
 * viewport, the footer spanned the region the tab bar occupies and ran past
 * the viewport edge.
 *
 * jsdom loads no stylesheets, so `getComputedStyle().display` here is the
 * useless default rather than what Tailwind would produce — these assert the
 * class contract, which is the part that actually decides the layout. The
 * geometry itself was verified in a real browser.
 */
describe('page chrome — nothing renders underneath the fixed bottom bar', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('keeps the page footer out of the flow below lg, where the tab bar covers it', () => {
    const { container } = renderWithLanguage(<DashboardContent />);
    const footer = container.querySelector('footer');
    expect(footer).not.toBeNull();

    const cls = footer.className;
    expect(cls).toContain('hidden');
    expect(cls).toMatch(/\blg:block\b/);
  });

  it('still shows the footer from lg up, where there is no bottom bar', () => {
    const { container } = renderWithLanguage(<DashboardContent />);
    const footer = container.querySelector('footer');
    // `hidden lg:block` is the pair that does this. A bare `hidden`, or a
    // `lg:hidden`, would take the footer away from desktop too — where it is
    // ordinary page furniture and the only place the carrier list is shown.
    expect(footer.className).not.toMatch(/\blg:hidden\b/);
    expect(footer.className).toMatch(/\blg:block\b/);
  });

  it('reserves the Feedback FAB width in the footer row instead of adding height', () => {
    const { container } = renderWithLanguage(<DashboardContent />);
    const row = container.querySelector('footer > div');
    expect(row).not.toBeNull();
    // The FAB is fixed at end-4 / bottom-5.5rem, so at the end of the scroll
    // it lands on this row's trailing text and clipped the carrier list
    // mid-word. Bottom padding would fix the overlap by making the page
    // taller by the FAB's whole height, which is the bug this file guards.
    expect(row.className).toMatch(/\blg:pe-\d+\b/);
    expect(row.className).not.toMatch(/\blg:pb-\d/);
  });
});
