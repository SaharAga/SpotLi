import React, { useMemo } from 'react';
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
  const needsYou = attention > 0;

  const cells = [
    needsYou
      ? { id: 'customs', count: attention, label: t('stats.customs'), tone: 'text-rose-400', lead: true }
      : { id: 'transit', count: transit, label: t('stats.inTransit'), tone: 'text-slate-100', lead: true },
    needsYou
      ? { id: 'transit', count: transit, label: t('stats.inTransit'), tone: 'text-slate-100' }
      : { id: 'all', count: total, label: t('stats.total'), tone: 'text-slate-100' },
    { id: 'delivered', count: delivered, label: t('stats.delivered'), tone: 'text-slate-400' }
  ];

  return (
    <div className="flex items-start gap-4 sm:gap-6 my-5 sm:my-6">
      {cells.map((cell) => {
        const isActive = activeFilter === cell.id;
        return (
          <button
            key={cell.id}
            onClick={() => onSelectFilter(cell.id)}
            aria-current={isActive ? 'true' : undefined}
            className={`flex-1 min-w-0 flex flex-col items-start gap-1 text-start rounded-xl px-1 py-1 min-h-[48px] cursor-pointer transition-opacity focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none ${
              isActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <span
              className={`font-semibold leading-none tracking-tight [font-variant-numeric:tabular-nums] ${cell.tone} ${
                cell.lead ? 'text-4xl' : 'text-2xl'
              }`}
            >
              {cell.count}
            </span>
            {/* Two lines rather than an ellipsis. These labels are long in
                both languages — "Customs / Action", "בדיקת מכס / דורש טיפול" —
                and truncating the one that matters most defeats the point of
                promoting it. The fixed height keeps the three numbers on a
                common baseline whether a label wraps or not. */}
            <span
              className={`text-xs font-bold leading-tight line-clamp-2 min-h-[2.1em] ${
                isActive ? 'text-slate-200' : 'text-slate-400'
              }`}
            >
              {cell.label}
            </span>
            {isActive && (
              <span className="block h-0.5 w-6 rounded-full bg-blue-500" aria-hidden="true" />
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
