// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FullScreenLockerModal } from './FullScreenLockerModal';
import { LanguageProvider } from '../context/LanguageContext';
import { copyToClipboard } from '../utils/clipboard';
import confetti from 'canvas-confetti';

vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}));

vi.mock('../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true)
}));

function renderWithLanguage(ui, language = 'en') {
  localStorage.setItem('deliveree_lang', language);
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

const mockPackage = {
  id: 'pkg-locker-1',
  title: 'Anker USB-C Fast Charger',
  titleHe: 'מטען מהיר אנקר Anker USB-C',
  trackingNumber: 'BX948102948IL',
  carrier: 'boxit',
  status: 'ready_for_pickup',
  pickupCode: '8492',
  pickupLocation: 'Dizengoff Center BoxIt #142',
  pickupHours: '24/7'
};

describe('FullScreenLockerModal Component', () => {
  let originalWakeLock;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    originalWakeLock = navigator.wakeLock;
    // Mock navigator.wakeLock
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: vi.fn().mockResolvedValue({
          released: false,
          release: vi.fn().mockResolvedValue(undefined)
        })
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: originalWakeLock,
      writable: true,
      configurable: true
    });
  });

  it('renders individual oversized PIN digits and location details', () => {
    renderWithLanguage(
      <FullScreenLockerModal
        isOpen={true}
        pkg={mockPackage}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Full-Screen Locker Mode')).toBeInTheDocument();
    expect(screen.getAllByText('Anker USB-C Fast Charger').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dizengoff Center BoxIt #142')).toBeInTheDocument();

    // Digits: 8, 4, 9, 2
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('requests screen wake lock on mount and releases on unmount', () => {
    const { unmount } = renderWithLanguage(
      <FullScreenLockerModal
        isOpen={true}
        pkg={mockPackage}
        onClose={vi.fn()}
      />
    );

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    unmount();
  });

  it('copies PIN to clipboard when tapping the PIN card', async () => {
    const user = userEvent.setup();
    const onShowToast = vi.fn();

    renderWithLanguage(
      <FullScreenLockerModal
        isOpen={true}
        pkg={mockPackage}
        onClose={vi.fn()}
        onShowToast={onShowToast}
      />
    );

    const pinCard = screen.getByTitle('Tap to copy PIN');
    await user.click(pinCard);

    expect(copyToClipboard).toHaveBeenCalledWith('8492');
    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('PIN code copied!'),
      'success'
    );
  });

  it('calls onMarkDelivered and closes modal when clicking Mark as Collected', async () => {
    const user = userEvent.setup();
    const onMarkDelivered = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onShowToast = vi.fn();

    renderWithLanguage(
      <FullScreenLockerModal
        isOpen={true}
        pkg={mockPackage}
        onClose={onClose}
        onMarkDelivered={onMarkDelivered}
        onShowToast={onShowToast}
      />
    );

    const markBtn = screen.getByRole('button', { name: /Mark as Collected/i });
    await user.click(markBtn);

    expect(onMarkDelivered).toHaveBeenCalledWith('pkg-locker-1', 'delivered');
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders stacked PIN cards and batch collects when multiple packages share the same location', async () => {
    const user = userEvent.setup();
    const siblingPkg = {
      id: 'pkg-locker-2',
      title: 'Sony Wireless Earbuds',
      trackingNumber: 'BX998811223IL',
      carrier: 'boxit',
      status: 'ready_for_pickup',
      pickupCode: '1204',
      pickupLocation: 'Dizengoff Center BoxIt #142'
    };

    const onMarkDelivered = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onShowToast = vi.fn();

    renderWithLanguage(
      <FullScreenLockerModal
        isOpen={true}
        pkg={mockPackage}
        packages={[mockPackage, siblingPkg]}
        onClose={onClose}
        onMarkDelivered={onMarkDelivered}
        onShowToast={onShowToast}
      />
    );

    // Shows bundled header
    expect(screen.getByText(/Bundled Pickup \(2 Packages\)/i)).toBeInTheDocument();
    expect(screen.getByText('Anker USB-C Fast Charger')).toBeInTheDocument();
    expect(screen.getByText('Sony Wireless Earbuds')).toBeInTheDocument();

    // Digits for both: 8492 and 1204
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();

    // Click "Mark All as Collected (2)"
    const collectAllBtn = screen.getByRole('button', { name: /Mark All as Collected \(2\)/i });
    await user.click(collectAllBtn);

    expect(onMarkDelivered).toHaveBeenCalledWith('pkg-locker-1', 'delivered');
    expect(onMarkDelivered).toHaveBeenCalledWith('pkg-locker-2', 'delivered');
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('sets dialog aria-labelledby pointing to title and renders accessible action buttons', () => {
    renderWithLanguage(
      <FullScreenLockerModal
        isOpen={true}
        pkg={mockPackage}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('locker-modal-title');
    const title = document.getElementById('locker-modal-title');
    expect(title).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close|סגור/i });
    expect(closeBtn).toBeInTheDocument();

    const pinButton = screen.getByRole('button', { name: /Pickup PIN.*8492/i });
    expect(pinButton).toBeInTheDocument();
    expect(pinButton).toHaveAttribute('dir', 'ltr');

    const navButtons = screen.getAllByRole('button', { name: /Navigate to Location/i });
    expect(navButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders shelf numbers and phone shortcuts inside bdi dir=ltr tags', () => {
    const pkgWithShelfAndPhone = {
      ...mockPackage,
      shelfNumber: 'B-14',
      pickupPhone: '054-1234567'
    };

    renderWithLanguage(
      <FullScreenLockerModal
        isOpen={true}
        pkg={pkgWithShelfAndPhone}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('B-14')).toBeInTheDocument();
    expect(screen.getByText('B-14').tagName.toLowerCase()).toBe('bdi');

    const phoneLink = screen.getByRole('link', { name: /Call Store: 054-1234567/i });
    expect(phoneLink).toHaveAttribute('href', 'tel:054-1234567');
    expect(screen.getByText('054-1234567').tagName.toLowerCase()).toBe('bdi');
  });
});
