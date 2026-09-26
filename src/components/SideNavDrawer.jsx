import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles, Link2, BarChart3, MessageSquare,
  ShieldCheck, Info, Download, Upload, RotateCcw, Sun, Moon,
  User, Settings, X, MapPin
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';
import { APP_NAME } from '../constants/app';
import { acquireScrollLock, releaseScrollLock } from './Modal';

export function SideNavDrawer({
  isOpen,
  isDemoMode,
  onClose,
  onOpenAuth,
  onOpenSettings,
  onOpenSmartImport,
  onOpenConnectModal,
  onOpenAnalytics,
  onOpenFeedback,
  onOpenAdminFeedback,
  onOpenAbout,
  onOpenAppTour,
  onOpenExport,
  onOpenLockerMap,
  onImportData,
  onResetData,
  onShowToast
}) {
  const { language, toggleLanguage, isRTL, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      if (onShowToast) {
        onShowToast(
          language === 'he'
            ? 'קובץ הגיבוי גדול מדי (מקסימום 2MB)'
            : 'Backup file exceeds maximum limit of 2MB',
          'error'
        );
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string' && onImportData) {
        onImportData(content);
      }
    };
    reader.onerror = () => {
      if (onShowToast) {
        onShowToast(language === 'he' ? 'שגיאה בקריאת הקובץ' : 'Failed to read file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNavClick = (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    acquireScrollLock();
    return () => {
      releaseScrollLock();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const backdropArmedRef = useRef(false);

  const handleBackdropMouseDown = useCallback((e) => {
    backdropArmedRef.current = e.target === e.currentTarget;
  }, []);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target !== e.currentTarget) return;
      if (!backdropArmedRef.current) return;
      backdropArmedRef.current = false;
      onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 animate-fade-in flex ${isRTL ? 'justify-start' : 'justify-end'}`}
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      {/* Off-canvas Sheet */}
      <div
        className={`relative w-full max-w-xs sm:max-w-sm h-full bg-slate-900 ${isRTL ? 'border-e' : 'border-s'} border-slate-800 shadow-2xl flex flex-col z-10 transition-transform duration-300 animate-slide-in-${isRTL ? 'right' : 'left'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shadow-sm">
              <img src="/icons/app-icon.png" alt="SpotLi" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{APP_NAME} Pro</h3>
              <span className="text-xs text-slate-400 font-mono">v{APP_VERSION}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Close Navigation Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Menu Items */}
        <div className="p-4 space-y-1.5 overflow-y-auto flex-1 text-xs">
          {/* Profile / User Account */}
          <button
            onClick={() => handleNavClick(onOpenAuth)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/25 text-start cursor-pointer transition-colors min-h-[48px]"
          >
            {user ? (
              <div className="w-6 h-6 rounded-full relative shrink-0 overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white border border-blue-500/40">
                <span>{user.name?.charAt(0) || 'U'}</span>
                {user.avatar && (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
            ) : (
              <User className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
            )}
            <div className="truncate">
              <span className="font-bold block truncate text-slate-100">
                {user ? user.name : (language === 'he' ? 'התחברות לחשבון' : 'Sign In / Account')}
              </span>
              <span className="text-xs text-slate-400 truncate block">
                {user ? user.email : (language === 'he' ? 'סנכרון ענן וגיבוי' : 'Cloud sync & backup')}
              </span>
            </div>
          </button>

          <div className="pt-1 pb-2 border-t border-slate-800" />

          {(user || isDemoMode) && (
            <>
              {/* Smart Clipboard Ingestion */}
              <button
                onClick={() => handleNavClick(onOpenSmartImport)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
              >
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-semibold">{t('smartPaste')}</span>
              </button>

              {/* Ingestion Guide */}
              <button
                onClick={() => handleNavClick(onOpenConnectModal)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
              >
                <Link2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-semibold">{language === 'he' ? 'מדריך קליטה אוטומטית' : 'Automatic Ingestion Guide'}</span>
              </button>

              {/* App Tour */}
              {onOpenAppTour && (
                <button
                  onClick={() => handleNavClick(onOpenAppTour)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
                >
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-semibold">{t('appTourMenu')}</span>
                </button>
              )}

              {/* Insights */}
              <button
                onClick={() => handleNavClick(onOpenAnalytics)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
              >
                <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">{t('insights.title')}</span>
              </button>

              {/* Export Center */}
              <button
                onClick={() => handleNavClick(onOpenExport)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
              >
                <Download className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-semibold">{language === 'he' ? 'מרכז ייצוא ודוחות (CSV/JSON/PDF)' : 'Export Center (CSV/JSON/PDF)'}</span>
              </button>

              {/* Import Backup */}
              <label className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]">
                <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">{t('backup.importData')}</span>
                <input type="file" accept=".json" onChange={handleFileInput} className="hidden" />
              </label>

              {/* Locker Map */}
              {onOpenLockerMap && (
                <button
                  onClick={() => handleNavClick(onOpenLockerMap)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
                >
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-semibold">{language === 'he' ? 'איתור נקודות איסוף ולוקרים' : 'Pickup Points & Lockers'}</span>
                </button>
              )}
            </>
          )}

          {/* Alpha Feedback */}
          <button
            onClick={() => handleNavClick(onOpenFeedback)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 text-start cursor-pointer transition-colors min-h-[48px]"
          >
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{language === 'he' ? 'משוב ודיווח באגים' : 'Alpha Feedback'}</span>
          </button>

          {/* Admin Dashboard & Telemetry */}
          {onOpenAdminFeedback && (
            <button
              onClick={() => handleNavClick(onOpenAdminFeedback)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-semibold">{language === 'he' ? 'מרכז ניהול ומדדים (מנהל)' : 'Admin Dashboard & Telemetry'}</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => handleNavClick(onOpenSettings || onOpenAuth)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
          >
            <Settings className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold">{language === 'he' ? 'הגדרות' : 'Settings'}</span>
          </button>

          {/* About & Info */}
          <button
            onClick={() => handleNavClick(onOpenAbout)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 text-slate-200 text-start cursor-pointer transition-colors min-h-[48px]"
          >
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-semibold">{language === 'he' ? 'אודות ופרטי מערכת' : 'About & System Info'}</span>
          </button>

          {(user || isDemoMode) && (
            /* Reset / Clear Data */
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <button
                onClick={() => handleNavClick(onResetData)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-500/10 text-rose-400 text-start cursor-pointer transition-colors min-h-[48px]"
              >
                <RotateCcw className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold">{t('backup.clearAllDeliveries')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Drawer Footer with Theme Toggle & Sign Out */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <button
              onClick={() => toggleTheme()}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 text-slate-200 font-semibold cursor-pointer min-h-[48px]"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
              <span>{isDark ? (language === 'he' ? 'מצב יום' : 'Light') : (language === 'he' ? 'מצב לילה' : 'Dark')}</span>
            </button>

            <button
              onClick={toggleLanguage}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 text-slate-200 font-bold text-xs cursor-pointer min-h-[48px]"
            >
              {language === 'he' ? 'English (EN)' : 'עברית (HE)'}
            </button>
          </div>

          {user && (
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-xs transition-colors cursor-pointer min-h-[48px]"
            >
              {language === 'he' ? 'התנתקות מהחשבון' : 'Sign Out'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
