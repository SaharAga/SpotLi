/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminDashboardModal, describeAppCheck } from './AdminDashboardModal.jsx';
import { LanguageProvider } from '../context/LanguageContext';
import { syncQueueService, DEAD_LETTER_STORAGE_KEY } from '../services/syncQueueService';
import { AuthProvider } from '../context/AuthContext';

vi.mock('../services/firebase', () => ({
  db: null,
  auth: { currentUser: null },
  isFirebaseConfigured: false,
  googleProvider: {},
  appleProvider: {},
  facebookProvider: {},
  getAppCheckDiagnostic: () => ({ state: 'unconfigured', detail: 'not set in this build' }),
  whenAppCheckSettled: () => Promise.resolve({ state: 'unconfigured', detail: 'not set in this build' })
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
    // Pinned: this suite's assertions were written against the Hebrew UI, and
    // LanguageProvider now detects from navigator instead of defaulting to it.
    localStorage.setItem('deliveree_lang', 'he');
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

  it('shows App Check status on the System tab, so it is readable without DevTools', async () => {
    renderDashboard();

    fireEvent.click(screen.getByText(/Export & System|ייצוא ומערכת/i));
    expect(screen.getByText(/App Check Status|מצב App Check/i)).toBeTruthy();

    // The mocked client reports no site key in this build.
    expect(await screen.findByText(/Not configured|לא מוגדר/i)).toBeTruthy();
    expect(screen.getByText(/not set in this build/i)).toBeTruthy();
  });

  it('lists dead-lettered changes and puts one back in the queue on Retry', () => {
    // Each of these is a change the user made that never reached the cloud.
    // retryDeadLetterMutation existed but nothing called it, so they were
    // unrecoverable — and invisible.
    localStorage.setItem(DEAD_LETTER_STORAGE_KEY, JSON.stringify([
      {
        id: 'mut-dead-1',
        type: 'ADD',
        payload: { id: 'pkg-1', title: 'Rosewater Cream Blouse' },
        userId: 'user-1',
        retryCount: 5,
        failedAt: '2026-09-14T10:00:00Z',
        lastError: 'Missing or insufficient permissions.'
      }
    ]));
    const onShowToast = vi.fn();
    renderDashboard({ onShowToast });

    fireEvent.click(screen.getByText(/Export & System|ייצוא ומערכת/i));
    expect(screen.getByText('Rosewater Cream Blouse')).toBeTruthy();
    expect(screen.getByText(/Missing or insufficient permissions/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /retry|נסה שוב/i }));

    expect(syncQueueService.getDeadLetterQueue()).toHaveLength(0);
    expect(syncQueueService.getQueue().some((m) => m.id === 'mut-dead-1')).toBe(true);
    expect(onShowToast).toHaveBeenCalled();

    syncQueueService.clearQueue();
    syncQueueService.clearDeadLetterQueue();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    renderDashboard({ onClose: handleClose });

    const closeBtn = screen.getByLabelText(/back|חזרה/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('connects dialog aria-labelledby and provides tablist and tab WAI-ARIA semantics', () => {
    renderDashboard();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'admin-dashboard-title');
    const title = document.getElementById('admin-dashboard-title');
    expect(title).toBeInTheDocument();

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(6);

    const trendsTab = screen.getByRole('tab', { name: /overview & trends|מגמות ואיכות/i });
    expect(trendsTab).toHaveAttribute('aria-selected', 'true');
    expect(trendsTab).toHaveAttribute('aria-controls', 'admin-panel-trends');

    const feedbackTab = screen.getByRole('tab', { name: /user feedback|משובי בודקים/i });
    expect(feedbackTab).toHaveAttribute('aria-selected', 'false');
    expect(feedbackTab).toHaveAttribute('aria-controls', 'admin-panel-feedback');

    fireEvent.click(feedbackTab);
    expect(feedbackTab).toHaveAttribute('aria-selected', 'true');
    expect(trendsTab).toHaveAttribute('aria-selected', 'false');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'admin-panel-feedback');
    expect(panel).toHaveAttribute('aria-labelledby', 'admin-tab-feedback');
  });

  it('enforces >= 48px touch targets on tabs, search input, and filter controls', () => {
    renderDashboard();

    const tabs = screen.getAllByRole('tab');
    for (const tab of tabs) {
      expect(tab.className).toContain('min-h-[48px]');
    }

    const feedbackTab = screen.getByRole('tab', { name: /user feedback|משובי בודקים/i });
    fireEvent.click(feedbackTab);

    const searchInput = screen.getByPlaceholderText(/search feedback|חיפוש בתוכן/i);
    expect(searchInput.className).toContain('min-h-[48px]');

    const ratingSelect = screen.getByRole('combobox');
    expect(ratingSelect.className).toContain('min-h-[48px]');
  });
});

describe('describeAppCheck', () => {
  it('separates a working install from a configured-but-rejected one', () => {
    // The distinction the Firebase console cannot show you on a phone: both
    // of these have a key, and only one of them is protecting anything.
    expect(describeAppCheck('token-ok', 'en').label).toBe('Verified');
    expect(describeAppCheck('no-token', 'en').label).toBe('Key rejected');
    expect(describeAppCheck('no-token', 'en').nextStep).toMatch(/allowed-domains/i);
  });

  it('points an unset key at the repository variable, and says what is unprotected', () => {
    const described = describeAppCheck('unconfigured', 'en');
    expect(described.label).toBe('Not configured');
    expect(described.nextStep).toMatch(/VITE_RECAPTCHA_V3_SITE_KEY/);
    expect(described.nextStep).toMatch(/feedback/);
  });

  it('translates every state', () => {
    for (const state of ['token-ok', 'no-token', 'init-failed', 'checking', 'unconfigured']) {
      const he = describeAppCheck(state, 'he');
      const en = describeAppCheck(state, 'en');
      expect(he.label).not.toBe(en.label);
      expect(he.tone).toBe(en.tone);
    }
  });
});
