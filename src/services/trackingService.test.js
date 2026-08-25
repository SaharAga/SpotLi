import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as carrierApiProxy from './carrierApiProxy';
import {
  trackingService,
  RATE_LIMIT_COOLDOWN_MS,
  resetTrackingCooldown,
  checkRateLimit,
  recordTrackingFetch,
  normalizeCheckpoints,
  fetchTrackingUpdates,
  batchRefreshTracking,
  debounce
} from './trackingService';

describe('Multi-Carrier Tracking Service', () => {
  beforeEach(() => {
    resetTrackingCooldown();
    vi.restoreAllMocks();
  });

  describe('trackingService Object', () => {
    it('exports all expected API methods on trackingService default object', () => {
      expect(trackingService.fetchTrackingUpdates).toBeDefined();
      expect(trackingService.batchRefreshTracking).toBeDefined();
      expect(trackingService.checkRateLimit).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('allows initial fetch and enforces 60-second cooldown afterwards', () => {
      const trackingNum = 'RS123456789IL';
      expect(checkRateLimit(trackingNum).isLimited).toBe(false);

      recordTrackingFetch(trackingNum);

      const rateCheck = checkRateLimit(trackingNum);
      expect(rateCheck.isLimited).toBe(true);
      expect(rateCheck.remainingMs).toBeGreaterThan(0);
      expect(rateCheck.remainingMs).toBeLessThanOrEqual(RATE_LIMIT_COOLDOWN_MS);
    });

    it('clears specific cooldown via resetTrackingCooldown', () => {
      const trackingNum = 'CH12345678';
      recordTrackingFetch(trackingNum);
      expect(checkRateLimit(trackingNum).isLimited).toBe(true);

      resetTrackingCooldown(trackingNum);
      expect(checkRateLimit(trackingNum).isLimited).toBe(false);
    });

    it('clears all cooldowns when resetTrackingCooldown called without arguments', () => {
      recordTrackingFetch('TRK1');
      recordTrackingFetch('TRK2');
      expect(checkRateLimit('TRK1').isLimited).toBe(true);
      expect(checkRateLimit('TRK2').isLimited).toBe(true);

      resetTrackingCooldown();
      expect(checkRateLimit('TRK1').isLimited).toBe(false);
      expect(checkRateLimit('TRK2').isLimited).toBe(false);
    });

    it('handles empty or non-string tracking numbers safely in rate limiter', () => {
      expect(checkRateLimit(null).isLimited).toBe(false);
      expect(checkRateLimit('').isLimited).toBe(false);
      expect(checkRateLimit(undefined).isLimited).toBe(false);
    });
  });

  describe('Checkpoint Normalization', () => {
    it('normalizes raw checkpoint objects with all required schema fields', () => {
      const raw = [
        {
          title: 'Customs Cleared',
          titleHe: 'עבר שחרור מכס',
          details: 'Released from customs',
          location: 'Tel Aviv',
          time: '2026-08-19T10:00:00Z'
        }
      ];

      const normalized = normalizeCheckpoints(raw, 'TEST123');
      expect(normalized.length).toBe(1);
      expect(normalized[0].id).toBeDefined();
      expect(normalized[0].title).toBe('Customs Cleared');
      expect(normalized[0].titleHe).toBe('עבר שחרור מכס');
      expect(normalized[0].description).toBe('Released from customs');
      expect(normalized[0].location).toBe('Tel Aviv');
      expect(normalized[0].timestamp).toBe('2026-08-19T10:00:00Z');
      expect(normalized[0].isCompleted).toBe(true);
    });

    it('handles empty or non-array checkpoint inputs gracefully', () => {
      expect(normalizeCheckpoints(null)).toEqual([]);
      expect(normalizeCheckpoints(undefined)).toEqual([]);
      expect(normalizeCheckpoints('not-array')).toEqual([]);
    });
  });

  describe('fetchTrackingUpdates', () => {
    it('returns error for invalid tracking number', async () => {
      const res = await fetchTrackingUpdates('', 'israel-post');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid tracking number');
    });

    it('reports an unsupported carrier as untracked rather than inventing data', async () => {
      const res = await fetchTrackingUpdates('CH10849201', 'chita');
      expect(res.success).toBe(true);
      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('carrier-unsupported');
      expect(res.carrier).toBe('chita');
      expect(res.checkpoints).toEqual([]);
      expect(res.status).toBeUndefined();
      expect(res.expectedDeliveryDate).toBeUndefined();
    });

    it('reports an unreachable supported carrier as untracked', async () => {
      const res = await fetchTrackingUpdates('RS948219481IL', 'israel-post');
      expect(res.success).toBe(true);
      expect(res.tracked).toBe(false);
      expect(res.reason).toBe('carrier-unavailable');
      expect(res.checkpoints).toEqual([]);
    });

    it('does not spend the rate-limit cooldown on an unsupported carrier', async () => {
      const tracking = 'CH55555555';
      await fetchTrackingUpdates(tracking, 'chita');
      const second = await fetchTrackingUpdates(tracking, 'chita');
      expect(second.success).toBe(true);
      expect(second.rateLimited).toBeUndefined();
    });

    it('rejects subsequent fetch within cooldown period', async () => {
      const tracking = 'RS888888888IL';
      const first = await fetchTrackingUpdates(tracking, 'israel-post');
      expect(first.success).toBe(true);

      const second = await fetchTrackingUpdates(tracking, 'israel-post');
      expect(second.success).toBe(false);
      expect(second.rateLimited).toBe(true);
      expect(second.remainingCooldownMs).toBeGreaterThan(0);
    });

    it('allows bypassing cooldown when bypassRateLimit is true', async () => {
      const tracking = 'RS777777777IL';
      await fetchTrackingUpdates(tracking, 'israel-post');
      const second = await fetchTrackingUpdates(tracking, 'israel-post', true);
      expect(second.success).toBe(true);
    });
  });

  describe('batchRefreshTracking', () => {
    it('returns empty result for empty packages array', async () => {
      const res = await batchRefreshTracking([]);
      expect(res.updatedPackages).toEqual([]);
      expect(res.refreshedCount).toBe(0);
    });

    it('refreshes multiple active packages with progress updates', async () => {
      const packages = [
        {
          id: 'pkg-1',
          title: 'Pkg 1',
          trackingNumber: 'RS111111111IL',
          carrier: 'israel-post',
          status: 'in_transit',
          category: 'other',
          isPinned: false,
          isArchived: false,
          checkpoints: []
        },
        {
          id: 'pkg-2',
          title: 'Pkg 2',
          trackingNumber: 'CH22222222',
          carrier: 'chita',
          status: 'in_transit',
          category: 'other',
          isPinned: false,
          isArchived: false,
          checkpoints: []
        }
      ];

      const progressSteps = [];
      const res = await batchRefreshTracking(packages, (p) => progressSteps.push(p));

      // Neither carrier can be tracked here, so both packages must come back
      // untouched instead of gaining invented checkpoints.
      expect(res.refreshedCount).toBe(0);
      expect(res.untrackedCount).toBe(2);
      expect(res.updatedPackages.length).toBe(2);
      expect(res.updatedPackages[0].checkpoints).toEqual([]);
      expect(res.updatedPackages[1].checkpoints).toEqual([]);
      expect(progressSteps.length).toBeGreaterThan(0);
    });

    it('skips delivered or archived packages in batch refresh', async () => {
      const packages = [
        {
          id: 'pkg-delivered',
          title: 'Delivered Item',
          trackingNumber: 'RS333333333IL',
          carrier: 'israel-post',
          status: 'delivered',
          isPinned: false,
          isArchived: false,
          checkpoints: []
        },
        {
          id: 'pkg-archived',
          title: 'Archived Item',
          trackingNumber: 'RS444444444IL',
          carrier: 'israel-post',
          status: 'in_transit',
          isPinned: false,
          isArchived: true,
          checkpoints: []
        }
      ];

      const res = await batchRefreshTracking(packages);
      expect(res.refreshedCount).toBe(0);
    });
  });

  describe('Debounce helper', () => {
    it('debounces rapid calls into a single execution', async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);
      expect(fn).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });
});

describe('batchRefreshTracking - schemaVersion and unknown fields survive a refresh (issue #41)', () => {
  beforeEach(() => {
    resetTrackingCooldown();
    vi.restoreAllMocks();
  });

  it('keeps schemaVersion and unknown fields across a live-tracking refresh', async () => {
    vi.spyOn(carrierApiProxy, 'fetchLiveCarrierTracking').mockResolvedValue({
      tracked: true,
      status: 'out_for_delivery',
      estimatedDelivery: '2026-09-01',
      checkpoints: [
        { id: 'cp-new', title: 'Out for delivery', timestamp: '2026-08-25T10:00:00Z', isCompleted: true }
      ]
    });

    const pkg = {
      id: 'pkg-keep',
      title: 'Keeps its extras',
      trackingNumber: 'RS555555555IL',
      carrier: 'israel-post',
      status: 'in_transit',
      category: 'other',
      isPinned: false,
      isArchived: false,
      checkpoints: [],
      schemaVersion: 1,
      // A field outside the known keys — e.g. written by a newer client.
      futureField: { nested: 'value' }
    };

    const res = await batchRefreshTracking([pkg]);

    expect(res.refreshedCount).toBe(1);
    const updated = res.updatedPackages[0];
    expect(updated.status).toBe('out_for_delivery');
    expect(updated.checkpoints.length).toBe(1);
    expect(updated.schemaVersion).toBe(1);
    expect(updated.futureField).toEqual({ nested: 'value' });
  });

  it('stamps schemaVersion on a refreshed record that never had one', async () => {
    vi.spyOn(carrierApiProxy, 'fetchLiveCarrierTracking').mockResolvedValue({
      tracked: true,
      status: 'in_transit',
      estimatedDelivery: '',
      checkpoints: [{ id: 'cp-a', title: 'Departed', timestamp: '2026-08-25T09:00:00Z' }]
    });

    const res = await batchRefreshTracking([{
      id: 'pkg-legacy',
      title: 'Legacy record',
      trackingNumber: 'RS666666666IL',
      carrier: 'israel-post',
      status: 'in_transit',
      checkpoints: []
    }]);

    expect(res.refreshedCount).toBe(1);
    expect(res.updatedPackages[0].schemaVersion).toBe(1);
  });
});
