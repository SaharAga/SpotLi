import React, { useState, useMemo } from 'react';
import {
  X, Download, FileSpreadsheet, FileCode, Printer,
  CheckCircle2, Package, Filter, ShieldCheck
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { exportToCSV, exportToJSON, generatePrintableSummary } from '../utils/exportUtils';
import { Modal } from './Modal';

export function ExportModal({
  isOpen,
  onClose,
  packages = [],
  onShowToast
}) {
  const { language } = useLanguage();

  const [selectedFormat, setSelectedFormat] = useState('csv'); // 'csv' | 'json' | 'print'
  const [selectedScope, setSelectedScope] = useState('all'); // 'all' | 'active' | 'delivered'
  const [isExporting, setIsExporting] = useState(false);

  const filteredExportPackages = useMemo(() => {
    if (!Array.isArray(packages)) return [];
    return packages.filter(pkg => {
      if (selectedScope === 'active') {
        return !pkg.isArchived && pkg.status !== 'delivered';
      }
      if (selectedScope === 'delivered') {
        return pkg.status === 'delivered' || pkg.isArchived;
      }
      return true;
    });
  }, [packages, selectedScope]);

  if (!isOpen) return null;

  const handleExecuteExport = () => {
    if (filteredExportPackages.length === 0) {
      if (onShowToast) {
        onShowToast(language === 'he' ? 'אין חבילות לייצוא בטווח שנבחר' : 'No packages found for selected scope', 'info');
      }
      return;
    }

    setIsExporting(true);

    try {
      const today = new Date().toISOString().slice(0, 10);
      if (selectedFormat === 'csv') {
        exportToCSV(filteredExportPackages, true, `deliveree_export_${selectedScope}_${today}.csv`);
        if (onShowToast) {
          onShowToast(
            language === 'he' 
              ? `קובץ CSV הופק בהצלחה (${filteredExportPackages.length} חבילות)` 
              : `CSV export ready (${filteredExportPackages.length} packages)`,
            'success'
          );
        }
      } else if (selectedFormat === 'json') {
        // Not a backup: this list is scope-filtered, and importData overwrites
        // the storage key wholesale rather than merging. A file named "backup"
        // holding only `delivered` would delete every active package on
        // restore. The restorable backup is the Account tab's Full Backup.
        exportToJSON(filteredExportPackages, true, `deliveree_export_${selectedScope}_${today}.json`);
        if (onShowToast) {
          onShowToast(
            language === 'he' 
              ? `קובץ JSON הופק בהצלחה (${filteredExportPackages.length} חבילות)` 
              : `JSON export ready (${filteredExportPackages.length} packages)`,
            'success'
          );
        }
      } else if (selectedFormat === 'print') {
        generatePrintableSummary(filteredExportPackages, language, true);
        if (onShowToast) {
          onShowToast(
            language === 'he' ? 'חלון ההדפסה וה-PDF נפתח' : 'Printable summary opened',
            'info'
          );
        }
      }
      onClose();
    } catch (err) {
      console.error('Export failed', err);
      if (onShowToast) {
        onShowToast(language === 'he' ? 'שגיאה בעת ביצוע הייצוא' : 'Export operation failed', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="ExportModal"
      overlayClassName="p-3 sm:p-4"
      className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
    >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shadow-md">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>{language === 'he' ? 'מרכז ייצוא ודוחות' : 'Export Center & Reports'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'he' ? 'דוחות לאקסל, JSON והדפסה — לצפייה, לא לשחזור' : 'Excel, JSON & printable reports — for reading, not restoring'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Close Export Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 text-xs text-slate-200">
          {/* 1. Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <span>{language === 'he' ? '1. בחר פורמט ייצוא' : '1. Select Export Format'}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* CSV / Excel */}
              <button
                type="button"
                onClick={() => setSelectedFormat('csv')}
                className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer flex flex-col justify-between min-h-[48px] ${
                  selectedFormat === 'csv'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  {selectedFormat === 'csv' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <div>
                  <span className="font-bold text-slate-100 block text-xs">Excel / CSV</span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'he' ? 'תאימות מלאה לעברית (UTF-8 BOM)' : 'RFC 4180 with UTF-8 BOM'}
                  </span>
                </div>
              </button>

              {/* JSON report — scope-filtered, not a restorable backup */}
              <button
                type="button"
                onClick={() => setSelectedFormat('json')}
                className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer flex flex-col justify-between min-h-[48px] ${
                  selectedFormat === 'json'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileCode className="w-5 h-5 text-indigo-400" />
                  {selectedFormat === 'json' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <div>
                  <span className="font-bold text-slate-100 block text-xs">
                    {language === 'he' ? 'ייצוא JSON' : 'JSON Export'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'he' ? 'לפי הסינון שנבחר — לא קובץ שחזור' : 'Filtered by scope — not a restore file'}
                  </span>
                </div>
              </button>

              {/* Print / PDF */}
              <button
                type="button"
                onClick={() => setSelectedFormat('print')}
                className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer flex flex-col justify-between min-h-[48px] ${
                  selectedFormat === 'print'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Printer className="w-5 h-5 text-amber-400" />
                  {selectedFormat === 'print' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <div>
                  <span className="font-bold text-slate-100 block text-xs">Print / PDF</span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'he' ? 'דוח מסודר להדפסה' : 'Printable summary sheet'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Scope Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              <span>{language === 'he' ? '2. טווח חבילות לייצוא' : '2. Package Scope'}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedScope('all')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer min-h-[48px] flex items-center justify-center ${
                  selectedScope === 'all'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {language === 'he' ? 'כל החבילות' : 'All Packages'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedScope('active')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer min-h-[48px] flex items-center justify-center ${
                  selectedScope === 'active'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {language === 'he' ? 'פעילות בלבד' : 'Active Only'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedScope('delivered')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer min-h-[48px] flex items-center justify-center ${
                  selectedScope === 'delivered'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {language === 'he' ? 'נמסרו / ארכיון' : 'Delivered / Archive'}
              </button>
            </div>
          </div>

          {/* Package Summary Badge */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-300">
                {language === 'he' ? 'חבילות שנכללות בייצוא:' : 'Included in Export:'}
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-xs">
              {filteredExportPackages.length} {language === 'he' ? 'פריטים' : 'items'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {language === 'he' 
                ? 'ייצוא מאובטח מבוצע מקומית במכשיר שלך ללא העברת מידע לצד שלישי.' 
                : 'Zero-trust client-side processing: your data remains on your device.'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer min-h-[48px]"
          >
            {language === 'he' ? 'ביטול' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={isExporting || filteredExportPackages.length === 0}
            onClick={handleExecuteExport}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer min-h-[48px]"
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting 
                ? (language === 'he' ? 'מפיק קובץ...' : 'Generating...') 
                : (language === 'he' ? `ייצא עכשיו (${filteredExportPackages.length})` : `Download Export (${filteredExportPackages.length})`)}
            </span>
          </button>
        </div>
      </Modal>
  );
}
