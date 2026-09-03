import React, { useState, useEffect } from 'react';
import {
  X, User, Settings, ShieldAlert, Database,
  Download, Trash2, CheckCircle2, Moon, Sun, Globe,
  Truck, Calendar, Mail, Check, AlertTriangle, Cloud,
  Info, Sparkles, Package, ShieldCheck, Bell, Navigation
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { CARRIERS, CARRIER_LIST } from '../types/carriers';
import { APP_VERSION, RELEASE_DATE, BUILD_CHANNEL } from '../constants/version';
import { notificationService } from '../services/notificationService';
const LegalDocumentModal = React.lazy(() => import('./LegalDocumentModal').then(module => ({ default: module.LegalDocumentModal })));
import { exportRawToJSON } from '../utils/exportUtils';
import { deliveryService } from '../services/deliveryService';
import { todayISO } from '../utils/dateUtils';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { Modal } from './Modal';
import { NAV_APPS, getPreferredNavigationApp, setPreferredNavigationApp, clearPreferredNavigationApp } from '../utils/navigationService';

const ACCOUNT_SECTIONS = [
  { id: 'preferences', icon: Settings, label: { en: 'Appearance & Language', he: 'תצוגה ושפה' } },
  { id: 'notifications', icon: Bell, label: { en: 'Notifications', he: 'התראות' } },
  { id: 'profile', icon: User, label: { en: 'Profile & Account', he: 'פרופיל וחשבון' }, requiresAuth: true },
  { id: 'data', icon: Database, label: { en: 'Data & Backup', he: 'נתונים וגיבוי' }, requiresAuth: true },
  { id: 'about', icon: Info, label: { en: 'About & Info', he: 'אודות ומידע' } },
  { id: 'danger', icon: ShieldAlert, label: { en: 'Danger Zone', he: 'מחיקת חשבון (GDPR)' }, danger: true, requiresAuth: true }
];

// Design tokens: --stg-* custom properties (index.css), a pilot navy+gold
// palette scoped to .settings-theme — see that block's comment for why.
const card = 'p-4 bg-[var(--stg-surface-2)] border border-[var(--stg-border)] rounded-xl';
const label = 'text-[11px] text-[var(--stg-text-muted)] block mb-1';
const sectionTitle = 'text-xs font-bold text-[var(--stg-text)] flex items-center gap-2';
const selectCls = 'w-full bg-[var(--stg-surface)] border border-[var(--stg-border)] text-[var(--stg-text)] text-base sm:text-sm rounded-lg p-2.5 focus:border-[var(--stg-accent)] focus:outline-none cursor-pointer min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed';

function Switch({ checked, onChange, disabled }) {
  // Thumb position is driven directly by `checked` via logical inset-start
  // (not a peer-checked + rtl: translate combo) — that combo relies on two
  // same-specificity rules where source order decides the winner, which
  // silently broke in RTL. inset-inline-start already flips with `dir`,
  // so one conditional class is correct in both directions with no
  // rtl: variant needed at all.
  return (
    <label className="relative inline-flex items-center cursor-pointer min-h-[44px] shrink-0">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only peer"
      />
      <span className="w-11 h-6 rounded-full bg-[var(--stg-border)] peer-checked:bg-[var(--stg-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--stg-accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--stg-surface)] peer-disabled:opacity-50 transition-colors" />
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-150 ${
          checked ? 'start-[22px]' : 'start-[2px]'
        }`}
      />
    </label>
  );
}

export function AccountModal({
  isOpen,
  onClose,
  initialTab = 'preferences',
  packages = [],
  onExportData,
  onOpenExport,
  onOpenAuth,
  onShowToast
}) {
  const { language, setLanguage, t } = useLanguage();
  const { isDark, theme, setTheme } = useTheme();
  const { user, updateUserPreferences, updateAiTrainingOptIn, deleteUserAccountAndData, syncStatus, lastSyncTime, logout } = useAuth();

  const [activeTab, setActiveTab] = useState(initialTab); // one of ACCOUNT_SECTIONS ids
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState(() => notificationService.getPreferences());
  const [permissionStatus, setPermissionStatus] = useState(() => notificationService.getNotificationPermission());
  const [openLegalDoc, setOpenLegalDoc] = useState(null); // 'terms' | 'privacy' | null
  const [isTogglingAiOptIn, setIsTogglingAiOptIn] = useState(false);
  const [preferredNavApp, setPreferredNavApp] = useState(() => getPreferredNavigationApp() || 'auto');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setNotificationPrefs(notificationService.getPreferences());
      setPermissionStatus(notificationService.getNotificationPermission());
      setPreferredNavApp(getPreferredNavigationApp() || 'auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleUpdateNotifPref = (key, value) => {
    // A rejected storage write (quota, private mode) used to be reported as a
    // success; the toggle moved and nothing was persisted.
    const { ok, preferences } = notificationService.savePreferencesWithStatus({ [key]: value });
    setNotificationPrefs(preferences);
    if (key === 'pushEnabled' && value === false) {
      // Stop this device from receiving (and Cloud Functions from paying to
      // send to) push once the user turns it off, not just locally.
      notificationService.unsubscribeFromPush(user?.uid);
    }
    if (!onShowToast) return;
    if (ok) {
      onShowToast(t('notifications.preferencesSaved') || 'Preferences saved', 'success');
    } else {
      onShowToast(
        language === 'he'
          ? 'שמירת הגדרות ההתראות נכשלה — אחסון המכשיר מלא'
          : 'Could not save notification settings — device storage is full',
        'error'
      );
    }
  };

  const handleRequestPushPermission = async () => {
    const perm = await notificationService.requestNotificationPermission(user?.uid);
    setPermissionStatus(perm);
    setNotificationPrefs(notificationService.getPreferences());
    if (perm === 'granted') {
      if (onShowToast) onShowToast(language === 'he' ? 'הרשאת התראות הופעלה בהצלחה!' : 'Notification permission granted!', 'success');
    } else if (perm === 'denied') {
      if (onShowToast) onShowToast(language === 'he' ? 'הרשאת התראות נדחתה בדפדפן' : 'Notification permission denied', 'error');
    }
  };

  const handleSendTestNotification = async () => {
    try {
      const res = await notificationService.sendTestNotification(language);
      if (res) {
        if (onShowToast) onShowToast(language === 'he' ? 'התראת בדיקה נשלחה!' : 'Test notification sent!', 'success');
      } else {
        if (onShowToast) onShowToast(language === 'he' ? 'לא ניתן לשלוח התראה, בדוק הרשאות' : 'Could not send notification, check permissions', 'error');
      }
    } catch {
      if (onShowToast) onShowToast(language === 'he' ? 'שגיאה בשליחת התראת בדיקה' : 'Error sending test notification', 'error');
    }
  };

  if (!isOpen) return null;

  const currentPrefs = user?.preferences || {
    defaultCarrier: 'all',
    language: language || 'he',
    theme: isDark ? 'dark' : 'light',
    dateFormat: 'DD/MM/YYYY',
    autoArchiveDelivered: false
  };

  const handleCarrierChange = (e) => {
    if (!user) return;
    updateUserPreferences({
      ...currentPrefs,
      defaultCarrier: e.target.value
    });
    if (onShowToast) {
      onShowToast(language === 'he' ? 'הגדרת ספק ברירת מחדל עודכנה' : 'Default carrier updated', 'success');
    }
  };

  const handleLanguagePreferenceChange = (newLang) => {
    setLanguage(newLang);
    if (user) {
      updateUserPreferences({
        ...currentPrefs,
        language: newLang
      });
    }
    if (onShowToast) {
      onShowToast(newLang === 'he' ? 'שפת הממשק שונתה לעברית' : 'Language changed to English', 'success');
    }
  };


  const handleAutoArchiveToggle = (e) => {
    const nextVal = e.target.checked;
    if (user) {
      updateUserPreferences({
        ...currentPrefs,
        autoArchiveDelivered: nextVal
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEYS.AUTO_ARCHIVE_DELIVERED, String(nextVal));
      } catch (err) {
        console.warn("Failed to set local autoArchive pref:", err);
      }
    }
    if (onShowToast) {
      onShowToast(
        nextVal
          ? (language === "he" ? "ארכוב אוטומטי הופעל" : "Auto-archive enabled")
          : (language === "he" ? "ארכוב אוטומטי בוטל" : "Auto-archive disabled"),
        "success"
      );
    }
  };

  const handleDateFormatChange = (e) => {
    if (!user) return;
    updateUserPreferences({
      ...currentPrefs,
      dateFormat: e.target.value
    });
    if (onShowToast) {
      onShowToast(language === 'he' ? 'פורמט תאריכים עודכן' : 'Date format updated', 'success');
    }
  };

  const handleNavAppChange = (e) => {
    const val = e.target.value;
    setPreferredNavApp(val);
    if (val === 'auto') {
      clearPreferredNavigationApp();
    } else {
      setPreferredNavigationApp(val);
    }
    if (onShowToast) {
      onShowToast(language === 'he' ? 'אפליקציית הניווט המועדפת עודכנה' : 'Preferred navigation app updated', 'success');
    }
  };

  const handleBackupJSON = () => {
    // A backup must be able to reconstruct what the user has, which is what
    // the format change buys: ten flat CSV columns cannot carry checkpoints,
    // titleHe/notesHe, category, the flags or schemaVersion, and no CSV
    // importer exists — so the previous "backup" could not be restored at all.
    // deliveryService.importData reads JSON, so this file actually restores.
    //
    // Read from storage rather than the `packages` prop. In normal operation
    // the two match (savePackages validates before writing, so the blob is
    // already repaired); the raw read matters for a legacy or
    // externally-modified blob, where it backs up the stored bytes instead of
    // a repaired copy. Repair-on-read is deliberately left alone — it is what
    // stops the app dying on corrupt data.
    const rawPackages = deliveryService.getRawPackages(user.id);

    if (rawPackages.length === 0) {
      if (onShowToast) onShowToast(language === 'he' ? 'אין חבילות לגיבוי' : 'No packages to back up', 'info');
      return;
    }

    exportRawToJSON(rawPackages, true, `deliveree_backup_${user.id}_${todayISO()}.json`);

    if (onShowToast) onShowToast(language === 'he' ? 'קובץ גיבוי JSON הורד בהצלחה' : 'JSON backup downloaded', 'success');
  };

  const handleToggleAiOptIn = async () => {
    if (!user || isTogglingAiOptIn) return;
    setIsTogglingAiOptIn(true);
    const nextValue = !user.aiTrainingOptIn;
    try {
      await updateAiTrainingOptIn(nextValue);
      if (onShowToast) {
        onShowToast(
          nextValue
            ? (language === 'he' ? 'תודה! נאסוף דוגמאות תיקון לשיפור הדיוק.' : 'Thanks! We’ll start collecting correction examples to improve accuracy.')
            : (language === 'he' ? 'הופסק. כל המידע שנאסף עד כה נמחק.' : 'Turned off. Any data already collected has been deleted.'),
          'success'
        );
      }
    } finally {
      setIsTogglingAiOptIn(false);
    }
  };

  const handleDeleteAccount = async () => {
    const trimmed = deleteConfirmationInput.trim().toUpperCase();
    if (trimmed !== 'DELETE' && trimmed !== 'מחק') {
      if (onShowToast) {
        onShowToast(language === 'he' ? 'נא להקליד "מחק" או "DELETE" לאישור' : 'Please type "DELETE" to confirm', 'error');
      }
      return;
    }

    try {
      setIsDeleting(true);
      await deleteUserAccountAndData(user.id);
      if (onShowToast) {
        onShowToast(language === 'he' ? 'החשבון וכל המידע נמחקו לצמיתות' : 'Account and all data wiped permanently', 'info');
      }
      onClose();
    } catch {
      if (onShowToast) {
        onShowToast(language === 'he' ? 'שגיאה במחיקת החשבון' : 'Failed to delete account', 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="AccountModal"
      overlayClassName="p-3 sm:p-4"
      className="settings-theme relative w-full max-w-3xl bg-[var(--stg-surface)] border border-[var(--stg-border)] rounded-2xl shadow-2xl overflow-hidden my-8"
      style={{ fontFamily: 'var(--stg-font)' }}
    >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[var(--stg-border)] flex items-center justify-between bg-[var(--stg-surface-2)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl relative shrink-0 overflow-hidden bg-[var(--stg-primary)] flex items-center justify-center text-[var(--stg-primary-on)] font-bold text-base shadow-md">
              {user ? (
                <>
                  <span>{user.name?.charAt(0) || 'U'}</span>
                  {user.avatar && (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </>
              ) : (
                <Settings className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--stg-text)] flex items-center gap-2">
                <span>{user ? user.name : (language === 'he' ? 'הגדרות' : 'Settings')}</span>
                {user && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--stg-accent-soft)] text-[var(--stg-accent)] font-semibold">
                    {user.plan || 'Personal'}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--stg-text-muted)]">
                {user ? user.email : (language === 'he' ? 'תצוגה, שפה והתראות זמינים ללא התחברות' : 'Appearance, language & notifications work without signing in')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={() => {
                  logout();
                  if (onShowToast) onShowToast(language === 'he' ? 'התנתקת מהחשבון' : 'Logged out', 'info');
                  onClose();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--stg-destructive-soft)] hover:opacity-80 text-[var(--stg-destructive)] font-semibold text-xs transition-opacity cursor-pointer min-h-[40px]"
                title={language === 'he' ? 'התנתקות מהחשבון' : 'Sign Out'}
                id="account-modal-signout-btn"
              >
                <span>{language === 'he' ? 'התנתקות' : 'Sign Out'}</span>
              </button>
            ) : (
              onOpenAuth && (
                <button
                  onClick={() => { onClose(); onOpenAuth(); }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--stg-accent-soft)] hover:opacity-80 text-[var(--stg-accent)] font-semibold text-xs transition-opacity cursor-pointer min-h-[40px]"
                >
                  <span>{language === 'he' ? 'התחברות' : 'Sign In'}</span>
                </button>
              )
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[var(--stg-border)] hover:opacity-80 text-[var(--stg-text-muted)] hover:text-[var(--stg-text)] transition-opacity cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section list (left rail) + content (right) */}
        <div className="flex flex-col sm:flex-row">
          <nav className="sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-e border-[var(--stg-border)] bg-[var(--stg-bg)] p-2 sm:p-3 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible no-scrollbar">
            {ACCOUNT_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeTab === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(section.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap min-h-[44px] text-start ${
                    isActive
                      ? section.danger
                        ? 'bg-[var(--stg-destructive-soft)] text-[var(--stg-destructive)]'
                        : 'bg-[var(--stg-surface)] text-[var(--stg-primary)] shadow-sm'
                      : section.danger
                        ? 'text-[var(--stg-text-muted)] hover:bg-[var(--stg-surface)] hover:text-[var(--stg-destructive)]'
                        : 'text-[var(--stg-text-muted)] hover:bg-[var(--stg-surface)] hover:text-[var(--stg-text)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive && !section.danger ? 'text-[var(--stg-accent)]' : ''}`} />
                  <span>{language === 'he' ? section.label.he : section.label.en}</span>
                </button>
              );
            })}
          </nav>

          {/* Section Content */}
          <div className="flex-1 min-w-0 p-5 sm:p-6 text-xs text-[var(--stg-text)] max-h-[60vh] overflow-y-auto">
          {ACCOUNT_SECTIONS.find((s) => s.id === activeTab)?.requiresAuth && !user ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-10 animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-[var(--stg-accent-soft)] flex items-center justify-center text-[var(--stg-accent)]">
                <User className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-[var(--stg-text)] text-sm">
                  {language === 'he' ? 'נדרשת התחברות' : 'Sign in required'}
                </p>
                <p className="text-[var(--stg-text-muted)] text-xs mt-1 max-w-xs">
                  {language === 'he' ? 'סעיף זה קשור לחשבון האישי שלך — התחברו כדי לגשת אליו.' : 'This section is tied to your personal account — sign in to access it.'}
                </p>
              </div>
              {onOpenAuth && (
                <button
                  onClick={() => { onClose(); onOpenAuth(); }}
                  className="px-4 py-2.5 rounded-lg bg-[var(--stg-primary)] text-[var(--stg-primary-on)] font-bold text-xs transition-all cursor-pointer min-h-[44px]"
                >
                  {language === 'he' ? 'התחברות / הרשמה' : 'Sign In / Register'}
                </button>
              )}
            </div>
          ) : (
          <>
          {/* TAB 1: PROFILE & ACCOUNT */}
          {activeTab === 'profile' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={card}>
                  <span className={label}>{language === 'he' ? 'שם מלא' : 'Full Name'}</span>
                  <span className="font-semibold text-[var(--stg-text)] text-sm">{user.name}</span>
                </div>

                <div className={card}>
                  <span className={label}>{language === 'he' ? 'כתובת אימייל' : 'Email Address'}</span>
                  <span className="font-semibold text-[var(--stg-text)] text-sm">{user.email}</span>
                </div>

                <div className={card}>
                  <span className={label}>{language === 'he' ? 'כתובת ייבוא אוטומטית' : 'Ingestion Email Box'}</span>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[var(--stg-accent)] shrink-0" />
                    <span className="font-mono text-[var(--stg-text)] text-xs truncate">{user.ingestionEmail || `${user.id}@in.deliveree.app`}</span>
                  </div>
                </div>

                <div className={card}>
                  <span className={label}>{language === 'he' ? 'תאריך הצטרפות' : 'Account Created'}</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--stg-success)] shrink-0" />
                    <span className="font-semibold text-[var(--stg-text)] text-xs">{user.createdAt || 'August 2026'}</span>
                  </div>
                </div>
              </div>

              <div className={`${card} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--stg-success-soft)] text-[var(--stg-success)]">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-[var(--stg-text)] block text-xs">
                      {language === 'he' ? 'סטטוס סנכרון ענן' : 'Cloud Sync Status'}
                    </span>
                    <span className="text-[11px] text-[var(--stg-text-muted)]">
                      {syncStatus === 'syncing'
                        ? (language === 'he' ? 'מסנכרן כעת...' : 'Syncing now...')
                        : (language === 'he' ? `מעודכן (${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'כרגע'})` : `Synced (${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'})`)}
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--stg-success-soft)] text-[var(--stg-success)] text-[11px] font-bold">
                  <Check className="w-3 h-3" />
                  <span>{language === 'he' ? 'פעיל' : 'Active'}</span>
                </span>
              </div>

              {/* AI training opt-in — off by default, changeable anytime. See
                  src/constants/legal.js and LegalConsentGate for the initial
                  choice at registration/first login. */}
              <div className={`${card} flex items-start justify-between gap-3`}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--stg-accent-soft)] text-[var(--stg-accent)] shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-[var(--stg-text)] block text-xs">
                      {language === 'he' ? 'עזרו לשפר דיוק (AI)' : 'Help Improve AI Accuracy'}
                    </span>
                    <span className="text-[11px] text-[var(--stg-text-muted)] leading-relaxed block mt-0.5">
                      {language === 'he'
                        ? 'שמירת טקסט מודבק ותיקונים שביצעת לשיפור מנוע החילוץ (ללא תמונות). כיבוי מוחק מיידית כל מידע שכבר נאסף.'
                        : 'Stores pasted text and your corrections to improve the parser (never images). Turning this off immediately deletes any data already collected.'}
                    </span>
                  </div>
                </div>
                <Switch checked={!!user.aiTrainingOptIn} disabled={isTogglingAiOptIn} onChange={handleToggleAiOptIn} />
              </div>
            </div>
          )}

          {/* TAB: NOTIFICATIONS & ALERTS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 animate-fade-in">
              {/* Web Push Section */}
              <div className={`${card} space-y-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className={sectionTitle}>
                      <Bell className="w-4 h-4 text-[var(--stg-accent)]" />
                      <span>{t('notifications.webPush')}</span>
                    </span>
                    <p className="text-[11px] text-[var(--stg-text-muted)] leading-relaxed">
                      {t('notifications.webPushDesc')}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {permissionStatus === 'granted' ? (
                      <Switch
                        checked={notificationPrefs.pushEnabled}
                        onChange={(e) => handleUpdateNotifPref('pushEnabled', e.target.checked)}
                      />
                    ) : permissionStatus === 'denied' ? (
                      <span className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--stg-destructive-soft)] text-[var(--stg-destructive)] font-semibold">
                        {t('notifications.permissionDenied')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestPushPermission}
                        className="px-3 py-2 rounded-lg bg-[var(--stg-primary)] text-[var(--stg-primary-on)] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>{t('notifications.requestPermission')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {permissionStatus === 'granted' && (
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--stg-border)]">
                    <div className="flex items-center gap-2 text-[11px] text-[var(--stg-success)] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('notifications.permissionGranted')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      className="px-3 py-1.5 rounded-lg bg-[var(--stg-surface)] hover:bg-[var(--stg-surface-elevated)] border border-[var(--stg-border)] text-[var(--stg-text)] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px]"
                    >
                      <Sparkles className="w-3 h-3 text-[var(--stg-accent)]" />
                      <span>{language === 'he' ? 'שלח התראת בדיקה' : 'Send Test Notification'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Notification Events Filter Settings */}
              <div className={`${card} space-y-3`}>
                <span className="text-xs font-bold text-[var(--stg-text)] block">
                  {t('notifications.alertEventsTitle')}
                </span>

                <div className="space-y-2.5">
                  {[
                    { key: 'notifyOnStatusChange', copy: 'notifyOnAll' },
                    { key: 'notifyOnDelivered', copy: 'notifyOnDelivered' },
                    { key: 'notifyOnCustoms', copy: 'notifyOnCustoms' },
                    { key: 'notifyOnException', copy: 'notifyOnException' }
                  ].map(({ key, copy }) => (
                    <label key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--stg-surface)] border border-[var(--stg-border)] cursor-pointer min-h-[44px]">
                      <span className="text-[11px] font-semibold text-[var(--stg-text)]">
                        {t(`notifications.${copy}`)}
                      </span>
                      <input
                        type="checkbox"
                        checked={notificationPrefs[key]}
                        onChange={(e) => handleUpdateNotifPref(key, e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--stg-border)] cursor-pointer accent-[var(--stg-accent)]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="space-y-4 animate-fade-in">
              {/* Default Carrier Pre-Selection — account-scoped, needs a signed-in user */}
              <div className={`${card} space-y-2`}>
                <label className={sectionTitle}>
                  <Truck className="w-4 h-4 text-[var(--stg-accent)]" />
                  <span>{language === 'he' ? 'ספק משלוחים מועדף כברירת מחדל' : 'Default Pre-Selected Carrier'}</span>
                </label>
                <select
                  value={currentPrefs.defaultCarrier}
                  onChange={handleCarrierChange}
                  disabled={!user}
                  className={selectCls}
                >
                  <option value="all">{language === 'he' ? 'זיהוי אוטומטי (ללא קיבוע)' : 'Auto-detect (No default)'}</option>
                  {Object.entries(CARRIERS).map(([key, carrier]) => (
                    <option key={key} value={key}>
                      {language === 'he' ? (carrier.hebrewName || carrier.name) : carrier.name}
                    </option>
                  ))}
                </select>
                {!user && (
                  <p className="text-[10px] text-[var(--stg-text-muted)]">
                    {language === 'he' ? 'התחברו כדי לשמור העדפה זו לחשבונכם' : 'Sign in to save this to your account'}
                  </p>
                )}
              </div>

              
              {/* Auto-Archive Delivered Packages Toggle */}
              <div className={`${card} flex items-start justify-between gap-3`}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--stg-accent-soft)] text-[var(--stg-accent)] shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-[var(--stg-text)] block text-xs">
                      {t("autoArchive.settingTitle")}
                    </span>
                    <span className="text-[11px] text-[var(--stg-text-muted)] leading-relaxed block mt-0.5">
                      {t("autoArchive.settingDesc")}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={
                    user
                      ? Boolean(user.preferences?.autoArchiveDelivered)
                      : (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEYS.AUTO_ARCHIVE_DELIVERED) === "true")
                  }
                  onChange={handleAutoArchiveToggle}
                />
              </div>

              {/* Language Selection */}
              <div className={`${card} space-y-2`}>
                <label className={sectionTitle}>
                  <Globe className="w-4 h-4 text-[var(--stg-accent)]" />
                  <span>{language === 'he' ? 'שפת המערכת המועדפת' : 'Preferred Language'}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLanguagePreferenceChange('he')}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
                      language === 'he'
                        ? 'bg-[var(--stg-accent-soft)] border-[var(--stg-accent)] text-[var(--stg-accent)]'
                        : 'bg-[var(--stg-surface)] border-[var(--stg-border)] text-[var(--stg-text-muted)] hover:text-[var(--stg-text)]'
                    }`}
                  >
                    <span>עברית (Hebrew)</span>
                    {language === 'he' && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLanguagePreferenceChange('en')}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
                      language === 'en'
                        ? 'bg-[var(--stg-accent-soft)] border-[var(--stg-accent)] text-[var(--stg-accent)]'
                        : 'bg-[var(--stg-surface)] border-[var(--stg-border)] text-[var(--stg-text-muted)] hover:text-[var(--stg-text)]'
                    }`}
                  >
                    <span>English</span>
                    {language === 'en' && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Theme & Date Format */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`${card} space-y-2`}>
                  <label className={sectionTitle}>
                    {isDark ? <Moon className="w-4 h-4 text-[var(--stg-accent)]" /> : <Sun className="w-4 h-4 text-[var(--stg-accent)]" />}
                    <span>{language === 'he' ? 'ערכת נושא' : 'Theme'}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: 'light', label: { en: 'Light', he: 'בהיר' }, Icon: Sun },
                      { value: 'dark', label: { en: 'Dark', he: 'כהה' }, Icon: Moon },
                      { value: 'system', label: { en: 'System', he: 'מערכת' }, Icon: Settings }
                    ].map(({ value, label: optLabel, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTheme(value)}
                        className={`py-2.5 px-2 rounded-lg border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[44px] ${
                          theme === value
                            ? 'bg-[var(--stg-accent-soft)] border-[var(--stg-accent)] text-[var(--stg-accent)]'
                            : 'bg-[var(--stg-surface)] border-[var(--stg-border)] text-[var(--stg-text-muted)] hover:text-[var(--stg-text)]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{language === 'he' ? optLabel.he : optLabel.en}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`${card} space-y-2`}>
                  <label className={sectionTitle}>
                    <Calendar className="w-4 h-4 text-[var(--stg-accent)]" />
                    <span>{language === 'he' ? 'פורמט תאריכים' : 'Date Format'}</span>
                  </label>
                  <select
                    value={currentPrefs.dateFormat}
                    onChange={handleDateFormatChange}
                    disabled={!user}
                    className={selectCls}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (19/08/2026)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (08/19/2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-19)</option>
                  </select>
                  {!user && (
                    <p className="text-[10px] text-[var(--stg-text-muted)]">
                      {language === 'he' ? 'התחברו כדי לשמור העדפה זו לחשבונכם' : 'Sign in to save this to your account'}
                    </p>
                  )}
                </div>
              </div>

              {/* Preferred Navigation App Selector */}
              <div className={`${card} space-y-2`}>
                <label className={sectionTitle}>
                  <Navigation className="w-4 h-4 text-[var(--stg-accent)]" />
                  <span>{language === 'he' ? 'אפליקציית ניווט מועדפת' : 'Preferred Navigation App'}</span>
                </label>
                <select
                  value={preferredNavApp}
                  onChange={handleNavAppChange}
                  className={selectCls}
                >
                  <option value="auto">{language === 'he' ? 'שאל בכל פעם (תפריט בחירה)' : 'Always Ask (Choice Menu)'}</option>
                  <option value={NAV_APPS.WAZE}>{language === 'he' ? 'Waze (ווייז)' : 'Waze'}</option>
                  <option value={NAV_APPS.GOOGLE_MAPS}>{language === 'he' ? 'Google Maps (גוגל מפות)' : 'Google Maps'}</option>
                  <option value={NAV_APPS.APPLE_MAPS}>{language === 'he' ? 'Apple Maps (אפל מפות)' : 'Apple Maps'}</option>
                  <option value={NAV_APPS.MOOVIT}>{language === 'he' ? 'Moovit (תחבורה ציבורית)' : 'Moovit (Public Transit)'}</option>
                </select>
                <p className="text-[10px] text-[var(--stg-text-muted)]">
                  {language === 'he' 
                    ? 'משמש לפתיחה מיידית בלחיצה אחת על כפתור הניווט בפרטי החבילה' 
                    : 'Used for instant 1-click navigation from package pickup details'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: DATA & BACKUP */}
          {activeTab === 'data' && (
            <div className="space-y-4 animate-fade-in">
              <div className={`${card} flex items-center justify-between`}>
                <div>
                  <span className="text-xs font-bold text-[var(--stg-text)] block">
                    {language === 'he' ? 'סה"כ חבילות בחשבונך' : 'Total Packages in Your Account'}
                  </span>
                  <span className="text-[11px] text-[var(--stg-text-muted)]">
                    {language === 'he' ? `${packages.length} משלוחים שמורים בענן ובמכשיר` : `${packages.length} deliveries synced locally & on cloud`}
                  </span>
                </div>
                <span className="text-xl font-black text-[var(--stg-accent)] bg-[var(--stg-accent-soft)] px-3.5 py-1 rounded-lg [font-variant-numeric:tabular-nums]">
                  {packages.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenExport) {
                      onOpenExport();
                    } else if (onExportData) {
                      onExportData();
                    }
                  }}
                  className="p-4 rounded-xl bg-[var(--stg-surface-2)] hover:bg-[var(--stg-border)] border border-[var(--stg-border)] text-start transition-all cursor-pointer flex flex-col gap-2 min-h-[48px]"
                >
                  <div className="flex items-center gap-2 text-[var(--stg-accent)] font-bold">
                    <Download className="w-4 h-4" />
                    <span>{language === 'he' ? 'מרכז דוחות וייצוא' : 'Export Center (Reports)'}</span>
                  </div>
                  <p className="text-[11px] text-[var(--stg-text-muted)] leading-relaxed">
                    {language === 'he' ? 'דוחות לקריאה (CSV/JSON/PDF) עם סינון — לצפייה ולא לשחזור.' : 'Readable reports (CSV/JSON/PDF) with filtering — for reading, not for restoring.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleBackupJSON}
                  className="p-4 rounded-xl bg-[var(--stg-surface-2)] hover:bg-[var(--stg-border)] border border-[var(--stg-border)] text-start transition-all cursor-pointer flex flex-col gap-2 min-h-[48px]"
                >
                  <div className="flex items-center gap-2 text-[var(--stg-success)] font-bold">
                    <Database className="w-4 h-4" />
                    <span>{language === 'he' ? 'הורדת גיבוי מלא (JSON)' : 'Download Full Backup (JSON)'}</span>
                  </div>
                  <p className="text-[11px] text-[var(--stg-text-muted)] leading-relaxed">
                    {language === 'he' ? 'קובץ שחזור מלא הנקרא ישירות מהאחסון — כולל כל השדות, וניתן לייבוא חזרה לאפליקציה.' : 'A restorable snapshot read straight from storage — every field, importable back into the app.'}
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: DANGER ZONE (GDPR / Privacy Compliance) */}
          {activeTab === 'danger' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-[var(--stg-destructive-soft)] text-[var(--stg-destructive)] space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{language === 'he' ? 'מחיקה בלתי הפיכה - פרטיות ו-GDPR' : 'Irreversible Account & Data Deletion (GDPR)'}</span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  {language === 'he'
                    ? 'פעולה זו תמחק לחלוטין את כל החבילות שלך מהענן (Firestore), תמחק את החשבון האישי שלך, ותנקה את כל המידע השמור במכשיר זה. לא ניתן לשחזר את הנתונים לאחר ביצוע הפעולה (משובים אנונימיים שנשלחו בעבר אינם מקושרים לחשבונך ונשמרים לשיפור השירות).'
                    : 'This action permanently deletes all your shipments from cloud storage, deletes your user account credentials, and wipes local device caches. This operation cannot be undone (anonymized feedback previously submitted is not linked to your account and is retained for service reliability).'}
                </p>
              </div>

              <div className={`${card} space-y-3`}>
                <label className="block text-xs font-bold text-[var(--stg-text)]">
                  {language === 'he' ? 'לאישור המחיקה, הקלד "מחק" או "DELETE":' : 'To confirm, type "DELETE":'}
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  placeholder={language === 'he' ? 'הקלד מחק או DELETE' : 'Type DELETE'}
                  className="w-full bg-[var(--stg-surface)] border border-[var(--stg-border)] text-[var(--stg-text)] text-base sm:text-sm rounded-lg p-3 focus:border-[var(--stg-destructive)] focus:outline-none min-h-[44px]"
                />

                <button
                  type="button"
                  disabled={isDeleting || (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' && deleteConfirmationInput.trim().toUpperCase() !== 'מחק')}
                  onClick={handleDeleteAccount}
                  className="w-full py-3 px-4 rounded-lg bg-[var(--stg-destructive)] disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? (language === 'he' ? 'מוחק נתונים...' : 'Wiping all data...') : (language === 'he' ? 'מחק את החשבון וכל הנתונים לצמיתות' : 'Delete Account & Wipe All Data')}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: ABOUT & SYSTEM INFO */}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-fade-in">
              {/* Build Info Card */}
              <div className={`${card} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[var(--stg-accent-soft)] text-[var(--stg-accent)]">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--stg-text)] text-sm">Deliveree</span>
                      <span className="font-mono text-xs text-[var(--stg-accent)] font-bold bg-[var(--stg-accent-soft)] px-2 py-0.5 rounded-md">
                        v{APP_VERSION}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--stg-text-muted)]">
                      {RELEASE_DATE} • {BUILD_CHANNEL}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--stg-success-soft)] text-[var(--stg-success)] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>OWASP ASVS L3</span>
                </span>
              </div>

              {/* Supported Carriers Grid */}
              <div className={`${card} space-y-2.5`}>
                <div className="flex items-center justify-between">
                  <span className={sectionTitle}>
                    <Globe className="w-4 h-4 text-[var(--stg-accent)]" />
                    <span>{language === 'he' ? 'ספקי שילוח נתמכים' : 'Supported Carriers'}</span>
                  </span>
                  <span className="text-[10px] text-[var(--stg-text-muted)] font-semibold bg-[var(--stg-surface)] border border-[var(--stg-border)] px-2 py-0.5 rounded-full">
                    {CARRIER_LIST.length} {language === 'he' ? 'ספקים' : 'Carriers'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CARRIER_LIST.map((carrier) => (
                    <div
                      key={carrier.id}
                      className="p-2 rounded-lg bg-[var(--stg-surface)] border border-[var(--stg-border)] flex items-center gap-2"
                    >
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${carrier.color || 'from-blue-500 to-indigo-500'} shrink-0`} />
                      <span className="font-semibold text-[var(--stg-text)] text-[11px] truncate">
                        {language === 'he' ? (carrier.hebrewName || carrier.name) : carrier.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Release Highlights */}
              <div className={`${card} space-y-2`}>
                <span className={sectionTitle}>
                  <Sparkles className="w-4 h-4 text-[var(--stg-accent)]" />
                  <span>{language === 'he' ? `חידושים בגרסה ${APP_VERSION}` : `Release Highlights (${APP_VERSION})`}</span>
                </span>
                <div className="space-y-1.5 text-[11px] text-[var(--stg-text)]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--stg-success)] shrink-0 mt-0.5" />
                    <span>{language === 'he' ? 'סנכרון ענן מאובטח בזמן אמת עם Firebase Firestore.' : 'Real-time multi-device cloud synchronization via Firestore.'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--stg-success)] shrink-0 mt-0.5" />
                    <span>{language === 'he' ? 'זיהוי חכם של 13+ ספקי שילוח מקומיים ובינלאומיים.' : 'Smart tracking for 13+ domestic and global delivery carriers.'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--stg-success)] shrink-0 mt-0.5" />
                    <span>{language === 'he' ? 'ייבוא מהיר מ-SMS ואימייל וחוויית PWA לא מקוונת.' : 'Instant SMS smart paste & offline-first PWA caching.'}</span>
                  </div>
                </div>
              </div>

              {/* Legal */}
              <div className={`${card} flex gap-2.5`}>
                <button
                  type="button"
                  onClick={() => setOpenLegalDoc('terms')}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-[var(--stg-surface)] hover:bg-[var(--stg-border)] border border-[var(--stg-border)] text-[var(--stg-text)] text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
                >
                  {language === 'he' ? 'תנאי שימוש' : 'Terms of Use'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenLegalDoc('privacy')}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-[var(--stg-surface)] hover:bg-[var(--stg-border)] border border-[var(--stg-border)] text-[var(--stg-text)] text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
                >
                  {language === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy'}
                </button>
              </div>
            </div>
          )}
          </>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--stg-border)] bg-[var(--stg-surface-2)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              logout();
              if (onShowToast) onShowToast(language === 'he' ? 'התנתקת מהחשבון' : 'Logged out', 'info');
              onClose();
            }}
            className="sm:hidden px-3.5 py-2 rounded-lg bg-[var(--stg-destructive-soft)] hover:opacity-80 text-[var(--stg-destructive)] font-bold text-xs transition-opacity cursor-pointer min-h-[44px]"
          >
            {language === 'he' ? 'התנתקות מהחשבון' : 'Sign Out'}
          </button>

          <span className="hidden sm:inline text-[11px] text-[var(--stg-text-muted)]">
            {language === 'he' ? `Deliveree v${APP_VERSION} • אבטחת מידע Zero-Trust` : `Deliveree v${APP_VERSION} • Zero-Trust Privacy`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-[var(--stg-border)] hover:opacity-80 text-[var(--stg-text)] font-bold text-xs transition-opacity cursor-pointer min-h-[44px]"
          >
            {language === 'he' ? 'סגור' : 'Close'}
          </button>
        </div>

      </Modal>

      <React.Suspense fallback={null}><LegalDocumentModal
        isOpen={!!openLegalDoc}
        onClose={() => setOpenLegalDoc(null)}
        docType={openLegalDoc || 'terms'}
      /></React.Suspense>
    </>
  );
}
