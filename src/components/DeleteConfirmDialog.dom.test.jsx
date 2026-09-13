/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { LanguageProvider } from '../context/LanguageContext';

function renderWithContext(ui, lang = 'en') {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('spotli_language', lang);
  }
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('DeleteConfirmDialog Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = renderWithContext(
      <DeleteConfirmDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly with title, description, and action buttons', () => {
    renderWithContext(
      <DeleteConfirmDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-labelledby', 'delete-confirm-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'delete-confirm-description');

    const title = document.getElementById('delete-confirm-title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent(/Delete Package\?|למחוק את החבילה\?/i);

    const description = document.getElementById('delete-confirm-description');
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent(/Are you sure you want to delete this shipment\?|האם אתה בטוח/i);
  });

  it('calls onClose when cancel button is clicked', () => {
    const handleClose = vi.fn();
    renderWithContext(
      <DeleteConfirmDialog isOpen={true} onClose={handleClose} onConfirm={vi.fn()} />
    );

    const cancelButton = screen.getByRole('button', { name: /Keep Package|השאר חבילה/i });
    fireEvent.click(cancelButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when top X close button is clicked', () => {
    const handleClose = vi.fn();
    renderWithContext(
      <DeleteConfirmDialog isOpen={true} onClose={handleClose} onConfirm={vi.fn()} />
    );

    const closeButton = screen.getByRole('button', { name: /Close|סגור/i });
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm and onClose when confirm delete button is clicked', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();
    renderWithContext(
      <DeleteConfirmDialog isOpen={true} onClose={handleClose} onConfirm={handleConfirm} />
    );

    const confirmButton = screen.getByRole('button', { name: /Yes, Delete|כן, מחק/i });
    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('safely renders packageTitle wrapped in bdi tag when provided', () => {
    renderWithContext(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        packageTitle="Sony WH-1000XM5 Headphones"
      />
    );

    const bdi = screen.getByText('Sony WH-1000XM5 Headphones');
    expect(bdi.tagName.toLowerCase()).toBe('bdi');
    expect(bdi).toHaveAttribute('dir', 'auto');
  });

  it('enforces >= 48px touch targets across all interactive buttons', () => {
    renderWithContext(
      <DeleteConfirmDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3); // Close, Cancel, Confirm

    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[48px]');
    });
  });
});
