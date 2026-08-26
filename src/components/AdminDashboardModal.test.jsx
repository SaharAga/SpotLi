/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminDashboardModal } from './AdminDashboardModal.jsx';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';

vi.mock('../services/firebase', () => ({
  db: null,
  auth: { currentUser: null },
  isFirebaseConfigured: false,
  googleProvider: {},
  appleProvider: {},
  facebookProvider: {}
}));

vi.mock('../services/feedbackService', async () => {
  const actual = await vi.importActual('../services/feedbackService');
  return {
    ...actual,
    fetchAllFeedback: vi.fn().mockResolvedValue({
      ok: true,
      items: [
        { id: 'fb-1', type: 'bug', message: 'Button not working', rating: 2, appVersion: '0.16.0', timestamp: '2026-08-25T10:00:00Z', screenshot: 'data:image/png;base64,iVBORw0KGgo=' },
        { id: 'fb-2', type: 'feature', message: 'Add dark mode contrast', rating: 5, appVersion: '0.16.0', timestamp: '2026-08-26T10:00:00Z' }
      ]
    }),
    getLocalFeedbackHistory: vi.fn().mockReturnValue([])
  };
});

vi.mock('../services/crashReportService', async () => {
  const actual = await vi.importActual('../services/crashReportService');
  return {
    ...actual,
    fetchAllCrashReports: vi.fn().mockResolvedValue({
      ok: true,
      items: [
        { id: 'cr-1', signature: 'sig-123', message: 'TypeError: undefined is not a function', componentName: 'PackageCard', appVersion: '0.16.0', timestamp: '2026-08-26T12:00:00Z' }
      ]
    })
  };
});

vi.mock('../services/parseCorrectionService', async () => {
  const actual = await vi.importActual('../services/parseCorrectionService');
  return {
    ...actual,
    fetchAllParseCorrections: vi.fn().mockResolvedValue({
      ok: true,
      items: [
        { id: 'pc-1', source: 'regex', confidence: 'high', editedFields: ['carrier', 'trackingNumber'], timestamp: '2026-08-26T12:00:00Z' }
      ]
    })
  };
});

describe('AdminDashboardModal Component Tests', () => {
  const renderDashboard = (props = {}) => {
    return render(
      <AuthProvider>
        <LanguageProvider>
          <AdminDashboardModal
            isOpen={true}
            onClose={vi.fn()}
            onShowToast={vi.fn()}
            {...props}
          />
        </LanguageProvider>
      </AuthProvider>
    );
  };

  it('renders correctly when open with all 5 navigation tabs', () => {
    renderDashboard();

    expect(screen.getByText(/Overview & Trends|מגמות ואיכות/i)).toBeTruthy();
    expect(screen.getByText(/User Feedback|משובי בודקים/i)).toBeTruthy();
    expect(screen.getByText(/Crash Monitor|ניטור קריסות/i)).toBeTruthy();
    expect(screen.getByText(/Smart Parser|פיענוח חכם/i)).toBeTruthy();
    expect(screen.getByText(/Export & System|ייצוא ומערכת/i)).toBeTruthy();
  });

  it('switches between tabs smoothly', () => {
    renderDashboard();

    // Click on Crashes tab
    const crashesTab = screen.getByText(/Crash Monitor|ניטור קריסות/i);
    fireEvent.click(crashesTab);
    expect(screen.getByText(/דוחות קריסה מקובצים|Crash Reports Grouped/i)).toBeTruthy();

    // Click on Smart Parser tab
    const parserTab = screen.getByText(/Smart Parser|פיענוח חכם/i);
    fireEvent.click(parserTab);
    expect(screen.getByText(/Most Frequently Corrected Fields|שדות שתוקנו הכי הרבה/i)).toBeTruthy();

    // Click on Export & System tab
    const systemTab = screen.getByText(/Export & System|ייצוא ומערכת/i);
    fireEvent.click(systemTab);
    expect(screen.getByText(/Export Telemetry Data|ייצוא נתוני טלמטריה/i)).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    renderDashboard({ onClose: handleClose });

    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
