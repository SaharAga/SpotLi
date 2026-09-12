/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatureNudges } from './useFeatureNudges';
import { STORAGE_KEYS } from '../constants/storageKeys';

const mockGetGmailConnectionStatus = vi.fn().mockResolvedValue({ connected: false });
const mockGetConnectedServices = vi.fn(() => ({ gmail: false, outlook: false, accounts: [] }));

vi.mock('../services/emailSyncService', () => ({
  getConnectedServices: () => mockGetConnectedServices(),
  getGmailConnectionStatus: () => mockGetGmailConnectionStatus()
}));

describe('useFeatureNudges Hook Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Default notification permission
    window.Notification = { permission: 'default' };
  });

  it('returns null when no packages exist', () => {
    const { result } = renderHook(() => useFeatureNudges({ packages: [], user: null }));
    expect(result.current.activeNudge).toBeNull();
  });

  it('suggests push notifications when user has packages and permission is default', () => {
    const samplePackages = [{ id: 'pkg-1', title: 'Order', status: 'in_transit' }];
    const { result } = renderHook(() => useFeatureNudges({ packages: samplePackages, user: null }));
    expect(result.current.activeNudge).toEqual({
      id: 'push_notifications',
      type: 'push'
    });
  });

  it('suggests gmail sync when user is signed in, notifications granted, and gmail not connected', () => {
    window.Notification = { permission: 'granted' };
    const samplePackages = [{ id: 'pkg-1', title: 'Order', status: 'in_transit' }];
    const user = { uid: 'u123', email: 'user@test.com' };

    const { result } = renderHook(() => useFeatureNudges({ packages: samplePackages, user }));
    expect(result.current.activeNudge).toEqual({
      id: 'gmail_sync',
      type: 'gmail'
    });
  });

  it('does not suggest gmail sync when gmail is already connected', () => {
    window.Notification = { permission: 'granted' };
    mockGetConnectedServices.mockReturnValueOnce({ gmail: true, outlook: false, accounts: [] });
    const samplePackages = [{ id: 'pkg-1', title: 'Order', status: 'in_transit' }];
    const user = { uid: 'u123', email: 'user@test.com' };

    const { result } = renderHook(() => useFeatureNudges({ packages: samplePackages, user }));
    expect(result.current.activeNudge).toBeNull();
  });

  it('dismisses nudge for the current session when dismissNudge is called', () => {
    const samplePackages = [{ id: 'pkg-1', title: 'Order', status: 'in_transit' }];
    const { result } = renderHook(() => useFeatureNudges({ packages: samplePackages, user: null }));

    expect(result.current.activeNudge).not.toBeNull();
    act(() => {
      result.current.dismissNudge('push_notifications');
    });

    expect(result.current.activeNudge).toBeNull();
  });

  it('suppresses nudge permanently in localStorage when suppressPermanently is called', () => {
    const samplePackages = [{ id: 'pkg-1', title: 'Order', status: 'in_transit' }];
    const { result } = renderHook(() => useFeatureNudges({ packages: samplePackages, user: null }));

    act(() => {
      result.current.suppressPermanently('push_notifications');
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.FEATURE_NUDGES) || '{}');
    expect(stored.push_notifications?.permanent).toBe(true);

    // Re-mount hook and verify it remains suppressed
    const { result: remounted } = renderHook(() => useFeatureNudges({ packages: samplePackages, user: null }));
    expect(remounted.current.activeNudge).toBeNull();
  });

  it('allows temporary dismissal to re-show after the 14-day cooldown expires', () => {
    const samplePackages = [{ id: 'pkg-1', title: 'Order', status: 'in_transit' }];
    // Set a dismissal from 15 days ago
    const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
    localStorage.setItem(STORAGE_KEYS.FEATURE_NUDGES, JSON.stringify({
      push_notifications: { dismissedAt: fifteenDaysAgo, permanent: false }
    }));

    const { result } = renderHook(() => useFeatureNudges({ packages: samplePackages, user: null }));
    expect(result.current.activeNudge).toEqual({
      id: 'push_notifications',
      type: 'push'
    });
  });
});
