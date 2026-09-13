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

  const renderComponent = (lang = 'en', props = {}) => {
    return renderWithLanguage(
      <FirstTimeEmptyState
        onConnectGmail={onConnectGmail}
        onStartSmartImport={onStartSmartImport}
        onLoadDemoPackage={onLoadDemoPackage}
        {...props}
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


  /**
   * The Gmail tile shipped unconditionally, so a user whose Gmail was already
   * connected and syncing was still told — under a "Recommended" badge — to
   * connect it. These cover both directions, since a guard that hides the tile
   * for everyone would be just as wrong as one that hides it for nobody.
   */
  describe('when Gmail is already connected', () => {
    it('omits the Gmail tile', () => {
      renderComponent('en', { isGmailConnected: true });
      expect(screen.queryByRole('button', { name: /Connect Gmail Auto-Sync/i })).toBeNull();
      expect(screen.queryByText(/Connect Gmail Auto-Sync/i)).toBeNull();
    });

    it('keeps the other two tiles usable', () => {
      renderComponent('en', { isGmailConnected: true });
      fireEvent.click(screen.getByRole('button', { name: /Paste SMS or Link/i }));
      expect(onStartSmartImport).toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /Explore with Demo Package/i }));
      expect(onLoadDemoPackage).toHaveBeenCalled();
    });

    it('omits the Recommended badge along with the tile that carried it', () => {
      renderComponent('en', { isGmailConnected: true });
      expect(screen.queryByText(/Recommended/i)).toBeNull();
    });

    it('omits the Gmail tile in Hebrew too', () => {
      renderComponent('he', { isGmailConnected: true });
      expect(screen.queryByText('סנכרון אוטומטי מ-Gmail')).toBeNull();
      expect(screen.getAllByText('הדבק SMS או קישור מעקב').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('still shows the Gmail tile when the prop is omitted', () => {
    // The default has to be "not connected": a signed-out visitor renders this
    // with no account state at all, and hiding the tile there would remove the
    // primary call to action from the first screen a new user sees.
    renderComponent();
    expect(screen.getByRole('button', { name: /Connect Gmail Auto-Sync/i })).toBeInTheDocument();
  });

  it('renders correctly in Hebrew with proper titles and labels', () => {
    renderComponent('he');
    expect(screen.getByText('התחל לעקוב אחר החבילות שלך')).toBeInTheDocument();
    expect(screen.getAllByText('סנכרון אוטומטי מ-Gmail').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('הדבק SMS או קישור מעקב').length).toBeGreaterThanOrEqual(1);
  });
});
