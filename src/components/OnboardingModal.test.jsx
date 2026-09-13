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

  it('renders Slide 1 (Welcome & Overview) on mount', () => {
    renderComponent();
    expect(screen.getByText(/All Your Deliveries — In One Smart Place/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome to SpotLi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /See How It Works/i })).toBeInTheDocument();
  });

  it('navigates through all 4 slides using Next and Back buttons', () => {
    renderComponent();

    // Slide 1 (Welcome) -> Slide 2 (Gmail)
    const seeHowItWorksBtn = screen.getByRole('button', { name: /See How It Works/i });
    fireEvent.click(seeHowItWorksBtn);
    expect(screen.getByText(/Hands-Free Delivery Tracking/i)).toBeInTheDocument();

    // Slide 2 -> Slide 3 (SMS)
    const nextBtn1 = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn1);
    expect(screen.getByText(/Smart SMS & Link Import/i)).toBeInTheDocument();

    // Slide 3 -> Slide 4 (Pickup)
    const nextBtn2 = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn2);
    expect(screen.getByText(/Sunlight-Proof Pickup PINs/i)).toBeInTheDocument();

    // Slide 4 -> Slide 3 (Back)
    const backBtn = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backBtn);
    expect(screen.getByText(/Smart SMS & Link Import/i)).toBeInTheDocument();
  });

  it('calls onSignIn when Sign In header button is clicked', () => {
    const onSignIn = vi.fn();
    renderComponent({ onSignIn });
    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(signInBtn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Skip is clicked without onSignIn prop', () => {
    renderComponent();
    const skipBtn = screen.getByRole('button', { name: /Skip/i });
    fireEvent.click(skipBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onGetStartedGoogle when primary CTA clicked on last slide', () => {
    renderComponent();
    // Go to slide 4
    fireEvent.click(screen.getByRole('button', { name: /See How It Works/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    const googleBtn = screen.getByRole('button', { name: /Continue with Google|Get Started with Google/i });
    fireEvent.click(googleBtn);
    expect(onGetStartedGoogle).toHaveBeenCalledTimes(1);
  });

  it('calls onSignInEmail when secondary CTA clicked on last slide', () => {
    const onSignInEmail = vi.fn();
    renderComponent({ onSignInEmail });
    // Go to slide 4
    fireEvent.click(screen.getByRole('button', { name: /See How It Works/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    const emailBtn = screen.getByRole('button', { name: /Continue with Email/i });
    fireEvent.click(emailBtn);
    expect(onSignInEmail).toHaveBeenCalledTimes(1);
  });

  it('calls onTryDemo when demo option clicked on last slide', () => {
    const onTryDemo = vi.fn();
    renderComponent({ onTryDemo });
    // Go to slide 4
    fireEvent.click(screen.getByRole('button', { name: /See How It Works/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    const demoBtn = screen.getByRole('button', { name: /explore with demo package/i });
    fireEvent.click(demoBtn);
    expect(onTryDemo).toHaveBeenCalledTimes(1);
  });

  it('renders correctly in Hebrew with proper translations', () => {
    const onSignIn = vi.fn();
    renderComponent({ onSignIn }, 'he');
    expect(screen.getByText('כל המשלוחים והחבילות שלך — במקום אחד')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'גלה איך זה עובד' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחבר' })).toBeInTheDocument();
  });

  it('exposes accessible tablist and tab roles for slide navigation', () => {
    renderComponent();
    const tablist = screen.getByRole('tablist', { name: /Tour progress/i });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);

    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'onboarding-slide-tab-0');

    // Click tab 3 (Slide 3: Smart Import) directly
    fireEvent.click(tabs[2]);
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(panel).toHaveAttribute('aria-labelledby', 'onboarding-slide-tab-2');
    expect(screen.getByText(/Smart SMS & Link Import/i)).toBeInTheDocument();
  });

  it('renders dialog with labelledBy matching slide title', () => {
    renderComponent();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'onboarding-slide-title');
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveAttribute('id', 'onboarding-slide-title');
  });

  it('wraps courier codes and PINs in bdi elements for BiDi safety', () => {
    renderComponent({}, 'he');
    // On Slide 1, check #AMZ-9382 and #CH-4821
    const bdiElements = document.querySelectorAll('bdi[dir="ltr"]');
    expect(bdiElements.length).toBeGreaterThanOrEqual(3);

    const textContents = Array.from(bdiElements).map((el) => el.textContent);
    expect(textContents).toContain('#AMZ-9382');
    expect(textContents).toContain('#CH-4821');
  });
});
