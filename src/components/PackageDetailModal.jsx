import React, { useState, useEffect } from 'react';
import { 
  X, ExternalLink, Copy, Check, Calendar, MapPin, Plus, 
  Truck, Clock, RefreshCw, Info, RotateCcw, Edit3, AlertCircle, ChevronDown, ChevronUp, Flag, Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getCarrier } from '../types/carriers';
import { detectStore } from '../utils/storeDetector';
import { copyToClipboard } from '../utils/clipboard';
import { STAGES, CATEGORIES } from '../types/stages';
import { useLanguage } from '../context/LanguageContext';
import { formatDate, formatDateTime, getDaysRemaining } from '../utils/dateUtils';
import { getPickupCountdown, getReturnCountdown, calculateDefaultReturnDeadline } from '../utils/deadlineUtils';
import { canTransition, TRANSITION_MATRIX } from '../services/deliveryService';
import { checkRateLimit } from '../utils/rateLimiter';
import { isLiveTrackingSupported } from '../services/carrierApiProxy';
import { CourierActionHub } from './CourierActionHub';
import { Modal } from './Modal';
import { getPreferredNavigationApp, openNavigationApp } from '../utils/navigationService';
import { getLiveStoreStatus, resolveStoreHours } from '../utils/openingHoursService';
import { submitFeedback } from '../services/feedbackService';

export function PackageDetailModal({
  pkg,
  isOpen,
  onClose,
  onEdit,
  onUpdatePackage,
  onRefreshTracking,
  onOpenLockerMap,
  onOpenLockerMode,
  onOpenNavigation,
  onShowToast
}) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingCheckpoint, setIsAddingCheckpoint] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isReportingHours, setIsReportingHours] = useState(false);
  const [reportedHours, setReportedHours] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // New Checkpoint Form State
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDesc, setNewDesc] = useState('');

  if (!isOpen || !pkg) return null;

  const carrier = getCarrier(pkg.carrier);
  const store = detectStore(pkg);
  const currentStageIndex = STAGES.findIndex(s => s.id === pkg.status);
  const effectiveIndex = currentStageIndex === -1 ? 0 : currentStageIndex;
  const currentStage = STAGES[effectiveIndex];
  const category = CATEGORIES.find(c => c.id === pkg.category) || CATEGORIES[CATEGORIES.length - 1];
  const daysInfo = getDaysRemaining(pkg.expectedDeliveryDate, language);
  const pickupCountdown = getPickupCountdown(pkg.pickupDeadline);
  const returnCountdown = getReturnCountdown(pkg.returnDeadline);
  const resolvedHours = resolveStoreHours(pkg.pickupLocation, pkg.pickupHours, pkg.carrier);
  const storeStatus = getLiveStoreStatus(pkg.pickupHours, { now, locationName: pkg.pickupLocation, carrier: pkg.carrier });

  const handleCopy = async () => {
    const success = await copyToClipboard(pkg.trackingNumber);
    if (success) {
      setCopied(true);
      if (onShowToast) onShowToast(t('card.copied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } else if (onShowToast) {
      onShowToast(language === 'he' ? 'ההעתקה ללוח נכשלה' : 'Failed to copy to clipboard', 'error');
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;

    const rateCheck = checkRateLimit(pkg.trackingNumber);
    if (rateCheck.isLimited) {
      const waitSec = Math.ceil(rateCheck.remainingMs / 1000);
      if (onShowToast) {
        onShowToast(
          language === 'he'
            ? `נא להמתין ${waitSec} שניות לפני רענון נוסף`
            : `Please wait ${waitSec}s before refreshing again`,
          'info'
        );
      }
      return;
    }

    setIsRefreshing(true);
    try {
      if (onRefreshTracking) {
        await onRefreshTracking(pkg);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAdvanceStage = () => {
    if (effectiveIndex < STAGES.length - 1) {
      const nextStage = STAGES[effectiveIndex + 1];

      if (!canTransition(pkg.status, nextStage.id)) {
        if (onShowToast) {
          onShowToast(
            language === 'he'
              ? `מעבר לא חוקי מ-${pkg.status} אל ${nextStage.id}`
              : `Cannot transition from ${pkg.status} to ${nextStage.id}`,
            'error'
          );
        }
        return;
      }

      if (nextStage.id === 'delivered') {
        confetti({ particleCount: 100, spread: 70 });
      }
      
      const newCheckpoint = {
        id: `cp-${Date.now()}`,
        title: nextStage.label,
        titleHe: nextStage.hebrewLabel,
        description: nextStage.desc,
        descriptionHe: nextStage.hebrewDesc,
        location: pkg.destination || 'Israel Logistics Hub',
        timestamp: new Date().toISOString(),
        isCompleted: true
      };

      const updated = {
        ...pkg,
        status: nextStage.id,
        checkpoints: [newCheckpoint, ...(pkg.checkpoints || [])],
        updatedAt: new Date().toISOString()
      };

      onUpdatePackage(updated);
      if (onShowToast) onShowToast(language === 'he' ? `השלב עודכן ל-${nextStage.hebrewLabel}` : `Stage advanced to ${nextStage.label}`, 'success');
    }
  };

  const handleSetStage = (stageId) => {
    if (!canTransition(pkg.status, stageId)) {
      if (onShowToast) {
        onShowToast(
          language === 'he'
            ? `מעבר לא חוקי מ-${pkg.status} אל ${stageId}`
            : `Cannot transition from ${pkg.status} to ${stageId}`,
          'error'
        );
      }
      return;
    }

    if (stageId === 'delivered') {
      confetti({ particleCount: 80, spread: 60 });
    }
    const targetStage = STAGES.find(s => s.id === stageId);
    const updated = {
      ...pkg,
      status: stageId,
      updatedAt: new Date().toISOString()
    };
    onUpdatePackage(updated);
    if (onShowToast) onShowToast(language === 'he' ? `הסטטוס שונה ל-${targetStage?.hebrewLabel || stageId}` : `Status changed to ${targetStage?.label || stageId}`, 'info');
  };

  const handleAddCustomCheckpoint = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newCp = {
      id: `cp-${Date.now()}`,
      title: newTitle.trim(),
      titleHe: newTitle.trim(),
      location: newLocation.trim() || 'Regional Logistics Hub',
      description: newDesc.trim() || 'Status checkpoint update',
      descriptionHe: newDesc.trim() || 'עדכון תחנת מעקב',
      timestamp: new Date().toISOString(),
      isCompleted: true
    };

    const updated = {
      ...pkg,
      checkpoints: [newCp, ...(pkg.checkpoints || [])],
      updatedAt: new Date().toISOString()
    };

    onUpdatePackage(updated);
    setNewTitle('');
    setNewLocation('');
    setNewDesc('');
    setIsAddingCheckpoint(false);
    if (onShowToast) onShowToast(language === 'he' ? 'תחנת המעקב נוספה בהצלחה!' : 'Tracking checkpoint added!', 'success');
  };

  const itemTitle = (language === 'he' && pkg.titleHe) ? pkg.titleHe : pkg.title;
  const itemNotes = (language === 'he' && pkg.notesHe) ? pkg.notesHe : pkg.notes;

  const handleNavigate = () => {
    if (!pkg.pickupLocation) return;
    const preferred = getPreferredNavigationApp();
    if (preferred) {
      openNavigationApp(preferred, { location: pkg.pickupLocation, title: itemTitle });
    } else if (onOpenNavigation) {
      onOpenNavigation({ location: pkg.pickupLocation, title: itemTitle });
    } else {
      openNavigationApp('google_maps', { location: pkg.pickupLocation, title: itemTitle });
    }
  };

  const handleReportWrongHours = async (e) => {
    e.preventDefault();
    if (!reportedHours.trim()) return;
    setIsSubmittingReport(true);
    try {
      await submitFeedback({
        type: 'bug',
        message: `[שעות פתיחה שגויות] נקודת איסוף: "${pkg.pickupLocation || pkg.title}" (מספר מעקב: ${pkg.trackingNumber}, ספק: ${pkg.carrier}). שעות שדווחו על ידי המשתמש: ${reportedHours.trim()}`,
        rating: 5,
        isAnonymous: true
      });
      setIsReportingHours(false);
      setReportedHours('');
      if (onShowToast) {
        onShowToast(
          language === 'he'
            ? 'תודה! הדיווח נשלח לצוות לבדיקה ועדכון ❤️'
            : 'Thank you! Report submitted for verification ❤️',
          'success'
        );
      }
    } catch {
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'שגיאה בשליחת הדיווח' : 'Error sending report',
          'error'
        );
      }
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="PackageDetailModal"
      className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
    >
        {/* Header with Carrier Brand Color Banner */}
        <div className={`p-6 border-b border-slate-800/80 bg-gradient-to-r ${carrier.color} bg-opacity-10 relative flex items-start justify-between gap-4`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              {store && (
                <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border shadow-sm ${store.badgeBg} ${store.borderColor} ${store.textColor}`}>
                  {language === 'he' ? store.hebrewName : store.name}
                </span>
              )}
              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border shadow-sm ${carrier.badgeBg}`}>
                {language === 'he' ? carrier.hebrewName : carrier.name}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-xl bg-slate-800/80 text-slate-300 font-medium">
                {language === 'he' ? category.hebrewLabel : category.label}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 mt-2">
              {itemTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(pkg)}
                className="p-2.5 px-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700/80 shadow-sm min-h-[44px] cursor-pointer"
                title={language === 'he' ? 'עריכת פרטי חבילה' : 'Edit package details'}
                aria-label={language === 'he' ? 'עריכת פרטי חבילה' : 'Edit package details'}
              >
                <Edit3 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold">{language === 'he' ? 'עריכה' : 'Edit'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label={t('common.close') || 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Pickup Information Card */}
          {(pkg.pickupCode || pkg.pickupLocation) && (
            <div className="flex flex-col gap-3 p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-900/40 border-2 border-emerald-500/30 shadow-lg shadow-emerald-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              
              <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
                <div className="flex flex-col gap-2 flex-1">
                  {pkg.pickupCode && (
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-emerald-400 uppercase tracking-widest font-extrabold mb-1">
                          {language === 'he' ? 'קוד איסוף' : 'Pickup Code'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl sm:text-4xl font-black text-emerald-50 tracking-wider font-mono">
                            {pkg.pickupCode}
                          </span>
                          <button
                            onClick={async () => {
                              const success = await copyToClipboard(pkg.pickupCode);
                              if (success && onShowToast) onShowToast(language === 'he' ? 'קוד איסוף הועתק' : 'Pickup code copied', 'success');
                            }}
                            className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 transition-colors"
                            title={language === 'he' ? 'העתק קוד' : 'Copy code'}
                          >
                            <Copy className="w-5 h-5" />
                          </button>

                          {onOpenLockerMode && (
                            <button
                              type="button"
                              onClick={() => onOpenLockerMode(pkg)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer min-h-[36px]"
                              title={language === 'he' ? 'פתח מצב לוקר מוגדל' : 'Open Full-Screen Locker Mode'}
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>{language === 'he' ? 'מצב לוקר' : 'Locker Mode'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Deadline & Live Opening Hours Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {pickupCountdown.hasDeadline && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                        pickupCountdown.urgency === 'critical' || pickupCountdown.urgency === 'expired'
                          ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 animate-pulse' 
                          : pickupCountdown.urgency === 'warning'
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        {language === 'he' ? pickupCountdown.formattedHe : pickupCountdown.formattedEn}
                        <span className="opacity-70 font-normal">({formatDate(pkg.pickupDeadline, language)})</span>
                      </span>
                    )}

                    {/* Live Operating Status Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${storeStatus.badgeClass}`}>
                      <span className={`w-2 h-2 rounded-full ${storeStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                      <span>{language === 'he' ? storeStatus.badgeTextHe : storeStatus.badgeTextEn}</span>
                      <span className="opacity-80 font-normal">
                        • {language === 'he' ? storeStatus.nextChangeHe : storeStatus.nextChangeEn}
                      </span>
                    </span>
                  </div>

                  {/* Friday / Shabbat / Holiday Contextual Alerts */}
                  {(storeStatus.warningHe || storeStatus.warningEn) && (
                    <div className="flex items-center gap-2 mt-1.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{language === 'he' ? storeStatus.warningHe : storeStatus.warningEn}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 min-w-[140px] items-stretch">
                  {pkg.pickupLocation && (
                    <button
                      type="button"
                      onClick={handleNavigate}
                      className="flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-md min-h-[48px] cursor-pointer"
                      title={language === 'he' ? 'פתח ניווט לנקודת האיסוף' : 'Open navigation to pickup location'}
                    >
                      <MapPin className="w-4 h-4" />
                      <span>{language === 'he' ? 'נווט לאיסוף' : 'Navigate'}</span>
                    </button>
                  )}
                  
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      language === 'he'
                        ? `היי, אשמח שתיקח עבורי חבילה!\nקוד איסוף: ${pkg.pickupCode || 'אין'}\nמיקום: ${pkg.pickupLocation || 'לא צוין'}`
                        : `Hey, could you pick up a package for me?\nCode: ${pkg.pickupCode || 'N/A'}\nLocation: ${pkg.pickupLocation || 'N/A'}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-emerald-400 text-sm font-bold transition-all min-h-[48px] border border-emerald-900"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {language === 'he' ? 'שתף בוואטסאפ' : 'Share Proxy'}
                  </a>
                </div>
              </div>

              {/* Location Bar & Operating Hours Details */}
              {pkg.pickupLocation && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 relative z-10 flex flex-col gap-2">
                  <div
                    onClick={handleNavigate}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigate();
                      }
                    }}
                    className="flex items-start gap-2 cursor-pointer group hover:opacity-90 transition-opacity"
                    title={language === 'he' ? 'לחץ לפתיחת ניווט' : 'Click to navigate'}
                  >
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm text-emerald-100/90 leading-tight group-hover:underline">
                      {pkg.pickupLocation}
                    </span>
                  </div>

                  {/* Hours detail strip & Report wrong hours trigger */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-300 font-medium">
                        {language === 'he' ? resolvedHours.hoursHe : resolvedHours.hoursEn}
                      </span>
                      {resolvedHours.isEstimated && (
                        <span className="text-[10px] text-amber-400/90 italic">
                          ({language === 'he' ? 'משוער' : 'Estimated'})
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsReportingHours(!isReportingHours)}
                      className="text-[11px] text-indigo-300 hover:text-indigo-200 underline font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Flag className="w-3 h-3" />
                      <span>{t('openingHours.reportWrongHours')}</span>
                    </button>
                  </div>

                  {/* Inline Report Incorrect Hours Box */}
                  {isReportingHours && (
                    <form onSubmit={handleReportWrongHours} className="p-3 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-2 animate-fade-in text-xs">
                      <label className="block text-[11px] font-bold text-indigo-200">
                        {t('openingHours.reportPromptTitle')}
                      </label>
                      <input
                        type="text"
                        required
                        value={reportedHours}
                        onChange={(e) => setReportedHours(e.target.value)}
                        placeholder={t('openingHours.reportPlaceholder')}
                        className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsReportingHours(false)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs"
                        >
                          {t('modal.cancel')}
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingReport}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm"
                        >
                          {isSubmittingReport ? '...' : (language === 'he' ? 'שלח דיווח' : 'Submit')}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Return Policy & Window Box (Delivered or Return Set) */}
          {(pkg.status === 'delivered' || pkg.returnDeadline) && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-500/30 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {language === 'he' ? 'חלון החזרה לחנות' : 'Store Return Window'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {language === 'he' ? 'מעקב אחר מדיניות ההחזרה ומועד אחרון לזיכוי' : 'Track return policy deadline and refunds'}
                    </p>
                  </div>
                </div>

                {onUpdatePackage && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const target = calculateDefaultReturnDeadline(pkg.updatedAt || new Date(), 14);
                        onUpdatePackage({ ...pkg, returnDeadline: target, updatedAt: new Date().toISOString() });
                        if (onShowToast) onShowToast(language === 'he' ? 'חלון החזרה הוגדר ל-14 ימים' : 'Return window set to 14 days', 'success');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      +14 {language === 'he' ? 'ימים' : 'days'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = calculateDefaultReturnDeadline(pkg.updatedAt || new Date(), 30);
                        onUpdatePackage({ ...pkg, returnDeadline: target, updatedAt: new Date().toISOString() });
                        if (onShowToast) onShowToast(language === 'he' ? 'חלון החזרה הוגדר ל-30 ימים' : 'Return window set to 30 days', 'success');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      +30 {language === 'he' ? 'ימים' : 'days'}
                    </button>
                  </div>
                )}
              </div>

              {returnCountdown.hasDeadline ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                    returnCountdown.urgency === 'critical' || returnCountdown.urgency === 'expired'
                      ? 'bg-rose-500/25 text-rose-300 border-rose-500/40'
                      : returnCountdown.urgency === 'warning'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    {language === 'he' ? returnCountdown.formattedHe : returnCountdown.formattedEn}
                    <span className="opacity-70 font-normal">({formatDate(pkg.returnDeadline, language)})</span>
                  </span>

                  {pkg.returnNotes && (
                    <span className="text-xs text-slate-300 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl">
                      {pkg.returnNotes}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {language === 'he' 
                    ? 'לא הוגדר מועד החזרה לחבילה זו. השתמש בכפתורים למעלה להגדרה מהירה.'
                    : 'No return deadline set. Use the quick buttons above to track refund eligibility.'}
                </p>
              )}
            </div>
          )}

          {/* 1-Click Courier & WhatsApp Actions Hub */}
          <CourierActionHub pkg={pkg} onShowToast={onShowToast} />

          {/* Quick Tracking & Official Link Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                  {t('card.trackingNumber')}
                </span>
                <span className="font-mono text-base font-bold text-slate-200">
                  {pkg.trackingNumber}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title={t('card.copyTracking')}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onRefreshTracking && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 text-xs font-bold transition-all border border-slate-700/80 min-h-[44px]"
                  title={t('card.refreshStatus')}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{t('card.refreshStatus')}</span>
                </button>
              )}

              {onOpenLockerMap && (
                <button
                  onClick={onOpenLockerMap}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-blue-400 text-xs font-bold transition-all border border-slate-700/80 min-h-[44px]"
                  title={language === 'he' ? 'איתור נקודת איסוף ולוקרים' : 'Find Pickup Locker'}
                >
                  <MapPin className="w-4 h-4 text-rose-400" />
                  <span>{language === 'he' ? 'לוקר / איסוף' : 'Locker'}</span>
                </button>
              )}

              <a
                href={carrier.getTrackingUrl(pkg.trackingNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 min-h-[44px]"
              >
                <span>{t('detailModal.carrierDirectLink')}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Stepper Progress Section & Status Transition Override */}
          <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>{t('detailModal.currentStage')}:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${currentStage.badgeClass}`}>
                  {language === 'he' ? currentStage.hebrewLabel : currentStage.label}
                </span>
              </h3>

              <div className="flex items-center gap-2">
                {/* State Machine Transition Selector (Only showing allowed transitions) */}
                <select
                  value={pkg.status}
                  onChange={(e) => handleSetStage(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 min-h-[36px] cursor-pointer"
                  aria-label={t('tracking.overrideStatus')}
                >
                  {(TRANSITION_MATRIX[pkg.status] || [pkg.status]).map((statusKey) => {
                    const stageObj = STAGES.find(s => s.id === statusKey);
                    const label = stageObj
                      ? (language === 'he' ? stageObj.hebrewLabel : stageObj.label)
                      : statusKey;
                    return (
                      <option key={statusKey} value={statusKey}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                {effectiveIndex < STAGES.length - 1 && canTransition(pkg.status, STAGES[effectiveIndex + 1]?.id) && (
                  <button
                    onClick={handleAdvanceStage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md min-h-[36px]"
                  >
                    <span>{t('detailModal.advanceStageBtn')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Visual 6 Stages Clickable Stepper */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {STAGES.map((s, idx) => {
                const isPassed = idx < effectiveIndex;
                const isCurrent = idx === effectiveIndex;
                const isAllowed = canTransition(pkg.status, s.id);

                return (
                  <button
                    key={s.id}
                    onClick={() => handleSetStage(s.id)}
                    disabled={!isAllowed && !isCurrent}
                    title={!isAllowed && !isCurrent ? (language === 'he' ? 'מעבר לא מורשה' : 'Transition not permitted') : ''}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300 ring-2 ring-blue-500/30'
                        : isPassed
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                        : isAllowed
                        ? 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        : 'border-slate-900/60 bg-slate-950/40 text-slate-600 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full mb-1 flex items-center justify-center text-[10px] font-bold ${
                      isCurrent ? 'bg-blue-500 text-white' : isPassed ? 'bg-emerald-500 text-white' : isAllowed ? 'bg-slate-800 text-slate-400' : 'bg-slate-900 text-slate-700'
                    }`}>
                      {isPassed ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                    </div>
                    <span className="text-[11px] font-semibold line-clamp-1">
                      {language === 'he' ? s.hebrewLabel : s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Expected Delivery */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">{t('card.expectedOn')}</span>
              <div className="flex items-center gap-2 mt-1 text-sm font-bold text-slate-200">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>{formatDate(pkg.expectedDeliveryDate, language) || '-'}</span>
              </div>
              {daysInfo && (
                <span className={`inline-block text-[11px] font-semibold mt-1 px-2 py-0.5 rounded-md ${daysInfo.isUrgent ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                  {daysInfo.text}
                </span>
              )}
            </div>

            {/* Route (Origin -> Destination) */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">{t('card.route')}</span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-200">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate">{pkg.origin || 'Global'}</span>
                <span>→</span>
                <span className="truncate text-blue-300">{pkg.destination || 'Israel'}</span>
              </div>
            </div>

            {/* Order Date */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">{t('card.orderedOn')}</span>
              <div className="flex items-center gap-2 mt-1 text-sm font-semibold text-slate-200">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{formatDate(pkg.orderDate, language) || '-'}</span>
              </div>
            </div>
          </div>

          {/* Notes / Locker / Instructions */}
          {itemNotes && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">{t('card.notes')}</span>
              <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                {itemNotes}
              </p>
            </div>
          )}

          {/* Checkpoints Timeline Section */}
          <div className="space-y-4">
            {/* No live feed exists for this carrier — state it up front so the
                timeline below is never mistaken for carrier-sourced events. */}
            {!isLiveTrackingSupported(pkg.carrier) && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/90 font-medium leading-relaxed">
                  {t('tracking.notSupported').replace('{carrier}', language === 'he' ? carrier.hebrewName : carrier.name)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>{t('detailModal.timelineTitle')}</span>
                {!isLiveTrackingSupported(pkg.carrier) && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 bg-amber-500/10 border border-amber-500/25 rounded-md px-1.5 py-0.5">
                    {t('tracking.manualBadge')}
                  </span>
                )}
              </h3>
              
              <button
                onClick={() => setIsAddingCheckpoint(!isAddingCheckpoint)}
                className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-xl border border-blue-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('detailModal.addCheckpointBtn')}</span>
              </button>
            </div>

            {/* Add Custom Mock Checkpoint Simulator Form */}
            {isAddingCheckpoint && (
              <form onSubmit={handleAddCustomCheckpoint} className="p-4 rounded-2xl bg-slate-950 border border-blue-500/30 space-y-3 animate-fade-in">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  {t('detailModal.checkpointModalTitle')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t('detailModal.checkpointTitlePlaceholder')}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder={t('detailModal.checkpointLocationPlaceholder')}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t('detailModal.checkpointDescPlaceholder')}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingCheckpoint(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium"
                  >
                    {t('modal.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20"
                  >
                    {t('detailModal.saveCheckpoint')}
                  </button>
                </div>
              </form>
            )}

            {/* Checkpoint Events List */}
            {(!pkg.checkpoints || pkg.checkpoints.length === 0) ? (
              <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-500">
                {t('detailModal.noCheckpoints')}
              </div>
            ) : (
              <div className="relative pl-6 pr-6 space-y-6 before:absolute before:top-2 before:bottom-2 ltr:before:left-[35px] rtl:before:right-[35px] before:w-0.5 before:bg-slate-800">
                {pkg.checkpoints.map((cp, index) => {
                  const cpTitle = (language === 'he' && cp.titleHe) ? cp.titleHe : cp.title;
                  const cpDesc = (language === 'he' && cp.descriptionHe) ? cp.descriptionHe : cp.description;

                  return (
                    <div key={cp.id || index} className="relative flex items-start gap-4 group">
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        index === 0
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}>
                        {index === 0 ? (
                          <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 group-hover:border-slate-700 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                          <h4 className="text-xs font-bold text-slate-200">
                            {cpTitle}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatDateTime(cp.timestamp, language)}
                          </span>
                        </div>

                        {cp.location && (
                          <div className="flex items-center gap-1 text-[11px] text-blue-400 font-medium mb-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{cp.location}</span>
                          </div>
                        )}

                        {cpDesc && (
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {cpDesc}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            {language === 'he' ? 'סגור' : 'Close'}
          </button>
        </div>
      </Modal>
  );
}
