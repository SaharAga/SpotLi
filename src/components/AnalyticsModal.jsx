import React, { useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Award, Coins, CheckCircle2, Clock } from 'lucide-react';
import { getCarrier } from '../types/carriers';
import { STAGES } from '../types/stages';
import { Button } from './ui/Primitives';
import { useLanguage } from '../context/LanguageContext';
import {
  buildTransitDaysMap,
  calculateCarrierTurnaroundLeaderboard,
  calculateMultiCurrencyBreakdown,
  calculateDeliveryMetrics
} from '../utils/analyticsUtils';
import { Modal } from './Modal';
import { useFeatureUsage } from '../hooks/useFeatureUsage';
import { FEATURE_IDS } from '../constants/featureIds';

export function AnalyticsModal({
  isOpen,
  onClose,
  packages = [],
  uid = null
}) {
  const { t, language } = useLanguage();
  useFeatureUsage(FEATURE_IDS.ANALYTICS_MODAL, isOpen, uid);

  // Gated on `isOpen`: the modal stays mounted for the life of the app, so
  // without this every add, edit and status change would recompute the whole
  // analytics set for a dialog nobody is looking at — the common case by far.
  // The transit-day lookup is built once here and shared by both aggregators
  // that need it, instead of each one re-deriving it per delivered package.
  const analytics = useMemo(() => {
    if (!isOpen) return null;
    const transitDays = buildTransitDaysMap(packages);
    return {
      metrics: calculateDeliveryMetrics(packages, transitDays),
      leaderboard: calculateCarrierTurnaroundLeaderboard(packages, transitDays),
      currencyBreakdown: calculateMultiCurrencyBreakdown(packages)
    };
  }, [isOpen, packages]);

  if (!isOpen || !analytics) return null;

  const { metrics, leaderboard, currencyBreakdown } = analytics;

  // Fastest carrier from turnaround leaderboard
  const fastestCarrier = leaderboard.find(c => c.avgDays > 0);

  // Top carrier by volume
  let topCarrierId = null;
  let topCarrierCount = 0;
  Object.entries(metrics.carrierDistribution).forEach(([cid, data]) => {
    if (data.count > topCarrierCount) {
      topCarrierCount = data.count;
      topCarrierId = cid;
    }
  });
  const topCarrierObj = topCarrierId ? getCarrier(topCarrierId) : null;

  // SVG Circular Gauge calculations for Success / On-Time Ring Indicator
  const ringRadius = 38;
  const circumference = 2 * Math.PI * ringRadius;
  const successStrokeDashoffset = circumference - (metrics.deliverySuccessRate / 100) * circumference;
  const onTimeStrokeDashoffset = circumference - (metrics.onTimeRate / 100) * circumference;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="AnalyticsModal"
      labelledBy="analytics-modal-title"
      className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]"
    >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-blue-600/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center min-w-[48px] min-h-[48px]">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 id="analytics-modal-title" className="text-xl font-bold text-slate-100">
                {t('insights.title')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('insights.subtitle')}
              </p>
            </div>
          </div>
          {/* A tab destination, so no back arrow: the bottom bar is how you
              leave it. Desktop has no bottom bar, hence a Close — the same one
              Activity and Account use, so the three tabs match. */}
          <div className="hidden lg:block shrink-0">
            <Button onClick={onClose}>{language === 'he' ? 'סגור' : 'Close'}</Button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Top Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Packages */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between min-h-[84px] shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t('insights.totalCount')}
              </span>
              <p className="text-2xl font-extrabold text-slate-100 mt-1">
                {metrics.totalCount}
              </p>
            </div>

            {/* Active Parcels */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between min-h-[84px] shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t('insights.activeCount')}
              </span>
              <p className="text-2xl font-extrabold text-blue-400 mt-1">
                {metrics.activeCount}
              </p>
            </div>

            {/* Average Transit Days */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between min-h-[84px] shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t('insights.avgTime')}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-2xl font-extrabold text-emerald-400">
                  <bdi dir="ltr">{metrics.avgTransitDays}</bdi>
                </p>
                <span className="text-xs text-slate-400 font-medium">
                  {t('insights.daysAvg')}
                </span>
              </div>
            </div>

            {/* Top Carrier by Volume */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between min-h-[84px] shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                {t('insights.topCarrier')}
              </span>
              <p className="text-base font-bold text-amber-400 mt-1 truncate">
                {topCarrierObj ? (language === 'he' ? topCarrierObj.hebrewName : topCarrierObj.name) : '—'}
              </p>
            </div>
          </div>

          {/* Performance Rings & On-Time Indicator Card */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Ring Gauges */}
              <div className="flex items-center justify-around gap-4 p-2">
                {/* Success Rate Gauge */}
                <div className="flex flex-col items-center text-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                      <circle
                        cx="48"
                        cy="48"
                        r={ringRadius}
                        className="stroke-slate-800"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r={ringRadius}
                        className="stroke-emerald-500 transition-ui duration-1000 ease-out"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={successStrokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold text-slate-100">
                        {metrics.deliverySuccessRate}%
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-300 mt-2">
                    {t('insights.successRate')}
                  </span>
                </div>

                {/* On-Time Rate Gauge */}
                <div className="flex flex-col items-center text-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                      <circle
                        cx="48"
                        cy="48"
                        r={ringRadius}
                        className="stroke-slate-800"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r={ringRadius}
                        className="stroke-indigo-500 transition-ui duration-1000 ease-out"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={onTimeStrokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold text-slate-100">
                        {metrics.onTimeRate}%
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-300 mt-2">
                    {t('insights.onTimeRate')}
                  </span>
                </div>
              </div>

              {/* Performance Highlights */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800/80">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{t('insights.delivered')}</span>
                      <span className="text-emerald-400 font-bold"><bdi dir="ltr">{metrics.deliveredCount} / {metrics.totalCount}</bdi></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800/80">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{t('insights.fastestCarrier')}</span>
                      <span className="text-indigo-300 font-bold truncate">
                        {fastestCarrier 
                          ? `${language === 'he' ? fastestCarrier.carrierHebrewName : fastestCarrier.carrierName} (${fastestCarrier.avgDays} ${t('insights.days')})`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Courier Turnaround Leaderboard */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>{t('insights.turnaroundLeaderboard')}</span>
              </h3>
              <span className="text-xs text-slate-400 hidden sm:inline">
                {t('insights.turnaroundLeaderboardDesc')}
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                {t('insights.noLeaderboardData')}
              </p>
            ) : (
              <div className="space-y-2.5">
                {leaderboard.map((item, idx) => (
                  <div
                    key={item.carrierId}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-ui flex items-center justify-between gap-3 min-h-[52px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                          : idx === 1 
                          ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40' 
                          : idx === 2 
                          ? 'bg-amber-800/20 text-amber-500 border border-amber-700/40' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {language === 'he' ? item.carrierHebrewName : item.carrierName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {item.totalDelivered} {t('insights.delivered')} · {item.totalActive} {t('insights.active')}
                        </p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                      item.avgDays > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {item.avgDays > 0 ? `${item.avgDays} ${t('insights.days')}` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Multi-Currency Spending Breakdown */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span>{t('insights.currencyBreakdown')}</span>
              </h3>
              <span className="text-xs text-slate-400 hidden sm:inline">
                {t('insights.currencyBreakdownDesc')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(currencyBreakdown.currencies).map(([code, cur]) => (
                <div
                  key={code}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/90 flex flex-col justify-between min-h-[96px] hover:border-slate-700 transition-ui shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{code}</span>
                    <span className="text-base font-extrabold text-indigo-400">{cur.symbol}</span>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-slate-100 tracking-tight">
                      <bdi dir="ltr">{cur.symbol}{cur.total.toLocaleString(language === 'he' ? 'he-IL' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</bdi>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <bdi dir="ltr">{cur.count}</bdi> {t('insights.packages')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {!currencyBreakdown.hasValues && (
              <p className="text-xs text-slate-500 text-center pt-1">
                {t('insights.noCurrencyData')}
              </p>
            )}
          </div>

          {/* Carrier Distribution */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-400" />
              <span>{t('insights.carrierDistribution')}</span>
            </h3>

            {Object.keys(metrics.carrierDistribution).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                {t('insights.noCarrierDistribution')}
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(metrics.carrierDistribution).map(([carrierId, data]) => {
                  const carrier = getCarrier(carrierId);

                  return (
                    <div key={carrierId} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">{language === 'he' ? carrier.hebrewName : carrier.name}</span>
                        <span className="text-slate-400"><bdi dir="ltr">{data.count} ({data.percentage}%)</bdi></span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                        <div
                          className={`h-full bg-gradient-to-r ${carrier.color} rounded-full transition-ui duration-500`}
                          style={{ width: `${data.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Breakdown */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>{t('insights.stageDistribution')}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {STAGES.map(s => {
                const count = metrics.stageDistribution[s.id] || 0;
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between min-h-[64px]"
                  >
                    <span className="text-xs text-slate-400 font-medium">
                      {language === 'he' ? s.hebrewLabel : s.label}
                    </span>
                    <span className="text-xl font-bold text-slate-200 mt-1">
                      <bdi dir="ltr">{count}</bdi>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer. `hidden lg:flex`: on a phone this is a tab destination with
            the bottom bar always on screen, so the bar IS the way out and a
            second Close underneath it is redundant — two exits for one page
            was part of what still made these read as popups. Desktop has no
            bottom bar, so it keeps the button. */}
        <div className="hidden p-4 border-t border-slate-800 bg-slate-950/80 lg:flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="min-w-[120px] min-h-[48px] px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 hover:text-slate-100 text-xs font-bold transition-ui border border-slate-700/60 shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {language === 'he' ? 'סגור' : 'Close'}
          </button>
        </div>
      </Modal>
  );
}
