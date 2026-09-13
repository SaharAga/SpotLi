// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OfflineBanner } from './OfflineBanner';
import { LanguageProvider } from '../context/LanguageContext';
import { syncQueueService } from '../services/syncQueueService';

function renderWithLanguage(ui, language = 'en') {
  localStorage.setItem('deliveree_lang', language);
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('OfflineBanner Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    syncQueueService.isOnline = true;
    vi.spyOn(syncQueueService, 'getQueue').mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders nothing when online and idle', () => {
    const { container } = renderWithLanguage(<OfflineBanner />);
    expect(container.querySelector('[data-testid="offline-banner"]')).toBeNull();
  });

  it('displays offline banner with correct message when offline event fires', () => {
    renderWithLanguage(<OfflineBanner />);

    act(() => {
      syncQueueService.handleNetworkChange(false);
    });

    const banner = screen.getByTestId('offline-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('data-state', 'offline');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByText('Changes will save locally and sync automatically.')).toBeInTheDocument();
  });

  it('displays pending changes count when queue has items', () => {
    vi.spyOn(syncQueueService, 'getQueue').mockReturnValue([
      { id: '1', type: 'ADD' },
      { id: '2', type: 'STATUS_CHANGE' }
    ]);

    renderWithLanguage(<OfflineBanner />);

    act(() => {
      syncQueueService.handleNetworkChange(false);
    });

    expect(screen.getByText('2 changes pending sync')).toBeInTheDocument();
  });

  it('allows dismissing the offline banner', () => {
    renderWithLanguage(<OfflineBanner />);

    act(() => {
      syncQueueService.handleNetworkChange(false);
    });

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('Dismiss offline alert');
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('shows reconnected success pill when network returns, then auto-hides after timeout', () => {
    renderWithLanguage(<OfflineBanner />);

    // Go offline first
    act(() => {
      syncQueueService.handleNetworkChange(false);
    });
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

    // Come back online
    act(() => {
      syncQueueService.handleNetworkChange(true);
    });

    const banner = screen.getByTestId('offline-banner');
    expect(banner).toHaveAttribute('data-state', 'reconnected');
    expect(screen.getByText('Back online')).toBeInTheDocument();
    expect(screen.getByText('All changes synced successfully!')).toBeInTheDocument();

    // Advance timer past 3.5s
    act(() => {
      vi.advanceTimersByTime(3600);
    });

    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('renders Hebrew bilingual translations in Hebrew mode', () => {
    renderWithLanguage(<OfflineBanner />, 'he');

    act(() => {
      syncQueueService.handleNetworkChange(false);
    });

    expect(screen.getByText('אתה במצב לא מקוון')).toBeInTheDocument();
    expect(screen.getByText('השינויים יישמרו מקומית ויסונכרנו אוטומטית.')).toBeInTheDocument();
  });
});
