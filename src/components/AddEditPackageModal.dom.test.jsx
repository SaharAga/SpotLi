/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddEditPackageModal } from './AddEditPackageModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

// This is the app's primary write path: every package a user creates or
// edits goes through this form. Before this file it had no rendered
// coverage at all — only the pure detectCarrier/schema utilities it calls
// were tested.
describe('AddEditPackageModal (rendered)', () => {
  beforeEach(() => {
    cleanup();
  });

  it('does not submit when the required fields are empty', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={onSave} />
    );

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('auto-detects the carrier as the tracking number is typed', async () => {
    const user = userEvent.setup();
    const { container } = renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} />
    );

    const trackingInput = screen.getByPlaceholderText(/RS948219481IL/i);
    await user.type(trackingInput, 'RS948219481IL');

    // "Auto-detected" and the carrier name render as separate text nodes
    // inside one badge, so assert on the badge's combined text rather than
    // an exact node match.
    await screen.findByText(/auto-detected/i);
    expect(container.textContent).toContain('Israel Post');
  });

  it('submits a normalized package on save and closes the modal', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={onClose} onSave={onSave} />
    );

    await user.type(screen.getByPlaceholderText(/mechanical keyboard/i), '  New Headphones  ');
    await user.type(screen.getByPlaceholderText(/RS948219481IL/i), '  rs948219481il  ');
    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    // Title is trimmed, tracking number is trimmed and upper-cased — the
    // form must not persist stray whitespace or mixed-case tracking IDs.
    expect(saved.title).toBe('New Headphones');
    expect(saved.trackingNumber).toBe('RS948219481IL');
    expect(saved.carrier).toBe('israel-post');
    expect(saved.id).toMatch(/^pkg-/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pre-fills from an existing package in edit mode and preserves its id on save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const editPackage = {
      id: 'pkg-existing-1',
      title: 'Existing Item',
      trackingNumber: 'HFD90481029',
      carrier: 'hfd',
      category: 'electronics',
      status: 'in_transit',
      isPinned: true,
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      checkpoints: []
    };

    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={onSave} editPackage={editPackage} />
    );

    expect(screen.getByDisplayValue('Existing Item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HFD90481029')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save package/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.id).toBe('pkg-existing-1');
    expect(saved.isPinned).toBe(true);
    expect(saved.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithLanguage(
      <AddEditPackageModal isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
