/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, cleanup, act } from '@testing-library/react';
import { PackageCard } from './PackageCard';
import { LockerMapModal } from './LockerMapModal';
import { FullScreenLockerModal } from './FullScreenLockerModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const mockPkg1 = {
  id: 'pkg-sarona-1',
  title: 'ASOS Shirt',
  titleHe: 'חולצת פשתן ASOS',
  trackingNumber: 'BOX920194',
  carrier: 'boxit',
  status: 'ready_for_pickup',
  pickupLocation: 'שרונה מרקט, קומה 1-, תל אביב (לוקר Boxit)',
  pickupCode: '8492',
  shelfNumber: '42'
};

const mockPkg2 = {
  id: 'pkg-sarona-2',
  title: 'Zara Linen Shorts',
  titleHe: 'מכנסי פשתן Zara',
  trackingNumber: 'BOX920551',
  carrier: 'boxit',
  status: 'ready_for_pickup',
  pickupLocation: 'שרונה מרקט, קומה 1-, תל אביב (לוקר Boxit)',
  pickupCode: '5128',
  shelfNumber: '19'
};

describe('Multi-Package Pickup Bundling & Cluster Ergonomics', () => {
  beforeEach(() => {
    cleanup();
  });

  it('PackageCard renders interactive cluster button and triggers onOpenLockerMode on tap', () => {
    const handleOpenLocker = vi.fn();
    renderWithLanguage(
      <PackageCard
        pkg={mockPkg1}
        packages={[mockPkg1, mockPkg2]}
        onOpenLockerMode={handleOpenLocker}
      />,
      { language: 'he' }
    );

    const clusterBtn = screen.getByRole('button', { name: /עוד 1 חבילות באותה נקודה/i });
    expect(clusterBtn).toBeInTheDocument();
    expect(clusterBtn).toHaveTextContent('עוד 1 כאן');

    fireEvent.click(clusterBtn);
    expect(handleOpenLocker).toHaveBeenCalledWith(mockPkg1);
  });

  it('LockerMapModal groups user packages and displays active pickup points at the top', () => {
    const handleOpenLocker = vi.fn();
    renderWithLanguage(
      <LockerMapModal
        isOpen
        onClose={vi.fn()}
        packages={[mockPkg1, mockPkg2]}
        onOpenLockerMode={handleOpenLocker}
      />,
      { language: 'he' }
    );

    // Section header
    expect(screen.getByText('החבילות שלך שממתינות לאיסוף')).toBeInTheDocument();
    // 2 packages waiting chip
    expect(screen.getByText('2 חבילות כאן')).toBeInTheDocument();
    // Both PINs visible in detail card
    expect(screen.getByText('PIN: 8492')).toBeInTheDocument();
    expect(screen.getByText('PIN: 5128')).toBeInTheDocument();
    expect(screen.getByText('מדף: 42')).toBeInTheDocument();
    expect(screen.getByText('מדף: 19')).toBeInTheDocument();

    // Trigger locker mode button
    const openLockerBtn = screen.getByRole('button', { name: /פתח מסך איסוף מוגדל/i });
    fireEvent.click(openLockerBtn);
    expect(handleOpenLocker).toHaveBeenCalledWith(mockPkg1);
  });

  it('FullScreenLockerModal renders stacked PINs for bundled packages and marks all as collected', async () => {
    const handleMarkDelivered = vi.fn().mockResolvedValue();
    renderWithLanguage(
      <FullScreenLockerModal
        isOpen
        pkg={mockPkg1}
        packages={[mockPkg1, mockPkg2]}
        onClose={vi.fn()}
        onMarkDelivered={handleMarkDelivered}
      />,
      { language: 'he' }
    );

    // Header indicates bundled count
    expect(screen.getByText(/איסוף מרוכז \(2 חבילות\)/i)).toBeInTheDocument();

    // Both package titles and shelf numbers
    expect(screen.getByText('חולצת פשתן ASOS')).toBeInTheDocument();
    expect(screen.getByText('מכנסי פשתן Zara')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();

    // Mark all as collected
    const markAllBtn = screen.getByRole('button', { name: /סמן את כולן כנאספו \(2\)/i });
    expect(markAllBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(markAllBtn);
    });
    expect(handleMarkDelivered).toHaveBeenCalledWith('pkg-sarona-1', 'delivered');
    expect(handleMarkDelivered).toHaveBeenCalledWith('pkg-sarona-2', 'delivered');
  });
});
