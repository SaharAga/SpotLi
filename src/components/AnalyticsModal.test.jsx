import { describe, it, expect } from 'vitest';
import { AnalyticsModal } from './AnalyticsModal';
import {
  calculateCarrierTurnaroundLeaderboard,
  calculateMultiCurrencyBreakdown,
  calculateDeliveryMetrics
} from '../utils/analyticsUtils';
import { translations } from '../i18n/translations';

const mockPackages = [
  {
    id: 'pkg-1',
    title: 'Mechanical Keyboard',
    titleHe: 'מקלדת מכנית',
    trackingNumber: 'RS948219481IL',
    carrier: 'israel-post',
    status: 'delivered',
    orderDate: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-10T00:00:00Z',
    value: 350,
    currency: 'ILS'
  },
  {
    id: 'pkg-2',
    title: 'USB-C Cable',
    titleHe: 'כבל USB-C',
    trackingNumber: 'LP00582910482CN',
    carrier: 'cainiao',
    status: 'in_transit',
    orderDate: '2026-08-12T00:00:00Z',
    value: 19.99,
    currency: 'USD'
  },
  {
    id: 'pkg-3',
    title: 'Headphones',
    titleHe: 'אוזניות',
    trackingNumber: '4829104821',
    carrier: 'dhl',
    status: 'delivered',
    orderDate: '2026-08-05T00:00:00Z',
    updatedAt: '2026-08-08T00:00:00Z',
    value: 89.90,
    currency: 'EUR'
  }
];

describe('AnalyticsModal Logic & Translation Contract Tests', () => {
  it('exports valid component function', () => {
    expect(typeof AnalyticsModal).toBe('function');
  });

  it('guarantees complete translation coverage for insights in Hebrew and English', () => {
    const requiredKeys = [
      'title', 'subtitle', 'avgTime', 'activeCount', 'totalCount',
      'fastestCarrier', 'topCarrier', 'daysAvg', 'days', 'packages',
      'delivered', 'active', 'onTimeRate', 'successRate',
      'turnaroundLeaderboard', 'turnaroundLeaderboardDesc',
      'currencyBreakdown', 'currencyBreakdownDesc',
      'noCurrencyData', 'noLeaderboardData', 'noCarrierDistribution',
      'carrierDistribution', 'stageDistribution'
    ];

    for (const key of requiredKeys) {
      expect(translations.en.insights[key], `Missing en translation for ${key}`).toBeDefined();
      expect(translations.he.insights[key], `Missing he translation for ${key}`).toBeDefined();
      expect(typeof translations.en.insights[key]).toBe('string');
      expect(typeof translations.he.insights[key]).toBe('string');
    }
  });

  it('computes correct metrics, leaderboard, and currency partitions for sample dataset', () => {
    const metrics = calculateDeliveryMetrics(mockPackages);
    const leaderboard = calculateCarrierTurnaroundLeaderboard(mockPackages);
    const currencyBreakdown = calculateMultiCurrencyBreakdown(mockPackages);

    expect(metrics.totalCount).toBe(3);
    expect(metrics.deliveredCount).toBe(2);
    expect(metrics.activeCount).toBe(1);
    expect(metrics.deliverySuccessRate).toBe(100);

    // Leaderboard: DHL (3 days) > Israel Post (9 days) > Cainiao (0 delivered)
    expect(leaderboard.length).toBe(3);
    expect(leaderboard[0].carrierId).toBe('dhl');
    expect(leaderboard[0].avgDays).toBe(3);
    expect(leaderboard[1].carrierId).toBe('israel-post');
    expect(leaderboard[1].avgDays).toBe(9);

    // Currency partitions
    expect(currencyBreakdown.hasValues).toBe(true);
    expect(currencyBreakdown.currencies.ILS.total).toBe(350);
    expect(currencyBreakdown.currencies.USD.total).toBe(19.99);
    expect(currencyBreakdown.currencies.EUR.total).toBe(89.9);
    expect(currencyBreakdown.currencies.GBP.total).toBe(0);
  });

  it('safely handles empty datasets without divide-by-zero or crashes', () => {
    const emptyMetrics = calculateDeliveryMetrics([]);
    const emptyLeaderboard = calculateCarrierTurnaroundLeaderboard([]);
    const emptyCurrency = calculateMultiCurrencyBreakdown([]);

    expect(emptyMetrics.totalCount).toBe(0);
    expect(emptyMetrics.avgTransitDays).toBe(0);
    expect(emptyMetrics.deliverySuccessRate).toBe(100);
    expect(emptyLeaderboard).toEqual([]);
    expect(emptyCurrency.hasValues).toBe(false);
    expect(emptyCurrency.totalValuedPackages).toBe(0);
  });
});
