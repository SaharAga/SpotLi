import React, { useState } from 'react';
import { User, Bell, ShieldAlert, Link2, Upload, MapPin, MessageSquare, Info, ShieldCheck, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Title, Section, Button } from './ui/Primitives';
import { AccountModal } from './AccountModal';
import { AccountSettingsRows } from './AccountSettingsRows';
import { Modal } from './Modal';
import { ModalHeader } from './ui/Primitives';

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
  onOpenAuth,
  onOpenConnectModal,
  onOpenExport,
  onOpenLockerMap,
  onOpenFeedback,
  onOpenAdminFeedback,
  onOpenAbout,
  onImportData,
  packages = [],
  onExportData,
  onShowToast
}) {
  const { language, t, isRTL } = useLanguage();
  const { user, logout } = useAuth();
  const he = language === 'he';
  const [subPage, setSubPage] = useState(null); // 'profile' | 'notifications' | 'danger' | null

  // Rows do NOT close the sheet. An inner page opened from here — About,
  // Export, Settings — is one level deeper, so Account belongs underneath it:
  // that is what makes its back arrow return here rather than dumping you on
  // Status. Closing first (the original behaviour) emptied the stack, so back
  // had nowhere to go but the tab it started from.
  const go = (fn) => () => {
    if (typeof fn === 'function') fn();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file && onImportData) {
      onImportData(file);
    }
    e.target.value = '';
  };

  const signedIn = Boolean(user);

  return (
    <>
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
        <div data-account-rows className="flex flex-col gap-6">
        {/* Who you are. The one row that is about identity rather than action. */}
        <button
          type="button"
          onClick={signedIn ? () => setSubPage('profile') : go(onOpenAuth)}
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
            <Row icon={Link2} label={he ? 'קליטה אוטומטית' : 'Automatic ingestion'} onClick={go(onOpenConnectModal)} />
          </div>
        </Section>

        {/* Insights is deliberately absent: it has its own tab, and a second
            entry here would be a duplicate route to the same screen. */}
        <Section label={he ? 'החבילות שלך' : 'Your packages'}>
          <div className="flex flex-col gap-2">
            {onOpenLockerMap && (
              <Row icon={MapPin} label={he ? 'נקודות איסוף' : 'Pickup points'} onClick={go(onOpenLockerMap)} />
            )}
            <label className="w-full flex items-center gap-3 min-h-[52px] px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
              <Upload className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="flex-1 text-sm font-bold text-slate-100">{t('backup.importData')}</span>
              <input type="file" accept=".json" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </Section>

        <Section label={he ? 'התראות ופרטיות' : 'Notifications & privacy'}>
          <div className="flex flex-col gap-2">
            <Row icon={Bell} label={he ? 'התראות' : 'Notifications'} onClick={() => setSubPage('notifications')} />
            {signedIn && (
              <Row icon={ShieldAlert} tone="danger" label={he ? 'מחיקת חשבון' : 'Delete account'} onClick={() => setSubPage('danger')} />
            )}
          </div>
        </Section>

        </div>

        {/* The settings themselves, inline. They used to be a "Settings" row
            that opened a second screen with its own six-item rail — a settings
            menu inside a settings menu. */}
        <AccountSettingsRows
          onOpenExport={onOpenExport ? go(onOpenExport) : undefined}
          onShowToast={onShowToast}
        />

        <Section label={he ? 'חשבון' : 'Account'}>
          <div className="flex flex-col gap-2">
            {onOpenAdminFeedback && (
              <Row icon={ShieldCheck} label={he ? 'ניהול ומדדים' : 'Admin'} onClick={go(onOpenAdminFeedback)} />
            )}
            {signedIn && (
              <Row icon={LogOut} tone="danger" label={he ? 'התנתקות' : 'Sign out'} onClick={go(logout)} />
            )}
          </div>
        </Section>

        {/* Feedback and About sit last: they are the things you reach for least
            often, and neither is a setting. */}
        <Section label={he ? 'עוד' : 'More'}>
          <div className="flex flex-col gap-2">
            <Row icon={MessageSquare} label={he ? 'משוב ודיווח באגים' : 'Feedback'} onClick={go(onOpenFeedback)} />
            <Row icon={Info} label={he ? 'אודות' : 'About'} onClick={go(onOpenAbout)} />
          </div>
        </Section>

        <p className="text-xs text-slate-600 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
          {he ? 'Deliveree' : 'Deliveree'}
        </p>
      </div>
      </Modal>

      {/* The two dedicated pages. They stack on top of Account, so their back
          arrow returns here — the same rule every other inner page follows. */}
      <Modal
        isOpen={subPage === 'profile'}
        onClose={() => setSubPage(null)}
        componentName="AccountProfile"
        overlayClassName="p-3 sm:p-4"
        ariaLabel={he ? 'פרופיל' : 'Profile'}
        className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
      >
        <ModalHeader
          title={he ? 'פרופיל וחשבון' : 'Profile & account'}
          onClose={() => setSubPage(null)}
          closeLabel={he ? 'חזרה' : 'Back'}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AccountModal inline include={['profile']} onShowToast={onShowToast} onClose={() => setSubPage(null)} />
        </div>
      </Modal>

      <Modal
        isOpen={subPage === 'notifications'}
        onClose={() => setSubPage(null)}
        componentName="AccountNotifications"
        overlayClassName="p-3 sm:p-4"
        ariaLabel={he ? 'התראות' : 'Notifications'}
        className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
      >
        <ModalHeader
          title={he ? 'התראות' : 'Notifications'}
          onClose={() => setSubPage(null)}
          closeLabel={he ? 'חזרה' : 'Back'}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AccountModal inline include={['notifications']} onShowToast={onShowToast} onClose={() => setSubPage(null)} />
        </div>
      </Modal>

      <Modal
        isOpen={subPage === 'danger'}
        onClose={() => setSubPage(null)}
        componentName="AccountDangerZone"
        overlayClassName="p-3 sm:p-4"
        ariaLabel={he ? 'מחיקת חשבון' : 'Delete account'}
        className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
      >
        <ModalHeader
          title={he ? 'מחיקת חשבון' : 'Delete account'}
          onClose={() => setSubPage(null)}
          closeLabel={he ? 'חזרה' : 'Back'}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AccountModal inline include={['danger']} onShowToast={onShowToast} onClose={onClose} />
        </div>
      </Modal>
    </>
  );
}
