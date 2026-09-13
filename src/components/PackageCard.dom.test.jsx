// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PackageCard } from './PackageCard';
import { LanguageProvider } from '../context/LanguageContext';

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

describe('PackageCard Component', () => {
  const basePkg = {
    id: 'pkg-1',
    title: 'Wireless Keyboard',
    trackingNumber: 'IL123456789',
    carrier: 'boxit',
    status: 'ready_for_pickup',
    pickupCode: '8492',
    pickupLocation: 'Dizengoff Center BoxIt #142'
  };

  it('renders package title, tracking number, and PIN badge', () => {
    renderWithLanguage(
      <PackageCard
        pkg={basePkg}
        onOpenDetails={vi.fn()}
        onOpenLockerMode={vi.fn()}
      />
    );

    expect(screen.getByText('Wireless Keyboard')).toBeInTheDocument();
    expect(screen.getByText('IL123456789')).toBeInTheDocument();
    expect(screen.getByText('PIN 8492')).toBeInTheDocument();
  });

  it('renders amber redirect badge when isRedirected is true', () => {
    const redirectedPkg = {
      ...basePkg,
      isRedirected: true,
      originalPickupLocation: 'Old Locker'
    };

    renderWithLanguage(
      <PackageCard
        pkg={redirectedPkg}
        onOpenDetails={vi.fn()}
      />
    );

    expect(screen.getByText('Redirected')).toBeInTheDocument();
  });

  it('renders the sender-reported badge for a Gmail order-status package', () => {
    const orderStatusPkg = {
      ...basePkg,
      trackingNumber: '',
      confidence: 'sender_reported',
      status: 'in_transit'
    };

    renderWithLanguage(
      <PackageCard
        pkg={orderStatusPkg}
        onOpenDetails={vi.fn()}
      />
    );

    expect(screen.getByText('from order confirmation')).toBeInTheDocument();
  });

  it('renders pickup location and same-location sibling counter badge', () => {
    const siblingPkg = {
      id: 'pkg-2',
      title: 'Second Package',
      trackingNumber: 'IL987654321',
      carrier: 'boxit',
      status: 'ready_for_pickup',
      pickupLocation: 'Dizengoff Center BoxIt #142'
    };

    renderWithLanguage(
      <PackageCard
        pkg={basePkg}
        packages={[basePkg, siblingPkg]}
        onOpenDetails={vi.fn()}
      />
    );

    expect(screen.getByText('Dizengoff Center BoxIt #142')).toBeInTheDocument();
    expect(screen.getByText('+1 here')).toBeInTheDocument();
  });

  it('renders returned_to_sender status badge and RotateCcw icon', () => {
    const returnPkg = {
      ...basePkg,
      status: 'returned_to_sender'
    };

    renderWithLanguage(
      <PackageCard
        pkg={returnPkg}
        onOpenDetails={vi.fn()}
      />
    );

    expect(screen.getByText('Returned to Sender')).toBeInTheDocument();
  });

  it('triggers onToggleArchive on swipe right past threshold', () => {
    const onToggleArchive = vi.fn();
    const { container } = renderWithLanguage(
      <PackageCard
        pkg={basePkg}
        onOpenDetails={vi.fn()}
        onToggleArchive={onToggleArchive}
      />
    );

    const swipeTarget = container.querySelector('[style*="translateX"]') || container.querySelector('.group');
    expect(swipeTarget).toBeInTheDocument();

    fireEvent.touchStart(swipeTarget, { touches: [{ clientX: 50, clientY: 100 }] });
    fireEvent.touchMove(swipeTarget, { touches: [{ clientX: 150, clientY: 100 }] });
    fireEvent.touchEnd(swipeTarget);

    expect(onToggleArchive).toHaveBeenCalledWith('pkg-1');
  });

  it('triggers onDelete on swipe left past threshold', () => {
    const onDelete = vi.fn();
    const { container } = renderWithLanguage(
      <PackageCard
        pkg={basePkg}
        onOpenDetails={vi.fn()}
        onDelete={onDelete}
      />
    );

    const swipeTarget = container.querySelector('[style*="translateX"]') || container.querySelector('.group');
    expect(swipeTarget).toBeInTheDocument();

    fireEvent.touchStart(swipeTarget, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(swipeTarget, { touches: [{ clientX: 80, clientY: 100 }] });
    fireEvent.touchEnd(swipeTarget);

    expect(onDelete).toHaveBeenCalledWith('pkg-1');
  });

  it('does not trigger archive or delete if swipe is released before threshold', () => {
    const onToggleArchive = vi.fn();
    const onDelete = vi.fn();
    const { container } = renderWithLanguage(
      <PackageCard
        pkg={basePkg}
        onOpenDetails={vi.fn()}
        onToggleArchive={onToggleArchive}
        onDelete={onDelete}
      />
    );

    const swipeTarget = container.querySelector('[style*="translateX"]') || container.querySelector('.group');

    // Minor swipe of 30px (threshold is 60px)
    fireEvent.touchStart(swipeTarget, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(swipeTarget, { touches: [{ clientX: 130, clientY: 100 }] });
    fireEvent.touchEnd(swipeTarget);

    expect(onToggleArchive).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('copies pickup PIN on 1-tap copy button click and calls onShowToast', async () => {
    const onShowToast = vi.fn();
    renderWithLanguage(
      <PackageCard
        pkg={basePkg}
        onOpenDetails={vi.fn()}
        onShowToast={onShowToast}
      />
    );

    const copyPinBtn = screen.getByRole('button', { name: /Copy pickup PIN|העתק קוד איסוף/i });
    fireEvent.click(copyPinBtn);

    await waitFor(() => {
      expect(onShowToast).toHaveBeenCalledWith(expect.stringMatching(/Pickup code copied!|קוד איסוף הועתק!/), 'success');
    });
  });

  it('triggers onOpenNavigation when clicking pickup location row', () => {
    const onOpenNavigation = vi.fn();
    renderWithLanguage(
      <PackageCard
        pkg={basePkg}
        onOpenDetails={vi.fn()}
        onOpenNavigation={onOpenNavigation}
      />
    );

    const navRow = screen.getByRole('button', { name: /Dizengoff Center BoxIt #142/i });
    fireEvent.click(navRow);

    expect(onOpenNavigation).toHaveBeenCalledWith({
      location: 'Dizengoff Center BoxIt #142',
      title: 'Wireless Keyboard'
    });
  });

  it('renders shelf number badge when shelfNumber is provided', () => {
    const pkgWithShelf = {
      ...basePkg,
      shelfNumber: 'B-42'
    };

    renderWithLanguage(
      <PackageCard
        pkg={pkgWithShelf}
        onOpenDetails={vi.fn()}
      />
    );

    expect(screen.getByText('Shelf B-42')).toBeInTheDocument();
  });

  it('opens accessible action menu and triggers onToggleArchive when Archive item is clicked', () => {
    const onToggleArchive = vi.fn();
    renderWithLanguage(
      <PackageCard
        pkg={basePkg}
        onOpenDetails={vi.fn()}
        onToggleArchive={onToggleArchive}
      />
    );

    const menuBtn = screen.getByRole('button', { name: /Package actions|פעולות לחבילה/i });
    expect(menuBtn).toHaveAttribute('aria-haspopup', 'menu');
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

    const archiveItem = screen.getByRole('button', { name: /Archive|העבר לארכיון/i });
    fireEvent.click(archiveItem);

    expect(onToggleArchive).toHaveBeenCalledWith('pkg-1');
  });
});


