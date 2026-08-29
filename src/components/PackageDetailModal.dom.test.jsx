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

vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}));

vi.mock('../services/feedbackService', () => ({
  submitFeedback: vi.fn().mockResolvedValue({ success: true, id: 'fb-123' })
}));

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

  it('renders live opening hours badge and allows reporting wrong hours', async () => {
    const user = userEvent.setup();
    const onShowToast = vi.fn();

    renderWithLanguage(
      <PackageDetailModal
        isOpen={true}
        pkg={mockPackageWithPickup}
        onClose={vi.fn()}
        onShowToast={onShowToast}
      />
    );

    // BoxIt matches 24/7 directory
    expect(screen.getByText(/Open 24\/7/i)).toBeInTheDocument();

    // Click "Report incorrect hours"
    const reportBtn = screen.getByRole('button', { name: /Report incorrect hours/i });
    await user.click(reportBtn);

    // The inline form opens
    const input = screen.getByPlaceholderText(/Please enter the correct opening hours/i);
    expect(input).toBeInTheDocument();

    await user.type(input, 'Sun-Thu 08:00-20:00');
    const submitBtn = screen.getByRole('button', { name: /Submit/i });
    await user.click(submitBtn);

    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Thank you'),
      'success'
    );
  });

  it('renders smart same-location sibling banner and collects all packages on click', async () => {
    const user = userEvent.setup();
    const siblingPkg = {
      id: 'pkg-nav-2',
      title: 'Sony Headphones WH-1000XM5',
      trackingNumber: 'IL998877665',
      carrier: 'israel-post',
      status: 'available_for_pickup',
      pickupCode: '1204',
      pickupLocation: 'Dizengoff Center BoxIt Locker #142'
    };

    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onShowToast = vi.fn();

    renderWithLanguage(
      <PackageDetailModal
        isOpen={true}
        pkg={mockPackageWithPickup}
        packages={[mockPackageWithPickup, siblingPkg]}
        onClose={onClose}
        onStatusChange={onStatusChange}
        onShowToast={onShowToast}
      />
    );

    // Sibling alert appears
    expect(screen.getByText('1 other package waiting here!')).toBeInTheDocument();
    expect(screen.getByText('Sony Headphones WH-1000XM5')).toBeInTheDocument();
    expect(screen.getByText('PIN: 1204')).toBeInTheDocument();

    // Click "Mark All as Collected (2)"
    const collectAllBtn = screen.getByRole('button', { name: /Mark All as Collected \(2\)/i });
    await user.click(collectAllBtn);

    expect(onStatusChange).toHaveBeenCalledWith('pkg-nav-1', 'delivered');
    expect(onStatusChange).toHaveBeenCalledWith('pkg-nav-2', 'delivered');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders courier redirect notice and original requested location note when package was rerouted', () => {
    const redirectedPkg = {
      ...mockPackageWithPickup,
      isRedirected: true,
      pickupLocation: 'Super Yuda Ben Yehuda 45',
      originalPickupLocation: 'Dizengoff Center BoxIt Locker #142',
      redirectReason: 'locker_capacity'
    };

    renderWithLanguage(
      <PackageDetailModal
        isOpen={true}
        pkg={redirectedPkg}
        onClose={vi.fn()}
      />
    );

    // Redirect banner is displayed
    expect(screen.getByText('Pickup Location Changed')).toBeInTheDocument();
    expect(screen.getByText(/The courier redirected this package to an alternate pickup point/i)).toBeInTheDocument();
    // Original location note is displayed
    expect(screen.getByText('Original requested location:')).toBeInTheDocument();
    expect(screen.getByText('Dizengoff Center BoxIt Locker #142')).toBeInTheDocument();
    // New destination is rendered in the location bar
    expect(screen.getByText('Super Yuda Ben Yehuda 45')).toBeInTheDocument();
  });
});
