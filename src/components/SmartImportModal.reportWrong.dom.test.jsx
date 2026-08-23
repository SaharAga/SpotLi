/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SmartImportModal } from './SmartImportModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../services/feedbackService', () => ({
  submitFeedback: vi.fn()
}));

const { submitFeedback } = await import('../services/feedbackService');

describe('SmartImportModal — "this wasn\'t right" report', () => {
  beforeEach(() => {
    cleanup();
    submitFeedback.mockReset();
  });

  it('submits a bug report through the existing feedback pipeline, including the parsed values', async () => {
    submitFeedback.mockResolvedValue({ syncedToCloud: true });
    const user = userEvent.setup();
    const onShowToast = vi.fn();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} onShowToast={onShowToast} />
    );

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'RS948219481IL arrived');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));
    await screen.findByText('RS948219481IL');

    await user.click(screen.getByRole('button', { name: /wasn.t right/i }));

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    const payload = submitFeedback.mock.calls[0][0];
    expect(payload.type).toBe('bug');
    expect(payload.message).toContain('RS948219481IL');
    expect(payload.message).toContain('israel-post');
    expect(onShowToast).toHaveBeenCalledWith(expect.stringMatching(/reported/i), 'success');
  });

  it('shows a confirmed state and does not submit twice', async () => {
    submitFeedback.mockResolvedValue({ syncedToCloud: true });
    const user = userEvent.setup();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'RS948219481IL arrived');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));
    await screen.findByText('RS948219481IL');

    const reportButton = screen.getByRole('button', { name: /wasn.t right/i });
    await user.click(reportButton);
    await screen.findByRole('button', { name: /reported, thanks/i });

    await user.click(screen.getByRole('button', { name: /reported, thanks/i }));
    expect(submitFeedback).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast and stays reportable when the submission fails', async () => {
    submitFeedback.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    const onShowToast = vi.fn();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} onShowToast={onShowToast} />
    );

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'RS948219481IL arrived');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));
    await screen.findByText('RS948219481IL');

    await user.click(screen.getByRole('button', { name: /wasn.t right/i }));

    expect(onShowToast).toHaveBeenCalledWith(expect.stringMatching(/could not send/i), 'error');
    expect(screen.getByRole('button', { name: /wasn.t right/i })).toBeInTheDocument();
  });

  it('resets the reported state when a new parse runs', async () => {
    submitFeedback.mockResolvedValue({ syncedToCloud: true });
    const user = userEvent.setup();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/paste|text|sms/i);
    await user.type(textarea, 'RS948219481IL arrived');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));
    await screen.findByText('RS948219481IL');
    await user.click(screen.getByRole('button', { name: /wasn.t right/i }));
    await screen.findByRole('button', { name: /reported, thanks/i });

    await user.clear(textarea);
    await user.type(textarea, 'AliExpress order LP00582910482CN has arrived in Israel.');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    expect(await screen.findByRole('button', { name: /wasn.t right/i })).toBeInTheDocument();
  });
});
