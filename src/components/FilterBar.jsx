import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Search, X, LayoutGrid, List, RefreshCw, Loader2, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { CARRIER_LIST } from '../types/carriers';

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

  // Single-pass O(N) tab count reduction instead of per-tab filter passes
  const tabCounts = useMemo(() => {
    const safePackages = Array.isArray(packages) ? packages : [];
    const counts = {
      all: 0,
      active: 0,
      transit: 0,
      in_transit: 0,
      out_for_delivery: 0,
      delivered: 0,
      customs: 0,
      archived: 0
    };

    for (let i = 0; i < safePackages.length; i++) {
      const p = safePackages[i];
      if (!p) continue;

      if (p.isArchived) {
        counts.archived++;
      } else {
        counts.all++;
        const st = p.status;
        if (st === 'delivered') {
          counts.delivered++;
        } else if (st === 'customs' || st === 'exception') {
          counts.active++;
          counts.customs++;
        } else {
          counts.active++;
          counts.transit++;
          if (st === 'in_transit' || st === 'shipped' || st === 'ordered') {
            counts.in_transit++;
          } else if (st === 'out_for_delivery') {
            counts.out_for_delivery++;
          }
        }
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

  const isFiltered = activeTab !== 'all' || selectedCarrier !== 'all' || sortBy !== 'newest';

  // Just a search bar with everything else — status, carrier, sort — tucked
  // behind one "Filters" button beside it, opening a small panel rather
  // than ever wrapping or horizontally scrolling the bar itself.
  return (
    <div className="relative flex items-center gap-2 bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-800 mb-6 shadow-sm">
      <div className="relative flex-1 min-w-0">
        <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className={`w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm rounded-xl py-2.5 transition-all focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[44px] ${
            isRTL ? 'pr-9 pl-9' : 'pl-9 pr-9'
          }`}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className={`absolute top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center ${isRTL ? 'left-1' : 'right-1'}`}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <button
        onClick={() => setFiltersOpen((v) => !v)}
        aria-expanded={filtersOpen}
        aria-label={t('filters.status')}
        className={`relative shrink-0 p-2.5 rounded-xl border transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
          filtersOpen
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {isFiltered && !filtersOpen && (
          <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-slate-900" aria-hidden="true" />
        )}
      </button>

      {onRefreshAll && (
        <button
          onClick={onRefreshAll}
          disabled={isRefreshing}
          title={t('tracking.refreshAll')}
          aria-label={t('tracking.refreshAll')}
          className={`shrink-0 p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
            isRefreshing ? 'text-emerald-400' : ''
          }`}
        >
          {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      )}

      <div className="shrink-0 flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => onViewModeChange('grid')}
          title={t('filters.gridView')}
          aria-label={t('filters.gridView')}
          className={`p-2 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
            viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onViewModeChange('table')}
          title={t('filters.tableView')}
          aria-label={t('filters.tableView')}
          className={`p-2 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
            viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <List className="w-3.5 h-3.5" />
        </button>
      </div>

      {filtersOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setFiltersOpen(false)} />
          <div
            ref={panelRef}
            className={`absolute z-40 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 space-y-3.5 ${
              isRTL ? 'left-0' : 'right-0'
            }`}
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">{t('filters.status')}</label>
              <div className="flex flex-col gap-1">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onTabChange(opt.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-start transition-colors min-h-[40px] ${
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
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">{t('filters.allCarriers')}</label>
              <select
                value={selectedCarrier}
                onChange={(e) => onCarrierChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
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
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">{t('filters.sortBy')}</label>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
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
