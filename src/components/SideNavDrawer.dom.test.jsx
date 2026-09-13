/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideNavDrawer } from './SideNavDrawer';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

const mockAuth = {
  user: null,
  logout: vi.fn()
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    toggleTheme: vi.fn()
  })
}));

describe('SideNavDrawer Ergonomics & Scroll Lock (#136)', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    onClose.mockClear();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('locks body scroll when open and unlocks on unmount', () => {
    const { unmount } = renderWithLanguage(
      <SideNavDrawer isOpen={true} onClose={onClose} />
    );

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('requires mousedown before click to dismiss via backdrop', () => {
    renderWithLanguage(
      <SideNavDrawer isOpen={true} onClose={onClose} />
    );

    const dialog = screen.getByRole('dialog');

    // Click without mousedown should NOT trigger close
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    // Proper mousedown + click on backdrop triggers close
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', () => {
    renderWithLanguage(
      <SideNavDrawer isOpen={true} onClose={onClose} />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders user details when signed in and triggers onOpenAuth on click', async () => {
    const user = userEvent.setup();
    mockAuth.user = { name: 'סער אגא', email: 'sahar.test@example.com' };
    const onOpenAuth = vi.fn();
    renderWithLanguage(
      <SideNavDrawer isOpen={true} onClose={onClose} onOpenAuth={onOpenAuth} />
    );

    expect(screen.getByText('סער אגא')).toBeInTheDocument();
    expect(screen.getByText('sahar.test@example.com')).toBeInTheDocument();

    await user.click(screen.getByText('סער אגא'));
    expect(onOpenAuth).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    mockAuth.user = null;
  });
});
