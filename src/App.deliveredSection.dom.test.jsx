/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './App';
import { renderWithLanguage } from './test-utils/renderWithProviders';
import { deliveryService } from './services/deliveryService';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'section-test-user', email: 'user@example.com', preferences: {} },
    loading: false,
    triggerCloudSync: vi.fn(), logout: vi.fn(), updateUserPreferences: vi.fn(),
    updateAiTrainingOptIn: vi.fn(), deleteUserAccountAndData: vi.fn(), syncStatus: 'idle', lastSyncTime: null
  }),
  AuthProvider: ({ children }) => children
}));
vi.mock('./context/ThemeContext', () => ({ useTheme: () => ({ isDark: false, theme: 'light', setTheme: vi.fn() }) }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('./services/cloudStorageAdapter', () => ({ cloudAdapter: { subscribe: () => () => {}, isFirestoreActive: () => false } }));

const activePkg = {
  id: 'pkg-active',
  title: 'Active Shipment',
  trackingNumber: 'ACT123456789IL',
  carrier: 'israel-post',
  status: 'in_transit',
  category: 'other',
  isPinned: false,
  isArchived: false,
  checkpoints: []
};

const deliveredPkg = {
  id: 'pkg-delivered',
  title: 'Completed Shipment',
  trackingNumber: 'DEL123456789IL',
  carrier: 'dhl',
  status: 'delivered',
  category: 'other',
  isPinned: false,
  isArchived: false,
  checkpoints: []
};

describe('Dashboard Collapsible Delivered Section on "All" View', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      deliveryService.getStorageKey('section-test-user'),
      JSON.stringify([activePkg, deliveredPkg])
    );
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  it('renders active packages and collapsible delivered section, expanding on click', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<DashboardContent />);

    // Active package is immediately visible
    await screen.findByText('Active Shipment');

    // Delivered section button exists with count
    const deliveredToggle = await screen.findByTestId('delivered-section-toggle');
    expect(deliveredToggle).toHaveAttribute('aria-expanded', 'false');

    // Completed package is collapsed initially
    expect(screen.queryByText('Completed Shipment')).not.toBeInTheDocument();

    // Click to expand
    await user.click(deliveredToggle);

    expect(deliveredToggle).toHaveAttribute('aria-expanded', 'true');
    await screen.findByText('Completed Shipment');

    // Click again to collapse
    await user.click(deliveredToggle);
    expect(deliveredToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Completed Shipment')).not.toBeInTheDocument();
  });
});
