import React, { useState, useRef } from 'react';
import {
  Copy, Check, MoreVertical, Pin, Archive, Trash2, Edit3,
  Calendar, CheckCircle, ArrowUpRight, RefreshCw, Loader2, Package,
  Clock, RotateCcw, Sun, AlertTriangle
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
import { MapPin } from 'lucide-react';

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
  onShowToast
}) {
  const { t, language, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);
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
      setTimeout(() => setCopied(false), 2000);
    } else if (onShowToast) {
      onShowToast(language === 'he' ? 'ההעתקה ללוח נכשלה' : 'Failed to copy to clipboard', 'error');
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
      className={`relative rounded-2xl transition-all ${menuOpen ? 'z-50' : 'z-0'}`}
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
                pkg.isArchived ? 'text-emerald-300' : 'text-amber-300'
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
              className="flex items-center gap-2 font-bold text-xs text-rose-300 transition-transform duration-150"
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
        onClick={() => {
          if (Math.abs(swipeOffset) > 5) return;
          onOpenDetails(pkg);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : 'none',
          transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className={`group relative bg-slate-900 hover:bg-slate-800 border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 shadow-sm hover:shadow-md ${
          pkg.isPinned ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Row 1: leading icon, title + tracking/carrier meta, status pill */}
        <div className="flex items-start gap-3">
          <div className={`relative p-2 rounded-xl shrink-0 ${stage.badgeClass.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ')}`}>
            {pkg.status === 'returned_to_sender' ? (
              <RotateCcw className="w-4 h-4" />
            ) : pkg.status === 'exception' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            {pkg.isPinned && (
              <Pin
                className="absolute -top-1 -end-1 w-3 h-3 fill-blue-400 text-blue-400"
                aria-hidden="true"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
              {itemTitle}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate">
              <span className="font-mono"><bdi dir="ltr">{pkg.trackingNumber}</bdi></span>
              <span className="opacity-50">·</span>
              <span className="truncate">
                {store ? (language === 'he' ? store.hebrewName : store.name) + ' — ' : ''}
                {language === 'he' ? carrier.hebrewName : carrier.name}
              </span>
              {pkg.pickupCode && onOpenLockerMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenLockerMode(pkg);
                  }}
                  title={language === 'he' ? 'פתח מצב לוקר מוגדל' : 'Open Full-Screen Locker Mode'}
                  className="ms-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-bold cursor-pointer transition-colors shrink-0"
                >
                  <span>PIN {pkg.pickupCode}</span>
                </button>
              )}
              {pkg.isRedirected && (
                <span
                  title={language === 'he' ? 'חברת השילוח העבירה את החבילה לנקודה חלופית' : 'Package was redirected to an alternate pickup location'}
                  className="ms-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold shrink-0"
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span>{t('redirectDetection.badge')}</span>
                </span>
              )}
              {pkg.confidence === 'sender_reported' && (
                <span
                  title={language === 'he'
                    ? 'הסטטוס מבוסס על אימייל אישור הזמנה, ולא על מעקב מאומת מול חברת השילוח'
                    : 'Status is based on your order confirmation email, not carrier-verified tracking'}
                  className="ms-1 inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/50 text-xs font-bold shrink-0"
                >
                  {language === 'he' ? 'מאישור הזמנה' : 'from order confirmation'}
                </span>
              )}
            </div>
          </div>

          <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold border ${stage.badgeClass}`}>
            {language === 'he' ? stage.hebrewLabel : stage.label}
          </span>
        </div>

        {/* Pickup Location & Same-Location Bundling Tag */}
        {pkg.pickupLocation && (
          <div className="flex items-center justify-between gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">{pkg.pickupLocation}</span>
            </div>
            {sameLocationSiblings.length > 0 && (
              <span className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
                {language === 'he' ? `עוד ${sameLocationSiblings.length} כאן` : `+${sameLocationSiblings.length} here`}
              </span>
            )}
          </div>
        )}

        {/* Optional Countdown Banner for Pickup or Return */}
        {pkg.status !== 'delivered' && pickupCountdown.hasDeadline && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
            pickupCountdown.urgency === 'critical' || pickupCountdown.urgency === 'expired'
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              : pickupCountdown.urgency === 'warning'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{language === 'he' ? pickupCountdown.formattedHe : pickupCountdown.formattedEn}</span>
          </div>
        )}

        {pkg.status === 'delivered' && returnCountdown.hasDeadline && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
            returnCountdown.urgency === 'critical' || returnCountdown.urgency === 'expired'
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              : returnCountdown.urgency === 'warning'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
          }`}>
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{language === 'he' ? returnCountdown.formattedHe : returnCountdown.formattedEn}</span>
          </div>
        )}

        {/* Row 2: expected date + quick actions, all on one line */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{formatDate(pkg.expectedDeliveryDate, language)}</span>
            {daysInfo && pkg.status !== 'delivered' && (
              <span
                className={`shrink-0 text-xs px-1.5 py-0.2 rounded-md font-bold ${
                  daysInfo.isUrgent ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {daysInfo.text}
              </span>
            )}
          </div>

          {/* Only the two highest-frequency actions stay visible; everything
              else (copy, carrier link, pin, edit, archive, delete) lives in
              the overflow menu — the whole card is already the "view
              details" tap target, so a 7-icon row was pure clutter. */}
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {onRefreshTracking && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title={t('card.refreshStatus')}
                aria-label={t('card.refreshStatus')}
                className={`p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center ${
                  isRefreshing ? 'animate-spin text-emerald-400' : ''
                }`}
              >
                {isRefreshing ? <Loader2 className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleMarkDelivered}
              title={pkg.status === 'delivered' ? t('card.markActive') : t('card.markDelivered')}
              className={`p-2 rounded-lg transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center ${
                pkg.status === 'delivered' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <CheckCircle className={`w-3.5 h-3.5 ${pkg.status === 'delivered' ? 'fill-emerald-500/20' : ''}`} />
            </button>

            <div className="relative">
              <button
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
                title={t('card.viewDetails')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                  <div
                    className={`absolute z-50 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl py-1 text-xs end-0 ${
                      menuFlipUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        handleCopy(e);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[48px]"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{t('card.copyTracking')}</span>
                    </button>

                    {pkg.pickupCode && onOpenLockerMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onOpenLockerMode(pkg);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-emerald-400 hover:bg-slate-800 hover:text-emerald-300 min-h-[48px] font-semibold"
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>{language === 'he' ? 'מצב לוקר מוגדל' : 'Locker Mode'}</span>
                      </button>
                    )}

                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[48px]"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>{t('card.viewCarrier')}</span>
                    </a>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onTogglePin(pkg.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[48px]"
                    >
                      <Pin className={`w-3.5 h-3.5 ${pkg.isPinned ? 'fill-blue-400 text-blue-400' : ''}`} />
                      <span>{pkg.isPinned ? t('card.unpin') : t('card.pin')}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onEdit(pkg);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[48px]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{t('card.edit')}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onToggleArchive(pkg.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[48px]"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{pkg.isArchived ? t('card.unarchive') : t('card.archive')}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onDelete(pkg.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 min-h-[48px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
