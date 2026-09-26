import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Star, Trash2, Bug, Lightbulb, Heart, RefreshCw, CloudOff, Cloud, AlertTriangle, ShieldCheck, BarChart3, Activity, Download, Cpu, Search, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../constants/admin';
import { APP_VERSION } from '../constants/version';
import {
  fetchAllFeedback,
  mergeFeedbackSources,
  getLocalFeedbackHistory,
  computeFeedbackAnalytics,
  LOCAL_FEEDBACK_HISTORY_KEY
} from '../services/feedbackService';
import { fetchAllCrashReports, groupCrashReports } from '../services/crashReportService';
import { fetchAllParseCorrections, computeParseCorrectionStats } from '../services/parseCorrectionService';
import { fetchAllSmartImportAttempts, computeSmartImportMissRateStats } from '../services/smartImportAttemptService';
import { fetchFeatureAdoptionStats, computeAdoptionSummary } from '../services/featureAdoptionStatsService';
import { syncQueueService, computeSyncQueueHealth } from '../services/syncQueueService';
import { getAppCheckDiagnostic, whenAppCheckSettled } from '../services/firebase';
import { AdminScreenshotLightbox } from './AdminScreenshotLightbox.jsx';
import { Modal } from './Modal.jsx';
import { downloadBlob } from '../utils/exportUtils';

/**
 * Turns an App Check status into something readable on a phone.
 *
 * The console warnings this mirrors need a desktop browser, and App Check's
 * own failure mode is silence — so this is the only place the difference
 * between "working" and "configured but rejected" is visible on a device.
 *
 * @param {string} state one of the states getAppCheckDiagnostic reports
 * @param {string} language 'he' | 'en'
 * @returns {{label: string, tone: string, nextStep: string}}
 */
export function describeAppCheck(state, language) {
  const he = language === 'he';
  switch (state) {
    case 'token-ok':
      return {
        label: he ? 'מאומת' : 'Verified',
        tone: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
        nextStep: he
          ? 'הבקשות מהמכשיר הזה נחתמות. מונה ה-Verified בקונסולה אמור לעלות.'
          : 'Requests from this device are signed. The console\'s Verified count should climb.'
      };
    case 'no-token':
      return {
        label: he ? 'המפתח נדחה' : 'Key rejected',
        tone: 'bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300',
        nextStep: he
          ? 'המפתח הגיע לבנייה אבל reCAPTCHA דחה אותו. בדוק שהמפתח שייך לפרויקט הזה ושהדומיין שלמטה מופיע ברשימת הדומיינים המורשים שלו.'
          : 'The key reached the build but reCAPTCHA rejected it. Check that the key belongs to this Firebase project and that the hostname below is on its allowed-domains list.'
      };
    case 'init-failed':
      return {
        label: he ? 'האתחול נכשל' : 'Init failed',
        tone: 'bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300',
        nextStep: he
          ? 'initializeAppCheck זרק שגיאה — פירוט למטה.'
          : 'initializeAppCheck threw — details below.'
      };
    case 'checking':
      return {
        label: he ? 'בבדיקה…' : 'Checking…',
        tone: 'bg-slate-800 border border-slate-700 text-slate-300',
        nextStep: he ? 'בקשת אסימון בדרך.' : 'A token request is in flight.'
      };
    default:
      return {
        label: he ? 'לא מוגדר' : 'Not configured',
        tone: 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300',
        nextStep: he
          ? 'מפתח ה-reCAPTCHA לא הגיע לבנייה הזו — בדוק את משתנה המאגר VITE_RECAPTCHA_V3_SITE_KEY ב-GitHub. עד אז לכתיבות ללא הזדהות, כמו /feedback, אין הגנה מפני בוטים.'
          : 'The reCAPTCHA key did not reach this build — check the VITE_RECAPTCHA_V3_SITE_KEY repository variable on GitHub. Until it does, unauthenticated writes like /feedback have no bot protection.'
      };
  }
}

export function AdminDashboardModal({
  isOpen,
  onClose,
  onShowToast
}) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [activeTab, setActiveTab] = useState('trends'); // 'trends' | 'feedback' | 'crashes' | 'parser' | 'adoption' | 'system'
  
  // Data states
  const [localFeedbacks, setLocalFeedbacks] = useState(() => getLocalFeedbackHistory());
  const [cloudFeedbacks, setCloudFeedbacks] = useState([]);
  const [crashReports, setCrashReports] = useState([]);
  const [parseCorrections, setParseCorrections] = useState([]);
  const [smartImportAttempts, setSmartImportAttempts] = useState([]);
  const [adoptionStats, setAdoptionStats] = useState([]);

  // This device's own offline sync queue health (see syncQueueService.js —
  // there is no cross-device aggregation for this today, just a live local
  // read, refreshed whenever the queue changes via the service's own
  // subscribe() — same live-status mechanism the online/offline banner
  // elsewhere in the app already uses).
  const [syncQueueHealth, setSyncQueueHealth] = useState(() =>
    computeSyncQueueHealth(syncQueueService.getQueue(), syncQueueService.getDeadLetterQueue())
  );
  // The dead-lettered mutations themselves, not just the count. Each one is a
  // change the user made that never reached the cloud: retryDeadLetterMutation
  // existed but nothing called it, so they were unrecoverable and invisible.
  const [deadLetters, setDeadLetters] = useState(() => syncQueueService.getDeadLetterQueue());
  useEffect(() => {
    const refresh = () => {
      setSyncQueueHealth(computeSyncQueueHealth(syncQueueService.getQueue(), syncQueueService.getDeadLetterQueue()));
      setDeadLetters(syncQueueService.getDeadLetterQueue());
    };
    const unsubscribe = syncQueueService.subscribe(refresh);
    refresh();
    return unsubscribe;
  }, []);

  const handleRetryDeadLetter = useCallback((mutationId) => {
    const requeued = syncQueueService.retryDeadLetterMutation(mutationId);
    onShowToast?.(
      requeued
        ? (language === 'he' ? 'השינוי הוחזר לתור הסנכרון' : 'Change re-queued for sync')
        : (language === 'he' ? 'השינוי כבר לא בתור' : 'That change is no longer queued'),
      requeued ? 'success' : 'info'
    );
  }, [language, onShowToast]);
  
  // App Check, read from the client that actually runs it (see firebase.js).
  // Re-read on every open: the startup token request may still have been in
  // flight the first time this mounted.
  const [appCheck, setAppCheck] = useState(() => getAppCheckDiagnostic());
  useEffect(() => {
    if (!isOpen) return undefined;
    let alive = true;
    setAppCheck(getAppCheckDiagnostic());
    whenAppCheckSettled().then((status) => {
      if (alive) setAppCheck(status);
    });
    return () => { alive = false; };
  }, [isOpen]);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [cloudError, setCloudError] = useState(null);

  // Filters for feedback tab
  const [feedbackFilterType, setFeedbackFilterType] = useState('all'); // 'all' | 'bug' | 'feature' | 'praise'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRating, setSelectedRating] = useState('all');

  // Two-step confirm for clearing the local buffer (it cannot be undone).
  const [confirmingClear, setConfirmingClear] = useState(false);

  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState(null);

  // Combined feedback
  const allFeedbacks = useMemo(() => {
    return mergeFeedbackSources(cloudFeedbacks, localFeedbacks);
  }, [cloudFeedbacks, localFeedbacks]);

  // Analytics computation
  const feedbackAnalytics = useMemo(() => {
    return computeFeedbackAnalytics(allFeedbacks);
  }, [allFeedbacks]);

  // Crash grouping
  const crashGroups = useMemo(() => {
    return groupCrashReports(crashReports);
  }, [crashReports]);

  // Parser stats
  const parserStats = useMemo(() => {
    return computeParseCorrectionStats(parseCorrections);
  }, [parseCorrections]);

  // Smart Import miss-rate stats (the denominator parserStats can't provide
  // on its own — see smartImportAttemptService.js)
  const missRateStats = useMemo(() => {
    return computeSmartImportMissRateStats(smartImportAttempts);
  }, [smartImportAttempts]);

  // Feature adoption summary (trailing 30 days, see featureAdoptionStatsService.js)
  const adoptionSummary = useMemo(() => {
    return computeAdoptionSummary(adoptionStats);
  }, [adoptionStats]);

  // Fetch all cloud telemetry
  const loadAllTelemetry = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setCloudError(null);

    try {
      const [feedbackRes, crashRes, parserRes, missRateRes, adoptionRes] = await Promise.all([
        fetchAllFeedback(),
        fetchAllCrashReports(),
        fetchAllParseCorrections(),
        fetchAllSmartImportAttempts(),
        fetchFeatureAdoptionStats()
      ]);

      if (feedbackRes.ok) setCloudFeedbacks(feedbackRes.items);
      if (crashRes.ok) setCrashReports(crashRes.items);
      if (parserRes.ok) setParseCorrections(parserRes.items);
      if (missRateRes.ok) setSmartImportAttempts(missRateRes.items);
      if (adoptionRes.ok) setAdoptionStats(adoptionRes.items);

      if (!feedbackRes.ok && !crashRes.ok) {
        setCloudError(feedbackRes.error || crashRes.error || 'Failed to load cloud telemetry');
      }
    } catch (err) {
      console.warn('[AdminDashboard] Telemetry fetch error:', err);
      setCloudError(err?.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isOpen && isAdmin) {
      loadAllTelemetry();
    }
  }, [isOpen, isAdmin, loadAllTelemetry]);

  if (!isOpen) return null;

  // Filtered feedbacks
  const filteredFeedbacks = allFeedbacks.filter(fb => {
    if (feedbackFilterType !== 'all' && fb.type !== feedbackFilterType) return false;
    if (selectedRating !== 'all' && Number(fb.rating) !== Number(selectedRating)) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const msg = (fb.message || '').toLowerCase();
      const id = (fb.id || '').toLowerCase();
      const version = (fb.appVersion || '').toLowerCase();
      if (!msg.includes(query) && !id.includes(query) && !version.includes(query)) return false;
    }
    return true;
  });

  const handleClearLocalBuffer = () => {
    setConfirmingClear(false);
    localStorage.removeItem(LOCAL_FEEDBACK_HISTORY_KEY);
    setLocalFeedbacks([]);
    if (onShowToast) {
      onShowToast(
        language === 'he' ? 'היסטוריית המשובים המקומית נוקתה' : 'Local feedback buffer cleared',
        'info'
      );
    }
  };

  const handleExportFeedbacksCSV = () => {
    const csvRows = allFeedbacks.map(fb => [
      `"${fb.id || ''}"`,
      `"${fb.type || ''}"`,
      `"${fb.rating || ''}"`,
      `"${(fb.message || '').replace(/"/g, '""')}"`,
      `"${fb.appVersion || ''}"`,
      `"${fb.timestamp || ''}"`,
      `"${fb.screenWidth}x${fb.screenHeight}"`
    ]);
    const header = '"ID","Type","Rating","Message","AppVersion","Timestamp","ScreenSize"';
    const csvContent = '\uFEFF' + [header, ...csvRows.map(r => r.join(','))].join('\r\n');
    downloadBlob(csvContent, 'text/csv;charset=utf-8;', `spotli_feedbacks_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportFeedbacksJSON = () => {
    const jsonStr = JSON.stringify(allFeedbacks, null, 2);
    downloadBlob(jsonStr, 'application/json;charset=utf-8;', `spotli_feedbacks_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleExportCrashesJSON = () => {
    const jsonStr = JSON.stringify(crashReports, null, 2);
    downloadBlob(jsonStr, 'application/json;charset=utf-8;', `spotli_crashes_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const he = language === 'he';
  const formatWhen = (value) => {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(he ? 'he-IL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  };
  const FEEDBACK_TYPE_LABEL = {
    bug: he ? 'תקלה' : 'Bug',
    feature: he ? 'הצעה' : 'Idea',
    praise: he ? 'שבח' : 'Praise'
  };
  const tabs = [
    { id: 'trends', icon: BarChart3, label: he ? 'מגמות ואיכות' : 'Overview & Trends', short: he ? 'סקירה' : 'Trends', accent: 'indigo' },
    { id: 'feedback', icon: MessageSquare, label: he ? 'משובי בודקים' : 'User Feedback', short: he ? 'משובים' : 'Feedback', accent: 'indigo', count: allFeedbacks.length },
    { id: 'crashes', icon: AlertTriangle, label: he ? 'ניטור קריסות' : 'Crash Monitor', short: he ? 'קריסות' : 'Crashes', accent: 'orange', count: crashGroups.length },
    { id: 'parser', icon: Cpu, label: he ? 'פיענוח חכם' : 'Smart Parser', short: he ? 'פיענוח' : 'Parser', accent: 'blue', count: parseCorrections.length },
    { id: 'adoption', icon: Activity, label: he ? 'אימוץ תכונות' : 'Feature Adoption', short: he ? 'אימוץ' : 'Usage', accent: 'purple' },
    { id: 'system', icon: Download, label: he ? 'ייצוא ומערכת' : 'Export & System', short: he ? 'מערכת' : 'System', accent: 'emerald' }
  ];
  const ACTIVE_TAB_TONE = {
    indigo: 'text-indigo-700 dark:text-indigo-300 border-indigo-600 dark:border-indigo-400',
    orange: 'text-orange-700 dark:text-orange-300 border-orange-600 dark:border-orange-400',
    blue: 'text-blue-700 dark:text-blue-300 border-blue-600 dark:border-blue-400',
    purple: 'text-purple-700 dark:text-purple-300 border-purple-600 dark:border-purple-400',
    emerald: 'text-emerald-700 dark:text-emerald-300 border-emerald-600 dark:border-emerald-400'
  };

  // Shown in place of a "nothing here" message whenever the cloud read
  // failed: an empty list after a failed fetch is not evidence of health.
  const cloudUnavailableNotice = (
    <div className="text-center py-12 space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800">
      <CloudOff className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" aria-hidden="true" />
      <p className="text-xs font-semibold text-slate-300">
        {he ? 'לא ניתן לטעון נתונים מהענן — אין כאן מידע על מצב האפליקציה.' : 'Could not load cloud data — this tells you nothing about app health.'}
      </p>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // The lightbox answers its own Escape; don't close the dashboard under it.
        if (!lightboxImage) onClose();
      }}
      labelledBy="admin-dashboard-title"
      componentName="AdminDashboardModal"
      className="w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col"
    >
        {/* Header — one compact row; on a phone every pixel here is a pixel
            the data does not get. */}
        <div className="px-4 py-3 sm:px-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shrink-0" aria-hidden="true">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="admin-dashboard-title" className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2 min-w-0">
                <span className="truncate">{he ? 'מרכז ניהול' : 'Admin Center'}</span>
                <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/30 shrink-0">
                  <bdi dir="ltr">v{APP_VERSION}</bdi>
                </span>
              </h2>
              <p className="hidden sm:block text-xs text-slate-400 truncate">
                {he ? 'מעקב תקלות, דוחות קריסה, חוויית משתמש וביצועי מנוע הפיענוח' : 'Issue trends, crash reports, UX satisfaction & smart parser telemetry'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={loadAllTelemetry}
                disabled={isLoading}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center disabled:opacity-50"
                title={he ? 'רענן נתונים מהענן' : 'Refresh cloud data'}
                aria-label={he ? 'רענן' : 'Refresh'}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
              aria-label={he ? 'חזרה' : 'Back'}
              title={he ? 'חזרה' : 'Back'}
            >
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Status line */}
        <div className="px-4 sm:px-6 py-2 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs gap-x-3 gap-y-1 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {isAdmin ? (
              cloudError ? (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
                  <span className="text-rose-700 dark:text-rose-300 font-medium">
                    {he
                      ? `אין חיבור לענן (${cloudError}) — מוצגים נתוני מכשיר זה בלבד`
                      : `Cloud unavailable (${cloudError}) — showing this device only`}
                  </span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                    {isLoading
                      ? (he ? 'טוען מהענן…' : 'Loading from cloud…')
                      : (he
                        ? `מחובר לענן · ${cloudFeedbacks.length} משובים · ${crashReports.length} קריסות · ${parseCorrections.length} תיקוני פיענוח`
                        : `Cloud · ${cloudFeedbacks.length} feedback · ${crashReports.length} crashes · ${parseCorrections.length} parse fixes`)}
                  </span>
                </>
              )
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  {he
                    ? 'תצוגת מכשיר מקומית — נדרש חשבון מנהל מאומת לגישה לנתוני הענן.'
                    : 'Local device view — a verified admin account is needed for cloud data.'}
                </span>
              </>
            )}
          </div>
          <span className="text-slate-400 truncate max-w-full">
            <bdi dir="ltr" className="sm:hidden">v{APP_VERSION} · </bdi>
            {user?.email || (he ? 'משתמש אורח' : 'Guest')}
          </span>
        </div>

        {/* Tabs — all six fit on a 360px phone (icon over a short label);
            full labels from sm up. */}
        <div
          role="tablist"
          aria-label={he ? 'לשוניות מרכז ניהול' : 'Admin Telemetry Tabs'}
          className="grid grid-cols-6 sm:flex sm:items-center sm:gap-2 px-1 sm:px-6 pt-1 sm:pt-3 border-b border-slate-800 overflow-x-auto overflow-y-hidden shrink-0"
        >
          {tabs.map(({ id, icon: Icon, label, short, accent, count }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`admin-tab-${id}`}
                aria-selected={active}
                aria-controls={`admin-panel-${id}`}
                aria-label={count !== undefined ? `${label} (${count})` : label}
                onClick={() => setActiveTab(id)}
                className={`relative px-0 sm:px-3.5 py-1.5 sm:py-2.5 text-[11px] tracking-tight sm:tracking-normal sm:text-xs font-bold rounded-t-xl transition-ui cursor-pointer min-h-[48px] min-w-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap border-b-2 ${
                  active
                    ? `bg-slate-800/90 ${ACTIVE_TAB_TONE[accent]}`
                    : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
                <span className="sm:hidden truncate max-w-full">{short}</span>
                <span className="hidden sm:inline">{label}</span>
                {count !== undefined && count > 0 && (
                  <span className="absolute top-0.5 end-0.5 sm:static text-[10px] sm:text-xs leading-none px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content Viewport */}
        <div
          role="tabpanel"
          id={`admin-panel-${activeTab}`}
          aria-labelledby={`admin-tab-${activeTab}`}
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 text-slate-200 space-y-6"
        >
          {/* TAB 1: OVERVIEW & TRENDS */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              {/* Scorecard KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* CSAT Rating */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>{language === 'he' ? 'ציון חוויית משתמש (CSAT)' : 'Avg UX Rating'}</span>
                    <Star className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 flex items-baseline gap-1">
                    <span>{feedbackAnalytics.averageRating || '—'}</span>
                    <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {feedbackAnalytics.total} {language === 'he' ? 'דירוגים שנאספו' : 'total ratings collected'}
                  </div>
                </div>

                {/* Bug Volume */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>{language === 'he' ? 'תקלות שדווחו' : 'Reported Bugs'}</span>
                    <Bug className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                    {feedbackAnalytics.bugCount}
                  </div>
                  <div className="text-xs text-slate-400">
                    {feedbackAnalytics.total > 0
                      ? `${Math.round((feedbackAnalytics.bugCount / feedbackAnalytics.total) * 100)}% ${language === 'he' ? 'מכלל המשובים' : 'of feedback'}`
                      : '0%'}
                  </div>
                </div>

                {/* Crash Count */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>{language === 'he' ? 'סוגי קריסות (ייחודיים)' : 'Unique Crashes'}</span>
                    <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-orange-600 dark:text-orange-400">
                    {crashGroups.length}
                  </div>
                  <div className="text-xs text-slate-400">
                    {crashReports.length} {language === 'he' ? 'מופעי קריסה סה״כ' : 'total crash instances'}
                  </div>
                </div>

                {/* Ideas & Praise */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>{language === 'he' ? 'הצעות ושבחים' : 'Ideas & Praise'}</span>
                    <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {feedbackAnalytics.featureCount + feedbackAnalytics.praiseCount}
                  </div>
                  <div className="text-xs text-slate-400">
                    {feedbackAnalytics.featureCount} 💡 {language === 'he' ? 'הצעות' : 'ideas'} • {feedbackAnalytics.praiseCount} ❤️ {language === 'he' ? 'שבחים' : 'praise'}
                  </div>
                </div>
              </div>

              {/* Version by Version Comparison */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{language === 'he' ? 'השוואת איכות לפי גרסאות אפליקציה' : 'Quality Trends by App Version'}</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    {language === 'he' ? 'מדידת ירידה בכמות התקלות בין שחרורים' : 'Measuring issue reduction across releases'}
                  </span>
                </div>

                {feedbackAnalytics.versionTrends.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    {language === 'he' ? 'אין עדיין מספיק נתונים להשוואה לפי גרסאות' : 'Not enough versioned data yet'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {feedbackAnalytics.versionTrends.map((vt) => (
                      <div key={vt.version} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 text-xs px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            v{vt.version}
                          </span>
                          <span className="text-xs text-slate-300">
                            {vt.total} {language === 'he' ? 'משובים' : 'submissions'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                            <Bug className="w-3.5 h-3.5" aria-hidden="true" /> {vt.bug}
                          </span>
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                            <Lightbulb className="w-3.5 h-3.5" /> {vt.feature}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Heart className="w-3.5 h-3.5" /> {vt.praise}
                          </span>
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                            ⭐ {vt.avgRating}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weekly Trends Timeline */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{language === 'he' ? 'ציר זמן שבועי: תקלות מול שיפורים' : 'Weekly Issue & Sentiment Timeline'}</span>
                </h3>
                <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap" aria-hidden="true">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" />{he ? 'תקלות' : 'Bugs'}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />{he ? 'הצעות' : 'Ideas'}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{he ? 'שבחים' : 'Praise'}</span>
                </div>

                {feedbackAnalytics.weeklyTrends.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    {language === 'he' ? 'אין נתוני ציר זמן שבועי' : 'No weekly trend data available'}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {feedbackAnalytics.weeklyTrends.map((wt) => (
                      <div key={wt.week} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{wt.label}</span>
                          <span>{wt.total} {language === 'he' ? 'דיווחים' : 'reports'} • ⭐ {wt.avgRating}</span>
                        </div>
                        <div className="h-4 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                          {wt.bug > 0 && (
                            <div
                              style={{ width: `${(wt.bug / wt.total) * 100}%` }}
                              className="bg-rose-500 h-full"
                              title={`${wt.bug} bugs`}
                            />
                          )}
                          {wt.feature > 0 && (
                            <div
                              style={{ width: `${(wt.feature / wt.total) * 100}%` }}
                              className="bg-blue-500 h-full"
                              title={`${wt.feature} features`}
                            />
                          )}
                          {wt.praise > 0 && (
                            <div
                              style={{ width: `${(wt.praise / wt.total) * 100}%` }}
                              className="bg-emerald-500 h-full"
                              title={`${wt.praise} praise`}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: USER FEEDBACK */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                {/* Type Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-1 sm:pb-0">
                  {['all', 'bug', 'feature', 'praise'].map((type) => (
                    <button
                      type="button"
                      aria-pressed={feedbackFilterType === type}
                      key={type}
                      onClick={() => setFeedbackFilterType(type)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-ui cursor-pointer min-h-[48px] whitespace-nowrap ${
                        feedbackFilterType === type
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {type === 'all' ? (language === 'he' ? 'הכל' : 'All') :
                       type === 'bug' ? (language === 'he' ? 'תקלות 🐞' : 'Bugs 🐞') :
                       type === 'feature' ? (language === 'he' ? 'הצעות 💡' : 'Ideas 💡') :
                       (language === 'he' ? 'שבחים ❤️' : 'Praise ❤️')}
                    </button>
                  ))}
                </div>

                {/* Search and Star Filter */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative flex-1 min-w-0 sm:w-48">
                    <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="search"
                      aria-label={he ? 'חיפוש משובים' : 'Search feedback'}
                      placeholder={language === 'he' ? 'חיפוש בתוכן...' : 'Search feedback...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl ps-9 pe-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 min-h-[48px]"
                    />
                  </div>

                  <select
                    value={selectedRating}
                    onChange={(e) => setSelectedRating(e.target.value)}
                    aria-label={he ? 'סינון לפי דירוג' : 'Filter by rating'}
                    className="w-32 shrink-0 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer min-h-[48px]"
                  >
                    <option value="all">{language === 'he' ? 'כל הדירוגים' : 'All stars'}</option>
                    <option value="5">5 ★</option>
                    <option value="4">4 ★</option>
                    <option value="3">3 ★</option>
                    <option value="2">2 ★</option>
                    <option value="1">1 ★</option>
                  </select>
                </div>
              </div>

              {/* Feedback List */}
              {isLoading && allFeedbacks.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto animate-spin" />
                  <p className="text-xs text-slate-400">{language === 'he' ? 'טוען משובים...' : 'Loading feedback...'}</p>
                </div>
              ) : allFeedbacks.length === 0 && cloudError ? (
                cloudUnavailableNotice
              ) : filteredFeedbacks.length === 0 ? (
                <div className="text-center py-12 space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-400">
                    {language === 'he' ? 'לא נמצאו משובים התואמים לסינון' : 'No matching feedback found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFeedbacks.map((fb, idx) => (
                    <div key={fb.id || idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg text-xs ${
                            fb.type === 'bug' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                            fb.type === 'feature' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {fb.type === 'bug' ? <Bug className="w-3.5 h-3.5" /> : fb.type === 'feature' ? <Lightbulb className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                          </span>
                          <span className="font-bold text-slate-200 text-xs">{FEEDBACK_TYPE_LABEL[fb.type] || fb.type}</span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400" /> {fb.rating}/5
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          <bdi dir="auto">{formatWhen(fb.timestamp)}</bdi>
                        </span>
                      </div>

                      <p className="text-xs text-slate-100 bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 leading-relaxed whitespace-pre-wrap">
                        {fb.message}
                      </p>

                      {/* Screenshot Thumbnail with Lightbox trigger */}
                      {fb.screenshot && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setLightboxImage(fb.screenshot)}
                            className="group relative block rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-500/50 transition-ui cursor-pointer max-w-sm text-start"
                          >
                            <img
                              src={fb.screenshot}
                              alt={he ? 'צילום מסך מהבודק' : 'Tester screenshot'}
                              loading="lazy"
                              className="w-full max-h-48 object-contain bg-slate-900 group-hover:opacity-90 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                              {language === 'he' ? 'לחץ לצפייה בגודל מלא' : 'Click for full size'}
                            </div>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 flex-wrap gap-2">
                        <span className="truncate flex items-center gap-1.5">
                          {he ? 'בודק אנונימי' : 'Anonymous tester'}
                          {fb.source === 'cloud' && (
                            <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" aria-label={he ? 'מהענן' : 'From cloud'} />
                          )}
                        </span>
                        <span><bdi dir="ltr">{fb.screenWidth}×{fb.screenHeight} · v{fb.appVersion || APP_VERSION}</bdi></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CRASH MONITOR */}
          {activeTab === 'crashes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span>{language === 'he' ? 'דוחות קריסה מקובצים לפי חתימת תקלה' : 'Crash Reports Grouped by Error Signature'}</span>
                </span>
                <span className="text-xs text-slate-400 font-mono shrink-0">
                  {crashReports.length} {language === 'he' ? 'סך מופעים' : 'total events'}
                </span>
              </div>

              {isLoading && crashGroups.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto animate-spin" aria-hidden="true" />
                  <p className="text-xs text-slate-400">{he ? 'טוען דוחות קריסה...' : 'Loading crash reports...'}</p>
                </div>
              ) : crashGroups.length === 0 && cloudError ? (
                cloudUnavailableNotice
              ) : crashGroups.length === 0 ? (
                <div className="text-center py-12 space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">
                    {language === 'he' ? 'אפס קריסות מדווחות! האפליקציה יציבה.' : 'Zero crashes reported! App is healthy.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {crashGroups.map((group) => (
                    <div key={group.signature} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="p-1.5 rounded-lg text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold">
                            {group.componentName || 'General'}
                          </span>
                          <span className="text-orange-600 dark:text-orange-400 font-bold text-xs px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                            {group.count}× {language === 'he' ? 'מופעים' : 'occurrences'}
                          </span>
                          {group.sessionCount > 0 && (
                            <span
                              className="text-rose-700 dark:text-rose-300 font-bold text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20"
                              title={language === 'he' ? 'הבחנה בין סשן אחד שקרס שוב ושוב לבין הרבה משתמשים שנפגעו' : 'Distinct sessions hit, not raw occurrences — see crashReportService.js'}
                            >
                              {group.sessionCount} {language === 'he' ? 'סשנים ייחודיים' : 'unique sessions'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {language === 'he' ? 'נצפה לאחרונה:' : 'Last seen:'} <bdi dir="auto">{formatWhen(group.lastSeen)}</bdi>
                        </span>
                      </div>

                      <p className="text-xs text-rose-700 dark:text-rose-300 bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                        {group.message}
                      </p>

                      <div className="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap text-xs text-slate-400 pt-1">
                        <span className="font-mono break-all"><bdi dir="ltr">{group.signature}</bdi></span>
                        <span><bdi dir="ltr">v{group.appVersion || APP_VERSION}</bdi></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SMART PARSER */}
          {activeTab === 'parser' && (
            <div className="space-y-6">
              {/* Miss rate: the actual quality metric — what fraction of Smart
                  Import saves needed a manual fix, out of every save attempt,
                  not just the ones that got corrected. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">{language === 'he' ? 'סה״כ ניסיונות ייבוא חכם' : 'Total Smart Import Attempts'}</span>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{missRateStats.total}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">{language === 'he' ? 'אחוז שדרשו תיקון' : 'Needed a Correction'}</span>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {missRateStats.total > 0 ? `${Math.round(missRateStats.missRate * 100)}%` : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">{language === 'he' ? 'ללא תיקון' : 'Clean Saves'}</span>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {missRateStats.total > 0 ? `${Math.round((1 - missRateStats.missRate) * 100)}%` : '—'}
                  </div>
                </div>
              </div>

              {Object.keys(missRateStats.perCarrier).length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{language === 'he' ? 'אחוז תיקונים לפי מוביל' : 'Miss Rate by Carrier'}</span>
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(missRateStats.perCarrier)
                      .sort(([, a], [, b]) => b.missRate - a.missRate)
                      .map(([carrier, counts]) => (
                        <div key={carrier} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span className="font-mono font-semibold">{carrier}</span>
                            <span>{Math.round(counts.missRate * 100)}% ({counts.corrected}/{counts.total})</span>
                          </div>
                          <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              style={{ width: `${Math.round(counts.missRate * 100)}%` }}
                              className="bg-amber-500 h-full rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">{language === 'he' ? 'סה״כ תיקוני משתמשים' : 'Total User Corrections'}</span>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{parserStats.total}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">{language === 'he' ? 'מקור הפיענוח: Regex' : 'Source: Regex'}</span>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{parserStats.sourceBreakdown.regex}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">{language === 'he' ? 'מקור הפיענוח: Gemini AI' : 'Source: Gemini AI'}</span>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{parserStats.sourceBreakdown.ai}</div>
                </div>
              </div>

              {/* Field breakdown */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{language === 'he' ? 'שדות שתוקנו הכי הרבה על ידי משתמשים' : 'Most Frequently Corrected Fields'}</span>
                </h3>

                {Object.keys(parserStats.fieldBreakdown).length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    {cloudError
                      ? (he ? 'לא ניתן לטעון נתונים מהענן' : 'Could not load cloud data')
                      : (language === 'he' ? 'אין נתוני תיקוני פיענוח עדיין' : 'No parse corrections recorded yet')}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(parserStats.fieldBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([field, count]) => (
                        <div key={field} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span className="font-mono font-semibold">{field}</span>
                            <span>{count} {language === 'he' ? 'פעמים' : 'times'}</span>
                          </div>
                          <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              style={{ width: `${Math.min(100, (count / Math.max(1, parserStats.total)) * 100)}%` }}
                              className="bg-blue-500 h-full rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: FEATURE ADOPTION */}
          {activeTab === 'adoption' && (
            <div className="space-y-6">
              <p className="text-xs text-slate-500">
                {language === 'he'
                  ? 'אחוז מבוסס על ימי-שימוש (לא משתמשים ייחודיים לאורך התקופה) — ראו הערת עיצוב ב-featureAdoptionStatsService.js'
                  : 'Rate is app-visit-days based, not true period-unique users — see the design note in featureAdoptionStatsService.js'}
              </p>

              {Object.keys(adoptionSummary).length === 0 ? (
                cloudError ? cloudUnavailableNotice : (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    {language === 'he' ? 'אין עדיין נתוני אימוץ תכונות' : 'No feature-adoption data yet'}
                  </p>
                )
              ) : (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>{language === 'he' ? 'אימוץ לפי תכונה (30 ימים אחרונים)' : 'Adoption by Feature (Trailing 30 Days)'}</span>
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(adoptionSummary)
                      .sort(([, a], [, b]) => b.adoptionRate - a.adoptionRate)
                      .map(([feature, counts]) => (
                        <div key={feature} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span className="font-mono font-semibold">{feature}</span>
                            <span>{Math.round(counts.adoptionRate * 100)}%</span>
                          </div>
                          <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              style={{ width: `${Math.min(100, Math.round(counts.adoptionRate * 100))}%` }}
                              className="bg-purple-500 h-full rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SYSTEM & EXPORT */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              {/* App Check — the only place this is visible without DevTools */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{language === 'he' ? 'מצב App Check (מכשיר זה)' : 'App Check Status (This Device)'}</span>
                </h3>
                {(() => {
                  const described = describeAppCheck(appCheck.state, language);
                  return (
                    <>
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${described.tone}`}>
                        {described.label}
                      </span>
                      <p className="text-xs text-slate-400 leading-relaxed">{described.nextStep}</p>
                      <p className="text-xs text-slate-500 leading-relaxed break-words font-mono">{appCheck.detail}</p>
                    </>
                  );
                })()}
              </div>

              {/* Offline sync queue health (this device only — see note above) */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <CloudOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{language === 'he' ? 'בריאות תור הסנכרון (מכשיר זה)' : 'Sync Queue Health (This Device)'}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">{language === 'he' ? 'ממתינים לסנכרון' : 'Pending Mutations'}</span>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{syncQueueHealth.pendingCount}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">{language === 'he' ? 'הישן ביותר ממתין' : 'Oldest Pending'}</span>
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {syncQueueHealth.oldestPendingAgeMs === null
                        ? '—'
                        : `${Math.round(syncQueueHealth.oldestPendingAgeMs / 60000)}m`}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">{language === 'he' ? 'נכשלו לצמיתות' : 'Dead-Lettered'}</span>
                    <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{syncQueueHealth.deadLetterCount}</div>
                  </div>
                </div>

                {/* Each of these is a change the user made that never reached
                    the cloud. Without a way back into the queue they are
                    simply lost, silently. */}
                {deadLetters.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {language === 'he'
                        ? 'שינויים שלא הגיעו לענן אחרי כל הניסיונות. אפשר להחזיר כל אחד לתור.'
                        : 'Changes that never reached the cloud after every retry. Each can be put back in the queue.'}
                    </p>
                    {deadLetters.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl bg-slate-900/80 border border-rose-500/20 space-y-2"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                            {entry.type}
                          </span>
                          <span className="text-xs text-slate-300 font-medium break-all">
                            {entry.payload?.title
                              || entry.payload?.trackingNumber
                              || entry.payload?.id
                              || entry.payload?.packageId
                              || (language === 'he' ? 'ללא שם' : 'Untitled')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 break-words font-mono">{entry.lastError}</p>
                        <button
                          onClick={() => handleRetryDeadLetter(entry.id)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 min-h-[48px]"
                        >
                          <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>{language === 'he' ? 'נסה שוב' : 'Retry'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Export Tools */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{language === 'he' ? 'ייצוא נתוני טלמטריה לניתוח חיצוני' : 'Export Telemetry Data for Offline Analysis'}</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {language === 'he'
                    ? 'הורדת קובצי CSV ו-JSON מלאים של כל המשובים ודוחות הקריסה לצורך ניתוח באקסל או BI.'
                    : 'Download complete CSV and JSON snapshots of all feedbacks and crash reports for spreadsheet or BI analysis.'}
                </p>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleExportFeedbacksCSV}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 min-h-[48px]"
                  >
                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{language === 'he' ? 'ייצא משובים (CSV)' : 'Export Feedback (CSV)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportFeedbacksJSON}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 min-h-[48px]"
                  >
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{language === 'he' ? 'ייצא משובים (JSON)' : 'Export Feedback (JSON)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCrashesJSON}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 min-h-[48px]"
                  >
                    <Download className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span>{language === 'he' ? 'ייצא קריסות (JSON)' : 'Export Crashes (JSON)'}</span>
                  </button>
                </div>
              </div>

              {/* Local Buffer Management */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>{language === 'he' ? 'ניהול זיכרון מטמון מקומי' : 'Local Device Buffer'}</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {language === 'he'
                    ? 'מנקה רק את היסטוריית המשובים שנשמרה בדפדפן זה. רשומות בענן נשמרות ללא שינוי.'
                    : 'Clears only feedback submissions buffered on this device. Cloud records remain immutable.'}
                </p>
                {confirmingClear ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearLocalBuffer}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer min-h-[48px]"
                    >
                      {he ? `כן, למחוק ${localFeedbacks.length} משובים מקומיים` : `Yes, delete ${localFeedbacks.length} local submissions`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer min-h-[48px]"
                    >
                      {he ? 'ביטול' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(true)}
                    disabled={localFeedbacks.length === 0}
                    className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors cursor-pointer min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {language === 'he' ? 'נקה זיכרון מקומי' : 'Clear Local Buffer'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Screenshot Lightbox Modal */}
      <AdminScreenshotLightbox
        isOpen={!!lightboxImage}
        imageSrc={lightboxImage}
        onClose={() => setLightboxImage(null)}
        language={language}
      />
    </Modal>
  );
}
