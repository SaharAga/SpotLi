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
    renderModal({ isOpen: true, packages });

    const expected = analyticsUtils.calculateDeliveryMetrics(packages);
    expect(document.body.textContent).toContain(String(expected.deliveredCount));
    expect(document.body.textContent).toContain(`${expected.deliverySuccessRate}%`);
  });

  it('renders graceful empty state without hardcoded facade fallbacks when 0 packages exist', () => {
    renderModal({ isOpen: true, packages: [] });

    // Must not fabricate fake Israel Post records when no packages exist
    const text = document.body.textContent;
    expect(text).not.toContain('Israel Post (8 days)');
    expect(text).not.toContain('דואר ישראל (8 ימים)');

    // Should display empty fallback indicators
    expect(text).toContain('No delivered shipments available to benchmark carrier transit times');
    expect(text).toContain('No carrier distribution data available yet');
  });

  it('renders rich metrics and the carrier leaderboard accurately', () => {
    const richPackages = [
      {
        id: 'p-1',
        title: 'Wireless Earbuds',
        carrier: 'dhl',
        status: 'delivered',
        orderDate: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-04T00:00:00Z',
        value: 120,
        currency: 'USD'
      },
      {
        id: 'p-2',
        title: 'Running Shoes',
        carrier: 'cheetah',
        status: 'in_transit',
        orderDate: '2026-08-02T00:00:00Z',
        value: 450,
        currency: 'ILS'
      }
    ];

    renderModal({ isOpen: true, packages: richPackages });

    const text = document.body.textContent;
    // Total count: 2
    expect(text).toContain('2');
    // Active count: 1
    expect(text).toContain('1');
    // DHL fastest carrier (3 days)
    expect(text).toContain('DHL Express');
    expect(text).toContain('3 days');
  });

  it('supports Hebrew localization with mirrored language context', () => {
    localStorage.setItem('deliveree_lang', 'he');
    render(
      <LanguageProvider>
        <AnalyticsModal isOpen={true} onClose={() => {}} packages={[]} />
      </LanguageProvider>
    );

    const text = document.body.textContent;
    expect(text).toContain('תובנות וסטטיסטיקות משלוחים');
    expect(text).toContain('אין עדיין משלוחים שנמסרו למדידת מהירות חברות השילוח');
    expect(text).toContain('אין עדיין נתוני התפלגות חברות שילוח');
  });
});
