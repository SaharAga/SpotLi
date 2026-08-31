/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const setDocMock = vi.fn().mockResolvedValue(undefined);
const getDocsMock = vi.fn();
const collectionMock = vi.fn((db, name) => ({ db, name }));
const docMock = vi.fn((col, id) => ({ col, id }));
const queryMock = vi.fn((...args) => args);
const orderByMock = vi.fn((...args) => args);
const limitMock = vi.fn((...args) => args);

vi.mock('firebase/firestore', () => ({
  collection: (...args) => collectionMock(...args),
  doc: (...args) => docMock(...args),
  setDoc: (...args) => setDocMock(...args),
  getDocs: (...args) => getDocsMock(...args),
  query: (...args) => queryMock(...args),
  orderBy: (...args) => orderByMock(...args),
  limit: (...args) => limitMock(...args)
}));

vi.mock('./firebase', () => ({
  db: { fake: 'db' },
  isFirebaseConfigured: true
}));

const {
  buildCrashReport,
  reportCrash,
  initGlobalCrashReporting,
  groupCrashReports,
  OFFLINE_CRASH_QUEUE_KEY
} = await import('./crashReportService');

describe('buildCrashReport', () => {
  it('includes the component name, error name, and message', () => {
    const error = new Error('boom');
    const { message } = buildCrashReport(error, 'PackageCard');
    expect(message).toContain('[PackageCard]');
    expect(message).toContain('Error: boom');
  });

  it('truncates to the feedback message size limit', () => {
    const error = new Error('x'.repeat(3000));
    const { message } = buildCrashReport(error);
    expect(message.length).toBeLessThanOrEqual(1500);
  });

  it('produces the same signature for the same component + error name + message', () => {
    const a = buildCrashReport(new Error('boom'), 'PackageCard');
    const b = buildCrashReport(new Error('boom'), 'PackageCard');
    expect(a.signature).toBe(b.signature);
  });

  it('produces a different signature for a different component', () => {
    const a = buildCrashReport(new Error('boom'), 'PackageCard');
    const b = buildCrashReport(new Error('boom'), 'PackageTable');
    expect(a.signature).not.toBe(b.signature);
  });
});

describe('reportCrash', () => {
  beforeEach(() => {
    setDocMock.mockClear().mockResolvedValue(undefined);
    sessionStorage.clear();
    localStorage.clear();
  });

  it('uploads a crash report to the crashReports collection', async () => {
    await reportCrash(new Error('boom'), { componentName: 'PackageCard' });
    expect(collectionMock).toHaveBeenCalledWith(expect.anything(), 'crashReports');
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('does not submit the same error signature twice in one session', async () => {
    await reportCrash(new Error('boom'), { componentName: 'PackageCard' });
    await reportCrash(new Error('boom'), { componentName: 'PackageCard' });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('still submits a different error after a first one', async () => {
    await reportCrash(new Error('boom'), { componentName: 'PackageCard' });
    await reportCrash(new Error('bang'), { componentName: 'PackageCard' });
    expect(setDocMock).toHaveBeenCalledTimes(2);
  });

  it('never throws even if the Firestore write rejects, and queues offline instead', async () => {
    setDocMock.mockRejectedValueOnce(new Error('network down'));
    await expect(reportCrash(new Error('boom'))).resolves.toBeUndefined();
    const queue = JSON.parse(localStorage.getItem(OFFLINE_CRASH_QUEUE_KEY) || '[]');
    expect(queue.length).toBe(1);
  });

  it('caps total reports per session', async () => {
    for (let i = 0; i < 25; i++) {
      await reportCrash(new Error(`boom-${i}`), { componentName: 'Loop' });
    }
    expect(setDocMock).toHaveBeenCalledTimes(20);
  });
});

describe('groupCrashReports', () => {
  it('groups occurrences by signature and counts them', () => {
    const items = [
      { signature: 'a', message: 'm1', timestamp: '2026-01-01T00:00:00.000Z', appVersion: '1.0' },
      { signature: 'a', message: 'm1', timestamp: '2026-01-02T00:00:00.000Z', appVersion: '1.1' },
      { signature: 'b', message: 'm2', timestamp: '2026-01-01T00:00:00.000Z', appVersion: '1.0' }
    ];
    const groups = groupCrashReports(items);
    expect(groups).toHaveLength(2);
    const a = groups.find(g => g.signature === 'a');
    expect(a.count).toBe(2);
    expect(a.lastSeen).toBe('2026-01-02T00:00:00.000Z');
    expect(a.firstSeen).toBe('2026-01-01T00:00:00.000Z');
  });

  it('sorts groups by most recently seen first', () => {
    const items = [
      { signature: 'old', message: 'm', timestamp: '2026-01-01T00:00:00.000Z' },
      { signature: 'new', message: 'm', timestamp: '2026-06-01T00:00:00.000Z' }
    ];
    const groups = groupCrashReports(items);
    expect(groups[0].signature).toBe('new');
  });

  it('handles an empty or non-array input', () => {
    expect(groupCrashReports([])).toEqual([]);
    expect(groupCrashReports(undefined)).toEqual([]);
  });

  it('counts distinct sessions separately from raw occurrences', () => {
    const items = [
      { signature: 'a', message: 'm1', timestamp: '2026-01-01T00:00:00.000Z', sessionId: 's1' },
      { signature: 'a', message: 'm1', timestamp: '2026-01-01T00:01:00.000Z', sessionId: 's1' }, // same session, repeat crash
      { signature: 'a', message: 'm1', timestamp: '2026-01-02T00:00:00.000Z', sessionId: 's2' }
    ];
    const groups = groupCrashReports(items);
    const a = groups.find((g) => g.signature === 'a');
    expect(a.count).toBe(3);
    expect(a.sessionCount).toBe(2);
  });

  it('reports sessionCount 0 for reports written before sessionId existed', () => {
    const items = [{ signature: 'a', message: 'm1', timestamp: '2026-01-01T00:00:00.000Z' }];
    const groups = groupCrashReports(items);
    expect(groups[0].sessionCount).toBe(0);
  });
});

describe('initGlobalCrashReporting', () => {
  it('is idempotent and does not throw when called multiple times', () => {
    expect(() => {
      initGlobalCrashReporting();
      initGlobalCrashReporting();
    }).not.toThrow();
  });
});
