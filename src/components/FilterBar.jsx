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

  // Every control lives in one flex row that never wraps — on a viewport
  // too narrow to fit it all, the row scrolls horizontally instead of
  // dropping to a second line (search stays put via sticky ordering: it's
  // the widest, flex-1 element, so it's what visually "leads" the scroll).
  return (
    <div className="flex items-center gap-2 bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-800 mb-6 shadow-sm overflow-x-auto no-scrollbar">
      <div className="relative flex-1 min-w-[160px]">
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

      <div className="relative shrink-0">
        <Filter className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none ${isRTL ? 'right-2.5' : 'left-2.5'}`} />
        <select
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value)}
          aria-label={t('filters.status')}
          className={`bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px] w-32 sm:w-40 ${
            isRTL ? 'pr-8 pl-2' : 'pl-8 pr-2'
          }`}
        >
          {statusOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} ({tabCounts[opt.id] || 0})
            </option>
          ))}
        </select>
      </div>

      <select
        value={selectedCarrier}
        onChange={(e) => onCarrierChange(e.target.value)}
        aria-label={t('filters.allCarriers')}
        className="shrink-0 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px] w-24 sm:w-32"
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
        aria-label={t('filters.sortBy')}
        className="shrink-0 hidden md:block bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px] w-28"
      >
        <option value="newest">{t('filters.newest')}</option>
        <option value="expected">{t('filters.expectedDate')}</option>
        <option value="title">{t('filters.title')}</option>
        <option value="status">{t('filters.status')}</option>
      </select>

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
    </div>
  );
}
