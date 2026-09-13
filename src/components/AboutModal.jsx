import React, { useState, useEffect } from 'react';
import { X, Sparkles, RefreshCw, ShieldCheck, Heart, CheckCircle2, Lock, Cpu, Award, Globe, Activity, AlertTriangle, XCircle, FileText, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { CARRIER_LIST } from '../types/carriers';
import { APP_VERSION, RELEASE_DATE, BUILD_CHANNEL } from '../constants/version';
import { runAllBistDiagnostics } from '../utils/bistDiagnostics';
const LegalDocumentModal = React.lazy(() => import('./LegalDocumentModal').then(module => ({ default: module.LegalDocumentModal })));
import { Modal } from './Modal';

export function AboutModal({
  isOpen,
  onClose,
  onOpenFeedback,
  onShowToast
}) {
  const { language, t } = useLanguage();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);
  const [bistResult, setBistResult] = useState(null);
  const [isRunningBist, setIsRunningBist] = useState(false);
  const [openLegalDoc, setOpenLegalDoc] = useState(null); // 'terms' | 'privacy' | null

  useEffect(() => {
    if (isOpen) {
      try {
        const initialReport = runAllBistDiagnostics();
        setBistResult(initialReport);
      } catch (err) {
        console.warn('[AboutModal] Initial BIST diagnostics failed:', err);
      }

      // Check if service worker is already waiting
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg && (reg.waiting || reg.installing)) {
            setIsUpdateReady(true);
          }
        }).catch(() => {});
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunSelfTest = () => {
    setIsRunningBist(true);
    setTimeout(() => {
      try {
        const report = runAllBistDiagnostics();
        setBistResult(report);
        if (onShowToast) {
          onShowToast(
            language === 'he'
              ? `בדיקת מערכת עצמית (BIST) הושלמה: ${report.status}`
              : `System BIST Diagnostics Complete: ${report.status}`,
            report.status === 'PASS' ? 'success' : 'error'
          );
        }
      } catch {
        if (onShowToast) {
          onShowToast(
            language === 'he' ? 'שגיאה בהרצת בדיקות מערכת' : 'Failed running system diagnostics',
            'error'
          );
        }
      } finally {
        setIsRunningBist(false);
      }
    }, 250);
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          if (registration.waiting || registration.installing) {
            setIsUpdateReady(true);
            if (onShowToast) {
              onShowToast(
                language === 'he'
                  ? 'גרסה חדשה של SpotLi זמינה! לחץ לרענון והחלת העדכון'
                  : 'New SpotLi update ready! Reload to apply.',
                'info'
              );
            }
          } else {
            if (onShowToast) {
              onShowToast(
                language === 'he'
                  ? `נבדקו עדכוני PWA. האפליקציה בגרסה העדכנית ביותר (v${APP_VERSION})!`
                  : `Checked for PWA updates. App is running the latest build (v${APP_VERSION})!`,
                'success'
              );
            }
          }
        } else {
          if (onShowToast) {
            onShowToast(
              language === 'he'
                ? `המערכת מעודכנת לגרסה האחרונה (v${APP_VERSION})`
                : `System is up to date (v${APP_VERSION})`,
              'info'
            );
          }
        }
      } else {
        if (onShowToast) {
          onShowToast(
            language === 'he'
              ? `המערכת מעודכנת לגרסה האחרונה (v${APP_VERSION})`
              : `System is up to date (v${APP_VERSION})`,
            'info'
          );
        }
      }
    } catch {
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'בדיקת העדכונים הושלמה' : 'Update check completed',
          'info'
        );
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleClearCacheAndForceRefresh = async () => {
    setIsForceRefreshing(true);
    try {
      if (typeof window !== 'undefined') {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
        }
        window.location.reload();
      }
    } catch (err) {
      console.warn('[AboutModal] Force refresh error:', err);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="AboutModal"
      overlayClassName="p-3 sm:p-4"
      labelledBy="about-modal-title"
      className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
    >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 shrink-0">
          <div className="flex flex-1 min-w-0 items-center gap-3">
            <div className="relative group shrink-0">
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 opacity-80 blur-sm group-hover:opacity-100 transition duration-500" />
              <div className="relative w-11 h-11 rounded-2xl bg-slate-950 border border-slate-700/80 flex items-center justify-center overflow-hidden shadow-md">
                <img
                  src="/icons/app-icon.png"
                  alt="SpotLi"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="about-modal-title" className="text-base sm:text-lg font-black tracking-tight text-slate-100">
                  {t('appTitle')}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 uppercase tracking-wider">
                  <bdi dir="ltr">v{APP_VERSION}</bdi>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {t('appTagline')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="order-first me-3 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label={language === 'he' ? 'חזרה' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-300 pb-8">
          {/* Section 1: System Info & Version Banner */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-100">
                  {language === 'he' ? 'גרסת מערכת' : 'System Build'}:
                </span>
                <span className="font-mono text-xs text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                  <bdi dir="ltr">{APP_VERSION}</bdi>
                </span>
                <span className="text-xs text-slate-400">
                  <bdi dir="ltr">({RELEASE_DATE})</bdi>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase font-semibold">
                  <bdi dir="ltr">{BUILD_CHANNEL}</bdi>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {language === 'he'
                  ? 'ארכיטקטורת React 19 + PWA מאובטחת לסנכרון ומעקב חבילות רב-ספקי.'
                  : 'React 19 + PWA zero-trust client architecture for multi-carrier tracking.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCheckForUpdates}
                disabled={isCheckingUpdate}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition-ui shadow-md shadow-blue-600/20 cursor-pointer min-h-[48px] shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                <span>
                  {isCheckingUpdate
                    ? (language === 'he' ? 'בודק עדכונים...' : 'Checking...')
                    : (language === 'he' ? 'בדוק עדכונים 🔄' : 'Check for Updates 🔄')}
                </span>
              </button>

              <button
                type="button"
                onClick={handleClearCacheAndForceRefresh}
                disabled={isForceRefreshing}
                title={language === 'he' ? 'נקה מטמון ורענן אפליקציה' : 'Clear Cache & Force Reload'}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 font-semibold text-xs border border-slate-700 transition-ui cursor-pointer min-h-[48px] shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${isForceRefreshing ? 'animate-spin' : ''}`} />
                <span>{language === 'he' ? 'איפוס מטמון 🧹' : 'Clear Cache 🧹'}</span>
              </button>
            </div>
          </div>

          {/* Update Available Banner within AboutModal */}
          {isUpdateReady && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-blue-500/40 flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                <div>
                  <span className="font-bold text-slate-100 block text-xs">
                    {language === 'he' ? 'גרסה חדשה מוכנה להתקנה!' : 'New Version Ready!'}
                  </span>
                  <span className="text-xs text-slate-300">
                    {language === 'he' ? 'עדכון תוכנה זמין. רענן את האפליקציה להחלת השינויים.' : 'Software update available. Refresh app to apply changes.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.reload();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-ui shadow-md cursor-pointer shrink-0 min-h-[48px]"
              >
                {language === 'he' ? 'רענן כעת' : 'Reload Now'}
              </button>
            </div>
          )}

          {/* Section 2: Interactive System Health & BIST Diagnostics */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {language === 'he' ? (
                    <>
                      <span>בדיקת תקינות מערכת</span>{' '}
                      <bdi dir="ltr" className="inline-block whitespace-nowrap">
                        (BIST Self-Test)
                      </bdi>
                    </>
                  ) : (
                    'System Health & Self-Test (BIST)'
                  )}
                </h3>
                {bistResult && (
                  <span
                    dir="ltr"
                    className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                      bistResult.status === 'PASS'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : bistResult.status === 'WARN'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {bistResult.status === 'PASS' && <CheckCircle2 className="w-3 h-3" />}
                    {bistResult.status === 'WARN' && <AlertTriangle className="w-3 h-3" />}
                    {bistResult.status === 'FAIL' && <XCircle className="w-3 h-3" />}
                    <span>{bistResult.status}</span>
                    <span>({bistResult.summary.passed}/{bistResult.summary.total})</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleRunSelfTest}
                disabled={isRunningBist}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs border border-slate-700 transition-ui cursor-pointer min-h-[48px]"
              >
                <Activity className={`w-3.5 h-3.5 ${isRunningBist ? 'animate-pulse text-emerald-400' : 'text-blue-400'}`} />
                <span>
                  {isRunningBist
                    ? (language === 'he' ? 'מבצע בדיקה...' : 'Testing...')
                    : (language === 'he' ? 'הרץ בדיקה עצמית 🩺' : 'Run Diagnostics 🩺')}
                </span>
              </button>
            </div>

            {bistResult && (
              <div className="grid grid-cols-1 gap-2 pt-1">
                {bistResult.checks.map((check) => (
                  <div
                    key={check.id}
                    className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {check.status === 'PASS' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : check.status === 'WARN' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-200 text-xs truncate" dir="ltr">
                          {check.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-tight" dir="ltr">
                        {check.message}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                        check.status === 'PASS'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : check.status === 'WARN'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Privacy & Security Architecture Badges */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{language === 'he' ? 'ארכיטקטורת אבטחה ופרטיות' : 'Privacy & Security Standards'}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-950/60 border border-emerald-500/20 rounded-2xl flex items-start gap-2.5">
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-100 block text-xs">OWASP ASVS L3</span>
                  <span className="text-xs text-slate-400 leading-tight block">
                    {language === 'he' ? 'עמידה בתקני אבטחת אפליקציות מחמירים' : 'Application security verification'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-blue-500/20 rounded-2xl flex items-start gap-2.5">
                <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-100 block text-xs">Zero-Trust Firestore</span>
                  <span className="text-xs text-slate-400 leading-tight block">
                    {language === 'he' ? 'בידוד נתונים מוחלט לכל משתמש' : 'Strict user data isolation rules'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-purple-500/20 rounded-2xl flex items-start gap-2.5">
                <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-100 block text-xs">Client-Side First</span>
                  <span className="text-xs text-slate-400 leading-tight block">
                    {language === 'he' ? 'אימות קלט קליינט וחישוב מקומי' : 'Safe local regex & offline caches'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Supported Carriers Grid (13+ carriers) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>{language === 'he' ? 'ספקי שילוח נתמכים' : 'Supported Carriers'}</span>
              </h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
                <bdi dir="ltr">{CARRIER_LIST.length}</bdi> {language === 'he' ? 'ספקים' : 'Carriers'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {CARRIER_LIST.map((carrier) => (
                <div
                  key={carrier.id}
                  className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 transition-colors flex items-center gap-2 min-h-[48px]"
                >
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${carrier.color || 'from-blue-500 to-indigo-500'} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-200 text-xs block truncate">
                      {language === 'he' ? (carrier.hebrewName || carrier.name) : carrier.name}
                    </span>
                    <span className="text-xs text-slate-400 block truncate">
                      {carrier.country || 'Global'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Release Highlights */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                {language === 'he' ? (
                  <>
                    <span>חידושים בגרסה</span> <bdi dir="ltr">{APP_VERSION}</bdi>
                  </>
                ) : (
                  <>
                    <span>Release Highlights</span> <bdi dir="ltr">({APP_VERSION})</bdi>
                  </>
                )}
              </span>
            </h3>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  {language === 'he'
                    ? 'בדיקת תקינות מערכת (BIST) אינטראקטיבית בזמן אמת לאחסון מקומי, זיהוי ספקים ומגבלות זיכרון.'
                    : 'Interactive live Built-in Self-Test (BIST) diagnostics for storage, carrier regex, and memory invariants.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  {language === 'he'
                    ? 'סנכרון ענן בזמן אמת עם Firebase Firestore ואבטחת נתונים לפי משתמש.'
                    : 'Real-time multi-device cloud synchronization with zero-trust Firestore security.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  {language === 'he'
                    ? 'תמיכה ב-13+ ספקי שילוח ישראליים ובינלאומיים (דואר ישראל, צ\'יטה, HFD, בוקסיט, קאיניאו, DHL, FedEx ועוד).'
                    : 'Support for 13+ domestic & international carriers (Israel Post, Cheetah, HFD, BoxIt, Cainiao, DHL, FedEx, etc.).'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  {language === 'he'
                    ? 'זיהוי חכם והדבקה מהירה של מספרי מעקב מתוך הודעות SMS ואימייל עם קריאת לוח אוטומטית.'
                    : 'Smart auto-clipboard reading & regex parsing for carrier tracking numbers and dates directly from SMS & receipts.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  {language === 'he'
                    ? 'תמיכה מלאה בהתקנת PWA ומעקב לא מקוון במובייל ודסקטופ עם ארגונומיית מגע מלאה (48px+).'
                    : 'PWA offline caching, installable experience, and safe-area touch ergonomics (>=48px touch targets).'}
                </span>
              </div>
            </div>
          </div>
          {/* Section 6: Legal */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>{language === 'he' ? 'משפטי' : 'Legal'}</span>
            </h3>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setOpenLegalDoc('terms')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer min-h-[48px]"
              >
                <span>{language === 'he' ? 'תנאי שימוש' : 'Terms of Use'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenLegalDoc('privacy')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer min-h-[48px]"
              >
                <span>{language === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenFeedback}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-bold text-xs transition-ui cursor-pointer min-h-[48px] w-full sm:w-auto"
          >
            <Heart className="w-4 h-4 text-purple-400 fill-purple-400/20" />
            <span>{language === 'he' ? 'שלח משוב ❤️' : 'Send Feedback ❤️'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-ui cursor-pointer min-h-[48px] w-full sm:w-auto"
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
