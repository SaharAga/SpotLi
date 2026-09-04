import React from 'react';
import {
  User, Settings, Sparkles, Link2, BarChart3, Download, Upload, MapPin,
  MessageSquare, Info, ShieldCheck, RotateCcw, LogOut, Sun, Moon, Languages
} from 'lucide-react';
import { Modal } from './Modal';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Title, Section, Button } from './ui/Primitives';

/**
 * The Account screen.
 *
 * Replaces `SideNavDrawer` for the bottom bar's Account tab. The drawer showed
 * thirteen items at identical visual weight sliding in from the edge — the same
 * "nothing leads" problem the home screen had, just relocated. Reaching
 * Settings meant scanning a list where "Reset all data" sat with exactly as
 * much prominence.
 *
 * Here the same thirteen destinations are grouped and ranked: who you are, then
 * what you do often, then your data, then the rare and the destructive. Nothing
 * was removed — `SideNavDrawer` is still mounted for the desktop hamburger,
 * which has room for a flat list.
 */

function Row({ icon: Icon, label, meta, onClick, tone = 'default' }) {
  const tones = {
    default: 'text-slate-100',
    danger: 'text-rose-400',
    accent: 'text-blue-400'
  };
  const iconTones = {
    default: 'text-slate-400',
    danger: 'text-rose-400',
    accent: 'text-blue-400'
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 min-h-[52px] px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-start focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
    >
      <Icon className={`w-4 h-4 shrink-0 ${iconTones[tone]}`} aria-hidden="true" />
      <span className={`flex-1 min-w-0 text-sm font-bold truncate ${tones[tone]}`}>{label}</span>
      {meta && <span className="text-xs text-slate-500 shrink-0">{meta}</span>}
    </button>
  );
}

export function AccountSheet({
  isOpen,
  onClose,
  isDemoMode,
  onOpenAuth,
  onOpenSettings,
  onOpenSmartImport,
  onOpenConnectModal,
  onOpenAnalytics,
  onOpenExport,
  onOpenLockerMap,
  onOpenFeedback,
  onOpenAdminFeedback,
  onOpenAbout,
  onImportData,
  onResetData
}) {
  const { language, t, isRTL, toggleLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const he = language === 'he';

  // Every row closes the sheet first, so the destination is never stacked on
  // top of it — the drawer used to leave itself open behind modals.
  const go = (fn) => () => {
    onClose();
    if (typeof fn === 'function') fn();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file && onImportData) {
      onClose();
      onImportData(file);
    }
    e.target.value = '';
  };

  const signedIn = Boolean(user);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="AccountSheet"
      overlayClassName="p-3 sm:p-4"
      ariaLabel={he ? 'חשבון' : 'Account'}
      className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
    >
      <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-slate-800">
        <Title>{he ? 'חשבון' : 'Account'}</Title>
        {/* Desktop only. On a phone the bottom bar is on screen and is how you
            leave a tab destination — a Close on top of it is a second exit for
            one page, which is what made these read as popups. */}
        <div className="hidden lg:block shrink-0">
          <Button onClick={onClose} >{he ? 'סגור' : 'Close'}</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Who you are. The one row that is about identity rather than action. */}
        <button
          type="button"
          onClick={go(signedIn ? onOpenSettings : onOpenAuth)}
          className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-start focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
        >
          <span className="w-12 h-12 shrink-0 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center font-display font-semibold text-lg">
            {signedIn ? (user.name || user.email || '?').trim().charAt(0).toUpperCase() : <User className="w-5 h-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-100 truncate">
              {signedIn ? (user.name || user.email) : (he ? 'התחבר לחשבון' : 'Sign in')}
            </span>
            <span className="block text-xs text-slate-400 truncate mt-0.5">
              {signedIn
                ? (he ? 'הגדרות חשבון וסנכרון' : 'Account settings and sync')
                : (he ? 'לסנכרון בין מכשירים' : 'To sync across devices')}
            </span>
          </span>
        </button>

        <Section label={he ? 'הוספת חבילות' : 'Adding packages'}>
          <div className="flex flex-col gap-2">
            <Row icon={Sparkles} tone="accent" label={t('smartPaste')} onClick={go(onOpenSmartImport)} />
            <Row icon={Link2} label={he ? 'קליטה אוטומטית' : 'Automatic ingestion'} onClick={go(onOpenConnectModal)} />
          </div>
        </Section>

        <Section label={he ? 'החבילות שלך' : 'Your packages'}>
          <div className="flex flex-col gap-2">
            <Row icon={BarChart3} label={t('insights.title')} onClick={go(onOpenAnalytics)} />
            {onOpenLockerMap && (
              <Row icon={MapPin} label={he ? 'נקודות איסוף' : 'Pickup points'} onClick={go(onOpenLockerMap)} />
            )}
            <Row icon={Download} label={he ? 'ייצוא' : 'Export'} onClick={go(onOpenExport)} />
            <label className="w-full flex items-center gap-3 min-h-[52px] px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
              <Upload className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="flex-1 text-sm font-bold text-slate-100">{t('backup.importData')}</span>
              <input type="file" accept=".json" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </Section>

        <Section label={he ? 'העדפות' : 'Preferences'}>
          <div className="flex flex-col gap-2">
            <Row icon={Settings} label={he ? 'הגדרות' : 'Settings'} onClick={go(onOpenSettings || onOpenAuth)} />
            <Row
              icon={isDark ? Sun : Moon}
              label={he ? 'ערכת נושא' : 'Theme'}
              meta={isDark ? (he ? 'כהה' : 'Dark') : (he ? 'בהיר' : 'Light')}
              onClick={toggleTheme}
            />
            <Row
              icon={Languages}
              label={he ? 'שפה' : 'Language'}
              meta={he ? 'עברית' : 'English'}
              onClick={toggleLanguage}
            />
          </div>
        </Section>

        {/* Rare and destructive, last and visually quieter. In the drawer these
            sat at the same weight as Settings. */}
        <Section label={he ? 'עוד' : 'More'}>
          <div className="flex flex-col gap-2">
            <Row icon={MessageSquare} label={he ? 'משוב ודיווח באגים' : 'Feedback'} onClick={go(onOpenFeedback)} />
            <Row icon={Info} label={he ? 'אודות' : 'About'} onClick={go(onOpenAbout)} />
            {onOpenAdminFeedback && (
              <Row icon={ShieldCheck} label={he ? 'ניהול ומדדים' : 'Admin'} onClick={go(onOpenAdminFeedback)} />
            )}
            {(signedIn || isDemoMode) && (
              <Row icon={RotateCcw} tone="danger" label={t('backup.clearAllDeliveries')} onClick={go(onResetData)} />
            )}
            {signedIn && (
              <Row icon={LogOut} tone="danger" label={he ? 'התנתקות' : 'Sign out'} onClick={go(logout)} />
            )}
          </div>
        </Section>

        <p className="text-xs text-slate-600 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
          {he ? 'Deliveree' : 'Deliveree'}
        </p>
      </div>
    </Modal>
  );
}
