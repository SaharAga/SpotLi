/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { FirstTimeEmptyState } from './FirstTimeEmptyState';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

describe('FirstTimeEmptyState – Session 30 a11y', () => {
  const onConnectGmail = vi.fn();
  const onStartSmartImport = vi.fn();
  const onLoadDemoPackage = vi.fn();

  const render = (lang = 'en') =>
    renderWithLanguage(
      <FirstTimeEmptyState
        onConnectGmail={onConnectGmail}
        onStartSmartImport={onStartSmartImport}
        onLoadDemoPackage={onLoadDemoPackage}
      />,
      { language: lang }
    );

  it('decorative Sparkles icon in header has aria-hidden', () => {
    const { container } = render();
    // The welcome badge wraps Sparkles + span — the icon itself gets aria-hidden
    const hiddenIcons = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenIcons.length).toBeGreaterThan(0);
  });

  it('tile icon containers are aria-hidden', () => {
    const { container } = render();
    const hiddenContainers = container.querySelectorAll('div[aria-hidden="true"]');
    expect(hiddenContainers.length).toBeGreaterThanOrEqual(3);
  });

  it('Gmail CTA button has aria-describedby linking to tile description', () => {
    render();
    // Find button containing the gmail tile title text
    const gmailBtn = screen.getByRole('button', { name: /connect gmail|gmail sync/i });
    expect(gmailBtn).toHaveAttribute('aria-describedby', 'gmail-tile-desc');
    // The referenced paragraph must exist
    expect(document.getElementById('gmail-tile-desc')).toBeInTheDocument();
  });

  it('Smart Import CTA button has aria-describedby', () => {
    render();
    const smsBtn = screen.getByRole('button', { name: /smart import|paste/i });
    expect(smsBtn).toHaveAttribute('aria-describedby', 'sms-tile-desc');
    expect(document.getElementById('sms-tile-desc')).toBeInTheDocument();
  });

  it('Demo CTA button has aria-describedby', () => {
    render();
    const demoBtn = screen.getByRole('button', { name: /demo|explore/i });
    expect(demoBtn).toHaveAttribute('aria-describedby', 'demo-tile-desc');
    expect(document.getElementById('demo-tile-desc')).toBeInTheDocument();
  });

  it('renders Hebrew RTL layout with same aria attributes', () => {
    render('he');
    const gmailBtn = screen.getByRole('button', { name: /gmail|חבר/i });
    expect(gmailBtn).toHaveAttribute('aria-describedby', 'gmail-tile-desc');
  });
});
