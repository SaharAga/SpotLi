/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountModal } from './AccountModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';
import { DEFAULT_NOTIFICATION_PREFS, notificationService } from '../services/notificationService';
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
    exportRawToJSON: (...args) => {
      exportSpies.raw(...args);
      return actual.exportRawToJSON(...args);
    },
    exportToCSV: (...args) => {
      exportSpies.validated(...args);
      return actual.exportToCSV(...args);
    }
  };
});

const STORAGE_KEY = 'deliveree_packages_user-42';

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
      onClose={vi.fn()}
      packages={[UNREPAIRED_PACKAGE]}
      {...props}
    />
  );
}

async function clickBackup() {
  const button = screen.getByRole('button', { name: /Download full backup/i });
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
  it('backs up the stored blob, not the in-memory prop', async () => {
    // The two agree in normal operation (savePackages validates before
    // writing). They diverge for a legacy or externally-written blob, which is
    // what this asserts: the stored bytes reach the file, not App state.
    const repairedProp = [{ ...UNREPAIRED_PACKAGE, carrier: 'other', status: 'in_transit', trackingNumber: 'RR123456789IL' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([UNREPAIRED_PACKAGE]));

    renderModal({ packages: repairedProp });
    await clickBackup();

    expect(exportSpies.raw).toHaveBeenCalledTimes(1);
    expect(exportSpies.validated).not.toHaveBeenCalled();

    const [passedPackages] = exportSpies.raw.mock.calls[0];
    expect(passedPackages).toEqual([UNREPAIRED_PACKAGE]);
    expect(passedPackages).not.toEqual(repairedProp);
  });

  it('applies no repair pass of its own to what it was handed', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([UNREPAIRED_PACKAGE]));
    renderModal();
    await clickBackup();

    const { exportRawToJSON } = await import('../utils/exportUtils');
    exportSpies.raw.mockClear();
    const [out] = JSON.parse(exportRawToJSON([UNREPAIRED_PACKAGE])).packages;

    expect(out.carrier).toBe('some_carrier_we_never_heard_of'); // not 'other'
    expect(out.status).toBe('lost_in_the_post'); // not 'in_transit'
    expect(out.trackingNumber).toBe('rr-123 456/789il'); // not uppercased/stripped/UNTRACKED
    expect(out.orderDate).toBe(''); // empty orderDate stays empty
    expect(out.destination).toBe(''); // empty destination stays empty
    expect(out.title).toBe('Sneakers "Air"'); // not 'Untitled Package'
    expect(out).not.toHaveProperty('schemaVersion'); // nothing added either
  });

  it('keeps the Hebrew fields the CSV backup dropped (#53)', async () => {
    const { exportRawToJSON } = await import('../utils/exportUtils');
    const [out] = JSON.parse(exportRawToJSON([UNREPAIRED_PACKAGE])).packages;

    expect(out.title).toBe('Sneakers "Air"');
    expect(out.titleHe).toBe('נעלי ספורט');
    expect(out.notes).toBe('Special "Priority" delivery');
    expect(out.notesHe).toBe('משלוח מהיר');
  });

  it('produces a file the app can actually restore', async () => {
    const withCheckpoints = {
      ...UNREPAIRED_PACKAGE,
      carrier: 'israel_post',
      status: 'in_transit',
      trackingNumber: 'RR123456789IL',
      checkpoints: [{ id: 'cp-1', status: 'in_transit', location: 'Haifa', timestamp: '2026-08-01T00:00:00.000Z' }]
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([withCheckpoints]));

    renderModal();
    await clickBackup();

    const [passedPackages] = exportSpies.raw.mock.calls[0];
    const { exportRawToJSON } = await import('../utils/exportUtils');
    const { deliveryService } = await import('../services/deliveryService');
    const restored = deliveryService.importData(exportRawToJSON(passedPackages));

    expect(restored.error).toBeUndefined();
    expect(restored.success).toBe(true);
    expect(restored.packages[0].id).toBe(withCheckpoints.id);
    expect(restored.packages[0].titleHe).toBe('נעלי ספורט');
    expect(restored.packages[0].checkpoints).toHaveLength(1);
  });

  it('backs up every row past the 1,000-item advisory cap', async () => {
    const many = Array.from({ length: 1200 }, (_, i) => ({
      id: `pkg-${i}`,
      title: `Item ${i}`,
      trackingNumber: `TRK${i}`
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(many));

    renderModal();
    await clickBackup();

    const [passedPackages] = exportSpies.raw.mock.calls[0];
    expect(passedPackages).toHaveLength(1200);
    const { exportRawToJSON } = await import('../utils/exportUtils');
    expect(JSON.parse(exportRawToJSON(passedPackages)).packages).toHaveLength(1200);
  });

  it('preserves the filename convention and the success toast', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([UNREPAIRED_PACKAGE]));
    const onShowToast = vi.fn();
    renderModal({ onShowToast });
    await clickBackup();

    const [, triggerDownload, filename] = exportSpies.raw.mock.calls[0];
    expect(triggerDownload).toBe(true);
    expect(filename).toBe(`spotli_backup_user-42_${todayISO()}.json`);
    expect(downloads).toEqual([`spotli_backup_user-42_${todayISO()}.json`]);
    expect(onShowToast).toHaveBeenCalledWith(expect.stringContaining('JSON backup'), 'success');
  });

  it('shows an info toast and exports nothing when storage holds no packages', async () => {
    const onShowToast = vi.fn();
    // Non-empty prop, empty storage: the prop must not stand in for the blob.
    renderModal({ onShowToast, packages: [UNREPAIRED_PACKAGE] });
    await clickBackup();

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

    // Every section renders at once now, so pick the notification toggle by
    // its own row rather than by position among all the switches on the page.
    const section = document.querySelector('[data-section="notifications"]');
    const toggle = within(section).getAllByRole('checkbox')[0];
    await userEvent.click(toggle);

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
    expect(isValidConfirmation('  מחק  ')).toBe(true);
    expect(isValidConfirmation('del')).toBe(false);
    expect(isValidConfirmation('cancel')).toBe(false);
    expect(isValidConfirmation('')).toBe(false);
    expect(isValidConfirmation(null)).toBe(false);
  });
});

describe('AccountModal — preferred navigation app', () => {
  it('updates preferred navigation app in localStorage on select change', async () => {
    const user = userEvent.setup();
    const onShowToast = vi.fn();

    renderWithLanguage(
      <AccountModal
        isOpen
        onClose={vi.fn()}
        onShowToast={onShowToast}
      />
    );

    // A row that shows its value and opens a picker, not an inline select:
    // one geometry for every setting is what makes the list read as one screen.
    await user.click(screen.getByRole('button', { name: /Navigation app/i }));
    await user.click(screen.getByRole('radio', { name: /Waze/i }));

    expect(localStorage.getItem('deliveree_preferred_nav_app')).toBe('waze');
    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Preferred navigation app updated'),
      'success'
    );
  });
});



describe('AccountModal — push subscription uid plumbing', () => {
  // The ownership-ledger worked example in issue #64: a correct service-side
  // fix reached through a call site that passed the wrong argument. Every push
  // call here read `user?.uid`, but AuthContext's profile exposes the Firebase
  // uid as `id` (buildCleanUserProfile), so `undefined` was passed and
  // `subscribeToPush` skipped its `if (uid)` server-persist branch entirely —
  // no row in `pushSubscriptions/{uid}/tokens`, nothing for a Cloud Function
  // to send to, and a green "permission granted" in the UI regardless.
  //
  // Asserted at the component, not at the service, because the service was
  // never the part that was wrong.
  afterEach(() => {
    delete globalThis.Notification;
    vi.restoreAllMocks();
    cleanup();
  });

  it('passes the signed-in uid through to the push subscription refresh', async () => {
    globalThis.Notification = { permission: 'granted', requestPermission: vi.fn() };
    const ensureSpy = vi
      .spyOn(notificationService, 'ensurePushSubscription')
      .mockResolvedValue({ subscribed: true, serverRegistered: true, subscription: {}, reason: null });
    vi.spyOn(notificationService, 'getPushDiagnostics').mockResolvedValue({
      permission: 'granted',
      vapidConfigured: true,
      browserSubscription: true,
      serverRegistered: true,
      pushEnabled: true
    });

    renderWithLanguage(
      <AccountModal isOpen initialTab="notifications" onClose={vi.fn()} onShowToast={vi.fn()} />
    );

    await vi.waitFor(() => {
      expect(ensureSpy).toHaveBeenCalledWith('user-42');
    });
  });

  it('flags the unregistered stage instead of showing an unqualified success', async () => {
    globalThis.Notification = { permission: 'granted', requestPermission: vi.fn() };
    vi.spyOn(notificationService, 'ensurePushSubscription')
      .mockResolvedValue({ subscribed: true, serverRegistered: false, subscription: {}, reason: 'server-write-failed' });
    vi.spyOn(notificationService, 'getPushDiagnostics').mockResolvedValue({
      permission: 'granted',
      vapidConfigured: true,
      browserSubscription: true,
      serverRegistered: false,
      pushEnabled: false
    });

    renderWithLanguage(
      <AccountModal isOpen initialTab="notifications" onClose={vi.fn()} onShowToast={vi.fn()} />
    );

    expect(await screen.findByText(/Subscription registered on server/i)).toBeTruthy();
  });
});

describe('AccountModal — accessibility & form semantics', () => {
  it('renders Picker options as an accessible radiogroup with aria-checked states', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AccountModal isOpen onClose={vi.fn()} onShowToast={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Navigation app/i }));

    const radiogroup = screen.getByRole('radiogroup', { name: /Navigation app/i });
    expect(radiogroup).toBeTruthy();

    const radios = within(radiogroup).getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(4);

    // One should have aria-checked="true" (default or current value)
    const checkedRadios = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checkedRadios.length).toBe(1);
  });

  it('associates the delete confirmation label with its input via htmlFor and id', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AccountModal isOpen onClose={vi.fn()} onShowToast={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Delete account/i }));

    const deleteInput = screen.getByLabelText(/To confirm, type "DELETE":/i);
    expect(deleteInput).toBeTruthy();
    expect(deleteInput.id).toBe('account-delete-confirm');
  });
});
