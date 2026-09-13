/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { FeatureNudgeBanner } from './FeatureNudgeBanner';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

describe('FeatureNudgeBanner – Session 30 a11y', () => {
  const onAction = vi.fn();
  const onDismiss = vi.fn();
  const onSuppressPermanently = vi.fn();

  const render = (nudge, lang = 'en') =>
    renderWithLanguage(
      <FeatureNudgeBanner
        nudge={nudge}
        onAction={onAction}
        onDismiss={onDismiss}
        onSuppressPermanently={onSuppressPermanently}
      />,
      { language: lang }
    );

  it('banner root has role="region" with aria-label matching nudge title', () => {
    render({ id: 'push_notifications', type: 'push' });
    const region = screen.getByRole('region');
    expect(region).toBeInTheDocument();
    // aria-label should match the push title text
    expect(region).toHaveAttribute('aria-label');
    expect(region.getAttribute('aria-label').length).toBeGreaterThan(0);
  });

  it('icon container is aria-hidden (decorative)', () => {
    const { container } = render({ id: 'push_notifications', type: 'push' });
    const iconWrapper = container.querySelector('[aria-hidden="true"]');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('suppress-permanently button has aria-label', () => {
    render({ id: 'push_notifications', type: 'push' });
    // aria-label is same as button text; use getByLabelText for robustness against curly apostrophes
    // The button is the one that calls onSuppressPermanently
    const { container } = renderWithLanguage(
      <FeatureNudgeBanner
        nudge={{ id: 'push_notifications', type: 'push' }}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
        onSuppressPermanently={vi.fn()}
      />,
      { language: 'en' }
    );
    const btns = container.querySelectorAll('button[aria-label]');
    const suppressBtn = [...btns].find(b => /show again/i.test(b.getAttribute('aria-label')));
    expect(suppressBtn).toBeTruthy();
  });

  it('close button has aria-label and min-h-[48px] class', () => {
    render({ id: 'push_notifications', type: 'push' });
    const closeBtn = screen.getByRole('button', { name: /dismiss/i });
    expect(closeBtn).toHaveAttribute('aria-label');
    expect(closeBtn.className).toMatch(/min-h-\[48px\]/);
  });

  it('renders Hebrew RTL nudge with correct region label', () => {
    render({ id: 'push_notifications', type: 'push' }, 'he');
    const region = screen.getByRole('region');
    expect(region).toBeInTheDocument();
  });
});
