/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IngestionGuideModal } from './IngestionGuideModal.jsx';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'testuser123', email: 'test@example.com' }
  }),
  AuthProvider: ({ children }) => <div>{children}</div>
}));

vi.mock('../services/emailSyncService', async () => {
  const actual = await vi.importActual('../services/emailSyncService');
  return {
    ...actual,
    requestGmailForwardingSetup: vi.fn().mockImplementation(async () => {
      actual.setConnectedService('gmail', true);
      return { ok: true };
    }),
    requestOutlookForwardingSetup: vi.fn().mockImplementation(async () => {
      actual.setConnectedService('outlook', true);
      return { ok: true };
    })
  };
});

describe('IngestionGuideModal Component Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
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
    expect(screen.getByText(/usr_testuser123@in.deliveree.app/i)).toBeTruthy();
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

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    renderModal({ onClose: handleClose });

    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
