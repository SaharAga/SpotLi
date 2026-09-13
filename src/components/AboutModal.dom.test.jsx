/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AboutModal } from './AboutModal';
import { LanguageProvider } from '../context/LanguageContext';
import { APP_VERSION } from '../constants/version';

const renderAbout = (props = {}, lang = 'en') => {
  localStorage.setItem('deliveree_lang', lang);
  return render(
    <LanguageProvider>
      <AboutModal
        isOpen
        onClose={vi.fn()}
        onOpenFeedback={vi.fn()}
        onShowToast={vi.fn()}
        {...props}
      />
    </LanguageProvider>
  );
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AboutModal DOM Integration', () => {
  it('does not render when isOpen is false', () => {
    render(
      <LanguageProvider>
        <AboutModal isOpen={false} onClose={vi.fn()} />
      </LanguageProvider>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders system build, version, and release channel info', () => {
    renderAbout();
    expect(screen.getAllByText(new RegExp(`v?${APP_VERSION}`, 'i')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/React 19 \+ PWA/i)).toBeTruthy();
  });

  it('provides a 48px back button that calls onClose with accessible label', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderAbout({ onClose });

    const backBtn = screen.getByRole('button', { name: 'Back' });
    expect(backBtn).toBeTruthy();
    expect(backBtn.className).toContain('min-h-[48px]');

    await user.click(backBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('runs BIST diagnostics when Run Diagnostics is clicked', async () => {
    const user = userEvent.setup();
    const onShowToast = vi.fn();
    renderAbout({ onShowToast });

    const diagBtn = screen.getByRole('button', { name: /Run Diagnostics|Diagnostics/i });
    expect(diagBtn).toBeTruthy();

    await user.click(diagBtn);

    await waitFor(() => {
      expect(onShowToast).toHaveBeenCalledWith(
        expect.stringContaining('PASS'),
        'success'
      );
    });
  });

  it('displays supported carriers with country and badges', () => {
    renderAbout();
    expect(screen.getByText(/Supported Carriers/i)).toBeTruthy();
    expect(screen.getByText('Israel Post')).toBeTruthy();
    expect(screen.getByText('Cheetah Delivery (Chita)')).toBeTruthy();
  });

  it('provides accessible buttons for Legal terms and privacy policy', async () => {
    const user = userEvent.setup();
    renderAbout();

    const termsBtn = screen.getByRole('button', { name: 'Terms of Use' });
    const privacyBtn = screen.getByRole('button', { name: 'Privacy Policy' });
    expect(termsBtn).toBeTruthy();
    expect(privacyBtn).toBeTruthy();
    expect(termsBtn.className).toContain('min-h-[48px]');
    expect(privacyBtn.className).toContain('min-h-[48px]');

    await user.click(termsBtn);
    expect(await screen.findByRole('dialog', { name: /Terms of Use/i })).toBeTruthy();
  });

  it('calls onOpenFeedback when Send Feedback button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenFeedback = vi.fn();
    renderAbout({ onOpenFeedback });

    const feedbackBtn = screen.getByRole('button', { name: /Send Feedback/i });
    expect(feedbackBtn).toBeTruthy();
    expect(feedbackBtn.className).toContain('min-h-[48px]');

    await user.click(feedbackBtn);
    expect(onOpenFeedback).toHaveBeenCalled();
  });

  it('supports Hebrew RTL mode with localized labels and back button', () => {
    renderAbout({}, 'he');
    expect(screen.getByRole('button', { name: 'חזרה' })).toBeTruthy();
    expect(screen.getByText('גרסת מערכת:')).toBeTruthy();
    expect(screen.getAllByText(/בדיקת תקינות מערכת/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('דואר ישראל')).toBeTruthy();
  });
});
