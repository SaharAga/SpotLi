import React, { useState } from 'react';
import {
  Package, Plus, Sparkles, Menu, X, LogIn,
  ClipboardCheck, Edit3, ShieldCheck
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SideNavDrawer } from './SideNavDrawer';
import { APP_VERSION } from '../constants/version';

export function Navbar({
  isDemoMode,
  onOpenAddModal,
  onOpenSmartImport,
  onOpenAnalytics,
  onOpenConnectModal,
  onOpenAuth,
  onOpenAbout,
  onOpenFeedback,
  onOpenAdminFeedback,
  onOpenExport,
  onOpenLockerMap,
  onImportData,
  onResetData,
  onOpenSettings,
  onShowToast
}) {
  const { language, t } = useLanguage();
  const { user } = useAuth();

  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
  const [isAddActionSheetOpen, setIsAddActionSheetOpen] = useState(false);

  const handleQuickClipboardPaste = async () => {
    setIsAddActionSheetOpen(false);
    onOpenSmartImport();
  };

  return (
    <>
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-2xl transition-all duration-300 pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Leading edge: menu + brand together, the way Gmail/WhatsApp anchor their drawer trigger */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setIsSideDrawerOpen(true)}
            className="shrink-0 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open Navigation Menu"
            title={language === 'he' ? 'תפריט' : 'Menu'}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative group shrink-0">
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 opacity-70 blur-sm group-hover:opacity-100 transition duration-500 animate-pulse-subtle" />
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-blue-400 shadow-md">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 truncate">
                {t('appTitle')}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold tracking-wider">
                v{APP_VERSION}
              </span>
            </div>
            <span className="hidden sm:block text-[10px] text-slate-400 font-medium -mt-0.5 truncate">
              {t('appTagline')}
            </span>
          </div>
          </div>
        </div>

        {/* Desktop Toolbar (Hidden on Mobile) — kept deliberately minimal; everything else lives in the nav drawer */}
        <div className="hidden lg:flex items-center gap-2 sm:gap-2.5">
          {/* Admin Center Shortcut */}
          {onOpenAdminFeedback && (
            <button
              onClick={onOpenAdminFeedback}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-colors cursor-pointer min-h-[48px]"
              title={language === 'he' ? 'מרכז ניהול ומדדים' : 'Admin Telemetry Center'}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span className="hidden xl:inline">{language === 'he' ? 'ניהול ומדדים' : 'Admin Center'}</span>
            </button>
          )}

          {/* User Account / Profile */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer min-h-[48px]"
          >
            {user ? (
              <>
                <div className="w-5 h-5 rounded-full relative shrink-0 overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white border border-blue-500/40">
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
                <span className="text-xs font-medium max-w-[100px] truncate">{user.name}</span>
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold text-blue-400">{language === 'he' ? 'התחבר' : 'Login'}</span>
              </>
            )}
          </button>

          {(user || isDemoMode) && (
            /* Primary Add Package Trigger — opens Smart Import by default, with a manual-entry fallback inside it */
            <button
              onClick={onOpenSmartImport}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer min-h-[48px]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{t('addPackage')}</span>
            </button>
          )}
        </div>

        {/* Mobile / Tablet Compact Action Bar */}
        <div className="flex lg:hidden items-center gap-2">
          {/* Admin shortcut icon on mobile */}
          {onOpenAdminFeedback && (
            <button
              onClick={onOpenAdminFeedback}
              className="flex items-center justify-center p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 cursor-pointer min-h-[48px] min-w-[44px]"
              title={language === 'he' ? 'מרכז ניהול ומדדים' : 'Admin Telemetry'}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </button>
          )}
          {/* Quick User Account Avatar / LogIn Button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 cursor-pointer min-h-[48px]"
            title={user ? user.name : 'Sign In'}
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
              <>
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-bold text-blue-400">{language === 'he' ? 'התחבר' : 'Login'}</span>
              </>
            )}
          </button>

          {(user || isDemoMode) && (
            /* Primary Mobile Smart '+' Action Trigger */
            <button
              onClick={() => setIsAddActionSheetOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/25 cursor-pointer min-h-[48px]"
              title={language === 'he' ? 'הוספת חבילה / הדבקה מהירה' : 'Add Shipment / Quick Paste'}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">{t('addPackage')}</span>
            </button>
          )}
        </div>
      </div>
    </header>

      {/* SMART '+' INGESTION ACTION SHEET (Mobile / Touch Ergonomic Bottom Sheet) */}
      {isAddActionSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true">
          <div className="fixed inset-0" onClick={() => setIsAddActionSheetOpen(false)} />
          <div className="relative w-full max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 z-10 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <span>{language === 'he' ? 'הוספת חבילה חדשה' : 'Add New Shipment'}</span>
              </h3>
              <button
                onClick={() => setIsAddActionSheetOpen(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white min-h-[48px] min-w-[48px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: 1-Click Clipboard Auto-Paste */}
              <button
                onClick={handleQuickClipboardPaste}
                className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/40 hover:border-blue-500 transition-all text-start cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-100 block">
                      {language === 'he' ? 'הדבקה חכמה מלוח ההעתקה (1-Click)' : 'Smart Clipboard Auto-Paste (1-Click)'}
                    </span>
                    <span className="text-[11px] text-blue-300">
                      {language === 'he' ? 'זיהוי אוטומטי מ-SMS, אימייל או מספר מעקב' : 'Auto-detect carrier and code from SMS or email'}
                    </span>
                  </div>
                </div>
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              </button>

              {/* Option 2: Manual Form Entry */}
              <button
                onClick={() => {
                  setIsAddActionSheetOpen(false);
                  onOpenAddModal();
                }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all text-start cursor-pointer min-h-[48px]"
              >
                <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-200 block">
                    {language === 'he' ? 'הזנה ידנית בטופס' : 'Manual Form Entry'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {language === 'he' ? 'מילוי פרטי משלוח באופן ידני' : 'Fill in custom title, carrier & tracking code'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NATIVE SIDE NAVIGATION DRAWER (RTL Right / LTR Left) */}
      <SideNavDrawer
        isOpen={isSideDrawerOpen}
        isDemoMode={isDemoMode}
        onClose={() => setIsSideDrawerOpen(false)}
        onOpenAuth={onOpenAuth}
        onOpenSettings={onOpenSettings}
        onOpenSmartImport={onOpenSmartImport}
        onOpenConnectModal={onOpenConnectModal}
        onOpenAnalytics={onOpenAnalytics}
        onOpenFeedback={onOpenFeedback}
        onOpenAdminFeedback={onOpenAdminFeedback}
        onOpenAbout={onOpenAbout}
        onOpenExport={onOpenExport}
        onOpenLockerMap={onOpenLockerMap}
        onImportData={onImportData}
        onResetData={onResetData}
        onShowToast={onShowToast}
      />
    </>
  );
}
