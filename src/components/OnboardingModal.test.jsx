/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { OnboardingModal } from './OnboardingModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

describe('OnboardingModal Component Tests', () => {
  const onClose = vi.fn();
  const onGetStartedGoogle = vi.fn();
  const onStartManual = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}, lang = 'en') => {
    return renderWithLanguage(
      <OnboardingModal
        isOpen={true}
        onClose={onClose}
        onGetStartedGoogle={onGetStartedGoogle}
        onStartManual={onStartManual}
        {...props}
      />,
      { language: lang }
    );
  };

  it('renders nothing when isOpen is false', () => {
    renderWithLanguage(<OnboardingModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders Slide 1 (Gmail Auto-Sync) on mount', () => {
    renderComponent();
    expect(screen.getByText(/Hands-Free Delivery Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Automated Sync/i)).toBeInTheDocument();
  });

  it('navigates through all 3 slides using Next and Back buttons', () => {
    renderComponent();

    // Slide 1 -> Slide 2
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Smart SMS & Link Import/i)).toBeInTheDocument();

    // Slide 2 -> Slide 3
    const nextBtn2 = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn2);
    expect(screen.getByText(/Sunlight-Proof Pickup PINs/i)).toBeInTheDocument();

    // Slide 3 -> Slide 2 (Back)
    const backBtn = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backBtn);
    expect(screen.getByText(/Smart SMS & Link Import/i)).toBeInTheDocument();
  });

  it('calls onClose when Skip is clicked', () => {
    renderComponent();
    const skipBtn = screen.getByRole('button', { name: /Skip/i });
    fireEvent.click(skipBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onGetStartedGoogle when primary CTA clicked on last slide', () => {
    renderComponent();
    // Go to slide 3
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    const googleBtn = screen.getByRole('button', { name: /Get Started with Google/i });
    fireEvent.click(googleBtn);
    expect(onGetStartedGoogle).toHaveBeenCalledTimes(1);
  });

  it('calls onStartManual when secondary CTA clicked on last slide', () => {
    renderComponent();
    // Go to slide 3
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    const manualBtn = screen.getByRole('button', { name: /Start Tracking Manually/i });
    fireEvent.click(manualBtn);
    expect(onStartManual).toHaveBeenCalledTimes(1);
  });

  it('renders correctly in Hebrew with proper translations', () => {
    renderComponent({}, 'he');
    expect(screen.getByText('מעקב חבילות אוטומטי וללא מאמץ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'דלג' })).toBeInTheDocument();
  });
});
