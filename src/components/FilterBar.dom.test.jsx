/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { FilterBar } from './FilterBar';
import { LanguageProvider } from '../context/LanguageContext';

function renderFilterBar(props = {}, lang = 'en') {
  localStorage.setItem('deliveree_lang', lang);
  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    activeTab: 'all',
    onTabChange: vi.fn(),
    selectedCarrier: 'all',
    onCarrierChange: vi.fn(),
    sortBy: 'newest',
    onSortChange: vi.fn(),
    viewMode: 'grid',
    onViewModeChange: vi.fn(),
    onRefreshAll: vi.fn(),
    isRefreshing: false,
    packages: [
      { id: '1', status: 'in_transit', isArchived: false },
      { id: '2', status: 'delivered', isArchived: false },
      { id: '3', status: 'customs', isArchived: false },
      { id: '4', status: 'delivered', isArchived: true },
    ]
  };

  return {
    ...render(
      <LanguageProvider>
        <FilterBar {...defaultProps} {...props} />
      </LanguageProvider>
    ),
    props: { ...defaultProps, ...props }
  };
}

describe('FilterBar – Session 31 a11y & Controls', () => {
  it('renders search input and clear button when search query exists', () => {
    const onSearchChange = vi.fn();
    renderFilterBar({ searchQuery: 'iPhone', onSearchChange });

    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toHaveValue('iPhone');

    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    expect(clearBtn).toHaveAttribute('type', 'button');
    fireEvent.click(clearBtn);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('chips have aria-pressed states reflecting active tab', () => {
    renderFilterBar({ activeTab: 'transit' });

    const allChip = screen.getByRole('button', { name: /^all/i });
    expect(allChip).toHaveAttribute('aria-pressed', 'false');

    const transitChip = screen.getByRole('button', { name: /in transit/i });
    expect(transitChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles filters panel with type="button" and aria-expanded', () => {
    renderFilterBar();

    const filtersBtn = screen.getByRole('button', { name: /status|filters/i });
    expect(filtersBtn).toHaveAttribute('type', 'button');
    expect(filtersBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(filtersBtn);
    expect(filtersBtn).toHaveAttribute('aria-expanded', 'true');

    // Panel controls are rendered
    expect(screen.getByLabelText(/all carriers/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
  });

  it('allows changing view mode between grid and table', () => {
    const onViewModeChange = vi.fn();
    renderFilterBar({ viewMode: 'grid', onViewModeChange });

    // Open filter panel first
    const filtersBtn = screen.getByRole('button', { name: /status|filters/i });
    fireEvent.click(filtersBtn);

    const gridBtn = screen.getByRole('button', { name: /^grid$/i });
    const tableBtn = screen.getByRole('button', { name: /^table$/i });

    expect(gridBtn).toHaveAttribute('type', 'button');
    expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    expect(tableBtn).toHaveAttribute('type', 'button');
    expect(tableBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(tableBtn);
    expect(onViewModeChange).toHaveBeenCalledWith('table');
  });

  it('supports keyboard dismissal (Escape) of the filters panel', () => {
    renderFilterBar();

    const filtersBtn = screen.getByRole('button', { name: /status|filters/i });
    fireEvent.click(filtersBtn);
    expect(filtersBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(filtersBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
