/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LegalConsentGate } from './LegalConsentGate';
import { LEGAL_VERSION } from '../constants/legalVersion';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

const authMocks = vi.hoisted(() => ({
  user: null,
  acceptLegalTerms: vi.fn(),
  logout: vi.fn()
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: authMocks.user,
    acceptLegalTerms: authMocks.acceptLegalTerms,
    logout: authMocks.logout
  })
}));

describe('LegalConsentGate DOM Tests', () => {
  beforeEach(() => {
    cleanup();
    authMocks.user = null;
    authMocks.acceptLegalTerms.mockReset();
    authMocks.logout.mockReset();
  });

  it('renders nothing when user is not signed in (guest)', () => {
    authMocks.user = null;
    renderWithLanguage(<LegalConsentGate />);
    expect(screen.queryByText(/Before you continue|לפני שממשיכים/i)).toBeNull();
  });

  it('renders nothing when user already accepted the current LEGAL_VERSION', () => {
    authMocks.user = {
      id: 'uid123',
      email: 'test@example.com',
      legalAcceptedVersion: LEGAL_VERSION
    };
    renderWithLanguage(<LegalConsentGate />);
    expect(screen.queryByText(/Before you continue|לפני שממשיכים/i)).toBeNull();
  });

  it('renders gate when user has never accepted legal terms', () => {
    authMocks.user = {
      id: 'uid123',
      email: 'test@example.com',
      legalAcceptedVersion: null
    };
    renderWithLanguage(<LegalConsentGate />);
    expect(screen.getByText(/Before you continue|לפני שממשיכים/i)).toBeInTheDocument();
  });

  it('renders gate when user has an outdated legal version', () => {
    authMocks.user = {
      id: 'uid123',
      email: 'test@example.com',
      legalAcceptedVersion: '2026-08-23.1'
    };
    renderWithLanguage(<LegalConsentGate />);
    expect(screen.getByText(/Before you continue|לפני שממשיכים/i)).toBeInTheDocument();
  });

  it('calls acceptLegalTerms when user agrees and clicks continue', async () => {
    const user = userEvent.setup();
    authMocks.user = {
      id: 'uid123',
      email: 'test@example.com',
      legalAcceptedVersion: '2026-08-23.1'
    };
    const onShowToast = vi.fn();

    renderWithLanguage(<LegalConsentGate onShowToast={onShowToast} />, { language: 'en' });

    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    expect(continueBtn).toBeDisabled();

    // Check terms checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // agreedToTerms

    expect(continueBtn).toBeEnabled();
    await user.click(continueBtn);

    expect(authMocks.acceptLegalTerms).toHaveBeenCalledWith(false);
  });

  it('triggers export data when clicking export button', async () => {
    const user = userEvent.setup();
    authMocks.user = {
      id: 'uid123',
      email: 'test@example.com',
      legalAcceptedVersion: '2026-08-23.1'
    };
    const onShowToast = vi.fn();

    renderWithLanguage(<LegalConsentGate onShowToast={onShowToast} />, { language: 'en' });

    const exportBtn = screen.getByRole('button', { name: /Export my data/i });
    expect(exportBtn).toBeInTheDocument();
    await user.click(exportBtn);

    expect(onShowToast).toHaveBeenCalledWith('Data backup downloaded successfully', 'success');
  });
});
