// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActivityModal } from './ActivityModal';
import { LanguageProvider } from '../context/LanguageContext';

function renderWithLanguage(ui, language = 'en') {
  localStorage.setItem('deliveree_lang', language);
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('ActivityModal Component', () => {
  const mockPackages = [
    {
      id: 'pkg-1',
      title: 'Gaming Mouse',
      titleHe: 'עכבר גיימינג',
      trackingNumber: 'IL123456789',
      carrier: 'israel-post',
      status: 'ready_for_pickup',
      checkpoints: [
        {
          id: 'cp-1',
          title: 'Ready for pickup',
          titleHe: 'מוכן לאיסוף בסניף',
          description: 'Locker 14 at Dizengoff Post Office',
          descriptionHe: 'לוקר 14 בסניף דואר דיזנגוף',
          location: 'Dizengoff Post Office',
          timestamp: '2026-09-13T10:30:00Z'
        },
        {
          id: 'cp-2',
          title: 'Arrived at sorting hub',
          titleHe: 'הגיע למרכז מיון',
          location: 'Tel Aviv Hub',
          timestamp: '2026-09-12T14:00:00Z'
        }
      ]
    },
    {
      id: 'pkg-2',
      title: 'Noise Cancelling Headphones',
      titleHe: 'אוזניות מבטלות רעש',
      trackingNumber: '1Z9999999999999999',
      carrier: 'ups',
      status: 'in_transit',
      checkpoints: [
        {
          id: 'cp-3',
          title: 'Customs cleared',
          titleHe: 'שוחרר מהמכס',
          timestamp: '2026-09-12T09:00:00Z'
        }
      ]
    }
  ];

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithLanguage(
      <ActivityModal isOpen={false} onClose={vi.fn()} packages={mockPackages} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders empty state when packages have no checkpoints', () => {
    renderWithLanguage(
      <ActivityModal
        isOpen={true}
        onClose={vi.fn()}
        packages={[{ id: 'empty-1', title: 'Pending Package', checkpoints: [] }]}
      />
    );

    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('No updates yet')).toBeInTheDocument();
    expect(screen.getByText(/As carriers report on your packages/i)).toBeInTheDocument();
  });

  it('renders activity feed grouped with updates count, event titles, carriers, and locations', () => {
    renderWithLanguage(
      <ActivityModal
        isOpen={true}
        onClose={vi.fn()}
        packages={mockPackages}
      />
    );

    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('3 recent updates')).toBeInTheDocument();
    expect(screen.getByText('Ready for pickup')).toBeInTheDocument();
    expect(screen.getByText(/Locker 14 at Dizengoff Post Office/i)).toBeInTheDocument();
    expect(screen.getByText('Dizengoff Post Office')).toBeInTheDocument();
    expect(screen.getByText('Customs cleared')).toBeInTheDocument();
  });

  it('triggers onOpenPackage callback when an activity item is clicked', () => {
    const handleOpenPackage = vi.fn();

    renderWithLanguage(
      <ActivityModal
        isOpen={true}
        onClose={vi.fn()}
        packages={mockPackages}
        onOpenPackage={handleOpenPackage}
      />
    );

    const firstItem = screen.getByRole('button', { name: /Ready for pickup/i });
    fireEvent.click(firstItem);

    expect(handleOpenPackage).toHaveBeenCalledWith('pkg-1');
  });

  it('renders Hebrew bilingual translations and localized titles in Hebrew mode', () => {
    renderWithLanguage(
      <ActivityModal
        isOpen={true}
        onClose={vi.fn()}
        packages={mockPackages}
      />,
      'he'
    );

    expect(screen.getByText('פעילות')).toBeInTheDocument();
    expect(screen.getByText('3 עדכונים אחרונים')).toBeInTheDocument();
    expect(screen.getByText('מוכן לאיסוף בסניף')).toBeInTheDocument();
    expect(screen.getByText(/לוקר 14 בסניף דואר דיזנגוף/i)).toBeInTheDocument();
  });

  it('toggles inclusion of archived packages via switch button', () => {
    localStorage.removeItem('deliveree_activity_include_archived');
    const packagesWithArchived = [
      {
        id: 'pkg-live',
        title: 'Live Box',
        isArchived: false,
        checkpoints: [
          { id: 'cp-live', title: 'On Plane', timestamp: '2026-09-10T10:00:00Z' }
        ]
      },
      {
        id: 'pkg-archived',
        title: 'Archived Box',
        isArchived: true,
        checkpoints: [
          { id: 'cp-arch', title: 'Delivered Yesterday', timestamp: '2026-09-09T10:00:00Z' }
        ]
      }
    ];

    renderWithLanguage(
      <ActivityModal
        isOpen={true}
        onClose={vi.fn()}
        packages={packagesWithArchived}
      />
    );

    // Initially archived is excluded
    expect(screen.getByText('1 recent updates')).toBeInTheDocument();
    expect(screen.getByText('On Plane')).toBeInTheDocument();
    expect(screen.queryByText('Delivered Yesterday')).not.toBeInTheDocument();

    // Toggle switch
    const toggleBtn = screen.getByRole('switch', { name: /include archived packages/i });
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('2 recent updates')).toBeInTheDocument();
    expect(screen.getByText('Delivered Yesterday')).toBeInTheDocument();
  });
});
