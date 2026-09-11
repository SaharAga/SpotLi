/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { PostAuthSetupWizard } from './PostAuthSetupWizard';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

const mockConnectGmail = vi.fn();
const mockRequestNotificationPermission = vi.fn();

vi.mock('../services/emailSyncService', () => ({
  connectGmail: () => mockConnectGmail(),
  getConnectedServices: () => ({ gmail: false, outlook: false, accounts: [] })
}));

vi.mock('../services/notificationService', () => ({
  notificationService: {
    requestNotificationPermission: (...args) => mockRequestNotificationPermission(...args)
  }
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-uid-123', email: 'test@example.com' }
  })
}));

describe('PostAuthSetupWizard Component Tests', () => {
  const onClose = vi.fn();
  const onComplete = vi.fn();
  const onShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.Notification = { permission: 'default' };
    mockConnectGmail.mockResolvedValue({ ok: true });
    mockRequestNotificationPermission.mockResolvedValue('granted');
  });

  const renderComponent = (lang = 'en') => {
    return renderWithLanguage(
      <PostAuthSetupWizard
        isOpen={true}
        onClose={onClose}
        onComplete={onComplete}
        onShowToast={onShowToast}
      />,
      { language: lang }
    );
  };

  it('renders Step 1 (Gmail sync) on initial open', () => {
    renderComponent();
    expect(screen.getByText(/Connect Gmail Auto-Sync/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Gmail/i })).toBeInTheDocument();
  });

  it('invokes connectGmail when clicking Connect Gmail button', async () => {
    renderComponent();
    const btn = screen.getByRole('button', { name: /Connect Gmail/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockConnectGmail).toHaveBeenCalledTimes(1);
    });
  });

  it('transitions to Step 2 when Next is clicked and triggers notification request', async () => {
    renderComponent();
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Real-Time Delivery Alerts/i)).toBeInTheDocument();
    const pushBtn = screen.getByRole('button', { name: /Turn On Delivery Alerts/i });
    fireEvent.click(pushBtn);

    await waitFor(() => {
      expect(mockRequestNotificationPermission).toHaveBeenCalledWith('test-uid-123');
    });
  });

  it('calls onComplete and onClose when user finishes the wizard', () => {
    renderComponent();
    // Advance to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    // Finish
    fireEvent.click(screen.getByRole('button', { name: /Go to My Deliveries/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete and onClose when user clicks Maybe Later / Skip', () => {
    renderComponent();
    const skipBtn = screen.getByRole('button', { name: /Maybe Later/i });
    fireEvent.click(skipBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
