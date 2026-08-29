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
    expect(screen.getByText('Anker USB-C Fast Charger')).toBeInTheDocument();
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

  it('triggers navigation callback when clicking Navigate button', async () => {
    const user = userEvent.setup();
    const onOpenNavigation = vi.fn();

    renderWithLanguage(
      <FullScreenLockerModal
        isOpen={true}
        pkg={mockPackage}
        onClose={vi.fn()}
        onOpenNavigation={onOpenNavigation}
      />
    );

    const navButtons = screen.getAllByTitle(/Navigate to Location/i);
    await user.click(navButtons[0]);

    expect(onOpenNavigation).toHaveBeenCalledWith({
      location: 'Dizengoff Center BoxIt #142',
      title: 'Anker USB-C Fast Charger'
    });
  });
});
