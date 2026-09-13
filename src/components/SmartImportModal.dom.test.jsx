/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SmartImportModal } from './SmartImportModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

// These are the first tests that actually render SmartImportModal. Before
// this file, "SmartImportModal.test.jsx" only re-tested parseSmartText
// through `typeof SmartImportModal === 'function'` — no click, keystroke, or
// conditional render in the component itself was ever exercised.
describe('SmartImportModal (rendered)', () => {
  beforeEach(() => {
    cleanup();
  });

  it('parses pasted text and shows the extracted tracking number and carrier', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />
    );

    const textarea = screen.getByPlaceholderText(/paste|text|sms/i);
    await user.type(textarea, 'Tracking RS948219483IL has arrived at the branch.');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    expect(await screen.findByText('RS948219483IL')).toBeInTheDocument();
    expect(screen.getByText('Israel Post')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add this package to tracker/i })).toBeInTheDocument();
  });

  it('shows the no-match state and offers manual entry when nothing parses', async () => {
    const user = userEvent.setup();
    const onSwitchToManual = vi.fn();
    renderWithLanguage(
      <SmartImportModal
        isOpen
        onClose={vi.fn()}
        onParsedResult={vi.fn()}
        onSwitchToManual={onSwitchToManual}
      />
    );

    const textarea = screen.getByPlaceholderText(/paste|text|sms/i);
    await user.type(textarea, 'just some unrelated text with no tracking info');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    const manualEntryButton = await screen.findByRole('button', { name: 'Enter Details Manually' });
    expect(manualEntryButton).toBeInTheDocument();
    await user.click(manualEntryButton);
    expect(onSwitchToManual).toHaveBeenCalledWith('just some unrelated text with no tracking info');
  });

  it('applying a parsed result calls onParsedResult with normalized fields and closes the modal', async () => {
    const user = userEvent.setup();
    const onParsedResult = vi.fn();
    const onClose = vi.fn();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={onClose} onParsedResult={onParsedResult} />
    );

    const textarea = screen.getByPlaceholderText(/paste|text|sms/i);
    await user.type(textarea, 'Tracking RS948219483IL from Israel Post has arrived.');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));
    await user.click(await screen.findByRole('button', { name: /add this package to tracker/i }));

    expect(onParsedResult).toHaveBeenCalledTimes(1);
    const arg = onParsedResult.mock.calls[0][0];
    expect(arg.trackingNumber).toBe('RS948219483IL');
    expect(arg.carrierId).toBe('israel-post');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a quick sample-message button parses immediately without typing', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /israel post sms example/i }));
    expect(await screen.findByText('RS948219483IL')).toBeInTheDocument();
  });

  it('parses Israeli locker SMS and displays pickup point and PIN in preview', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /boxit \/ cheetah locker example/i }));
    expect(await screen.findByText('BOX920194')).toBeInTheDocument();
    expect(screen.getByText('BoxIt')).toBeInTheDocument();
    expect(screen.getByText('Pickup PIN')).toBeInTheDocument();
    expect(screen.getByText('8492')).toBeInTheDocument();
    expect(screen.getByText('Pickup Point')).toBeInTheDocument();
  });

  it('the back control calls onClose', () => {
    // Inner pages lead with a back arrow rather than an X — they are one
    // level into a tab, not a window over it. Two controls render (a leading
    // back on mobile, a trailing close on desktop); either dismisses.
    const onClose = vi.fn();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={onClose} onParsedResult={vi.fn()} />
    );
    fireEvent.click(screen.getAllByLabelText(/back|close/i)[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('links dialog aria-labelledby to the title and contains tracking/pin within bdi dir="ltr"', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'smart-import-title');
    const title = document.getElementById('smart-import-title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent(/smart import/i);

    // Parse locker sample
    await user.click(screen.getByRole('button', { name: /boxit \/ cheetah locker example/i }));
    const trackingEl = await screen.findByText('BOX920194');
    expect(trackingEl.tagName.toLowerCase()).toBe('bdi');
    expect(trackingEl).toHaveAttribute('dir', 'ltr');

    const pinEl = screen.getByText('8492');
    expect(pinEl.tagName.toLowerCase()).toBe('bdi');
    expect(pinEl).toHaveAttribute('dir', 'ltr');
  });

  it('enforces touch targets and accessible controls on manual switch and action buttons', () => {
    const onSwitchToManual = vi.fn();
    renderWithLanguage(
      <SmartImportModal
        isOpen
        onClose={vi.fn()}
        onParsedResult={vi.fn()}
        onSwitchToManual={onSwitchToManual}
      />
    );

    const manualBtn = screen.getByRole('button', { name: /enter details manually instead/i });
    expect(manualBtn.className).toContain('min-h-[48px]');

    const pasteBtn = screen.getByRole('button', { name: /paste from clipboard/i });
    expect(pasteBtn.className).toContain('min-h-[48px]');

    const extractBtn = screen.getByRole('button', { name: /extract shipping details/i });
    expect(extractBtn.className).toContain('min-h-[48px]');
  });
});

