/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'delete-user', email: 'delete@example.com', preferences: {} },
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
  id: 'delete-me', title: 'Delete me', trackingNumber: 'RR123456789IL', carrier: 'israel-post',
  status: 'in_transit', category: 'other', isPinned: false, isArchived: false, checkpoints: []
};

describe('App package deletion', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(deliveryService.getStorageKey('delete-user'), JSON.stringify([pkg]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  it('removes the confirmed package through the real App delete handler', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<DashboardContent />);
    await screen.findByText('Delete me');
    await user.click(screen.getByTitle(/view details/i));
    await user.click(await screen.findByText(/^delete$/i));
    await user.click(await screen.findByText(/yes, delete/i));

    await waitFor(() => expect(deliveryService.getPackages('delete-user')).toEqual([]));
  });
});
