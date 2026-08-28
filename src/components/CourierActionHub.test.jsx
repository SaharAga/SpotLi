/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { CourierActionHub } from './CourierActionHub';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true)
}));

vi.mock('../utils/haptics', () => ({
  triggerHapticFeedback: vi.fn()
}));

describe('CourierActionHub', () => {
  const mockPkg = {
    id: 'pkg-123',
    title: 'Smart Watch',
    titleHe: 'שעון חכם',
    trackingNumber: 'IL987654321',
    carrier: 'israel_post',
    carrierName: 'Israel Post',
    pickupCode: '4321',
    pickupLocation: 'Point Dizengoff'
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders template tabs and action buttons in Hebrew', () => {
    renderWithLanguage(<CourierActionHub pkg={mockPkg} />, { language: 'he' });

    expect(screen.getByText(/תגובה מהירה לשליח/)).toBeInTheDocument();
    expect(screen.getByText('השאר ליד הדלת')).toBeInTheDocument();
    expect(screen.getByText('קוד כניסה / שער')).toBeInTheDocument();
    expect(screen.getByText('מקום בטוח / שכן')).toBeInTheDocument();
    expect(screen.getByText('ייפוי כוח לאיסוף')).toBeInTheDocument();
    expect(screen.getByText('שלח בוואטסאפ')).toBeInTheDocument();
    expect(screen.getByText('שלח ב-SMS')).toBeInTheDocument();
    expect(screen.getByText('העתק טקסט')).toBeInTheDocument();
  });

  it('renders template tabs and action buttons in English', () => {
    renderWithLanguage(<CourierActionHub pkg={mockPkg} />, { language: 'en' });

    expect(screen.getByText(/Courier Quick Actions/)).toBeInTheDocument();
    expect(screen.getByText('Porch Drop')).toBeInTheDocument();
    expect(screen.getByText('Gate Code')).toBeInTheDocument();
    expect(screen.getByText('Safe Place')).toBeInTheDocument();
    expect(screen.getByText('Proxy Pickup')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText('Copy Text')).toBeInTheDocument();
  });

  it('switches templates and updates preview text on click', () => {
    renderWithLanguage(<CourierActionHub pkg={mockPkg} />, { language: 'he' });

    fireEvent.click(screen.getByText('השאר ליד הדלת'));
    expect(screen.getByText(/אפשר בבקשה להשאיר ליד דלת הכניסה/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('מקום בטוח / שכן'));
    expect(screen.getByText(/אינני בבית, אשמח אם תוכל להשאיר/)).toBeInTheDocument();
  });

  it('shows inline gate code input when gate code template is selected', () => {
    renderWithLanguage(<CourierActionHub pkg={mockPkg} />, { language: 'he' });

    fireEvent.click(screen.getByText('קוד כניסה / שער'));
    const input = screen.getByPlaceholderText(/הזן קוד כניסה לבניין/);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '9988#' } });
    expect(screen.getByText(/קוד הכניסה לבניין \/ שער הוא: 9988#/)).toBeInTheDocument();
  });
});
