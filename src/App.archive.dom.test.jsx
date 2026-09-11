/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'archive-test-user', email: 'archive@example.com', preferences: {} },
    loading: false,
    triggerCloudSync: vi.fn(), logout: vi.fn(), updateUserPreferences: vi.fn(),
    updateAiTrainingOptIn: vi.fn(), deleteUserAccountAndData: vi.fn(), syncStatus: 'idle', lastSyncTime: null
  }),
  AuthProvider: ({ children }) => children
}));
vi.mock('./context/ThemeContext', () => ({ useTheme: () => ({ isDark: false, theme: 'light', setTheme: vi.fn() }) }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('./services/cloudStorageAdapter', () => ({ cloudAdapter: { subscribe: () => () => {}, isFirestoreActive: () => false } }));

const pkg = {
  id: 'archive-me', title: 'Archive me package', trackingNumber: 'RR123456789IL', carrier: 'israel-post',
  status: 'in_transit', category: 'other', isPinned: false, isArchived: false, checkpoints: []
};

describe('App package archive with Undo capability', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(deliveryService.getStorageKey('archive-test-user'), JSON.stringify([pkg]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  it('shows undo button on archive toast and restores package when clicked', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<DashboardContent />);
    await screen.findByText('Archive me package');

    // Open card actions menu
    const moreBtn = screen.getByTitle(/view details/i);
    await user.click(moreBtn);

    // Click Archive
    const archiveBtn = await screen.findByRole('button', { name: /^archive$/i });
    await user.click(archiveBtn);

    // Verify package is archived
    await waitFor(() => {
      const stored = deliveryService.getPackages('archive-test-user');
      expect(stored[0].isArchived).toBe(true);
    });

    // Verify toast with Undo button is visible
    const undoBtn = await screen.findByRole('button', { name: /^undo$/i });
    expect(undoBtn).toBeInTheDocument();

    // Click Undo
    await user.click(undoBtn);

    // Verify package is unarchived
    await waitFor(() => {
      const restored = deliveryService.getPackages('archive-test-user');
      expect(restored[0].isArchived).toBe(false);
    });
  });
});
