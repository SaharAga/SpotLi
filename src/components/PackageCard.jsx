import React, { useState, useRef } from 'react';
import {
  Copy, Check, MoreVertical, Pin, Archive, Trash2, Edit3,
  Calendar, CheckCircle, ArrowUpRight, RefreshCw, Loader2, Package
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CARRIERS } from '../types/carriers';
import { detectStore } from '../utils/storeDetector';
import { copyToClipboard } from '../utils/clipboard';
import { STAGES } from '../types/stages';
import { useLanguage } from '../context/LanguageContext';
import { formatDate, getDaysRemaining } from '../utils/dateUtils';
import { triggerHapticFeedback } from '../utils/haptics';
import { checkRateLimit } from '../services/trackingService';

function PackageCardImpl({
  pkg,
  onOpenDetails,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onStatusChange,
  onRefreshTracking,
  onShowToast
}) {
  const { t, language, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mobile Swipe Gesture State
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const hapticTriggeredRef = useRef(false);

  const carrier = CARRIERS[pkg.carrier] || CARRIERS['other'];
  const store = detectStore(pkg);
  const daysInfo = getDaysRemaining(pkg.expectedDeliveryDate, language);

  const trackingUrl = carrier.getTrackingUrl(pkg.trackingNumber);

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

    if (Math.abs(deltaX) > 15) {
      setIsSwiping(true);
      // Dampen swipe drag distance
      const boundedOffset = Math.max(-120, Math.min(120, deltaX));
      setSwipeOffset(boundedOffset);

      if (Math.abs(boundedOffset) >= 80 && !hapticTriggeredRef.current) {
        triggerHapticFeedback(18);
        hapticTriggeredRef.current = true;
      } else if (Math.abs(boundedOffset) < 80) {
        hapticTriggeredRef.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;

    if (swipeOffset >= 80) {
      // Swiped Right -> Toggle Archive
      onToggleArchive(pkg.id);
      triggerHapticFeedback([10, 50, 20]);
    } else if (swipeOffset <= -80) {
      // Swiped Left -> Delete
      onDelete(pkg.id);
      triggerHapticFeedback([20, 40, 30]);
    }

    setSwipeOffset(0);
    setIsSwiping(false);
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
  const stage = STAGES.find(s => s.id === pkg.status) || STAGES[0];

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe Action Background Indicator */}
      {isSwiping && (
        <div className="absolute inset-0 flex items-center justify-between px-6 rounded-2xl transition-colors">
          <div className={`flex items-center gap-2 font-bold text-xs ${swipeOffset > 40 ? 'text-amber-400 opacity-100' : 'opacity-0'}`}>
            <Archive className="w-5 h-5" />
            <span>{pkg.isArchived ? t('card.unarchive') : t('card.archive')}</span>
          </div>
          <div className={`flex items-center gap-2 font-bold text-xs ${swipeOffset < -40 ? 'text-rose-400 opacity-100' : 'opacity-0'}`}>
            <span>{t('card.delete')}</span>
            <Trash2 className="w-5 h-5" />
          </div>
        </div>
      )}

      <div
        onClick={() => onOpenDetails(pkg)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : 'none',
          transition: isSwiping ? 'none' : 'transform 0.25s ease-out'
        }}
        className={`group relative bg-slate-900 hover:bg-slate-800 border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 shadow-sm hover:shadow-md ${
          pkg.isPinned ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Row 1: leading icon, title + tracking/carrier meta, status pill */}
        <div className="flex items-start gap-3">
          <div className={`relative p-2 rounded-xl shrink-0 ${stage.badgeClass.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ')}`}>
            <Package className="w-4 h-4" />
            {pkg.isPinned && (
              <Pin
                className={`absolute -top-1 w-3 h-3 fill-blue-400 text-blue-400 ${isRTL ? '-left-1' : '-right-1'}`}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
              {itemTitle}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 truncate">
              <span className="font-mono"><bdi dir="ltr">{pkg.trackingNumber}</bdi></span>
              <span className="opacity-50">·</span>
              <span className="truncate">
                {store ? (language === 'he' ? store.hebrewName : store.name) + ' — ' : ''}
                {language === 'he' ? carrier.hebrewName : carrier.name}
              </span>
            </div>
          </div>

          <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold border ${stage.badgeClass}`}>
            {language === 'he' ? stage.hebrewLabel : stage.label}
          </span>
        </div>

        {/* Row 2: expected date + quick actions, all on one line */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{formatDate(pkg.expectedDeliveryDate, language)}</span>
            {daysInfo && pkg.status !== 'delivered' && (
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
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
                className={`p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                  isRefreshing ? 'animate-spin text-emerald-400' : ''
                }`}
              >
                {isRefreshing ? <Loader2 className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleMarkDelivered}
              title={pkg.status === 'delivered' ? t('card.markActive') : t('card.markDelivered')}
              className={`p-2 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                pkg.status === 'delivered' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <CheckCircle className={`w-3.5 h-3.5 ${pkg.status === 'delivered' ? 'fill-emerald-500/20' : ''}`} />
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                title={t('card.viewDetails')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                  <div
                    className={`absolute z-40 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 text-xs ${
                      isRTL ? 'left-0' : 'right-0'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        handleCopy(e);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[40px]"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{t('card.copyTracking')}</span>
                    </button>

                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[40px]"
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
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[40px]"
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
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[40px]"
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
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[40px]"
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
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 min-h-[40px]"
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
