/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackModal } from './FeedbackModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';
import * as feedbackService from '../services/feedbackService';
import * as imageCompressor from '../utils/imageCompressor';

describe('FeedbackModal DOM Integration & Ergonomics', () => {
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

  it('renders with accessible WAI-ARIA radiogroups and category tabs', () => {
    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'en' }
    );

    expect(screen.getByText('Alpha Feedback & Bug Report')).toBeInTheDocument();

    const categoryGroup = screen.getByRole('radiogroup', { name: /Feedback Category/i });
    expect(categoryGroup).toBeInTheDocument();

    const bugRadio = screen.getByRole('radio', { name: /Bug/i });
    const ideaRadio = screen.getByRole('radio', { name: /Idea/i });
    const praiseRadio = screen.getByRole('radio', { name: /Praise/i });

    expect(bugRadio).toHaveAttribute('aria-checked', 'true');
    expect(ideaRadio).toHaveAttribute('aria-checked', 'false');
    expect(praiseRadio).toHaveAttribute('aria-checked', 'false');

    // Rating radiogroup
    const ratingGroup = screen.getByRole('radiogroup', { name: /Rate your experience/i });
    expect(ratingGroup).toBeInTheDocument();

    const starRadios = screen.getAllByRole('radio', { name: /\d stars?/i });
    expect(starRadios).toHaveLength(5);
    starRadios.forEach((radio) => {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('allows switching feedback category and updates aria-checked states', async () => {
    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'en' }
    );

    const bugRadio = screen.getByRole('radio', { name: /Bug/i });
    const ideaRadio = screen.getByRole('radio', { name: /Idea/i });

    expect(bugRadio).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(ideaRadio);

    expect(ideaRadio).toHaveAttribute('aria-checked', 'true');
    expect(bugRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles rating stars and supports unselecting', async () => {
    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'en' }
    );

    const star4 = screen.getByRole('radio', { name: /4 stars/i });
    expect(star4).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(star4);
    expect(star4).toHaveAttribute('aria-checked', 'true');

    // Clicking the same star unselects it
    await userEvent.click(star4);
    expect(star4).toHaveAttribute('aria-checked', 'false');
  });

  it('shows error toast when attempting to submit with empty message', async () => {
    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'en' }
    );

    const submitBtn = screen.getByRole('button', { name: /Submit Feedback/i });
    fireEvent.submit(submitBtn.closest('form'));

    expect(onShowToast).toHaveBeenCalledWith(
      'Please enter feedback text',
      'error'
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('prompts once for rating if user submits without a score, then submits on second click', async () => {
    vi.spyOn(feedbackService, 'submitFeedback').mockResolvedValue({
      success: true,
      syncedToCloud: true,
      isOnline: true,
      feedback: { id: 'fb-101' }
    });

    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'en' }
    );

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'App is super snappy!');

    const submitBtn = screen.getByRole('button', { name: /Submit Feedback/i });

    // First click: prompts for rating
    await userEvent.click(submitBtn);
    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('No rating chosen'),
      'info'
    );
    expect(feedbackService.submitFeedback).not.toHaveBeenCalled();

    // Second click: proceeds with unrated feedback
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(feedbackService.submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bug',
          message: 'App is super snappy!',
          rating: null
        })
      );
    });

    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Thank you! Your feedback has been synced'),
      'success'
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits immediately when a rating is selected without prompt', async () => {
    vi.spyOn(feedbackService, 'submitFeedback').mockResolvedValue({
      success: true,
      syncedToCloud: true,
      isOnline: true,
      feedback: { id: 'fb-102' }
    });

    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'en' }
    );

    const praiseRadio = screen.getByRole('radio', { name: /Praise/i });
    await userEvent.click(praiseRadio);

    const star5 = screen.getByRole('radio', { name: /5 stars/i });
    await userEvent.click(star5);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Love the Hebrew locker PIN feature!');

    const submitBtn = screen.getByRole('button', { name: /Submit Feedback/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(feedbackService.submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'praise',
          message: 'Love the Hebrew locker PIN feature!',
          rating: 5
        })
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
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
    await userEvent.click(submitBtn);
    await userEvent.click(submitBtn);

    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('כשתחזור הרשת'),
      'info'
    );
  });

  it('displays screenshot compression errors gracefully', async () => {
    vi.spyOn(imageCompressor, 'compressImageFile').mockRejectedValue(new Error('too-large'));

    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'en' }
    );

    const fileInput = screen.getByLabelText(/Attach a screenshot/i);
    const mockFile = new File(['oversized-image-data'], 'large.png', { type: 'image/png' });

    await userEvent.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText(/Image is still too large after compression/i)).toBeInTheDocument();
    });
  });

  it('renders Hebrew RTL layout and localized strings correctly', () => {
    renderWithLanguage(
      <FeedbackModal isOpen={true} onClose={onClose} onShowToast={onShowToast} />,
      { language: 'he' }
    );

    expect(screen.getByText(/משוב ודיווח תקלות/i)).toBeInTheDocument();
    expect(screen.getByText(/תקלה \/ באג/i)).toBeInTheDocument();
    expect(screen.getByText(/הצעת ייעול/i)).toBeInTheDocument();
    expect(screen.getByText(/חוויית שימוש/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero Tracking & PII/i)).toBeInTheDocument();
  });
});
