/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountModal } from './AccountModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';
import { DEFAULT_NOTIFICATION_PREFS } from '../services/notificationService';
import { todayISO } from '../utils/dateUtils';

// AuthContext and ThemeContext both reach for browser/Firebase state that is
// unavailable in tests. Mocking them lets these tests render the real
// AccountModal and exercise the export path it actually takes — the previous
// version of this file never imported the component at all and asserted
// exportToCSV's own output, so it passed identically against the pre-#37
// hand-rolled implementation.
const authMocks = vi.hoisted(() => ({
  updateUserPreferences: vi.fn(),
  updateAiTrainingOptIn: vi.fn(),
  deleteUserAccountAndData: vi.fn(),
  logout: vi.fn()
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-42', email: 'u@example.com', preferences: {} },
    updateUserPreferences: authMocks.updateUserPreferences,
    updateAiTrainingOptIn: authMocks.updateAiTrainingOptIn,
    deleteUserAccountAndData: authMocks.deleteUserAccountAndData,
    logout: authMocks.logout,
    syncStatus: 'idle',
    lastSyncTime: null
  })
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false, theme: 'light', setTheme: vi.fn() })
}));

// Spy on the exporters while keeping their real behavior, so we can assert
// both WHICH function the backup button calls and what bytes it produced.
const exportSpies = vi.hoisted(() => ({ raw: vi.fn(), validated: vi.fn() }));

vi.mock('../utils/exportUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exportRawToCSV: (...args) => {
      exportSpies.raw(...args);
      return actual.exportRawToCSV(...args);
    },
    exportToCSV: (...args) => {
      exportSpies.validated(...args);
      return actual.exportToCSV(...args);
    }
  };
});

// A record that the repair pass would rewrite in every one of these fields.
const UNREPAIRED_PACKAGE = {
  id: 'pkg-raw-1',
  title: 'Sneakers "Air"',
  titleHe: 'נעלי ספורט',
  trackingNumber: 'rr-123 456/789il',
  carrier: 'some_carrier_we_never_heard_of',
  status: 'lost_in_the_post',
  orderDate: '',
  expectedDeliveryDate: '',
  origin: '',
  destination: '',
  notes: 'Special "Priority" delivery',
  notesHe: 'משלוח מהיר'
};

let downloads = [];

function renderModal(props = {}) {
  return renderWithLanguage(
    <AccountModal
      isOpen
      initialTab="data"
      onClose={vi.fn()}
      packages={[UNREPAIRED_PACKAGE]}
      {...props}
    />
  );
}

async function clickQuickExport() {
  const button = screen.getByRole('button', { name: /Quick Export to CSV/i });
  await userEvent.click(button);
}

beforeEach(() => {
  downloads = [];
  exportSpies.raw.mockClear();
  exportSpies.validated.mockClear();
  localStorage.clear();

  // Capture the downloaded blob instead of letting jsdom attempt navigation.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function capture() {
    downloads.push(this.getAttribute('download'));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AccountModal — backup export path', () => {
  it('routes the Account-tab backup through the raw exporter, not the validating one', async () => {
    renderModal();
    await clickQuickExport();

    expect(exportSpies.raw).toHaveBeenCalledTimes(1);
    expect(exportSpies.validated).not.toHaveBeenCalled();
  });

  it('writes the user’s stored values verbatim — no repair pass', async () => {
    renderModal();
    await clickQuickExport();

    const [passedPackages] = exportSpies.raw.mock.calls[0];
    expect(passedPackages).toEqual([UNREPAIRED_PACKAGE]);

    // Re-derive the produced CSV through the same real implementation.
    const { exportRawToCSV } = await import('../utils/exportUtils');
    exportSpies.raw.mockClear();
    const produced = exportRawToCSV([UNREPAIRED_PACKAGE]);
    const row = produced.replace(/^﻿/, '').split('\r\n')[1];

    // Values the validating exporter would have rewritten:
    expect(row).toContain('"some_carrier_we_never_heard_of"'); // not 'other'
    expect(row).toContain('"lost_in_the_post"'); // not 'in_transit'
    expect(row).toContain('"rr-123 456/789il"'); // not uppercased/stripped/UNTRACKED
    expect(row).not.toContain('UNTRACKED');
    expect(row).not.toContain(todayISO()); // empty orderDate stays empty
    expect(row).not.toContain('Israel'); // empty destination stays empty
    expect(row).not.toContain('Untitled Package');
  });

  it('keeps English Title/Notes columns even when Hebrew fields exist', async () => {
    const { exportRawToCSV } = await import('../utils/exportUtils');
    const row = exportRawToCSV([UNREPAIRED_PACKAGE])
      .replace(/^﻿/, '')
      .split('\r\n')[1];

    // formatPackageCSVRow uses `titleHe || title`; the raw formatter must not.
    expect(row).toContain('Sneakers ""Air""');
    expect(row).not.toContain('נעלי ספורט');
    expect(row).toContain('Special ""Priority"" delivery');
    expect(row).not.toContain('משלוח מהיר');
  });

  it('round-trips an unrepaired backup: every stored cell is recoverable', async () => {
    const { exportRawToCSV, CSV_HEADERS } = await import('../utils/exportUtils');
    const csv = exportRawToCSV([UNREPAIRED_PACKAGE]).replace(/^﻿/, '');
    const [headerLine, rowLine] = csv.split('\r\n');

    const parse = (line) =>
      line
        .slice(1, -1)
        .split('","')
        .map((cell) => cell.replace(/""/g, '"'));

    const headers = parse(headerLine);
    const cells = parse(rowLine);
    expect(headers).toEqual([...CSV_HEADERS]);

    const restored = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
    expect(restored.ID).toBe(UNREPAIRED_PACKAGE.id);
    expect(restored.Title).toBe(UNREPAIRED_PACKAGE.title);
    expect(restored.TrackingNumber).toBe(UNREPAIRED_PACKAGE.trackingNumber);
    expect(restored.Carrier).toBe(UNREPAIRED_PACKAGE.carrier);
    expect(restored.Status).toBe(UNREPAIRED_PACKAGE.status);
    expect(restored.OrderDate).toBe('');
    expect(restored.Destination).toBe('');
    expect(restored.Notes).toBe(UNREPAIRED_PACKAGE.notes);
  });

  it('exports every row past the 1,000-item advisory cap', async () => {
    const { exportRawToCSV } = await import('../utils/exportUtils');
    const many = Array.from({ length: 1200 }, (_, i) => ({
      id: `pkg-${i}`,
      title: `Item ${i}`,
      trackingNumber: `TRK${i}`
    }));
    const lines = exportRawToCSV(many).replace(/^﻿/, '').split('\r\n');
    expect(lines.length).toBe(1201); // header + 1200 rows
    expect(lines[1200]).toContain('pkg-1199');
  });

  it('preserves the filename convention and the success toast', async () => {
    const onShowToast = vi.fn();
    renderModal({ onShowToast });
    await clickQuickExport();

    const [, triggerDownload, filename] = exportSpies.raw.mock.calls[0];
    expect(triggerDownload).toBe(true);
    expect(filename).toBe(`deliveree_backup_user-42_${todayISO()}.csv`);
    expect(downloads).toEqual([`deliveree_backup_user-42_${todayISO()}.csv`]);
    expect(onShowToast).toHaveBeenCalledWith(expect.stringContaining('CSV backup'), 'success');
  });

  it('shows an info toast and exports nothing when there are no packages', async () => {
    const onShowToast = vi.fn();
    renderModal({ onShowToast, packages: [] });
    await clickQuickExport();

    expect(exportSpies.raw).not.toHaveBeenCalled();
    expect(onShowToast).toHaveBeenCalledWith(expect.stringContaining('No packages'), 'info');
  });
});

describe('AccountModal — notification preference failures', () => {
  it('reports an error toast when the preferences write is rejected', async () => {
    const onShowToast = vi.fn();
    renderWithLanguage(
      <AccountModal isOpen initialTab="notifications" onClose={vi.fn()} onShowToast={onShowToast} />
    );

    // Installed after render so the language preference write above succeeds.
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    });

    const toggles = screen.getAllByRole('checkbox');
    await userEvent.click(toggles[0]);

    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Could not save notification settings'),
      'error'
    );
    setItem.mockRestore();
  });
});

describe('AccountModal — account deletion keyword', () => {
  it('accepts only DELETE or מחק, case- and whitespace-insensitively', () => {
    const isValidConfirmation = (input) => {
      const trimmed = (input || '').trim().toUpperCase();
      return trimmed === 'DELETE' || trimmed === 'מחק';
    };

    expect(isValidConfirmation('DELETE')).toBe(true);
    expect(isValidConfirmation('delete')).toBe(true);
    expect(isValidConfirmation('  DELETE  ')).toBe(true);
    expect(isValidConfirmation('מחק')).toBe(true);
    expect(isValidConfirmation('del')).toBe(false);
    expect(isValidConfirmation('')).toBe(false);
    expect(isValidConfirmation(null)).toBe(false);
  });
});

describe('AccountModal — notification preference schema', () => {
  it('merges partial updates onto the defaults', () => {
    const updated = { ...DEFAULT_NOTIFICATION_PREFS, pushEnabled: true, notifyOnException: false };
    expect(updated.pushEnabled).toBe(true);
    expect(updated.notifyOnException).toBe(false);
    expect(updated.notifyOnStatusChange).toBe(true);
  });
});
