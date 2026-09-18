import React, { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { TAB_PREDICATES } from '../types/stages';
import { triggerHapticFeedback } from '../utils/haptics';

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

  /**
   * One focal number, not four equal tiles.
   *
   * The old 2x2 grid gave "total", "in transit", "delivered" and "attention"
   * identical visual weight, so nothing led and the eye had to read all four
   * to find the one that mattered. Here the count that needs a decision is set
   * large and in rose; the rest step down from it. When nothing needs you the
   * lead slot falls back to what is moving, so the emphasis always points at
   * something true rather than at a permanent zero.
   *
   * These are still filters — the whole row is tappable, same ids as before.
   */
  const cells = [
    { id: 'all', count: total, label: t('stats.total'), tone: 'text-slate-100' },
    { id: 'transit', count: transit, label: t('stats.inTransit'), tone: 'text-blue-400' },
    {
      id: 'customs',
      count: attention,
      label: t('stats.customs'),
      tone: attention > 0 ? 'text-rose-400' : 'text-slate-400'
    },
    { id: 'delivered', count: delivered, label: t('stats.delivered'), tone: 'text-slate-400' }
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4 my-5 sm:my-6">
      {cells.map((cell) => {
        const isActive = activeFilter === cell.id;
        return (
          <button
            key={cell.id}
            onClick={() => {
              triggerHapticFeedback('selection');
              onSelectFilter(cell.id);
            }}
            aria-current={isActive ? 'true' : undefined}
            className={`flex flex-col items-start justify-between p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer min-h-[64px] text-start ${
              isActive
                ? 'bg-slate-900 border-blue-500/50 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/20'
                : 'bg-slate-900/40 hover:bg-slate-900/70 border-slate-800/80 hover:border-slate-700/80'
            } focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none`}
          >
            <span
              className={`font-bold leading-none tracking-tight [font-variant-numeric:tabular-nums] ${cell.tone} text-2xl sm:text-3xl`}
            >
              {cell.count}
            </span>
            {/* Two lines rather than an ellipsis. These labels are long in
                both languages — "Customs / Action", "בדיקת מכס / דורש טיפול" —
                and truncating the one that matters most defeats the point of
                promoting it. The fixed height keeps the three numbers on a
                common baseline whether a label wraps or not. */}
            <span
              className={`text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 mt-1.5 min-h-[2.1em] ${
                isActive ? 'text-slate-100' : 'text-slate-400'
              }`}
            >
              {cell.label}
            </span>
            {isActive && (
              <span className="block h-1 w-6 rounded-full bg-blue-500 mt-1" aria-hidden="true" />
            )}
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
