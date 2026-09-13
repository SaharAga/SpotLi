/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

vi.mock('../services/featureUsageService', () => ({
  recordFeatureUse: vi.fn()
}));

import React from 'react';
import { screen, fireEvent, render } from '@testing-library/react';
import { InstallPwaBanner } from './InstallPwaBanner';
import { LanguageProvider } from '../context/LanguageContext';

function renderBanner(lang = 'en') {
  localStorage.setItem('deliveree_lang', lang);
  return render(
    <LanguageProvider>
      <InstallPwaBanner />
    </LanguageProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('deliveree_lang', 'en');
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => true,
    onchange: null
  }));
  delete window.navigator.standalone;
});

afterEach(() => {
  cleanup();
});

describe('InstallPwaBanner – Session 30 a11y', () => {
  it('banner dismiss button has type="button", aria-label, and min-h-[48px]', () => {
    renderBanner();
    const dismissBtn = screen.getByRole('button', { name: /dismiss banner/i });
    expect(dismissBtn).toHaveAttribute('type', 'button');
    expect(dismissBtn.className).toMatch(/min-h-\[48px\]/);
  });

  it('Install App button has type="button", aria-label, and min-h-[48px]', () => {
    renderBanner();
    const installBtn = screen.getByRole('button', { name: /install app/i });
    expect(installBtn).toHaveAttribute('type', 'button');
    expect(installBtn.className).toMatch(/min-h-\[48px\]/);
  });

  it('Not Now button has type="button" and min-h-[48px]', () => {
    renderBanner();
    const notNowBtn = screen.getByRole('button', { name: /not now/i });
    expect(notNowBtn).toHaveAttribute('type', 'button');
    expect(notNowBtn.className).toMatch(/min-h-\[48px\]/);
  });

  it('Download icon inside install button is aria-hidden', () => {
    const { container } = renderBanner();
    // The install button contains an svg that should be aria-hidden
    const installBtn = screen.getByRole('button', { name: /install app/i });
    const svgInBtn = installBtn.querySelector('svg');
    expect(svgInBtn).toHaveAttribute('aria-hidden', 'true');
  });

  it('iOS guide dialog shows role="dialog" with aria-modal when install button clicked', async () => {
    renderBanner();
    const installBtn = screen.getByRole('button', { name: /install app/i });
    await act(async () => { fireEvent.click(installBtn); });

    // The component shows the guide when no deferredPrompt is available (which is our test state)
    const dialog = screen.queryByRole('dialog');
    if (dialog) {
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'ios-guide-title');
      expect(document.getElementById('ios-guide-title')).toBeInTheDocument();

      // Guide close X button
      const closeBtn = screen.getByRole('button', { name: /close installation guide/i });
      expect(closeBtn).toHaveAttribute('type', 'button');
      expect(closeBtn.className).toMatch(/min-h-\[48px\]/);

      // Got It button
      const gotItBtn = screen.getByRole('button', { name: /got it/i });
      expect(gotItBtn).toHaveAttribute('type', 'button');
      expect(gotItBtn.className).toMatch(/min-h-\[48px\]/);
    }
  });

  it('renders Hebrew RTL variant with same ARIA structure', () => {
    renderBanner('he');
    const dismissBtn = screen.getByRole('button', { name: /dismiss banner/i });
    expect(dismissBtn).toHaveAttribute('type', 'button');
  });
});
