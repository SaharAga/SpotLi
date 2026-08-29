// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PackageDetailModal } from './PackageDetailModal';
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

const mockPackageWithPickup = {
  id: 'pkg-nav-1',
  title: 'Logitech MX Master 3S',
  titleHe: 'עכבר לוגיטק MX Master 3S',
  trackingNumber: 'RS948219483IL',
  carrier: 'israel-post',
  status: 'available_for_pickup',
  category: 'electronics',
  pickupCode: '8492',
  pickupLocation: 'Dizengoff Center BoxIt Locker #142',
  pickupDeadline: new Date(Date.now() + 86400000 * 3).toISOString(),
  checkpoints: []
};

describe('PackageDetailModal — Pickup Navigation Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('calls onOpenNavigation with pickup location when no preferred app is set', async () => {
    const user = userEvent.setup();
    const onOpenNavigation = vi.fn();

    renderWithLanguage(
      <PackageDetailModal
        isOpen={true}
        pkg={mockPackageWithPickup}
        onClose={vi.fn()}
        onOpenNavigation={onOpenNavigation}
      />
    );

    const navButton = screen.getByRole('button', { name: /Navigate/i });
    await user.click(navButton);

    expect(onOpenNavigation).toHaveBeenCalledTimes(1);
    expect(onOpenNavigation).toHaveBeenCalledWith({
      location: 'Dizengoff Center BoxIt Locker #142',
      title: 'Logitech MX Master 3S'
    });
  });

  it('directly opens preferred navigation app in new window when preferred app is saved', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEYS.PREFERRED_NAV_APP, NAV_APPS.WAZE);
    const onOpenNavigation = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithLanguage(
      <PackageDetailModal
        isOpen={true}
        pkg={mockPackageWithPickup}
        onClose={vi.fn()}
        onOpenNavigation={onOpenNavigation}
      />
    );

    const navButton = screen.getByRole('button', { name: /Navigate/i });
    await user.click(navButton);

    // Preferred app is Waze -> open directly, do not open choice modal
    expect(onOpenNavigation).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('waze.com/ul'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('triggers navigation when clicking on the pickup location address card', async () => {
    const user = userEvent.setup();
    const onOpenNavigation = vi.fn();

    renderWithLanguage(
      <PackageDetailModal
        isOpen={true}
        pkg={mockPackageWithPickup}
        onClose={vi.fn()}
        onOpenNavigation={onOpenNavigation}
      />
    );

    const addressElement = screen.getByText('Dizengoff Center BoxIt Locker #142');
    await user.click(addressElement);

    expect(onOpenNavigation).toHaveBeenCalledTimes(1);
    expect(onOpenNavigation).toHaveBeenCalledWith({
      location: 'Dizengoff Center BoxIt Locker #142',
      title: 'Logitech MX Master 3S'
    });
  });
});
