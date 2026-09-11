/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { FirstTimeEmptyState } from './FirstTimeEmptyState';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

describe('FirstTimeEmptyState Component Tests', () => {
  const onConnectGmail = vi.fn();
  const onStartSmartImport = vi.fn();
  const onLoadDemoPackage = vi.fn();

  const renderComponent = (lang = 'en') => {
    return renderWithLanguage(
      <FirstTimeEmptyState
        onConnectGmail={onConnectGmail}
        onStartSmartImport={onStartSmartImport}
        onLoadDemoPackage={onLoadDemoPackage}
      />,
      { language: lang }
    );
  };

  it('renders all 3 action tiles with titles and descriptions', () => {
    renderComponent();
    expect(screen.getByText(/Start Tracking Your Deliveries/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Connect Gmail Auto-Sync/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Paste SMS or Link/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Explore with Demo Package/i).length).toBeGreaterThanOrEqual(1);
  });

  it('triggers onConnectGmail when clicking Gmail tile', () => {
    renderComponent();
    const btn = screen.getByRole('button', { name: /Connect Gmail Auto-Sync/i });
    fireEvent.click(btn);
    expect(onConnectGmail).toHaveBeenCalledTimes(1);
  });

  it('triggers onStartSmartImport when clicking SMS tile', () => {
    renderComponent();
    const btn = screen.getByRole('button', { name: /Paste SMS or Link/i });
    fireEvent.click(btn);
    expect(onStartSmartImport).toHaveBeenCalledTimes(1);
  });

  it('triggers onLoadDemoPackage when clicking Demo tile', () => {
    renderComponent();
    const btn = screen.getByRole('button', { name: /Explore with Demo Package/i });
    fireEvent.click(btn);
    expect(onLoadDemoPackage).toHaveBeenCalledTimes(1);
  });

  it('renders correctly in Hebrew with proper titles and labels', () => {
    renderComponent('he');
    expect(screen.getByText('התחל לעקוב אחר החבילות שלך')).toBeInTheDocument();
    expect(screen.getAllByText('סנכרון אוטומטי מ-Gmail').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('הדבק SMS או קישור מעקב').length).toBeGreaterThanOrEqual(1);
  });
});
