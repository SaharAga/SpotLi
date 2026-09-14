/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A carrier inferred from a tracking number's shape is a guess, and this app
 * shipped a wrong one: a bare ten-digit number in an H&M Israel SMS matched
 * DHL and Aramex equally, came back "DHL Express", and the package was
 * actually carried by Tapuz.
 *
 * 17TRACK identifies carriers for a living, and the app asks it on every
 * refresh — but its answer was discarded twice over. `carrierProxy` returned
 * `carrier: carrierId`, echoing back whatever the client had sent rather than
 * what was detected, and `refreshPackageTracking` never wrote a carrier into
 * the updated package at all. These cover the client half: the network may
 * correct a guess, and may not overrule anything better.
 */
const mockFetch = vi.fn();
vi.mock('./trackingService', () => ({
  trackingService: { fetchTrackingUpdates: (...a) => mockFetch(...a) },
  fetchTrackingUpdates: (...a) => mockFetch(...a)
}));

const { deliveryService } = await import('./deliveryService');

const basePkg = (over = {}) => ({
  id: 'pkg-1',
  title: 'Order',
  trackingNumber: '7989423526',
  carrier: 'other',
  status: 'in_transit',
  checkpoints: [],
  ...over
});

const trackedResult = (over = {}) => ({
  success: true,
  tracked: true,
  status: 'in_transit',
  checkpoints: [],
  ...over
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('refreshPackageTracking — carrier identification from the network', () => {
  it('adopts a detected carrier when the package was only filed as "other"', async () => {
    mockFetch.mockResolvedValue(trackedResult({ detectedCarrier: 'fedex' }));
    const res = await deliveryService.refreshPackageTracking(basePkg(), null, true);
    expect(res.updatedPackage.carrier).toBe('fedex');
  });

  it('keeps a carrier the number itself identifies, rather than deferring', async () => {
    // RS…IL is Israel Post by its own prefix. A network guess must not
    // overwrite evidence that strong — nor a carrier the user picked by hand.
    mockFetch.mockResolvedValue(trackedResult({ detectedCarrier: 'fedex' }));
    const pkg = basePkg({ carrier: 'israel-post', trackingNumber: 'RS948219481IL' });
    const res = await deliveryService.refreshPackageTracking(pkg, null, true);
    expect(res.updatedPackage.carrier).toBe('israel-post');
  });

  it('keeps the reported name when 17TRACK names a courier we have no id for', async () => {
    // Tapuz, and most of the Israeli last mile, are absent from
    // TRACK17_CARRIER_MAP — so there is a name but nothing to map it to. The
    // package stays 'other' and manually tracked, but can show who has it.
    mockFetch.mockResolvedValue(
      trackedResult({ detectedCarrier: null, detectedCarrierName: 'Tapuz Delivery' })
    );
    const res = await deliveryService.refreshPackageTracking(basePkg(), null, true);
    expect(res.updatedPackage.carrier).toBe('other');
    expect(res.updatedPackage.carrierName).toBe('Tapuz Delivery');
  });

  it('leaves the carrier alone when the network identified nothing', async () => {
    mockFetch.mockResolvedValue(trackedResult());
    const res = await deliveryService.refreshPackageTracking(basePkg({ carrier: 'other' }), null, true);
    expect(res.updatedPackage.carrier).toBe('other');
  });
});
