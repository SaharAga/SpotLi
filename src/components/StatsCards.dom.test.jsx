/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { StatsCards } from './StatsCards';
import { LanguageProvider } from '../context/LanguageContext';

describe('StatsCards Component', () => {
  const mockPackages = [
    { id: '1', status: 'in_transit', isArchived: false },
    { id: '2', status: 'out_for_delivery', isArchived: false },
    { id: '3', status: 'customs', isArchived: false },
    { id: '4', status: 'delivered', isArchived: false }
  ];

  it('renders four KPI buckets with correct counts and desktop responsive grid classes', () => {
    const onSelectFilter = vi.fn();
    const { container } = render(
      <LanguageProvider>
        <StatsCards packages={mockPackages} activeFilter="all" onSelectFilter={onSelectFilter} />
      </LanguageProvider>
    );

    // Verify hidden on mobile (< 1024px) and grid on desktop (>= 1024px)
    expect(container.firstChild).toHaveClass('hidden', 'lg:grid');

    // Counts: Total=4, Transit=2 (in_transit + out_for_delivery), Attention=1 (customs), Delivered=1
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2);

    const transitButton = screen.getByRole('button', { name: /in transit/i });
    fireEvent.click(transitButton);
    expect(onSelectFilter).toHaveBeenCalledWith('transit');
  });

  it('reflects aria-current state for the active filter', () => {
    render(
      <LanguageProvider>
        <StatsCards packages={mockPackages} activeFilter="customs" onSelectFilter={vi.fn()} />
      </LanguageProvider>
    );

    const customsBtn = screen.getByRole('button', { name: /customs/i });
    expect(customsBtn).toHaveAttribute('aria-current', 'true');
  });
});
