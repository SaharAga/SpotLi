/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';
import { STORAGE_KEYS } from './constants/storageKeys';
import { LEGAL_VERSION } from './constants/legal';

/*
 * Regression test for the auto-archive decline path (flagged as still
 * missing in #91 section 6). #60 previously fixed a ReferenceError where
 * handleConfirmAutoArchive / handleDeclineAutoArchive called
 * updateUserPreferences without destructuring it from useAuth() — the
 * auto-archive prompt was inert for every signed-in user. This drives the
 * real "mark delivered" -> prompt -> confirm/decline path through the App,
 * not a mocked shortcut, per the ownership ledger's "write the negative
 * control" note: without the #60 fix, both tests below throw instead of
 * resolving the toast/localStorage assertions.
 */

const updateUserPreferences = vi.fn();

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'archive-user', email: 'archive@example.com', legalAcceptedVersion: LEGAL_VERSION, preferences: {} },
    loading: false,
    triggerCloudSync: vi.fn(),
    logout: vi.fn(),
    updateUserPreferences,
    updateAiTrainingOptIn: vi.fn(),
    deleteUserAccountAndData: vi.fn(),
    syncStatus: 'idle',
    lastSyncTime: null
  }),
  AuthProvider: ({ children }) => children
}));
vi.mock('./context/ThemeContext', () => ({ useTheme: () => ({ isDark: false, theme: 'light', setTheme: vi.fn() }) }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('./services/cloudStorageAdapter', () => ({
  cloudAdapter: { subscribe: () => () => {}, isFirestoreActive: () => false, savePackages: vi.fn() }
}));

const pkg = {
  id: 'not-yet-delivered', title: 'Auto archive me', trackingNumber: 'RR987654321IL',
  carrier: 'israel-post', status: 'in_transit', category: 'other',
  isPinned: false, isArchived: false, checkpoints: []
};

function seed() {
  localStorage.clear();
  localStorage.setItem(deliveryService.getStorageKey('archive-user'), JSON.stringify([pkg]));
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
}

describe('Auto-archive prompt on first delivered package (#91 regression)', () => {
  beforeEach(() => {
    updateUserPreferences.mockClear();
    seed();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('confirming archives the package and persists the preference without crashing', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<DashboardContent />);
    await screen.findByText('Auto archive me');

    await user.click(screen.getByTitle(/mark.*delivered|סמן כנמסר/i));
    const confirmButton = await screen.findByRole(
      'button',
      { name: /yes, auto-archive|כן, העבר אוטומטית/i },
      { timeout: 3000 }
    );
    await user.click(confirmButton);

    await waitFor(() => {
      expect(updateUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ autoArchiveDelivered: true })
      );
    });
    await waitFor(() => {
      const [saved] = deliveryService.getPackages('archive-user');
      expect(saved.isArchived).toBe(true);
    });
    expect(localStorage.getItem(STORAGE_KEYS.AUTO_ARCHIVE_PROMPTED)).toBe('true');
  });

  it('declining leaves the package active and persists the preference without crashing', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<DashboardContent />);
    await screen.findByText('Auto archive me');

    await user.click(screen.getByTitle(/mark.*delivered|סמן כנמסר/i));
    const declineButton = await screen.findByRole(
      'button',
      { name: /no, keep in delivered|לא, השאר ברשימת/i },
      { timeout: 3000 }
    );
    await user.click(declineButton);

    await waitFor(() => {
      expect(updateUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ autoArchiveDelivered: false })
      );
    });
    const [saved] = deliveryService.getPackages('archive-user');
    expect(saved.isArchived).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.AUTO_ARCHIVE_PROMPTED)).toBe('true');
  });
});
