import React, { useState, useEffect } from 'react';
import { Settings, Trash2, CheckCircle2, Calendar, Mail, Check, AlertTriangle, Cloud, Sparkles, Bell, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

import { APP_VERSION } from '../constants/version';
import { notificationService } from '../services/notificationService';
const LegalDocumentModal = React.lazy(() => import('./LegalDocumentModal').then(module => ({ default: module.LegalDocumentModal })));




import { Modal } from './Modal';
import { AccountSettingsRows } from './AccountSettingsRows';
import { getPreferredNavigationApp } from '../utils/navigationService';


// Design tokens: --stg-* custom properties (index.css), a pilot navy+gold
// palette scoped to .settings-theme — see that block's comment for why.
const card = 'p-4 bg-[var(--stg-surface-2)] border border-[var(--stg-border)] rounded-xl';
const label = 'text-xs text-[var(--stg-text-muted)] block mb-1';
const sectionTitle = 'text-xs font-bold text-[var(--stg-text)] flex items-center gap-2';

function Switch({ checked, onChange, disabled }) {
  // Thumb position is driven directly by `checked` via logical inset-start
  // (not a peer-checked + rtl: translate combo) — that combo relies on two
  // same-specificity rules where source order decides the winner, which
  // silently broke in RTL. inset-inline-start already flips with `dir`,
  // so one conditional class is correct in both directions with no
  // rtl: variant needed at all.
  return (
    <label className="relative inline-flex items-center cursor-pointer min-h-[48px] shrink-0">
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
  inline = false,
  include = null,
  onOpenExport,
  onOpenAuth,
  onShowToast
}) {
  const show = (id) => !include || include.includes(id);

  const { language, t } = useLanguage();
  const { user, updateAiTrainingOptIn, deleteUserAccountAndData, syncStatus, lastSyncTime, logout } = useAuth();

  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState(() => notificationService.getPreferences());
  const [permissionStatus, setPermissionStatus] = useState(() => notificationService.getNotificationPermission());
  const [openLegalDoc, setOpenLegalDoc] = useState(null); // 'terms' | 'privacy' | null
  const [isTogglingAiOptIn, setIsTogglingAiOptIn] = useState(false);

  useEffect(() => {
    if (inline || isOpen) {
      setNotificationPrefs(notificationService.getPreferences());
      setPermissionStatus(notificationService.getNotificationPermission());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, isOpen]);

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

  if (!inline && !isOpen) return null;









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

  // One copy of the settings sections, rendered either inline inside the
  // Account tab or, for the desktop hamburger, inside a Modal.
  const sections = (
    <>
            <div className="flex-1 min-w-0 p-5 sm:p-6 text-xs text-[var(--stg-text)] ">
            {/* TAB 1: PROFILE & ACCOUNT */}
            {user && show('profile') && (
              <>
              <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--stg-text-muted)] mb-3">{language === 'he' ? 'פרופיל וחשבון' : 'Profile & Account'}</h3>
  
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
  
                <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--stg-success-soft)] text-[var(--stg-success)]">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-[var(--stg-text)] block text-xs">
                        {language === 'he' ? 'סטטוס סנכרון ענן' : 'Cloud Sync Status'}
                      </span>
                      <span className="text-xs text-[var(--stg-text-muted)]">
                        {syncStatus === 'syncing'
                          ? (language === 'he' ? 'מסנכרן כעת...' : 'Syncing now...')
                          : (language === 'he' ? `מעודכן (${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'כרגע'})` : `Synced (${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'})`)}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--stg-success-soft)] text-[var(--stg-success)] text-xs font-bold">
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
                      <span className="text-xs text-[var(--stg-text-muted)] leading-relaxed block mt-0.5">
                        {language === 'he'
                          ? 'שמירת טקסט מודבק ותיקונים שביצעת לשיפור מנוע החילוץ (ללא תמונות). כיבוי מוחק מיידית כל מידע שכבר נאסף.'
                          : 'Stores pasted text and your corrections to improve the parser (never images). Turning this off immediately deletes any data already collected.'}
                      </span>
                    </div>
                  </div>
                  <Switch checked={!!user.aiTrainingOptIn} disabled={isTogglingAiOptIn} onChange={handleToggleAiOptIn} />
                </div>
              </div>
              </>
            )}
  
            {/* TAB: NOTIFICATIONS & ALERTS */}
            {show('notifications') && (
              <>
              <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--stg-text-muted)] mb-3">{language === 'he' ? 'התראות' : 'Notifications'}</h3>
  
              <div data-section="notifications" className="space-y-4 animate-fade-in">
                {/* Web Push Section */}
                <div className={`${card} space-y-3`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className={sectionTitle}>
                        <Bell className="w-4 h-4 text-[var(--stg-accent)]" />
                        <span>{t('notifications.webPush')}</span>
                      </span>
                      <p className="text-xs text-[var(--stg-text-muted)] leading-relaxed">
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
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-[var(--stg-destructive-soft)] text-[var(--stg-destructive)] font-semibold">
                          {t('notifications.permissionDenied')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestPushPermission}
                          className="px-3 py-2 rounded-lg bg-[var(--stg-primary)] text-[var(--stg-primary-on)] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[48px]"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>{t('notifications.requestPermission')}</span>
                        </button>
                      )}
                    </div>
                  </div>
  
                  {permissionStatus === 'granted' && (
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--stg-border)]">
                      <div className="flex items-center gap-2 text-xs text-[var(--stg-success)] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('notifications.permissionGranted')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendTestNotification}
                        className="px-3 py-1.5 rounded-lg bg-[var(--stg-surface)] hover:bg-[var(--stg-surface-elevated)] border border-[var(--stg-border)] text-[var(--stg-text)] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 min-h-[48px]"
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
                      <label key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--stg-surface)] border border-[var(--stg-border)] cursor-pointer min-h-[48px]">
                        <span className="text-xs font-semibold text-[var(--stg-text)]">
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
              </>
            )}
  
  
  
            {/* TAB 4: DANGER ZONE (GDPR / Privacy Compliance) */}
            {show('preferences') && (
              <AccountSettingsRows onOpenExport={onOpenExport} onShowToast={onShowToast} />
            )}

            {user && show('danger') && (
              <>
              <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--stg-text-muted)] mb-3">{language === 'he' ? 'מחיקת חשבון (GDPR)' : 'Danger Zone'}</h3>
  
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-[var(--stg-destructive-soft)] text-[var(--stg-destructive)] space-y-2">
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
                  <label className="block text-xs font-bold text-[var(--stg-text)]">
                    {language === 'he' ? 'לאישור המחיקה, הקלד "מחק" או "DELETE":' : 'To confirm, type "DELETE":'}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder={language === 'he' ? 'הקלד מחק או DELETE' : 'Type DELETE'}
                    className="w-full bg-[var(--stg-surface)] border border-[var(--stg-border)] text-[var(--stg-text)] text-base sm:text-sm rounded-lg p-3 focus:border-[var(--stg-destructive)] focus:outline-none min-h-[48px]"
                  />
  
                  <button
                    type="button"
                    disabled={isDeleting || (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' && deleteConfirmationInput.trim().toUpperCase() !== 'מחק')}
                    onClick={handleDeleteAccount}
                    className="w-full py-3 px-4 rounded-lg bg-[var(--stg-destructive)] disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeleting ? (language === 'he' ? 'מוחק נתונים...' : 'Wiping all data...') : (language === 'he' ? 'מחק את החשבון וכל הנתונים לצמיתות' : 'Delete Account & Wipe All Data')}</span>
                  </button>
                </div>
              </div>
              </>
            )}
  
          </div>
    </>
  );

  if (inline) {
    return (
      <div className="settings-theme settings-inline" style={{ fontFamily: 'var(--stg-font)' }}>
        {sections}
        <React.Suspense fallback={null}><LegalDocumentModal
          isOpen={!!openLegalDoc}
          onClose={() => setOpenLegalDoc(null)}
          docType={openLegalDoc || 'terms'}
        /></React.Suspense>
      </div>
    );
  }

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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--stg-accent-soft)] text-[var(--stg-accent)] font-semibold">
                    {user.plan || 'Personal'}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--stg-text-muted)]">
                {user ? user.email : (language === 'he' ? 'תצוגה, שפה והתראות זמינים ללא התחברות' : 'Appearance, language & notifications work without signing in')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 me-3 p-2 rounded-lg bg-[var(--stg-border)] hover:opacity-80 text-[var(--stg-text-muted)] hover:text-[var(--stg-text)] transition-opacity cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <div className="flex flex-1 min-w-0 items-center gap-2">
            {user ? (
              <button
                onClick={() => {
                  logout();
                  if (onShowToast) onShowToast(language === 'he' ? 'התנתקת מהחשבון' : 'Logged out', 'info');
                  onClose();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--stg-destructive-soft)] hover:opacity-80 text-[var(--stg-destructive)] font-semibold text-xs transition-opacity cursor-pointer min-h-[48px]"
                title={language === 'he' ? 'התנתקות מהחשבון' : 'Sign Out'}
                id="account-modal-signout-btn"
              >
                <span>{language === 'he' ? 'התנתקות' : 'Sign Out'}</span>
              </button>
            ) : (
              onOpenAuth && (
                <button
                  onClick={() => { onClose(); onOpenAuth(); }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--stg-accent-soft)] hover:opacity-80 text-[var(--stg-accent)] font-semibold text-xs transition-opacity cursor-pointer min-h-[48px]"
                >
                  <span>{language === 'he' ? 'התחברות' : 'Sign In'}</span>
                </button>
              )
            )}

          </div>
        </div>

        {/* One scrolling page. This used to be a six-item rail beside a
            single visible section — a second navigation inside what is already
            a tab destination. */}
          <div className="text-xs text-[var(--stg-text)] max-h-[60vh] overflow-y-auto p-5 sm:p-6">
            {sections}
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
            className="sm:hidden px-3.5 py-2 rounded-lg bg-[var(--stg-destructive-soft)] hover:opacity-80 text-[var(--stg-destructive)] font-bold text-xs transition-opacity cursor-pointer min-h-[48px]"
          >
            {language === 'he' ? 'התנתקות מהחשבון' : 'Sign Out'}
          </button>

          <span className="hidden sm:inline text-xs text-[var(--stg-text-muted)]">
            {language === 'he' ? `Deliveree v${APP_VERSION} • אבטחת מידע Zero-Trust` : `Deliveree v${APP_VERSION} • Zero-Trust Privacy`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-[var(--stg-border)] hover:opacity-80 text-[var(--stg-text)] font-bold text-xs transition-opacity cursor-pointer min-h-[48px]"
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
