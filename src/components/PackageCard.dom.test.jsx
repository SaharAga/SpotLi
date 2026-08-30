// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PackageCard } from './PackageCard';
import { LanguageProvider } from '../context/LanguageContext';

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
});
