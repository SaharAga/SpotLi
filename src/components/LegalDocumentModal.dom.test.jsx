/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LegalDocumentModal } from './LegalDocumentModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

describe('LegalDocumentModal (rendered)', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithLanguage(
      <LegalDocumentModal isOpen={false} onClose={vi.fn()} docType="terms" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Terms of Use content and connects dialog aria-labelledby', () => {
    renderWithLanguage(
      <LegalDocumentModal isOpen onClose={vi.fn()} docType="terms" />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'legal-doc-title');

    const heading = document.getElementById('legal-doc-title');
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Terms of Use');

    expect(screen.getByText('What this is')).toBeInTheDocument();
    expect(screen.getByText(/SpotLi is a personal package-tracking aggregator/i)).toBeInTheDocument();
  });

  it('renders Privacy Policy content when docType is "privacy"', () => {
    renderWithLanguage(
      <LegalDocumentModal isOpen onClose={vi.fn()} docType="privacy" />
    );

    const heading = document.getElementById('legal-doc-title');
    expect(heading).toHaveTextContent('Privacy Policy');
    // getAllByText, not getByText: "personal data" appears in more than one
    // section, so a singular query here was asserting the phrase is rare
    // rather than that the policy rendered — and broke the moment the
    // retention section was reworded.
    expect(screen.getAllByText(/personal data/i).length).toBeGreaterThan(0);

    // The carve-out the account-deletion promise depends on. Feedback and
    // crash reports are collected with no account link, so "delete my account"
    // cannot reach them; the policy has to say that plainly.
    expect(
      screen.getByText(/cannot be located or deleted per user/i)
    ).toBeInTheDocument();
  });

  it('renders Hebrew RTL content when language is "he"', () => {
    renderWithLanguage(
      <LegalDocumentModal isOpen onClose={vi.fn()} docType="terms" />,
      { language: 'he' }
    );

    const heading = document.getElementById('legal-doc-title');
    expect(heading).toHaveTextContent('תנאי שימוש');

    const backButton = screen.getByRole('button', { name: 'חזרה' });
    expect(backButton).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: 'סגור' });
    expect(closeButton).toBeInTheDocument();
  });

  it('calls onClose when clicking the header back button and footer close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithLanguage(
      <LegalDocumentModal isOpen onClose={onClose} docType="terms" />
    );

    const backButton = screen.getByRole('button', { name: 'Back' });
    await user.click(backButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('enforces >= 48px touch targets on interactive controls', () => {
    renderWithLanguage(
      <LegalDocumentModal isOpen onClose={vi.fn()} docType="terms" />
    );

    const backButton = screen.getByRole('button', { name: 'Back' });
    expect(backButton.className).toContain('min-h-[48px]');
    expect(backButton.className).toContain('min-w-[48px]');

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton.className).toContain('min-h-[48px]');
    expect(closeButton.className).toContain('min-w-[80px]');
  });
});
