import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Search, X, LayoutGrid, List, RefreshCw, Loader2, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { CARRIER_LIST } from '../types/carriers';
import { TAB_PREDICATES, TAB_IDS, ARCHIVED_TAB } from '../types/stages';
import { triggerHapticFeedback } from '../utils/haptics';

export function FilterBar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  selectedCarrier,
  onCarrierChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onRefreshAll,
  isRefreshing = false,
  packages = []
}) {
  const { t, language, isRTL } = useLanguage();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setFiltersOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [filtersOpen]);

  // One pass over the packages, counting each bucket with the shared
  // TAB_PREDICATES table so these counts cannot drift from what App's filter
  // actually shows. `archived` is a flag, not a status, so it is counted
  // separately and excluded from every other bucket.
  const tabCounts = useMemo(() => {
    const safePackages = Array.isArray(packages) ? packages : [];
    const counts = { [ARCHIVED_TAB]: 0 };
    for (const id of TAB_IDS) counts[id] = 0;

    for (const p of safePackages) {
      if (!p) continue;
      if (p.isArchived) {
        counts[ARCHIVED_TAB]++;
        continue;
      }
      for (const id of TAB_IDS) {
        if (TAB_PREDICATES[id](p)) counts[id]++;
      }
    }
    return counts;
  }, [packages]);

  // One compact status list instead of a row of pill tabs — the finer
  // in_transit/out_for_delivery split is still reachable per-package (card
  // badge, detail modal), just not a top-level filter option anymore.
  const statusOptions = [
    { id: 'all', label: t('tabs.all') },
    { id: 'transit', label: t('stats.inTransit') },
    { id: 'customs', label: t('tabs.customs') },
    { id: 'delivered', label: t('tabs.delivered') },
    { id: 'archived', label: t('tabs.archived') }
  ];

  // The three chips carry their own counts. Everything finer stays in the panel.
  const chips = [
    { id: 'all', label: t('chips.all'), count: tabCounts.all ?? 0 },
    { id: 'transit', label: t('stats.inTransit'), count: tabCounts.transit ?? 0 },
    { id: 'customs', label: t('chips.customs'), count: tabCounts.customs ?? 0 },
    { id: 'delivered', label: t('chips.done'), count: tabCounts.delivered ?? 0 }
  ];

  // Only light up the drawer badge when non-default secondary filters are set
  // (carrier, sort order, or the hidden archived status tab). Primary status
  // tabs (all, transit, customs, delivered) are prominent on the main surface
  // and do not represent a "hidden drawer filter".
  const isFiltered = activeTab === ARCHIVED_TAB || selectedCarrier !== 'all' || sortBy !== 'newest';

  // Just a search bar with everything else — status, carrier, sort — tucked
  // behind one "Filters" button beside it, opening a small panel rather
  // than ever wrapping or horizontally scrolling the bar itself.
  // Two rows, not one. Search, filters, refresh and both view toggles used to
  // share a single 390px line — five controls competing, and the search field
  // squeezed down to whatever was left. Search now owns its row; the controls
  // sit underneath where they can breathe.
  return (
    <div data-testid="filter-bar" className="relative flex flex-col gap-2.5 mb-6">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 text-slate-100 placeholder-slate-500 text-sm rounded-2xl py-3 ps-11 pe-11 transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm min-h-[48px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('selection');
                onSearchChange('');
              }}
              className="absolute top-1/2 -translate-y-1/2 end-1.5 p-2 rounded-lg text-slate-400 hover:text-slate-100 min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Filters Toggle Button */}
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('selection');
            setFiltersOpen((v) => !v);
          }}
          aria-expanded={filtersOpen}
          aria-label={t('filters.status')}
          title={t('filters.moreFilters')}
          className={`relative shrink-0 min-h-[48px] min-w-[48px] rounded-2xl border transition-all flex items-center justify-center cursor-pointer ${
            filtersOpen
              ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:text-slate-100 hover:bg-slate-900 hover:border-slate-700'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          {isFiltered && !filtersOpen && (
            <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-slate-950" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Chip row on mobile only (< 1024px). On desktop (>= 1024px), the top KPI StatsCards serve as the status filters */}
      <div className="flex lg:hidden items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] rtl:[mask-image:linear-gradient(to_left,black_calc(100%-2rem),transparent)]">
        {chips.map((chip) => {
          const isOn = activeTab === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => {
                triggerHapticFeedback('selection');
                onTabChange(chip.id);
              }}
              aria-pressed={isOn}
              className={`shrink-0 min-h-[48px] px-3.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none inline-flex items-center gap-1.5 ${
                isOn
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'bg-slate-900/60 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700/80 hover:bg-slate-900'
              }`}
            >
              <span>{chip.label}</span>
              <span className={`[font-variant-numeric:tabular-nums] px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                isOn ? 'bg-blue-700 text-blue-100' : 'bg-slate-800/90 text-slate-400'
              }`}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {filtersOpen && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setFiltersOpen(false)} />
          <div
            ref={panelRef}
            className="absolute z-[70] top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 space-y-3.5 end-0"
          >
            {onRefreshAll && (
              <button
                type="button"
                onClick={onRefreshAll}
                disabled={isRefreshing}
                aria-label={t('tracking.refreshAll')}
                className={`w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 transition-colors text-xs font-bold ${
                  isRefreshing ? 'text-emerald-600 dark:text-emerald-400' : ''
                }`}
              >
                {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
                <span>{t('tracking.refreshAll')}</span>
              </button>
            )}

            {/* View mode. It lived in the top bar beside search, which put a
                preference you set once next to a control you use constantly.
                It belongs with the other settings. */}
            <div>
              <label id="filter-viewmode-label" className="block text-xs font-bold text-slate-400 mb-1.5">{t('filters.gridView')} / {t('filters.tableView')}</label>
              <div className="flex items-center gap-2" role="group" aria-labelledby="filter-viewmode-label">
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  aria-label={t('filters.gridView')}
                  aria-pressed={viewMode === 'grid'}
                  className={`flex-1 flex items-center justify-center gap-2 min-h-[48px] rounded-xl text-xs font-bold transition-colors ${
                    viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                  <span>{t('filters.gridView')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('table')}
                  aria-label={t('filters.tableView')}
                  aria-pressed={viewMode === 'table'}
                  className={`flex-1 flex items-center justify-center gap-2 min-h-[48px] rounded-xl text-xs font-bold transition-colors ${
                    viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <List className="w-4 h-4" aria-hidden="true" />
                  <span>{t('filters.tableView')}</span>
                </button>
              </div>
            </div>

            <div>
              <label id="filter-status-label" className="block text-xs font-bold text-slate-400 mb-1.5">{t('filters.status')}</label>
              <div className="flex flex-col gap-1" role="group" aria-labelledby="filter-status-label">
                {statusOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => onTabChange(opt.id)}
                    aria-pressed={activeTab === opt.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-start transition-colors min-h-[48px] ${
                      activeTab === opt.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className={activeTab === opt.id ? 'text-blue-100' : 'text-slate-500'}>{tabCounts[opt.id] || 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="filter-carrier-select" className="block text-xs font-bold text-slate-400 mb-1.5">{t('filters.allCarriers')}</label>
              <select
                id="filter-carrier-select"
                value={selectedCarrier}
                onChange={(e) => onCarrierChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[48px]"
              >
                <option value="all">{t('filters.allCarriers')}</option>
                {CARRIER_LIST.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {language === 'he' ? carrier.hebrewName : carrier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-sort-select" className="block text-xs font-bold text-slate-400 mb-1.5">{t('filters.sortBy')}</label>
              <select
                id="filter-sort-select"
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[48px]"
              >
                <option value="newest">{t('filters.newest')}</option>
                <option value="expected">{t('filters.expectedDate')}</option>
                <option value="title">{t('filters.title')}</option>
                <option value="status">{t('filters.status')}</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
