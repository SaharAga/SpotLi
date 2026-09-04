import React, { useMemo } from 'react';
import { Package, Truck, CheckCircle2, AlertOctagon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { TAB_PREDICATES } from '../types/stages';

function StatsCardsImpl({ packages = [], activeFilter, onSelectFilter }) {
  const { t } = useLanguage();

  // Four top-level buckets only — in_transit/out_for_delivery collapse into
  // one "transit" tile and customs/exception into one "attention" tile so the
  // KPI row stays a clean 4-up grid; the finer-grained status still shows
  // per-package (card badge, detail-modal stepper), just not promoted here.
  // The bucket rules themselves live in TAB_PREDICATES so this tile row, the
  // FilterBar counters and App's filter cannot drift apart again.
  const { total, transit, delivered, attention } = useMemo(() => {
    const safePackages = Array.isArray(packages) ? packages : [];
    const counts = { total: 0, transit: 0, delivered: 0, attention: 0 };

    for (const p of safePackages) {
      if (!p) continue;
      counts.total += 1;
      if (TAB_PREDICATES.delivered(p)) counts.delivered += 1;
      else if (TAB_PREDICATES.customs(p)) counts.attention += 1;
      else if (TAB_PREDICATES.transit(p)) counts.transit += 1;
    }
    return counts;
  }, [packages]);

  const stats = [
    {
      id: 'all',
      title: t('stats.total'),
      count: total,
      icon: Package,
      stripe: 'bg-blue-500',
      iconBg: 'bg-blue-500/15 text-blue-400',
      activeRing: 'ring-2 ring-blue-500'
    },
    {
      id: 'transit',
      title: t('stats.inTransit'),
      count: transit,
      icon: Truck,
      stripe: 'bg-cyan-500',
      iconBg: 'bg-cyan-500/15 text-cyan-400',
      activeRing: 'ring-2 ring-cyan-500'
    },
    {
      id: 'delivered',
      title: t('stats.delivered'),
      count: delivered,
      icon: CheckCircle2,
      stripe: 'bg-emerald-500',
      iconBg: 'bg-emerald-500/15 text-emerald-400',
      activeRing: 'ring-2 ring-emerald-500'
    },
    {
      id: 'customs',
      title: t('stats.customs'),
      count: attention,
      icon: AlertOctagon,
      stripe: 'bg-amber-500',
      iconBg: 'bg-amber-500/15 text-amber-400',
      activeRing: 'ring-2 ring-amber-500',
      glow: attention > 0
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 my-4 sm:my-6">
      {stats.map((item) => {
        const Icon = item.icon;
        const isActive = activeFilter === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onSelectFilter(item.id)}
            className={`flex flex-col p-3 sm:p-4 rounded-2xl border transition-all duration-200 text-start group relative overflow-hidden shadow-sm ${
              isActive
                ? `${item.activeRing} bg-slate-900 shadow-lg`
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Identity stripe — always visible, not just on hover/active, so
                each tile's category reads at a glance in a scan. */}
            <span className={`absolute inset-y-0 start-0 w-[3px] ${item.stripe}`} aria-hidden="true" />

            <div className="flex items-center justify-between w-full mb-2 sm:mb-3">
              <span className="text-xs sm:text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors truncate">
                {item.title}
              </span>
              <div className={`p-1.5 sm:p-2 rounded-xl ${item.iconBg} shrink-0`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-3xl font-semibold text-slate-100 tracking-tight [font-variant-numeric:tabular-nums]">
                {item.count}
              </span>
              {/* A static dot, not a pulsing one. The ambient mood chrome
                  (index.css [data-mood]) now signals "something needs you"
                  across the whole surface, so this tile no longer has to
                  animate forever to be noticed. */}
              {item.id === 'customs' && item.count > 0 && (
                <span className="inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-amber-500" aria-hidden="true"></span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// The KPI row re-rendered on every keystroke in the search box because App
// passed it a freshly-allocated `packages.filter(...)` and a fresh arrow.
// Both are stable now, so memo actually bites.
export const StatsCards = React.memo(StatsCardsImpl);
