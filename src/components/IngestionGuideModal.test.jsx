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

const authState = vi.hoisted(() => ({
  user: { uid: 'testuser123', email: 'test@example.com' },
  loginWithGoogle: vi.fn().mockResolvedValue({ uid: 'testuser123', email: 'test@example.com' })
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    loginWithGoogle: authState.loginWithGoogle
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
    getGmailConnectionStatus: vi.fn().mockResolvedValue({ connected: false }),
    triggerGmailBackfill: vi.fn().mockResolvedValue({ ok: true, saved: 0 }),
    revokeGmailConnection: vi.fn().mockResolvedValue(undefined),
    requestOutlookForwardingSetup: vi.fn().mockImplementation(async () => {
      actual.addConnectedAccount({ email: 'test@outlook.com', service: 'outlook' });
      return { ok: true, email: 'test@outlook.com' };
    })
  };
});

vi.mock('../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true)
}));

describe('IngestionGuideModal Component Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    authState.user = { uid: 'testuser123', email: 'test@example.com' };
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
    // The forwarding address now lives behind the fallback disclosure —
    // it is the backup for people who cannot connect an inbox above, so it
    // no longer competes with the one-tap buttons.
    expect(screen.queryByText(/233b362d7b331adfde6e\+usr_testuser123@cloudmailin\.net/i)).toBeNull();
    fireEvent.click(screen.getByText(/Don't use Gmail or Outlook\?|אין לך Gmail או Outlook\?/i));
    expect(screen.getByText(/233b362d7b331adfde6e\+usr_testuser123@cloudmailin\.net/i)).toBeTruthy();
  });

  it('switches between interactive provider setup guides smoothly', () => {
    renderModal();
    fireEvent.click(screen.getByText(/Don't use Gmail or Outlook\?|אין לך Gmail או Outlook\?/i));

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

  it('does not restart the OAuth flow (and its full inbox rescan) when Gmail is already connected', async () => {
    const { connectGmail, getGmailConnectionStatus } = await import('../services/emailSyncService');
    getGmailConnectionStatus.mockResolvedValueOnce({
      connected: true,
      emailAddress: 'user@gmail.com',
      connectedAt: '2026-01-01T00:00:00.000Z'
    });
    const handleToast = vi.fn();
    renderModal({ onShowToast: handleToast });

    const addGmailBtn = await screen.findByText(/\+ Add Gmail|Gmail נוסף/i);
    fireEvent.click(addGmailBtn);

    await waitFor(() => {
      expect(handleToast).toHaveBeenCalledWith(expect.stringContaining('Gmail'), 'info');
    });
    expect(connectGmail).not.toHaveBeenCalled();
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

    const closeBtn = screen.getByLabelText('Back');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('gates private forwarding address behind sign-in when user is unauthenticated', () => {
    authState.user = null;
    const handleOpenAuth = vi.fn();
    renderModal({ onOpenAuth: handleOpenAuth });

    fireEvent.click(screen.getByText(/Don't use Gmail or Outlook\?|אין לך Gmail או Outlook\?/i));

    // Address is not shown
    expect(screen.queryByText(/cloudmailin\.net/i)).toBeNull();
    // Sign-in gate card is shown
    expect(screen.getByText(/Account required for forwarding|נדרשת התחברות לכתובת ייחודית/i)).toBeTruthy();

    const signInBtn = screen.getByRole('button', { name: /Sign in to generate address|התחברות להפקת כתובת אישית/i });
    fireEvent.click(signInBtn);
    expect(handleOpenAuth).toHaveBeenCalledWith({ initialMode: 'signin', reason: 'gmail_sync' });
  });

  it('sets dialog aria-labelledby pointing to title and renders localized back button', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('ingestion-guide-title');
    const title = document.getElementById('ingestion-guide-title');
    expect(title).toBeTruthy();
    expect(title.textContent).toMatch(/Automatic Shipment Ingestion|קליטת משלוחים אוטומטית/i);

    const backBtn = screen.getByLabelText(/Back|חזרה/i);
    expect(backBtn).toBeTruthy();
  });

  it('adheres to WAI-ARIA tablist, tab, and tabpanel accessibility patterns', () => {
    renderModal();
    fireEvent.click(screen.getByText(/Don't use Gmail or Outlook\?|אין לך Gmail או Outlook\?/i));

    const tablist = screen.getByRole('tablist', { name: /Email provider guides|מדריכי ספקי דוא״ל/i });
    expect(tablist).toBeTruthy();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);

    // Initial selected is gmail
    const gmailTab = screen.getByRole('tab', { name: 'Gmail' });
    expect(gmailTab.getAttribute('aria-selected')).toBe('true');
    expect(gmailTab.getAttribute('aria-controls')).toBe('ingestion-panel-gmail');

    const panel = screen.getByRole('tabpanel');
    expect(panel.id).toBe('ingestion-panel-gmail');
    expect(panel.getAttribute('aria-labelledby')).toBe('ingestion-tab-gmail');

    // Click Outlook tab
    const outlookTab = screen.getByRole('tab', { name: /Outlook \/ Hotmail/i });
    fireEvent.click(outlookTab);
    expect(outlookTab.getAttribute('aria-selected')).toBe('true');
    expect(gmailTab.getAttribute('aria-selected')).toBe('false');
    expect(panel.id).toBe('ingestion-panel-outlook');
    expect(panel.getAttribute('aria-labelledby')).toBe('ingestion-tab-outlook');
  });

  it('copies private ingestion email address to clipboard with feedback and toast', async () => {
    const { copyToClipboard } = await import('../utils/clipboard');
    const handleToast = vi.fn();
    renderModal({ onShowToast: handleToast });

    fireEvent.click(screen.getByText(/Don't use Gmail or Outlook\?|אין לך Gmail או Outlook\?/i));
    const copyEmailBtn = screen.getByLabelText(/Copy private ingestion email|העתק כתובת אימייל פרטית/i);
    fireEvent.click(copyEmailBtn);

    await waitFor(() => {
      expect(copyToClipboard).toHaveBeenCalledWith(expect.stringContaining('cloudmailin.net'));
      expect(handleToast).toHaveBeenCalledWith(
        expect.stringMatching(/copied to clipboard|הועתקה ללוח/i),
        'success'
      );
      expect(screen.getByText(/Copied!|הועתק!/i)).toBeTruthy();
    });
  });

  it('copies filter query to clipboard with 1-tap feedback and toast', async () => {
    const { copyToClipboard } = await import('../utils/clipboard');
    const { DEFAULT_FORWARDING_FILTER_QUERY } = await import('../constants/emailFilters');
    const handleToast = vi.fn();
    renderModal({ onShowToast: handleToast });

    fireEvent.click(screen.getByText(/Don't use Gmail or Outlook\?|אין לך Gmail או Outlook\?/i));
    const copyFilterBtn = screen.getByLabelText(/Copy filter query|העתק שאילתת מסנן/i);
    fireEvent.click(copyFilterBtn);

    await waitFor(() => {
      expect(copyToClipboard).toHaveBeenCalledWith(DEFAULT_FORWARDING_FILTER_QUERY);
      expect(handleToast).toHaveBeenCalledWith(
        expect.stringMatching(/copied to clipboard|הועתקה ללוח/i),
        'success'
      );
    });
  });

  it('toggles QR code section with accessible aria-expanded and aria-controls', () => {
    renderModal();
    const qrBtn = screen.getByRole('button', { name: /Scan QR|סרוק QR/i });
    expect(qrBtn.getAttribute('aria-expanded')).toBe('false');
    expect(qrBtn.getAttribute('aria-controls')).toBe('pwa-qr-section');
    expect(document.getElementById('pwa-qr-section')).toBeNull();

    fireEvent.click(qrBtn);
    expect(qrBtn.getAttribute('aria-expanded')).toBe('true');
    const qrSection = document.getElementById('pwa-qr-section');
    expect(qrSection).toBeTruthy();
    expect(screen.getByAltText('QR Code')).toBeTruthy();

    fireEvent.click(qrBtn);
    expect(qrBtn.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('pwa-qr-section')).toBeNull();
  });
});
