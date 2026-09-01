/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IngestionGuideModal } from './IngestionGuideModal.jsx';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('firebase/functions', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getFunctions: vi.fn(),
    httpsCallable: () => vi.fn().mockResolvedValue({ data: { ok: true } })
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'testuser123', email: 'test@example.com' },
    loginWithGoogle: vi.fn().mockResolvedValue({ uid: 'testuser123', email: 'test@example.com' })
  }),
  AuthProvider: ({ children }) => <div>{children}</div>
}));

vi.mock('../services/emailSyncService', async () => {
  const actual = await vi.importActual('../services/emailSyncService');
  return {
    ...actual,
    // connectGmail navigates the whole page away on success in the real
    // implementation, so there is no synchronous "connected" state to
    // observe here — just that the call resolves ok and nothing crashes.
    connectGmail: vi.fn().mockResolvedValue({ ok: true }),
    triggerGmailBackfill: vi.fn().mockResolvedValue({ ok: true, saved: 0 }),
    revokeGmailConnection: vi.fn().mockResolvedValue(undefined),
    requestOutlookForwardingSetup: vi.fn().mockImplementation(async () => {
      actual.addConnectedAccount({ email: 'test@outlook.com', service: 'outlook' });
      return { ok: true, email: 'test@outlook.com' };
    })
  };
});

describe('IngestionGuideModal Component Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const renderModal = (props = {}) => {
    return render(
      <LanguageProvider>
        <IngestionGuideModal
          isOpen={true}
          onClose={vi.fn()}
          onOpenSmartImport={vi.fn()}
          onShowToast={vi.fn()}
          {...props}
        />
      </LanguageProvider>
    );
  };

  it('renders correctly when open with 1-Click Gmail/Outlook and personal address', async () => {
    renderModal();

    expect(screen.getByText(/Automatic Shipment Ingestion|קליטת משלוחים אוטומטית/i)).toBeTruthy();
    // Signed-in users see a "Checking status..." state on the Gmail button
    // until the server-verified connection status resolves, before settling
    // on "Connect Gmail" (not connected in this test's mock).
    await waitFor(() => {
      expect(screen.getByText(/Connect Gmail|חבר Gmail/i)).toBeTruthy();
    });
    expect(screen.getByText(/Connect Outlook|חבר Outlook/i)).toBeTruthy();
    expect(screen.getByText(/233b362d7b331adfde6e\+usr_testuser123@cloudmailin\.net/i)).toBeTruthy();
  });

  it('switches between interactive provider setup guides smoothly', () => {
    renderModal();

    // Click Outlook tab
    const outlookTab = screen.getByText(/Outlook \/ Hotmail/i);
    fireEvent.click(outlookTab);
    expect(screen.getByText(/Outlook\.com/i)).toBeTruthy();

    // Click iCloud tab
    const icloudTab = screen.getByText(/Apple iCloud/i);
    fireEvent.click(icloudTab);
    expect(screen.getByText(/iCloud\.com\/mail/i)).toBeTruthy();

    // Click Yahoo tab
    const yahooTab = screen.getByText(/Yahoo Mail/i);
    fireEvent.click(yahooTab);
    expect(screen.getByText(/פתחו את Yahoo Mail|Open Yahoo Mail/i)).toBeTruthy();
  });

  it('handles 1-Click Gmail sync button click by starting the OAuth redirect', async () => {
    const { connectGmail } = await import('../services/emailSyncService');
    const handleToast = vi.fn();
    renderModal({ onShowToast: handleToast });

    const enableSyncBtn = await screen.findByText(/Connect Gmail|חבר Gmail/i);
    fireEvent.click(enableSyncBtn);

    await waitFor(() => {
      expect(connectGmail).toHaveBeenCalledTimes(1);
    });
    // Success navigates the page away — no in-place "connected" state or
    // toast is expected here; only a failure surfaces a toast (see below).
    expect(handleToast).not.toHaveBeenCalled();
  });

  it('shows an error toast when connectGmail fails to start', async () => {
    const { connectGmail } = await import('../services/emailSyncService');
    connectGmail.mockResolvedValueOnce({ ok: false, error: 'boom' });
    const handleToast = vi.fn();
    renderModal({ onShowToast: handleToast });

    const enableSyncBtn = await screen.findByText(/Connect Gmail|חבר Gmail/i);
    fireEvent.click(enableSyncBtn);

    await waitFor(() => {
      expect(handleToast).toHaveBeenCalledWith(expect.stringContaining('boom'), 'error');
    });
  });

  it('handles 1-Click Outlook sync button click', async () => {
    const handleToast = vi.fn();
    renderModal({ onShowToast: handleToast });

    const enableSyncBtn = screen.getByText(/Connect Outlook|חבר Outlook/i);
    fireEvent.click(enableSyncBtn);

    await waitFor(() => {
      expect(handleToast).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/\+ Outlook נוסף|\+ Add Outlook/i)).toBeTruthy();
    });
  });

  it('handles unlinking a connected account', async () => {
    const handleToast = vi.fn();
    const { addConnectedAccount } = await import('../services/emailSyncService');
    addConnectedAccount({ email: 'tester@gmail.com', service: 'gmail' });

    renderModal({ onShowToast: handleToast });

    expect(screen.getByText('tester@gmail.com')).toBeTruthy();
    const unlinkBtn = screen.getByLabelText(/Unlink tester@gmail\.com|Disconnect tester@gmail\.com/i);
    fireEvent.click(unlinkBtn);

    await waitFor(() => {
      expect(handleToast).toHaveBeenCalledWith(expect.stringContaining('tester@gmail.com'), 'info');
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    renderModal({ onClose: handleClose });

    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
