// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { NavigationChoiceModal } from './NavigationChoiceModal';
import { LanguageProvider } from '../context/LanguageContext';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { NAV_APPS } from '../utils/navigationService';

function renderWithLanguage(ui, language = 'en') {
  localStorage.setItem('deliveree_lang', language);
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('NavigationChoiceModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithLanguage(
      <NavigationChoiceModal isOpen={false} onClose={vi.fn()} location="Dizengoff 50, Tel Aviv" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all 4 navigation app options and destination query', () => {
    renderWithLanguage(
      <NavigationChoiceModal
        isOpen={true}
        onClose={vi.fn()}
        location="Dizengoff Center, Tel Aviv"
        lat={32.0754}
        lng={34.7750}
      />
    );

    expect(screen.getByText(/Choose Navigation App/i)).toBeInTheDocument();
    expect(screen.getByText(/Dizengoff Center, Tel Aviv/i)).toBeInTheDocument();
    expect(screen.getByText(/GPS: 32.0754, 34.7750/i)).toBeInTheDocument();
    expect(screen.getByText('Waze')).toBeInTheDocument();
    expect(screen.getByText('Google Maps')).toBeInTheDocument();
    expect(screen.getByText('Apple Maps')).toBeInTheDocument();
    expect(screen.getByText('Moovit')).toBeInTheDocument();
  });

  it('opens navigation app on click and closes the modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithLanguage(
      <NavigationChoiceModal
        isOpen={true}
        onClose={onClose}
        location="Azrieli Center, Tel Aviv"
      />
    );

    const wazeButton = screen.getByRole('button', { name: /Waze/i });
    await user.click(wazeButton);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('waze.com/ul'),
      '_blank',
      'noopener,noreferrer'
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('persists preference when remember choice checkbox is checked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onShowToast = vi.fn();
    vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithLanguage(
      <NavigationChoiceModal
        isOpen={true}
        onClose={onClose}
        location="Modiin Logistics Hub"
        onShowToast={onShowToast}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Always open with this app/i });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    const moovitButton = screen.getByRole('button', { name: /Moovit/i });
    await user.click(moovitButton);

    expect(localStorage.getItem(STORAGE_KEYS.PREFERRED_NAV_APP)).toBe(NAV_APPS.MOOVIT);
    expect(onShowToast).toHaveBeenCalledWith(expect.stringMatching(/saved as default/i), 'success');
  });

  it('resets saved default preference when clicking reset button', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEYS.PREFERRED_NAV_APP, NAV_APPS.WAZE);
    const onShowToast = vi.fn();

    renderWithLanguage(
      <NavigationChoiceModal
        isOpen={true}
        onClose={vi.fn()}
        location="Bursa Locker, Ramat Gan"
        onShowToast={onShowToast}
      />
    );

    expect(screen.getByText('Default App')).toBeInTheDocument();
    const resetButton = screen.getByRole('button', { name: /Reset saved default app/i });
    await user.click(resetButton);

    expect(localStorage.getItem(STORAGE_KEYS.PREFERRED_NAV_APP)).toBeNull();
    expect(onShowToast).toHaveBeenCalledWith(expect.stringMatching(/preference reset/i), 'info');
  });

  it('renders correctly in Hebrew with RTL layout and Hebrew labels', () => {
    renderWithLanguage(
      <NavigationChoiceModal
        isOpen={true}
        onClose={vi.fn()}
        location="דיזנגוף סנטר, תל אביב"
      />,
      'he'
    );

    expect(screen.getByText(/בחירת אפליקציית ניווט/i)).toBeInTheDocument();
    expect(screen.getByText(/דיזנגוף סנטר, תל אביב/i)).toBeInTheDocument();
    expect(screen.getByText(/ווייז \(Waze\)/i)).toBeInTheDocument();
    expect(screen.getByText(/מוביט \(Moovit\)/i)).toBeInTheDocument();
    expect(screen.getByText(/זכור את בחירתי לפעמים הבאות/i)).toBeInTheDocument();
  });

  it('links dialog aria-labelledby to modal title, renders localized close button, and sets group role', () => {
    const { unmount } = renderWithLanguage(
      <NavigationChoiceModal
        isOpen={true}
        onClose={vi.fn()}
        location="Sarona Market"
      />,
      'en'
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'navigation-choice-title');
    const title = document.getElementById('navigation-choice-title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('Choose Navigation App');

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Choose Navigation App' })).toBeInTheDocument();

    unmount();

    // Verify Hebrew localized close button
    renderWithLanguage(
      <NavigationChoiceModal
        isOpen={true}
        onClose={vi.fn()}
        location="שרונה מרקט"
      />,
      'he'
    );
    expect(screen.getByRole('button', { name: 'סגור' })).toBeInTheDocument();
  });

  it('isolates destination and GPS coordinates inside bdi tags and marks preferred app with aria-current', () => {
    localStorage.setItem(STORAGE_KEYS.PREFERRED_NAV_APP, NAV_APPS.WAZE);

    renderWithLanguage(
      <NavigationChoiceModal
        isOpen={true}
        onClose={vi.fn()}
        location="Sarona Market (Boxit Locker)"
        lat={32.0711}
        lng={34.7865}
      />
    );

    const destinationEl = screen.getByText('Sarona Market (Boxit Locker)');
    expect(destinationEl.tagName.toLowerCase()).toBe('bdi');
    expect(destinationEl).toHaveAttribute('dir', 'auto');

    const gpsEl = screen.getByText(/GPS: 32.0711, 34.7865/i);
    expect(gpsEl.tagName.toLowerCase()).toBe('bdi');
    expect(gpsEl).toHaveAttribute('dir', 'ltr');

    const wazeBtn = screen.getByRole('button', { name: /Waze.*Default/i });
    expect(wazeBtn).toHaveAttribute('aria-current', 'true');

    const googleBtn = screen.getByRole('button', { name: /Google Maps/i });
    expect(googleBtn).not.toHaveAttribute('aria-current');
  });
});

