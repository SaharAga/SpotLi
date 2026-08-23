import React, { useMemo } from 'react';
import { Search, X, LayoutGrid, List, RefreshCw, Loader2, Filter } from 'lucide-react';
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

  // One compact status dropdown instead of a row of pill tabs — the finer
  // in_transit/out_for_delivery split is still reachable per-package (card
  // badge, detail modal), just not a top-level filter option anymore.
  const statusOptions = [
    { id: 'all', label: t('tabs.all') },
    { id: 'transit', label: t('stats.inTransit') },
    { id: 'customs', label: t('tabs.customs') },
    { id: 'delivered', label: t('tabs.delivered') },
    { id: 'archived', label: t('tabs.archived') }
  ];

  return (
    <div className="flex flex-col gap-2.5 bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-800 mb-6 shadow-sm">
      {/* Primary row: status filter + search — the compact pair a user reaches for most */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative shrink-0 sm:w-52">
          <Filter className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`} />
          <select
            value={activeTab}
            onChange={(e) => onTabChange(e.target.value)}
            aria-label={t('filters.status')}
            className={`w-full bg-slate-950 border border-slate-800 text-slate-200 text-base sm:text-sm rounded-xl py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer min-h-[44px] ${
              isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          >
            {statusOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({tabCounts[opt.id] || 0})
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className={`w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-base sm:text-sm rounded-xl py-2.5 transition-all focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[44px] ${
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
      </div>

      {/* Secondary row: carrier, sort, refresh, view mode — lower-frequency controls */}
      <div className="flex items-center gap-2 pt-2.5 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
        <select
          value={selectedCarrier}
          onChange={(e) => onCarrierChange(e.target.value)}
          className="shrink-0 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[36px]"
        >
          <option value="all">{t('filters.allCarriers')}</option>
          {CARRIER_LIST.map((carrier) => (
            <option key={carrier.id} value={carrier.id}>
              {language === 'he' ? carrier.hebrewName : carrier.name}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="shrink-0 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[36px]"
        >
          <option value="newest">{t('filters.newest')}</option>
          <option value="expected">{t('filters.expectedDate')}</option>
          <option value="title">{t('filters.title')}</option>
          <option value="status">{t('filters.status')}</option>
        </select>

        <div className="flex-1" />

        {onRefreshAll && (
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            title={t('tracking.refreshAll')}
            aria-label={t('tracking.refreshAll')}
            className={`shrink-0 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center ${
              isRefreshing ? 'text-emerald-400' : ''
            }`}
          >
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        )}

        <div className="shrink-0 flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => onViewModeChange('grid')}
            title={t('filters.gridView')}
            aria-label={t('filters.gridView')}
            className={`p-1.5 rounded-md transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center ${
              viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            title={t('filters.tableView')}
            aria-label={t('filters.tableView')}
            className={`p-1.5 rounded-md transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center ${
              viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
