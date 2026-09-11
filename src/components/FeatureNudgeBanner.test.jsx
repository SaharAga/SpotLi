/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { FeatureNudgeBanner } from './FeatureNudgeBanner';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

describe('FeatureNudgeBanner Component Tests', () => {
  const onAction = vi.fn();
  const onDismiss = vi.fn();
  const onSuppressPermanently = vi.fn();

  const renderComponent = (nudge, lang = 'en') => {
    return renderWithLanguage(
      <FeatureNudgeBanner
        nudge={nudge}
        onAction={onAction}
        onDismiss={onDismiss}
        onSuppressPermanently={onSuppressPermanently}
      />,
      { language: lang }
    );
  };

  it('renders nothing when nudge is null', () => {
    const { container } = renderComponent(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders push notification nudge properly', () => {
    renderComponent({ id: 'push_notifications', type: 'push' });
    expect(screen.getByText(/Never miss a delivery update/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Turn On Alerts/i })).toBeInTheDocument();
  });

  it('renders gmail sync nudge properly', () => {
    renderComponent({ id: 'gmail_sync', type: 'gmail' });
    expect(screen.getByText(/Tired of manual pasting\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Gmail/i })).toBeInTheDocument();
  });

  it('triggers onAction when action button clicked', () => {
    renderComponent({ id: 'push_notifications', type: 'push' });
    const btn = screen.getByRole('button', { name: /Turn On Alerts/i });
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith('push');
  });

  it('triggers onDismiss when close button is clicked', () => {
    renderComponent({ id: 'push_notifications', type: 'push' });
    const closeBtn = screen.getByLabelText(/Dismiss/i);
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledWith('push_notifications');
  });

  it('triggers onSuppressPermanently when Don’t show again is clicked', () => {
    renderComponent({ id: 'push_notifications', type: 'push' });
    const suppressBtn = screen.getByText(/Don’t show again/i);
    fireEvent.click(suppressBtn);
    expect(onSuppressPermanently).toHaveBeenCalledWith('push_notifications');
  });
});
