/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IngestionGuideModal } from './IngestionGuideModal.jsx';
import { LanguageProvider } from '../context/LanguageContext';

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
    requestGmailForwardingSetup: vi.fn().mockImplementation(async () => {
      actual.addConnectedAccount({ email: 'test@example.com', service: 'gmail' });
      return { ok: true, email: 'test@example.com' };
    }),
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

  it('renders correctly when open with 1-Click Gmail/Outlook and personal address', () => {
    renderModal();

    expect(screen.getByText(/Automatic Shipment Ingestion|קליטת משלוחים אוטומטית/i)).toBeTruthy();
    expect(screen.getByText(/Connect Gmail|חבר Gmail/i)).toBeTruthy();
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

  it('handles 1-Click Gmail sync button click', async () => {
    const handleToast = vi.fn();
    renderModal({ onShowToast: handleToast });

    const enableSyncBtn = screen.getByText(/Connect Gmail|חבר Gmail/i);
    fireEvent.click(enableSyncBtn);

    await waitFor(() => {
      expect(handleToast).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/\+ Gmail נוסף|\+ Add Gmail/i)).toBeTruthy();
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
