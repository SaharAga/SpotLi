import React, { useState, useEffect } from 'react';
import {
  User,
  Trash2,
  CheckCircle2,
  Calendar,
  Mail,
  Check,
  AlertTriangle,
  Cloud,
  Sparkles,
  Bell,
  ShieldAlert,
  Link2,
  Upload,
  MapPin,
  MessageSquare,
  Info,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';
import { APP_NAME, INGESTION_EMAIL_DOMAIN } from '../constants/app';
import { notificationService } from '../services/notificationService';
import { Modal } from './Modal';
import { AccountSettingsRows } from './AccountSettingsRows';
import { Title, Section, Button, ModalHeader } from './ui/Primitives';

const LegalDocumentModal = React.lazy(() =>
  import('./LegalDocumentModal').then((module) => ({ default: module.LegalDocumentModal }))
);

const card = 'p-4 bg-slate-900 border border-slate-800 rounded-2xl';
const label = 'text-xs text-slate-400 block mb-1';
const sectionTitle = 'text-xs font-bold text-slate-100 flex items-center gap-2';

function Switch({ checked, onChange, disabled }) {
  return (
    <label className="relative inline-flex items-center justify-center cursor-pointer min-h-[48px] min-w-[48px] shrink-0">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only peer"
      />
      <span className="w-11 h-6 rounded-full bg-slate-700 peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-disabled:opacity-50 transition-colors" />
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-150 ${
          checked ? 'start-[24px]' : 'start-[4px]'
        }`}
      />
    </label>
  );
}

function AccountRow({ icon: Icon, label: rowLabel, meta, onClick, tone = 'default' }) {
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
      <span className={`flex-1 min-w-0 text-sm font-bold truncate ${tones[tone]}`}>{rowLabel}</span>
      {meta && <span className="text-xs text-slate-500 shrink-0">{meta}</span>}
    </button>
  );
}

export function AccountModal({
  isOpen,
  onClose,
  inline = false,
  include = null,
  initialTab = null,
  onOpenExport,
  onOpenAuth,
  onOpenConnectModal,
  onOpenLockerMap,
  onOpenFeedback,
  onOpenAdminFeedback,
  onOpenAbout,
  onOpenAppTour,
  onImportData,
  onExportData,
  onShowToast,
  packages = []
}) {
  const show = (id) => !include || include.includes(id);

  const { language, t, isRTL } = useLanguage();
  const { user, updateAiTrainingOptIn, deleteUserAccountAndData, syncStatus, lastSyncTime, logout } = useAuth();
  const he = language === 'he';

  const [subPage, setSubPage] = useState(initialTab || null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState(() => notificationService.getPreferences());
  const [permissionStatus, setPermissionStatus] = useState(() => notificationService.getNotificationPermission());
  const [openLegalDoc, setOpenLegalDoc] = useState(null); // 'terms' | 'privacy' | null
  const [isTogglingAiOptIn, setIsTogglingAiOptIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSubPage(initialTab || null);
    }
  }, [isOpen, initialTab]);

  const [pushDiagnostics, setPushDiagnostics] = useState(null);

  // AuthContext's user profile exposes the Firebase uid as `id` (see
  // buildCleanUserProfile) — there is no `uid` field on it. Every push call
  // here read `user?.uid` and so passed `undefined`, which made
  // `subscribeToPush` skip its `if (uid)` server-persist branch entirely:
  // clicking "enable notifications" while signed in created a browser
  // subscription that was never written to `pushSubscriptions/{uid}/tokens`,
  // leaving nothing for any Cloud Function to send to. `user?.uid` is kept as
  // a fallback in case a raw Firebase user object is ever passed in.
  const userUid = user?.id || user?.uid || null;

  useEffect(() => {
    if (inline || isOpen) {
      setNotificationPrefs(notificationService.getPreferences());
      setPermissionStatus(notificationService.getNotificationPermission());
    }
  }, [inline, isOpen]);

  // Opening notification settings is a second chance to repair a device whose
  // subscription was never persisted (or was dropped by the browser), for the
  // case where the user was already signed in when AuthContext's sign-in
  // effect ran. `ensurePushSubscription` never prompts, and the diagnostics
  // read is what makes a silent failure visible instead of leaving the user
  // with a green checkmark and no notifications.
  useEffect(() => {
    if (!(inline || isOpen)) return;
    if (notificationService.getNotificationPermission() !== 'granted') {
      setPushDiagnostics(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await notificationService.ensurePushSubscription(userUid);
        const diag = await notificationService.getPushDiagnostics(userUid);
        if (!cancelled) {
          setPushDiagnostics(diag);
          setNotificationPrefs(notificationService.getPreferences());
        }
      } catch (err) {
        console.warn('[AccountModal] Push diagnostics failed:', err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inline, isOpen, userUid]);

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

  const handleUpdateNotifPref = (key, value) => {
    const { ok, preferences } = notificationService.savePreferencesWithStatus({ [key]: value });
    setNotificationPrefs(preferences);
    if (key === 'pushEnabled' && value === false) {
      notificationService.unsubscribeFromPush(userUid);
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
    const perm = await notificationService.requestNotificationPermission(userUid);
    setPermissionStatus(perm);
    setNotificationPrefs(notificationService.getPreferences());
    if (perm === 'granted') {
      const diag = await notificationService.getPushDiagnostics(userUid);
      setPushDiagnostics(diag);
      // Granting permission is not the same as being reachable. Say which one
      // actually happened rather than reporting success for both.
      if (onShowToast) {
        if (diag.serverRegistered || (!userUid && diag.browserSubscription)) {
          onShowToast(language === 'he' ? 'הרשאת התראות הופעלה בהצלחה!' : 'Notification permission granted!', 'success');
        } else {
          onShowToast(
            language === 'he'
              ? 'ההרשאה ניתנה, אך רישום ההתראות לא הושלם — ראה פרטים בהגדרות'
              : 'Permission granted, but push registration did not complete — see details below',
            'error'
          );
        }
      }
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
        // Not "all data": anonymous feedback and crash reports carry no link
        // to an account and survive deletion by design. The Privacy Policy
        // says so; this toast used to contradict it.
        onShowToast(language === 'he' ? 'החשבון ונתוני החבילות נמחקו לצמיתות' : 'Account and package data wiped permanently', 'info');
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

  const renderProfile = () => (
    <div className="space-y-4 animate-fade-in text-xs text-slate-100">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={card}>
          <span className={label}>{language === 'he' ? 'שם מלא' : 'Full Name'}</span>
          <span className="font-semibold text-slate-100 text-sm">{user?.name || '—'}</span>
        </div>

        <div className={card}>
          <span className={label}>{language === 'he' ? 'כתובת אימייל' : 'Email Address'}</span>
          <span className="font-semibold text-slate-100 text-sm">{user?.email || '—'}</span>
        </div>

        <div className={card}>
          <span className={label}>{language === 'he' ? 'כתובת ייבוא אוטומטית' : 'Ingestion Email Box'}</span>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-mono text-slate-100 text-xs truncate">{user?.ingestionEmail || `${user?.id || 'user'}@${INGESTION_EMAIL_DOMAIN}`}</span>
          </div>
        </div>

        <div className={card}>
          <span className={label}>{language === 'he' ? 'תאריך הצטרפות' : 'Account Created'}</span>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-100 text-xs">{user?.createdAt || 'August 2026'}</span>
          </div>
        </div>
      </div>

      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-100 block text-xs">
              {language === 'he' ? 'סטטוס סנכרון ענן' : 'Cloud Sync Status'}
            </span>
            <span className="text-xs text-slate-400">
              {syncStatus === 'syncing'
                ? (language === 'he' ? 'מסנכרן כעת...' : 'Syncing now...')
                : (language === 'he' ? `מעודכן (${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'כרגע'})` : `Synced (${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'})`)}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
          <Check className="w-3 h-3" />
          <span>{language === 'he' ? 'פעיל' : 'Active'}</span>
        </span>
      </div>

      <div className={`${card} flex items-start justify-between gap-3`}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-100 block text-xs">
              {language === 'he' ? 'עזרו לשפר דיוק (AI)' : 'Help Improve AI Accuracy'}
            </span>
            <span className="text-xs text-slate-400 leading-relaxed block mt-0.5">
              {language === 'he'
                ? 'שמירת טקסט מודבק ותיקונים שביצעת לשיפור מנוע החילוץ (ללא תמונות). כיבוי מוחק מיידית כל מידע שכבר נאסף.'
                : 'Stores pasted text and your corrections to improve the parser (never images). Turning this off immediately deletes any data already collected.'}
            </span>
          </div>
        </div>
        <Switch checked={!!user?.aiTrainingOptIn} disabled={isTogglingAiOptIn} onChange={handleToggleAiOptIn} />
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div data-section="notifications" className="space-y-4 animate-fade-in text-xs text-slate-100">
      {/* Web Push Section */}
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <span className={sectionTitle}>
              <Bell className="w-4 h-4 text-blue-400" />
              <span>{t('notifications.webPush')}</span>
            </span>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('notifications.webPushDesc')}
            </p>
          </div>

          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {permissionStatus === 'granted' ? (
              <Switch
                checked={notificationPrefs.pushEnabled}
                onChange={(e) => handleUpdateNotifPref('pushEnabled', e.target.checked)}
              />
            ) : permissionStatus === 'denied' ? (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 font-semibold">
                {t('notifications.permissionDenied')}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestPushPermission}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-ui flex items-center gap-1.5 cursor-pointer min-h-[48px]"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{t('notifications.requestPermission')}</span>
              </button>
            )}
          </div>
        </div>

        {permissionStatus === 'granted' && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('notifications.permissionGranted')}</span>
            </div>
            <button
              type="button"
              onClick={handleSendTestNotification}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-100 text-xs font-semibold transition-ui cursor-pointer flex items-center gap-1.5 min-h-[48px]"
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>{language === 'he' ? 'שלח התראת בדיקה' : 'Send Test Notification'}</span>
            </button>
          </div>
        )}

        {permissionStatus === 'granted' && pushDiagnostics && (
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {language === 'he'
                ? 'התראת הבדיקה מוצגת מקומית ואינה בודקת את שרשרת ה-Web Push. השלבים הבאים כן:'
                : 'The test notification is shown locally and does not exercise the Web Push chain. These stages do:'}
            </p>
            {[
              {
                ok: pushDiagnostics.vapidConfigured,
                he: 'מפתח שרת ההתראות מוגדר',
                en: 'Push server key configured'
              },
              {
                ok: pushDiagnostics.browserSubscription,
                he: 'מנוי התראות קיים בדפדפן',
                en: 'Browser subscription present'
              },
              {
                ok: pushDiagnostics.serverRegistered,
                he: userUid ? 'המנוי נרשם בשרת' : 'נדרשת התחברות לרישום בשרת',
                en: userUid ? 'Subscription registered on server' : 'Sign in to register on server'
              }
            ].map((row) => (
              <div key={row.en} className="flex items-center gap-2 text-[11px]">
                {row.ok ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                )}
                <span className={row.ok ? 'text-slate-400' : 'text-amber-400 font-semibold'}>
                  {language === 'he' ? row.he : row.en}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification Events Filter Settings */}
      <div className={`${card} space-y-3`}>
        <span className="text-xs font-bold text-slate-100 block">
          {t('notifications.alertEventsTitle')}
        </span>

        <div className="space-y-2.5">
          {[
            { key: 'notifyOnStatusChange', copy: 'notifyOnAll' },
            { key: 'notifyOnDelivered', copy: 'notifyOnDelivered' },
            { key: 'notifyOnCustoms', copy: 'notifyOnCustoms' },
            { key: 'notifyOnException', copy: 'notifyOnException' }
          ].map(({ key, copy }) => (
            <label key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer min-h-[48px]">
              <span className="text-xs font-semibold text-slate-100">
                {t(`notifications.${copy}`)}
              </span>
              <input
                type="checkbox"
                checked={notificationPrefs[key]}
                onChange={(e) => handleUpdateNotifPref(key, e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 cursor-pointer accent-blue-600"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDanger = () => (
    <div className="space-y-4 animate-fade-in text-xs text-slate-100">
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 space-y-2">
        <div className="flex items-center gap-2 font-bold text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{language === 'he' ? 'מחיקה בלתי הפיכה - פרטיות ו-GDPR' : 'Irreversible Account & Data Deletion (GDPR)'}</span>
        </div>
        <p className="text-xs opacity-80 leading-relaxed">
          {language === 'he'
            ? 'פעולה זו תמחק לחלוטין את כל החבילות שלך מהענן (Firestore), תמחק את החשבון האישי שלך, ותנקה את כל המידע השמור במכשיר זה. לא ניתן לשחזר את הנתונים לאחר ביצוע הפעולה (משובים אנונימיים שנשלחו בעבר אינם מקושרים לחשבונך ונשמרים לשיפור השירות).'
            : 'This action permanently deletes all your shipments from cloud storage, deletes your user account credentials, and wipes local device caches. This operation cannot be undone (anonymized feedback previously submitted is not linked to your account and is retained for service reliability).'}
        </p>
      </div>

      <div className={`${card} space-y-3`}>
        <label htmlFor="account-delete-confirm" className="block text-xs font-bold text-slate-100">
          {language === 'he' ? 'לאישור המחיקה, הקלד "מחק" או "DELETE":' : 'To confirm, type "DELETE":'}
        </label>
        <input
          id="account-delete-confirm"
          type="text"
          value={deleteConfirmationInput}
          onChange={(e) => setDeleteConfirmationInput(e.target.value)}
          placeholder={language === 'he' ? 'הקלד מחק או DELETE' : 'Type DELETE'}
          className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-base sm:text-sm rounded-lg p-3 focus:border-rose-500 focus:outline-none min-h-[48px]"
        />

        <button
          type="button"
          disabled={isDeleting || (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' && deleteConfirmationInput.trim().toUpperCase() !== 'מחק')}
          onClick={handleDeleteAccount}
          className="w-full py-3 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs transition-ui flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
        >
          <Trash2 className="w-4 h-4" />
          <span>{isDeleting ? (language === 'he' ? 'מוחק נתונים...' : 'Wiping data...') : (language === 'he' ? 'מחק את החשבון ואת נתוני החבילות' : 'Delete Account & Package Data')}</span>
        </button>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-6">
        {show('profile') && user && renderProfile()}
        {show('notifications') && renderNotifications()}
        {show('preferences') && (
          <AccountSettingsRows onOpenExport={onOpenExport} onShowToast={onShowToast} />
        )}
        {show('danger') && user && renderDanger()}
        <React.Suspense fallback={null}>
          <LegalDocumentModal
            isOpen={!!openLegalDoc}
            onClose={() => setOpenLegalDoc(null)}
            docType={openLegalDoc || 'terms'}
          />
        </React.Suspense>
      </div>
    );
  }

  if (!isOpen) return null;

  const signedIn = Boolean(user);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        componentName="AccountModal"
        overlayClassName="p-3 sm:p-4"
        ariaLabel={he ? 'חשבון' : 'Account'}
        isTabScreen={true}
        className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
      >
        {subPage ? (
          <>
            <ModalHeader
              title={
                subPage === 'profile'
                  ? (he ? 'פרופיל וחשבון' : 'Profile & account')
                  : subPage === 'notifications'
                  ? (he ? 'התראות' : 'Notifications')
                  : (he ? 'מחיקת חשבון' : 'Delete account')
              }
              onClose={() => setSubPage(null)}
              closeLabel={he ? 'חזרה' : 'Back'}
            />
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-8 sm:pb-10">
              {subPage === 'profile' && renderProfile()}
              {subPage === 'notifications' && renderNotifications()}
              {subPage === 'danger' && renderDanger()}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-slate-800">
              <Title>{he ? 'חשבון' : 'Account'}</Title>
              <div className="shrink-0">
                <Button onClick={onClose}>{he ? 'סגור' : 'Close'}</Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-8 sm:pb-10 flex flex-col gap-6">
              <div data-account-rows className="flex flex-col gap-6">
                {/* Identity / Profile card */}
                <button
                  type="button"
                  onClick={signedIn ? () => setSubPage('profile') : go(onOpenAuth)}
                  className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-start focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none min-h-[52px]"
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
                    <AccountRow icon={Link2} label={he ? 'קליטה אוטומטית' : 'Automatic ingestion'} onClick={go(onOpenConnectModal)} />
                  </div>
                </Section>

                <Section label={he ? 'החבילות שלך' : 'Your packages'}>
                  <div className="flex flex-col gap-2">
                    {onOpenLockerMap && (
                      <AccountRow icon={MapPin} label={he ? 'נקודות איסוף' : 'Pickup points'} onClick={go(onOpenLockerMap)} />
                    )}
                    <label className="w-full flex items-center gap-3 min-h-[52px] px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                      <Upload className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="flex-1 text-sm font-bold text-slate-100">{t('backup.importData')}</span>
                      <input type="file" accept=".json" onChange={handleFile} aria-label={t('backup.importData')} className="hidden" />
                    </label>
                  </div>
                </Section>

                <Section label={he ? 'התראות ופרטיות' : 'Notifications & privacy'}>
                  <div className="flex flex-col gap-2">
                    <AccountRow icon={Bell} label={he ? 'התראות' : 'Notifications'} onClick={() => setSubPage('notifications')} />
                    {signedIn && (
                      <AccountRow icon={ShieldAlert} tone="danger" label={he ? 'מחיקת חשבון' : 'Delete account'} onClick={() => setSubPage('danger')} />
                    )}
                  </div>
                </Section>
              </div>

              {/* The settings themselves, inline */}
              <AccountSettingsRows
                onOpenExport={onOpenExport ? go(onOpenExport) : undefined}
                onShowToast={onShowToast}
              />

              {(onOpenAdminFeedback || signedIn) && (
                <Section label={he ? 'חשבון' : 'Account'}>
                  <div className="flex flex-col gap-2">
                    {onOpenAdminFeedback && (
                      <AccountRow icon={ShieldCheck} label={he ? 'ניהול ומדדים' : 'Admin'} onClick={go(onOpenAdminFeedback)} />
                    )}
                    {signedIn && (
                      <AccountRow icon={LogOut} tone="danger" label={he ? 'התנתקות' : 'Sign out'} onClick={go(logout)} />
                    )}
                  </div>
                </Section>
              )}

              <Section label={he ? 'עוד' : 'More'}>
                <div className="flex flex-col gap-2">
                  <AccountRow icon={MessageSquare} label={he ? 'משוב ודיווח באגים' : 'Feedback'} onClick={go(onOpenFeedback)} />
                  <AccountRow icon={Info} label={he ? 'אודות' : 'About'} onClick={go(onOpenAbout)} />
                  {onOpenAppTour && (
                    <AccountRow icon={Sparkles} label={he ? 'מדריך שימוש וסיור' : 'App Tour'} onClick={go(onOpenAppTour)} />
                  )}
                </div>
              </Section>

              <p className="text-xs text-slate-600 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
                {APP_NAME} <bdi dir="ltr">v{APP_VERSION}</bdi>
              </p>
            </div>
          </>
        )}
      </Modal>

      <React.Suspense fallback={null}>
        <LegalDocumentModal
          isOpen={!!openLegalDoc}
          onClose={() => setOpenLegalDoc(null)}
          docType={openLegalDoc || 'terms'}
        />
      </React.Suspense>
    </>
  );
}
