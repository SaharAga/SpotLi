import { describe, it, expect, beforeEach, vi } from 'vitest';

// The live path never ran in tests before: every carrier returned a fabricated
// record, so "tracked" behaviour was asserted against invented data. Mocking the
// proxy is the only way to cover the real merge path.
const mockFetchLive = vi.fn();

vi.mock('./carrierApiProxy', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchLiveCarrierTracking: (...args) => mockFetchLive(...args)
  };
});

const { fetchTrackingUpdates, batchRefreshTracking, resetTrackingCooldown } =
  await import('./trackingService');

const trackedRecord = {
  carrier: 'israel-post',
  tracked: true,
  status: 'out_for_delivery',
  checkpoints: [
    {
      id: 'cp-live-1',
      title: 'Arrived at branch',
      description: 'Awaiting collection',
      location: 'Tel Aviv',
      timestamp: '2026-08-20T09:00:00.000Z',
      isCompleted: true
    }
  ],
  estimatedDelivery: '2026-08-24',
  isFromCache: false
};

describe('trackingService live carrier path', () => {
  beforeEach(() => {
    resetTrackingCooldown();
    mockFetchLive.mockReset();
  });

  it('surfaces real upstream checkpoints and status', async () => {
    mockFetchLive.mockResolvedValue(trackedRecord);

    const res = await fetchTrackingUpdates('RS948219481IL', 'israel-post');

    expect(res.success).toBe(true);
    expect(res.tracked).toBe(true);
    expect(res.status).toBe('out_for_delivery');
    expect(res.checkpoints).toHaveLength(1);
    expect(res.checkpoints[0].title).toBe('Arrived at branch');
    expect(res.expectedDeliveryDate).toBe('2026-08-24');
  });

  it('merges new checkpoints into a package without duplicating existing ones', async () => {
    mockFetchLive.mockResolvedValue(trackedRecord);

    const packages = [
      {
        id: 'pkg-live',
        title: 'Live package',
        trackingNumber: 'RS948219481IL',
        carrier: 'israel-post',
        status: 'in_transit',
        category: 'other',
        isPinned: false,
        isArchived: false,
        checkpoints: [
          {
            id: 'cp-live-1',
            title: 'Arrived at branch',
            description: 'Awaiting collection',
            location: 'Tel Aviv',
            timestamp: '2026-08-20T09:00:00.000Z',
            isCompleted: true
          }
        ]
      }
    ];

    const res = await batchRefreshTracking(packages);

    expect(res.refreshedCount).toBe(1);
    expect(res.untrackedCount).toBe(0);
    expect(res.updatedPackages[0].checkpoints).toHaveLength(1);
    expect(res.updatedPackages[0].status).toBe('out_for_delivery');
  });

  it('leaves packages untouched when the upstream reports no data', async () => {
    mockFetchLive.mockResolvedValue({
      carrier: 'israel-post',
      tracked: false,
      reason: 'carrier-unavailable',
      status: null,
      checkpoints: [],
      estimatedDelivery: null,
      isFromCache: false
    });

    const original = {
      id: 'pkg-untracked',
      title: 'Untracked package',
      trackingNumber: 'RS111111111IL',
      carrier: 'israel-post',
      status: 'in_transit',
      category: 'other',
      isPinned: false,
      isArchived: false,
      checkpoints: []
    };

    const res = await batchRefreshTracking([original]);

    expect(res.refreshedCount).toBe(0);
    expect(res.untrackedCount).toBe(1);
    expect(res.updatedPackages[0]).toEqual(original);
  });
});
