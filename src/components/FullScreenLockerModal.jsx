import React, { useState, useEffect } from 'react';
import { 
  X, Check, Copy, ExternalLink, MapPin, Sparkles, Navigation, Clock, CheckCircle2, ShieldCheck, Sun
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Modal } from './Modal';
import { useLanguage } from '../context/LanguageContext';
import { getCarrier } from '../types/carriers';
import { copyToClipboard } from '../utils/clipboard';
import { getLiveStoreStatus } from '../utils/openingHoursService';
import { getPreferredNavigationApp, openNavigationApp } from '../utils/navigationService';

export function FullScreenLockerModal({
  isOpen,
  onClose,
  pkg,
  onMarkDelivered,
  onOpenNavigation,
  onShowToast
}) {
  const { t, isRTL, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  // Screen Wake Lock API — keeps screen on and prevents dimming in bright daylight
  useEffect(() => {
    if (!isOpen) return;
    let wakeLock = null;
    let isSubscribed = true;

    const requestLock = async () => {
      try {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Gracefully ignore if browser policies or battery saver block wake lock
      }
    };

    requestLock();

    return () => {
      isSubscribed = false;
      if (wakeLock && typeof wakeLock.release === 'function') {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isOpen]);

  if (!isOpen || !pkg) return null;

  const carrier = getCarrier(pkg.carrier);
  const title = (language === 'he' && pkg.titleHe) ? pkg.titleHe : pkg.title;
  const pin = pkg.pickupCode || '';
  const storeStatus = getLiveStoreStatus(pkg.pickupHours, { locationName: pkg.pickupLocation, carrier: pkg.carrier });

  const handleCopyPin = async () => {
    if (!pin) return;
    const success = await copyToClipboard(pin);
    if (success) {
      setCopied(true);
      if (onShowToast) {
        onShowToast(t('lockerMode.copied'), 'success');
      }
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleMarkAsDelivered = async () => {
    if (isMarking) return;
    setIsMarking(true);
    try {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      if (onMarkDelivered) {
        await onMarkDelivered(pkg.id, 'delivered');
      }
      if (onShowToast) {
        onShowToast(language === 'he' ? 'החבילה סומנה כנמסרה בהצלחה! 🎉' : 'Package marked as collected! 🎉', 'success');
      }
      onClose();
    } catch {
      if (onShowToast) {
        onShowToast(language === 'he' ? 'שגיאה בעדכון הסטטוס' : 'Failed to update status', 'error');
      }
    } finally {
      setIsMarking(false);
    }
  };

  const handleNavigate = () => {
    if (!pkg.pickupLocation) return;
    const preferred = getPreferredNavigationApp();
    if (preferred) {
      openNavigationApp(preferred, { location: pkg.pickupLocation, title });
    } else if (onOpenNavigation) {
      onOpenNavigation({ location: pkg.pickupLocation, title });
    } else {
      openNavigationApp('google_maps', { location: pkg.pickupLocation, title });
    }
  };

  const whatsappProxyUrl = `https://wa.me/?text=${encodeURIComponent(
    language === 'he'
      ? `היי, אשמח שתיקח עבורי חבילה (${title})!\nקוד איסוף לוקר: ${pin || 'אין'}\nמיקום: ${pkg.pickupLocation || 'לא צוין'}`
      : `Hey, could you pick up my package (${title})?\nLocker PIN: ${pin || 'N/A'}\nLocation: ${pkg.pickupLocation || 'N/A'}`
  )}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="FullScreenLockerModal"
      className="relative w-full max-w-xl bg-slate-950 border-2 border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden my-4 max-h-[95vh] flex flex-col text-slate-100"
    >
      {/* Sunlight-Proof Header */}
      <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Sun className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>{t('lockerMode.title')}</span>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {language === 'he' ? carrier.hebrewName : carrier.name}
              </span>
            </h2>
            <p className="text-xs text-slate-400 truncate max-w-[240px] sm:max-w-xs font-medium">
              {title}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={t('common.close') || 'Close'}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Body with Oversized PIN */}
      <div className="p-6 overflow-y-auto space-y-6 flex-1 flex flex-col justify-center items-center text-center">
        
        {/* Wake Lock & High-Brightness Indicator */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-emerald-300/90 font-medium">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('lockerMode.wakeLockActive')}</span>
        </div>

        {/* Giant Monospace PIN Code Card */}
        <div className="w-full">
          <span className="text-xs text-emerald-400 uppercase tracking-widest font-black block mb-2">
            {t('lockerMode.pickupPin')}
          </span>

          <div
            onClick={handleCopyPin}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCopyPin();
              }
            }}
            className="w-full p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-emerald-400/50 hover:border-emerald-300 transition-all cursor-pointer group shadow-2xl shadow-emerald-950/60 relative overflow-hidden"
            title={t('lockerMode.tapToCopy')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none" />

            {/* Giant Monospace Digits */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
              {pin ? (
                pin.split('').map((char, i) => (
                  <div
                    key={i}
                    className="w-12 h-16 sm:w-16 sm:h-20 bg-slate-950 border border-emerald-500/40 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform"
                  >
                    <span className="text-3xl sm:text-5xl font-black text-emerald-100 font-mono tracking-tighter">
                      {char}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-2xl font-bold text-slate-500 font-mono">
                  {language === 'he' ? 'אין קוד' : 'NO CODE'}
                </span>
              )}
            </div>

            {/* Tap to copy feedback hint */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 group-hover:text-emerald-300 transition-colors">
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 animate-bounce" />
                  <span className="text-emerald-400 font-bold">{t('lockerMode.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('lockerMode.tapToCopy')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Location & Live Hours Banner */}
        {pkg.pickupLocation && (
          <div className="w-full p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-3 text-start">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                  {pkg.pickupLocation}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${storeStatus.badgeClass}`}>
                    {language === 'he' ? storeStatus.badgeTextHe : storeStatus.badgeTextEn}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {language === 'he' ? storeStatus.nextChangeHe : storeStatus.nextChangeEn}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNavigate}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white transition-colors shrink-0 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={t('lockerMode.navigate')}
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

      {/* High-Action Bottom Dock */}
      <div className="p-5 border-t border-slate-800 bg-slate-950 space-y-3">
        {/* Primary Action: Mark as Collected */}
        <button
          type="button"
          onClick={handleMarkAsDelivered}
          disabled={isMarking}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[54px]"
        >
          <CheckCircle2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          <span>{isMarking ? t('lockerMode.markingDelivered') : t('lockerMode.markDelivered')}</span>
        </button>

        {/* Secondary Actions Row */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={whatsappProxyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold text-xs border border-emerald-900/60 transition-all flex items-center justify-center gap-2 min-h-[48px]"
          >
            <ExternalLink className="w-4 h-4" />
            <span>{t('lockerMode.shareWhatsApp')}</span>
          </a>

          <button
            type="button"
            onClick={handleNavigate}
            disabled={!pkg.pickupLocation}
            className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-400 hover:text-blue-300 font-bold text-xs border border-blue-900/60 transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-4 h-4" />
            <span>{t('lockerMode.navigate')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
