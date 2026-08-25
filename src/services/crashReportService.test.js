/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const submitFeedbackMock = vi.fn().mockResolvedValue({ success: true });

vi.mock('./feedbackService', () => ({
  submitFeedback: (...args) => submitFeedbackMock(...args)
}));

const { buildCrashReport, reportCrash, initGlobalCrashReporting } = await import('./crashReportService');

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
    submitFeedbackMock.mockClear();
    sessionStorage.clear();
  });

  it('submits a crash report with type crash', async () => {
    await reportCrash(new Error('boom'), { componentName: 'PackageCard' });
    expect(submitFeedbackMock).toHaveBeenCalledTimes(1);
    expect(submitFeedbackMock.mock.calls[0][0]).toMatchObject({ type: 'crash' });
  });

  it('does not submit the same error signature twice in one session', async () => {
    await reportCrash(new Error('boom'), { componentName: 'PackageCard' });
    await reportCrash(new Error('boom'), { componentName: 'PackageCard' });
    expect(submitFeedbackMock).toHaveBeenCalledTimes(1);
  });

  it('still submits a different error after a first one', async () => {
    await reportCrash(new Error('boom'), { componentName: 'PackageCard' });
    await reportCrash(new Error('bang'), { componentName: 'PackageCard' });
    expect(submitFeedbackMock).toHaveBeenCalledTimes(2);
  });

  it('never throws even if submitFeedback rejects', async () => {
    submitFeedbackMock.mockRejectedValueOnce(new Error('network down'));
    await expect(reportCrash(new Error('boom'))).resolves.toBeUndefined();
  });

  it('caps total reports per session', async () => {
    for (let i = 0; i < 25; i++) {
      await reportCrash(new Error(`boom-${i}`), { componentName: 'Loop' });
    }
    expect(submitFeedbackMock).toHaveBeenCalledTimes(20);
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
