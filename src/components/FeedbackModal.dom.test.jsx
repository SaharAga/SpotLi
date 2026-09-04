/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackModal } from './FeedbackModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';
import * as feedbackService from '../services/feedbackService';

describe('FeedbackModal toast distinction (#132)', () => {
  const onShowToast = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    onShowToast.mockClear();
    onClose.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows warning toast when online but firestore write fails', async () => {
    vi.spyOn(feedbackService, 'submitFeedback').mockResolvedValue({
      success: true,
      syncedToCloud: false,
      isOnline: true,
      feedback: { id: 'fb-1' }
    });

    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'he' }
    );

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Online failure report');

    const submitBtn = screen.getByRole('button', { name: /שלח משוב|Send Feedback/i });
    // Rating is optional: the first submit asks about it once, the second sends.
    await userEvent.click(submitBtn);
    await userEvent.click(submitBtn);

    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('השליחה נכשלה זמנית'),
      'warning'
    );
  });

  it('shows offline toast when device is truly offline', async () => {
    vi.spyOn(feedbackService, 'submitFeedback').mockResolvedValue({
      success: true,
      syncedToCloud: false,
      isOnline: false,
      feedback: { id: 'fb-2' }
    });

    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'he' }
    );

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Offline report');

    const submitBtn = screen.getByRole('button', { name: /שלח משוב|Send Feedback/i });
    // Rating is optional: the first submit asks about it once, the second sends.
    await userEvent.click(submitBtn);
    await userEvent.click(submitBtn);

    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('כשתחזור הרשת'),
      'info'
    );
  });
});
