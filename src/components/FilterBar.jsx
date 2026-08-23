import React, { useMemo } from 'react';
import { Search, X, LayoutGrid, List, Archive, RefreshCw, Loader2 } from 'lucide-react';
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

  // Single-pass O(N) tab count reduction instead of 7 individual filter passes
  const tabCounts = useMemo(() => {
    const safePackages = Array.isArray(packages) ? packages : [];
    const counts = {
      all: 0,
      active: 0,
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
        } else {
          counts.active++;
          if (st === 'in_transit' || st === 'shipped' || st === 'ordered') {
            counts.in_transit++;
          } else if (st === 'out_for_delivery') {
            counts.out_for_delivery++;
          } else if (st === 'customs' || st === 'exception') {
            counts.customs++;
          }
        }
      }
    }
    return counts;
  }, [packages]);

  const tabs = [
    { id: 'all', label: t('tabs.all') },
    { id: 'active', label: t('tabs.active') },
    { id: 'in_transit', label: t('tabs.inTransit') },
    { id: 'out_for_delivery', label: t('tabs.outForDelivery') },
    { id: 'customs', label: t('tabs.customs') },
    { id: 'delivered', label: t('tabs.delivered') },
    { id: 'archived', label: t('tabs.archived'), icon: Archive }
  ];

  return (
    <div className="flex flex-col gap-3 bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-800 mb-6 shadow-sm">
      {/* Top row: Search bar & Filters */}
      <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        {/* Search Bar */}
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

        {/* Carrier Filter, Sort & View Mode */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          {/* Carrier Filter */}
          <select
            value={selectedCarrier}
            onChange={(e) => onCarrierChange(e.target.value)}
            className="w-full sm:w-auto bg-slate-950 border border-slate-800 text-slate-200 text-base sm:text-sm rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
          >
            <option value="all">{t('filters.allCarriers')}</option>
            {CARRIER_LIST.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {language === 'he' ? carrier.hebrewName : carrier.name}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full sm:w-auto bg-slate-950 border border-slate-800 text-slate-200 text-base sm:text-sm rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
          >
            <option value="newest">{t('filters.newest')}</option>
            <option value="expected">{t('filters.expectedDate')}</option>
            <option value="title">{t('filters.title')}</option>
            <option value="status">{t('filters.status')}</option>
          </select>

          {/* Refresh All Action Button */}
          {onRefreshAll && (
            <button
              onClick={onRefreshAll}
              disabled={isRefreshing}
              title={t('tracking.refreshAll')}
              aria-label={t('tracking.refreshAll')}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 text-xs font-bold transition-all min-h-[44px] ${
                isRefreshing ? 'text-emerald-400' : ''
              }`}
            >
              {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden md:inline">{isRefreshing ? (language === 'he' ? 'מרענן...' : 'Refreshing...') : t('tracking.refreshAll')}</span>
            </button>
          )}

          {/* View Mode Switcher (Hidden on small phones to save space) */}
          <div className="hidden sm:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 min-h-[44px]">
            <button
              onClick={() => onViewModeChange('grid')}
              title={t('filters.gridView')}
              aria-label={t('filters.gridView')}
              className={`p-2 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('table')}
              title={t('filters.tableView')}
              aria-label={t('filters.tableView')}
              className={`p-2 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Filter Tabs with horizontal smooth touch scrolling */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-t border-slate-800/80 pt-2.5 -mx-1 px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id] || 0;
          const TabIcon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 min-h-[40px] cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-blue-800/80 text-blue-100' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
