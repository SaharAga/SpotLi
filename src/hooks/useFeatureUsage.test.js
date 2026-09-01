/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const recordFeatureUseMock = vi.fn();
vi.mock('../services/featureUsageService', () => ({
  recordFeatureUse: (...args) => recordFeatureUseMock(...args)
}));

const { useFeatureUsage } = await import('./useFeatureUsage');

describe('useFeatureUsage', () => {
  beforeEach(() => {
    recordFeatureUseMock.mockReset();
  });

  it('does not record while inactive', () => {
    renderHook(() => useFeatureUsage('smart_import', false, 'user-1'));
    expect(recordFeatureUseMock).not.toHaveBeenCalled();
  });

  it('records once when active becomes true', () => {
    const { rerender } = renderHook(({ active }) => useFeatureUsage('smart_import', active, 'user-1'), {
      initialProps: { active: false }
    });
    expect(recordFeatureUseMock).not.toHaveBeenCalled();

    rerender({ active: true });
    expect(recordFeatureUseMock).toHaveBeenCalledTimes(1);
    expect(recordFeatureUseMock).toHaveBeenCalledWith('smart_import', { uid: 'user-1' });
  });

  it('does not record again on a later re-render while still active', () => {
    const { rerender } = renderHook(({ active }) => useFeatureUsage('export', active, null), {
      initialProps: { active: true }
    });
    expect(recordFeatureUseMock).toHaveBeenCalledTimes(1);

    rerender({ active: true });
    rerender({ active: true });
    expect(recordFeatureUseMock).toHaveBeenCalledTimes(1);
  });

  it('passes a null uid through for guests', () => {
    renderHook(() => useFeatureUsage('pwa_install', true, null));
    expect(recordFeatureUseMock).toHaveBeenCalledWith('pwa_install', { uid: null });
  });
});
