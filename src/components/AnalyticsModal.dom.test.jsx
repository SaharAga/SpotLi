/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// Wrap the real implementations in spies so we can count how often the modal
// asks for analytics. The values returned are the genuine ones — this asserts
// scheduling, not arithmetic.
vi.mock('../utils/analyticsUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildTransitDaysMap: vi.fn(actual.buildTransitDaysMap),
    calculateDeliveryMetrics: vi.fn(actual.calculateDeliveryMetrics),
    calculateCarrierTurnaroundLeaderboard: vi.fn(actual.calculateCarrierTurnaroundLeaderboard),
    calculateMultiCurrencyBreakdown: vi.fn(actual.calculateMultiCurrencyBreakdown)
  };
});

const { AnalyticsModal } = await import('./AnalyticsModal');
const analyticsUtils = await import('../utils/analyticsUtils');
const { LanguageProvider } = await import('../context/LanguageContext');

const makePackages = (n) => Array.from({ length: n }, (_, i) => ({
  id: `pkg-${i}`,
  title: `Item ${i}`,
  trackingNumber: `RS94821948${i}IL`,
  carrier: 'israel-post',
  status: i % 2 === 0 ? 'delivered' : 'in_transit',
  orderDate: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-09T00:00:00Z'
}));

const renderModal = (props) => render(
  <LanguageProvider>
    <AnalyticsModal onClose={() => {}} {...props} />
  </LanguageProvider>
);

describe('AnalyticsModal computation gating', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('computes nothing while closed, however often the package list changes', () => {
    const { rerender } = renderModal({ isOpen: false, packages: makePackages(3) });

    for (let i = 4; i < 9; i += 1) {
      rerender(
        <LanguageProvider>
          <AnalyticsModal isOpen={false} onClose={() => {}} packages={makePackages(i)} />
        </LanguageProvider>
      );
    }

    expect(analyticsUtils.calculateDeliveryMetrics).not.toHaveBeenCalled();
    expect(analyticsUtils.calculateCarrierTurnaroundLeaderboard).not.toHaveBeenCalled();
    expect(analyticsUtils.calculateMultiCurrencyBreakdown).not.toHaveBeenCalled();
    expect(analyticsUtils.buildTransitDaysMap).not.toHaveBeenCalled();
  });

  it('computes once when opened, sharing one transit-day map between the aggregators', () => {
    renderModal({ isOpen: true, packages: makePackages(4) });

    expect(analyticsUtils.buildTransitDaysMap).toHaveBeenCalledTimes(1);
    expect(analyticsUtils.calculateDeliveryMetrics).toHaveBeenCalledTimes(1);
    expect(analyticsUtils.calculateCarrierTurnaroundLeaderboard).toHaveBeenCalledTimes(1);

    const sharedMap = analyticsUtils.buildTransitDaysMap.mock.results[0].value;
    expect(analyticsUtils.calculateDeliveryMetrics.mock.calls[0][1]).toBe(sharedMap);
    expect(analyticsUtils.calculateCarrierTurnaroundLeaderboard.mock.calls[0][1]).toBe(sharedMap);
  });

  it('renders the same numbers it would have rendered without the gate', () => {
    const packages = makePackages(6);
    const { container } = renderModal({ isOpen: true, packages });

    const expected = analyticsUtils.calculateDeliveryMetrics(packages);
    expect(container.textContent).toContain(String(expected.deliveredCount));
    expect(container.textContent).toContain(`${expected.deliverySuccessRate}%`);
  });
});
