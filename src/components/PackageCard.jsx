import React, { useState, useRef, useEffect } from 'react';
import {
  Copy, Check, MoreVertical, Pin, Archive, Trash2, Edit3,
  Calendar, CheckCircle, ArrowUpRight, RefreshCw, Loader2, Package,
  Clock, RotateCcw, Sun, AlertTriangle, MapPin, Navigation, Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getCarrier } from '../types/carriers';
import { detectStore } from '../utils/storeDetector';
import { copyToClipboard } from '../utils/clipboard';
import { STAGES, getStatusMeta } from '../types/stages';
import { useLanguage } from '../context/LanguageContext';
import { formatDate, getDaysRemaining } from '../utils/dateUtils';
import { getPickupCountdown, getReturnCountdown } from '../utils/deadlineUtils';
import { triggerHapticFeedback } from '../utils/haptics';
import { checkRateLimit } from '../utils/rateLimiter';
import { findSameLocationPackages } from '../utils/locationBundling';
import { openNavigationApp } from '../utils/navigationService';

function PackageCardImpl({
  pkg,
  packages = [],
  onOpenDetails,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onStatusChange,
  onRefreshTracking,
  onOpenLockerMode,
  onOpenNavigation,
  onShowToast
}) {
  const { t, language, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const copyTrackingTimerRef = useRef(null);
  const copyPinTimerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // The row menu opens downward by default. On the last cards in a list that
  // put it under the bottom tab bar, so on open we measure the space actually
  // left below the trigger and flip upward when the menu would not fit.
  const [menuFlipUp, setMenuFlipUp] = useState(false);
  const menuTriggerRef = useRef(null);
  const MENU_HEIGHT = 250;
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mobile Swipe Gesture State
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const hapticTriggeredRef = useRef(false);

  const carrier = getCarrier(pkg.carrier);
  const store = detectStore(pkg);
  const daysInfo = getDaysRemaining(pkg.expectedDeliveryDate, language);
  const pickupCountdown = getPickupCountdown(pkg.pickupDeadline);
  const returnCountdown = getReturnCountdown(pkg.returnDeadline);
  const sameLocationSiblings = React.useMemo(() => {
    return findSameLocationPackages(pkg, packages);
  }, [pkg, packages]);

  const trackingUrl = carrier.getTrackingUrl(pkg.trackingNumber);

  const SWIPE_THRESHOLD = 60;

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    setIsSwiping(false);
    hapticTriggeredRef.current = false;
  };

  const handleTouchMove = (e) => {
    const deltaX = e.touches[0].clientX - touchStartXRef.current;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;

    // Ignore vertical scrolling
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    if (Math.abs(deltaX) > 10) {
      setIsSwiping(true);
      // Dampen swipe drag distance slightly beyond threshold
      const sign = Math.sign(deltaX);
      const absVal = Math.abs(deltaX);
      const bounded = absVal <= SWIPE_THRESHOLD
        ? absVal
        : SWIPE_THRESHOLD + (absVal - SWIPE_THRESHOLD) * 0.45;
      const boundedOffset = Math.max(-140, Math.min(140, sign * bounded));
      setSwipeOffset(boundedOffset);

      if (Math.abs(boundedOffset) >= SWIPE_THRESHOLD && !hapticTriggeredRef.current) {
        triggerHapticFeedback(20);
        hapticTriggeredRef.current = true;
      } else if (Math.abs(boundedOffset) < SWIPE_THRESHOLD && hapticTriggeredRef.current) {
        hapticTriggeredRef.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;

    if (swipeOffset >= SWIPE_THRESHOLD) {
      // Swiped Right -> Toggle Archive
      onToggleArchive(pkg.id);
      triggerHapticFeedback([10, 50, 20]);
    } else if (swipeOffset <= -SWIPE_THRESHOLD) {
      // Swiped Left -> Delete
      onDelete(pkg.id);
      triggerHapticFeedback([20, 40, 30]);
    }

    setSwipeOffset(0);
    setIsSwiping(false);
    hapticTriggeredRef.current = false;
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    const success = await copyToClipboard(pkg.trackingNumber);
    if (success) {
      setCopied(true);
      if (onShowToast) onShowToast(t('card.copied'), 'success');
      if (copyTrackingTimerRef.current) clearTimeout(copyTrackingTimerRef.current);
      copyTrackingTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } else if (onShowToast) {
      onShowToast(language === 'he' ? 'ההעתקה ללוח נכשלה' : 'Failed to copy to clipboard', 'error');
    }
  };

  useEffect(() => {
    return () => {
      if (copyTrackingTimerRef.current) clearTimeout(copyTrackingTimerRef.current);
      if (copyPinTimerRef.current) clearTimeout(copyPinTimerRef.current);
    };
  }, []);

  const handleCopyPin = async (e) => {
    e.stopPropagation();
    if (!pkg.pickupCode) return;
    const success = await copyToClipboard(pkg.pickupCode);
    if (success) {
      setCopiedPin(true);
      triggerHapticFeedback();
      if (onShowToast) {
        onShowToast(language === 'he' ? 'קוד איסוף הועתק!' : 'Pickup code copied!', 'success');
      }
      if (copyPinTimerRef.current) clearTimeout(copyPinTimerRef.current);
      copyPinTimerRef.current = setTimeout(() => setCopiedPin(false), 2000);
    } else if (onShowToast) {
      onShowToast(language === 'he' ? 'ההעתקה ללוח נכשלה' : 'Failed to copy to clipboard', 'error');
    }
  };

  const handleOpenNavigation = (e) => {
    e.stopPropagation();
    if (!pkg.pickupLocation) return;
    const target = {
      location: pkg.pickupLocation,
      title: (language === 'he' && pkg.titleHe) ? pkg.titleHe : pkg.title
    };
    if (onOpenNavigation) {
      onOpenNavigation(target);
    } else {
      openNavigationApp('google_maps', target);
    }
  };

  const handleRefresh = async (e) => {
    e.stopPropagation();
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
    triggerHapticFeedback(15);

    try {
      if (onRefreshTracking) {
        await onRefreshTracking(pkg);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkDelivered = (e) => {
    e.stopPropagation();
    if (pkg.status !== 'delivered') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
      onStatusChange(pkg.id, 'delivered');
      if (onShowToast) onShowToast(language === 'he' ? 'החבילה סומנה כנמסרה! 🎉' : 'Package marked as delivered! 🎉', 'success');
    } else {
      onStatusChange(pkg.id, 'in_transit');
      if (onShowToast) onShowToast(language === 'he' ? 'החבילה הוחזרה למצב פעיל' : 'Package marked as active', 'info');
    }
  };

  const itemTitle = (language === 'he' && pkg.titleHe) ? pkg.titleHe : pkg.title;
  const stage = getStatusMeta(pkg.status);

  return (
    <div
      /* z-50, not z-30: this element creates a stacking context while the
         menu is open, so the menu's own z-50 is scoped INSIDE it and cannot
         escape. At z-30 the whole card-plus-menu sat below the install banner
         and the bottom nav (both z-40), and the menu was drawn behind them. */
      className={`relative rounded-2xl transition-ui ${menuOpen ? 'z-50' : 'z-0'}`}
      /* `content-visibility: auto` implies `contain: layout style paint`, and
         PAINT containment clips anything a descendant draws outside this box.
         The row menu is positioned `absolute top-full` — below the card — so
         it was being clipped away to nothing: the menu opened, and you saw
         only the sliver that happened to fall inside the card's own bounds.
         Dropping to `visible` while the menu is open removes the containment
         for that one card; every other card in the list keeps the
         skip-rendering win, which is what this was here for. */
      style={{
        contentVisibility: menuOpen ? 'visible' : 'auto',
        containIntrinsicSize: '140px'
      }}
    >
      {/* Swipe Action Background Track (Email-box style revealed actions) */}
      {(isSwiping || swipeOffset !== 0) && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none flex items-center justify-between">
          {/* Left Track: Archive / Unarchive */}
          <div
            className={`h-full flex items-center gap-2.5 px-4 sm:px-6 transition-colors duration-150 ${
              swipeOffset > 0
                ? (swipeOffset >= SWIPE_THRESHOLD
                    ? (pkg.isArchived ? 'bg-emerald-600/35' : 'bg-amber-600/35')
                    : (pkg.isArchived ? 'bg-emerald-500/15' : 'bg-amber-500/15'))
                : 'opacity-0'
            }`}
            style={{
              width: swipeOffset > 0 ? `${Math.max(swipeOffset + 12, 0)}px` : '0px'
            }}
          >
            <div
              className={`flex items-center gap-2 font-bold text-xs transition-transform duration-150 ${
                pkg.isArchived ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-950 dark:text-amber-300'
              }`}
              style={{
                transform: `scale(${swipeOffset >= SWIPE_THRESHOLD ? 1.08 : Math.max(0.85, Math.min(1, swipeOffset / SWIPE_THRESHOLD))})`,
                opacity: Math.min(1, Math.max(0.4, swipeOffset / 35))
              }}
            >
              <Archive className={`w-5 h-5 shrink-0 transition-transform ${swipeOffset >= SWIPE_THRESHOLD ? 'rotate-[-8deg]' : ''}`} />
              <span className="whitespace-nowrap font-bold">
                {swipeOffset >= SWIPE_THRESHOLD
                  ? (pkg.isArchived ? t('card.releaseToUnarchive') : t('card.releaseToArchive'))
                  : (pkg.isArchived ? t('card.unarchive') : t('card.archive'))}
              </span>
            </div>
          </div>

          {/* Right Track: Delete */}
          <div
            className={`h-full ms-auto flex items-center justify-end gap-2.5 px-4 sm:px-6 transition-colors duration-150 ${
              swipeOffset < 0
                ? (-swipeOffset >= SWIPE_THRESHOLD ? 'bg-rose-600/35' : 'bg-rose-500/15')
                : 'opacity-0'
            }`}
            style={{
              width: swipeOffset < 0 ? `${Math.max(-swipeOffset + 12, 0)}px` : '0px'
            }}
          >
            <div
              className="flex items-center gap-2 font-bold text-xs text-rose-800 dark:text-rose-300 transition-transform duration-150"
              style={{
                transform: `scale(${-swipeOffset >= SWIPE_THRESHOLD ? 1.08 : Math.max(0.85, Math.min(1, -swipeOffset / SWIPE_THRESHOLD))})`,
                opacity: Math.min(1, Math.max(0.4, -swipeOffset / 35))
              }}
            >
              <span className="whitespace-nowrap font-bold">
                {-swipeOffset >= SWIPE_THRESHOLD ? t('card.releaseToDelete') : t('card.delete')}
              </span>
              <Trash2 className={`w-5 h-5 shrink-0 transition-transform ${-swipeOffset >= SWIPE_THRESHOLD ? 'rotate-[8deg]' : ''}`} />
            </div>
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label={`${itemTitle} — ${language === 'he' ? stage.hebrewLabel : stage.label}`}
        onClick={() => {
          if (Math.abs(swipeOffset) > 5) return;
          if (typeof onOpenDetails === 'function') {
            onOpenDetails(pkg);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (typeof onOpenDetails === 'function') onOpenDetails(pkg);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : 'none',
          transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className={`group relative bg-slate-900/90 hover:bg-slate-900 border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 shadow-sm hover:shadow-xl hover:shadow-slate-950/40 hover:-translate-y-0.5 ${
          pkg.isPinned ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800/80 hover:border-slate-700'
        }`}
      >
        {/* Header Row: Leading Avatar, Title + Meta, and Status Badge */}
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              pkg.status === 'delivered'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : pkg.status === 'ready_for_pickup' || pkg.status === 'out_for_delivery'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}
          >
            {pkg.status === 'returned_to_sender' ? (
              <RotateCcw className="w-5 h-5 text-orange-400" />
            ) : pkg.status === 'exception' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            ) : (
              <Package className="w-5 h-5" />
            )}
            {pkg.isPinned && (
              <Pin
                className="absolute -top-1 -end-1 w-3.5 h-3.5 fill-blue-400 text-blue-400"
                aria-hidden="true"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                {itemTitle}
              </h3>
              
              <div className="shrink-0 flex items-center gap-1.5 ms-2">
                {pkg.isDemo && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {t('firstTimeEmpty.demoBadge')}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${stage.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    stage.color === 'emerald' ? 'bg-emerald-400' :
                    stage.color === 'amber' ? 'bg-amber-400' :
                    stage.color === 'rose' ? 'bg-rose-400' :
                    stage.color === 'orange' ? 'bg-orange-400' : 'bg-blue-400'
                  }`} aria-hidden="true" />
                  <span>{language === 'he' ? stage.hebrewLabel : stage.label}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 mt-1">
              <span className="font-mono text-slate-300 font-medium"><bdi dir="ltr">{pkg.trackingNumber}</bdi></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-medium truncate">
                {store ? (language === 'he' ? store.hebrewName : store.name) + ' — ' : ''}
                {language === 'he' ? carrier.hebrewName : carrier.name}
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Contextual Tags Strip (if any) */}
        {(pkg.confidence === 'sender_reported' || (pkg.customsDetails?.required && pkg.customsDetails?.status !== 'paid') || (pkg.localCarrier && pkg.localCarrier !== pkg.carrier)) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {pkg.confidence === 'sender_reported' && (
              <span
                title={language === 'he'
                  ? 'הסטטוס מבוסס על אימייל אישור הזמנה, ולא על מעקב מאומת מול חברת השילוח'
                  : 'Status is based on your order confirmation email, not carrier-verified tracking'}
                className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700/80 text-xs font-medium"
              >
                {language === 'he' ? 'מאישור הזמנה' : 'from order confirmation'}
              </span>
            )}
            {pkg.customsDetails?.required && pkg.customsDetails?.status !== 'paid' && (
              <span
                title={language === 'he' ? 'נדרש תשלום מכס' : 'Customs payment required'}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/25 text-xs font-semibold"
              >
                <span>{language === 'he' ? 'מכס' : 'Customs'}</span>
              </span>
            )}
            {pkg.localCarrier && pkg.localCarrier !== pkg.carrier && (
              <span
                title={language === 'he' ? `הועבר לחלוקה מקומית: ${getCarrier(pkg.localCarrier).hebrewName} (${pkg.localTrackingNumber || ''})` : `Domestic handover: ${getCarrier(pkg.localCarrier).name}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 text-xs font-medium"
              >
                <span>➔ {language === 'he' ? getCarrier(pkg.localCarrier).hebrewName : getCarrier(pkg.localCarrier).name}</span>
              </span>
            )}
          </div>
        )}

        {/* Digital Pickup Pass Widget: when pickup info, PIN, or locker location is active */}
        {(pkg.pickupLocation || pkg.pickupCode || pkg.shelfNumber || pkg.isRedirected) && (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-950/60 to-slate-950/80 border border-emerald-500/20 p-3 flex flex-col gap-2.5 shadow-inner">
            {(pkg.pickupCode || pkg.shelfNumber || pkg.isRedirected) && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {pkg.pickupCode && (
                  <div className="inline-flex items-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 font-mono text-xs font-semibold overflow-hidden shrink-0 min-h-[44px]">
                    {onOpenLockerMode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLockerMode(pkg);
                        }}
                        title={language === 'he' ? 'פתח מצב לוקר מוגדל' : 'Open Full-Screen Locker Mode'}
                        aria-label={language === 'he' ? `פתח מצב לוקר — PIN ${pkg.pickupCode}` : `Open Locker Mode — PIN ${pkg.pickupCode}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-500/20 text-emerald-200 transition-colors cursor-pointer min-h-[44px]"
                      >
                        <Sun className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                        <span className="font-bold text-sm tracking-wider">PIN {pkg.pickupCode}</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 text-emerald-200 font-bold text-sm tracking-wider min-h-[44px] flex items-center">
                        PIN {pkg.pickupCode}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyPin}
                      title={language === 'he' ? 'העתק קוד איסוף' : 'Copy pickup PIN'}
                      className="px-2.5 py-1.5 hover:bg-emerald-500/20 border-s border-emerald-500/30 text-emerald-300 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={language === 'he' ? 'העתק קוד איסוף' : 'Copy pickup PIN'}
                    >
                      {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1.5 ms-auto">
                  {pkg.shelfNumber && (
                    <span
                      title={language === 'he' ? `מספר מדף: ${pkg.shelfNumber}` : `Shelf number: ${pkg.shelfNumber}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/25 font-mono text-xs font-semibold"
                    >
                      <span>{language === 'he' ? 'מדף' : 'Shelf'} {pkg.shelfNumber}</span>
                    </span>
                  )}
                  {pkg.isRedirected && (
                    <span
                      title={language === 'he' ? 'חברת השילוח העבירה את החבילה לנקודה חלופית' : 'Package was redirected to an alternate pickup location'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/25 text-xs font-semibold"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                      <span>{t('redirectDetection.badge')}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {pkg.pickupLocation && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleOpenNavigation}
                  title={language === 'he' ? 'פתח ניווט לנקודת האיסוף (Waze / Maps)' : 'Open navigation (Waze / Maps)'}
                  aria-label={language === 'he' ? `נווט אל ${pkg.pickupLocation}` : `Navigate to ${pkg.pickupLocation}`}
                  className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-900/90 hover:text-emerald-300 transition-colors cursor-pointer min-h-[48px] text-start group/nav"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0 group-hover/nav:scale-110 transition-transform" aria-hidden="true" />
                    <span className="truncate text-xs font-medium text-slate-200">{pkg.pickupLocation}</span>
                  </div>
                  <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 group-hover/nav:bg-emerald-500/25 transition-colors flex items-center gap-1 text-[11px] font-semibold shrink-0">
                    <Navigation className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                    <span className="hidden sm:inline">{language === 'he' ? 'נווט' : 'Navigate'}</span>
                  </span>
                </button>

                {sameLocationSiblings.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHapticFeedback('selection');
                      if (onOpenLockerMode) onOpenLockerMode(pkg);
                    }}
                    className="px-3 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer min-h-[48px] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0"
                    aria-label={
                      language === 'he'
                        ? `עוד ${sameLocationSiblings.length} חבילות באותה נקודה. פתח מסך איסוף מרוכז.`
                        : `${sameLocationSiblings.length} other packages at this location. Open bundled pickup mode.`
                    }
                    title={
                      language === 'he'
                        ? `פתח מסך איסוף מרוכז עבור ${sameLocationSiblings.length + 1} חבילות`
                        : `Open bundled pickup screen for ${sameLocationSiblings.length + 1} packages`
                    }
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-300" aria-hidden="true" />
                    <span>{language === 'he' ? `עוד ${sameLocationSiblings.length} כאן` : `+${sameLocationSiblings.length} here`}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* In-Card Journey Stepper Bar: for packages in standard progression */}
        {pkg.status !== 'archived' && pkg.status !== 'exception' && pkg.status !== 'returned_to_sender' && !pkg.pickupLocation && (
          <div className="w-full py-1" aria-hidden="true">
            <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden flex">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pkg.status === 'delivered'
                    ? 'bg-emerald-500'
                    : pkg.status === 'ready_for_pickup' || pkg.status === 'out_for_delivery'
                      ? 'bg-teal-500'
                      : 'bg-blue-500'
                }`}
                style={{
                  width:
                    pkg.status === 'delivered' ? '100%' :
                    (pkg.status === 'ready_for_pickup' || pkg.status === 'out_for_delivery') ? '85%' :
                    (pkg.status === 'customs' || pkg.status === 'in_transit') ? '60%' :
                    pkg.status === 'shipped' ? '35%' : '15%'
                }}
              />
            </div>
          </div>
        )}

        {/* Optional Countdown Banner for Pickup or Return */}
        {pkg.status !== 'delivered' && pickupCountdown.hasDeadline && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
            pickupCountdown.urgency === 'critical' || pickupCountdown.urgency === 'expired'
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
              : pickupCountdown.urgency === 'warning'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
          }`}>
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{language === 'he' ? pickupCountdown.formattedHe : pickupCountdown.formattedEn}</span>
          </div>
        )}

        {pkg.status === 'delivered' && returnCountdown.hasDeadline && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
            returnCountdown.urgency === 'critical' || returnCountdown.urgency === 'expired'
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
              : returnCountdown.urgency === 'warning'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                : 'bg-blue-500/15 text-blue-300 border-blue-500/25'
          }`}>
            <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{language === 'he' ? returnCountdown.formattedHe : returnCountdown.formattedEn}</span>
          </div>
        )}

        {/* Footer Row: Arrival Date + Quick Actions */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-800/80 mt-auto">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 min-w-0">
            <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="shrink-0 whitespace-nowrap font-medium text-slate-300">{formatDate(pkg.expectedDeliveryDate, language)}</span>
            {daysInfo && pkg.status !== 'delivered' && (
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-md font-semibold ${
                  daysInfo.isUrgent ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25' : 'bg-slate-800/80 text-slate-400'
                }`}
              >
                {daysInfo.text}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {onRefreshTracking && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title={t('card.refreshStatus')}
                aria-label={t('card.refreshStatus')}
                className={`p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer ${
                  isRefreshing ? 'animate-spin text-emerald-400' : ''
                }`}
              >
                {isRefreshing ? <Loader2 className="w-4 h-4" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleMarkDelivered}
              aria-label={pkg.status === 'delivered' ? t('card.markActive') : t('card.markDelivered')}
              title={pkg.status === 'delivered' ? t('card.markActive') : t('card.markDelivered')}
              className={`p-2 rounded-xl transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer ${
                pkg.status === 'delivered' ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/25' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <CheckCircle className={`w-4 h-4 ${pkg.status === 'delivered' ? 'fill-emerald-400/20' : ''}`} aria-hidden="true" />
            </button>

            <div className="relative">
              <button
                type="button"
                ref={menuTriggerRef}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!menuOpen && menuTriggerRef.current) {
                    const { bottom } = menuTriggerRef.current.getBoundingClientRect();
                    // 96px keeps it clear of the bottom tab bar and the home
                    // indicator inset, which is the space the menu used to
                    // disappear into.
                    setMenuFlipUp(window.innerHeight - bottom < MENU_HEIGHT + 96);
                  }
                  setMenuOpen(!menuOpen);
                }}
                aria-label={t('card.moreActions')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={t('card.viewDetails')}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
              >
                <MoreVertical className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                  <div
                    aria-label={t('card.moreActions')}
                    className={`absolute z-50 w-48 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl py-1 text-xs end-0 ${
                      menuFlipUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        handleCopy(e);
                      }}
                      aria-label={t('card.copyTracking')}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 min-h-[48px]"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                      <span>{t('card.copyTracking')}</span>
                    </button>

                    {pkg.pickupCode && onOpenLockerMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onOpenLockerMode(pkg);
                        }}
                        aria-label={language === 'he' ? 'מצב לוקר מוגדל' : 'Locker Mode'}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-slate-800 hover:text-emerald-700 dark:hover:text-emerald-300 min-h-[48px] font-semibold"
                      >
                        <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{language === 'he' ? 'מצב לוקר מוגדל' : 'Locker Mode'}</span>
                      </button>
                    )}

                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={language === 'he' ? `עקוב אחר החבילה ב-${carrier.hebrewName}` : `Track package on ${carrier.name}`}
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 min-h-[48px]"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t('card.viewCarrier')}</span>
                    </a>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onTogglePin(pkg.id);
                      }}
                      aria-label={pkg.isPinned ? t('card.unpin') : t('card.pin')}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 min-h-[48px]"
                    >
                      <Pin className={`w-3.5 h-3.5 ${pkg.isPinned ? 'fill-blue-400 text-blue-400' : ''}`} aria-hidden="true" />
                      <span>{pkg.isPinned ? t('card.unpin') : t('card.pin')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onEdit(pkg);
                      }}
                      aria-label={t('card.edit')}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 min-h-[48px]"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t('card.edit')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onToggleArchive(pkg.id);
                      }}
                      aria-label={pkg.isArchived ? t('card.unarchive') : t('card.archive')}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 min-h-[48px]"
                    >
                      <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{pkg.isArchived ? t('card.unarchive') : t('card.archive')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onDelete(pkg.id);
                      }}
                      aria-label={t('card.delete')}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 min-h-[48px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t('card.delete')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Rendered once per package. Without memo every keystroke in the search box
// re-rendered every card; App now passes stable useCallback handlers so the
// props actually compare equal.
export const PackageCard = React.memo(PackageCardImpl);
