import React, { useState, useEffect } from 'react';
import { 
  X, Check, Copy, ExternalLink, MapPin, Sparkles, Navigation, Clock, CheckCircle2, ShieldCheck, Sun, Layers, Phone
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Modal } from './Modal';
import { useLanguage } from '../context/LanguageContext';
import { getCarrier } from '../types/carriers';
import { copyToClipboard } from '../utils/clipboard';
import { getLiveStoreStatus } from '../utils/openingHoursService';
import { getPreferredNavigationApp, openNavigationApp } from '../utils/navigationService';
import { findSameLocationPackages } from '../utils/locationBundling';

export function FullScreenLockerModal({
  isOpen,
  onClose,
  pkg,
  packages = [],
  onMarkDelivered,
  onOpenNavigation,
  onShowToast
}) {
  const { t, isRTL, language } = useLanguage();
  const [copiedId, setCopiedId] = useState(null);
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

  const siblingPackages = findSameLocationPackages(pkg, packages);
  const bundledList = [pkg, ...siblingPackages];
  const isBundled = bundledList.length > 1;

  const carrier = getCarrier(pkg.carrier);
  const title = (language === 'he' && pkg.titleHe) ? pkg.titleHe : pkg.title;
  const pin = pkg.pickupCode || '';
  const storeStatus = getLiveStoreStatus(pkg.pickupHours, { locationName: pkg.pickupLocation, carrier: pkg.carrier });

  const handleCopyPin = async (itemPin, itemId) => {
    if (!itemPin) return;
    const success = await copyToClipboard(itemPin);
    if (success) {
      setCopiedId(itemId);
      if (onShowToast) {
        onShowToast(t('lockerMode.copied'), 'success');
      }
      setTimeout(() => setCopiedId((curr) => (curr === itemId ? null : curr)), 2500);
    }
  };

  const handleMarkAsDelivered = async () => {
    if (isMarking) return;
    setIsMarking(true);
    try {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: isBundled ? 110 : 80,
          spread: 75,
          origin: { y: 0.6 }
        });
      }
      if (onMarkDelivered) {
        for (const item of bundledList) {
          await onMarkDelivered(item.id, 'delivered');
        }
      }
      if (onShowToast) {
        if (isBundled) {
          const msg = (t('locationBundling.collectAllSuccess') || '{count} packages marked as collected! 🎉')
            .replace('{count}', String(bundledList.length));
          onShowToast(msg, 'success');
        } else {
          onShowToast(language === 'he' ? 'החבילה סומנה כנמסרה בהצלחה! 🎉' : 'Package marked as collected! 🎉', 'success');
        }
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

  const whatsappProxyText = isBundled
    ? (language === 'he'
        ? `היי, אשמח שתיקח עבורי ${bundledList.length} חבילות!\nמיקום: ${pkg.pickupLocation || 'לא צוין'}\n\n` +
          bundledList.map((item, idx) => `${idx + 1}. ${(item.titleHe || item.title)} — קוד: ${item.pickupCode || 'ללא קוד'}${item.shelfNumber ? ` (מדף: ${item.shelfNumber})` : ''} (${item.trackingNumber})`).join('\n')
        : `Hey, could you pick up ${bundledList.length} packages for me?\nLocation: ${pkg.pickupLocation || 'N/A'}\n\n` +
          bundledList.map((item, idx) => `${idx + 1}. ${item.title} — PIN: ${item.pickupCode || 'None'}${item.shelfNumber ? ` (Shelf: ${item.shelfNumber})` : ''} (${item.trackingNumber})`).join('\n')
      )
    : (language === 'he'
        ? `היי, אשמח שתיקח עבורי חבילה (${title})!\nקוד איסוף לוקר: ${pin || 'אין'}${pkg.shelfNumber ? `\nמספר מדף: ${pkg.shelfNumber}` : ''}\nמיקום: ${pkg.pickupLocation || 'לא צוין'}`
        : `Hey, could you pick up my package (${title})?\nLocker PIN: ${pin || 'N/A'}${pkg.shelfNumber ? `\nShelf: ${pkg.shelfNumber}` : ''}\nLocation: ${pkg.pickupLocation || 'N/A'}`
      );

  const whatsappProxyUrl = `https://wa.me/?text=${encodeURIComponent(whatsappProxyText)}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="FullScreenLockerModal"
      className="relative w-full max-w-xl bg-slate-950 border-2 border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden my-4 max-h-[95vh] flex flex-col text-slate-100"
    >
      {/* Sunlight-Proof Header */}
      <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            {isBundled ? <Layers className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>
                {isBundled
                  ? (language === 'he' ? `איסוף מרוכז (${bundledList.length} חבילות)` : `Bundled Pickup (${bundledList.length} Packages)`)
                  : t('lockerMode.title')}
              </span>
              {!isBundled && (
                <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  {language === 'he' ? carrier.hebrewName : carrier.name}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 truncate max-w-[240px] sm:max-w-xs font-medium">
              {isBundled
                ? (language === 'he' ? `${bundledList.length} חבילות ממתינות באותה נקודה` : `${bundledList.length} packages waiting at this spot`)
                : title}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
          aria-label={t('common.close') || 'Close'}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Body with Oversized PIN(s) */}
      <div className="p-6 overflow-y-auto space-y-6 flex-1 flex flex-col items-center">
        
        {/* Wake Lock & High-Brightness Indicator */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-emerald-300/90 font-medium">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('lockerMode.wakeLockActive')}</span>
        </div>

        {/* Option A: Vertical Stack of PIN Cards (Supports both single and bundled packages) */}
        <div className="w-full space-y-5">
          {bundledList.map((item) => {
            const itemTitle = (language === 'he' && item.titleHe) ? item.titleHe : item.title;
            const itemCarrier = getCarrier(item.carrier);
            const itemPin = item.pickupCode || '';
            const isCopied = copiedId === item.id;

            return (
              <div
                key={item.id}
                className="w-full p-5 sm:p-6 rounded-3xl bg-slate-900/90 border-2 border-emerald-400/50 hover:border-emerald-300 transition-ui shadow-2xl shadow-emerald-950/60 relative overflow-hidden text-center"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none" />

                {/* Package Label Header in Stack */}
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-emerald-500/20 text-xs">
                  <span className="font-extrabold text-emerald-300 truncate max-w-[220px] sm:max-w-xs text-start">
                    {itemTitle}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 shrink-0">
                    {item.trackingNumber}
                  </span>
                </div>

                {item.shelfNumber && (
                  <div className="mb-3 px-3 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 inline-flex items-center gap-2 shadow-sm">
                    <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                      {language === 'he' ? 'מדף / מספר איסוף' : 'Shelf / Bin'}:
                    </span>
                    <span className="text-lg sm:text-xl font-mono font-black text-amber-200">
                      {item.shelfNumber}
                    </span>
                  </div>
                )}

                <span className="text-xs text-emerald-400 uppercase tracking-widest font-black block mb-2">
                  {itemPin ? t('lockerMode.pickupPin') : t('locationBundling.pinCode')}
                </span>

                {/* Giant Monospace Digits or Desk Instruction */}
                <div
                  onClick={() => handleCopyPin(itemPin, item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCopyPin(itemPin, item.id);
                    }
                  }}
                  className={`flex items-center justify-center gap-2 sm:gap-3 flex-wrap ${itemPin ? 'cursor-pointer group' : ''}`}
                  title={itemPin ? t('lockerMode.tapToCopy') : ''}
                >
                  {itemPin ? (
                    itemPin.split('').map((char, i) => (
                      <div
                        key={i}
                        className="w-11 h-14 sm:w-14 sm:h-18 bg-slate-950 border border-emerald-500/40 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform"
                      >
                        <span className="text-2xl sm:text-4xl font-black text-emerald-100 font-mono tracking-tighter">
                          {char}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400">
                      <span className="font-semibold">{t('locationBundling.noPin')}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{t('locationBundling.storeClerkHint')}</p>
                    </div>
                  )}
                </div>

                {/* Tap to copy feedback hint */}
                {itemPin && (
                  <div
                    onClick={() => handleCopyPin(itemPin, item.id)}
                    className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
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
                )}
              </div>
            );
          })}
        </div>

        {/* Location & Live Hours Banner */}
        {pkg.pickupLocation && (
          <div className="w-full p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-3 text-start">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                    {pkg.pickupLocation}
                  </h4>
                  {pkg.isRedirected && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      {t('redirectDetection.badge')}
                    </span>
                  )}
                </div>
                {pkg.isRedirected && pkg.originalPickupLocation && (
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    <span className="opacity-75">{t('redirectDetection.originalLocation')} </span>
                    <span className="line-through">{pkg.originalPickupLocation}</span>
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-bold border ${storeStatus.badgeClass}`}>
                    {language === 'he' ? storeStatus.badgeTextHe : storeStatus.badgeTextEn}
                  </span>
                  <span className="text-xs text-slate-400">
                    {language === 'he' ? storeStatus.nextChangeHe : storeStatus.nextChangeEn}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNavigate}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white transition-colors shrink-0 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
              title={t('lockerMode.navigate')}
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

      {/* High-Action Bottom Dock */}
      <div className="p-5 border-t border-slate-800 bg-slate-950 space-y-3 shrink-0">
        {/* Primary Action: Mark as Collected */}
        <button
          type="button"
          onClick={handleMarkAsDelivered}
          disabled={isMarking}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 transition-ui flex items-center justify-center gap-2 cursor-pointer min-h-[54px]"
        >
          <CheckCircle2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          <span>
            {isMarking
              ? t('lockerMode.markingDelivered')
              : isBundled
              ? (t('locationBundling.collectAll') || 'Mark All as Collected ({count})').replace('{count}', String(bundledList.length))
              : t('lockerMode.markDelivered')}
          </span>
        </button>

        {/* Secondary Actions Row */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={whatsappProxyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold text-xs border border-emerald-900/60 transition-ui flex items-center justify-center gap-2 min-h-[48px]"
          >
            <ExternalLink className="w-4 h-4" />
            <span>
              {isBundled
                ? t('locationBundling.shareAllWhatsApp')
                : t('lockerMode.shareWhatsApp')}
            </span>
          </a>

          <button
            type="button"
            onClick={handleNavigate}
            disabled={!pkg.pickupLocation}
            className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-400 hover:text-blue-300 font-bold text-xs border border-blue-900/60 transition-ui flex items-center justify-center gap-2 min-h-[48px] cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-4 h-4" />
            <span>{t('lockerMode.navigate')}</span>
          </button>
        </div>

        {/* Optional Call Store Shortcut */}
        {pkg.pickupPhone && (
          <a
            href={`tel:${pkg.pickupPhone}`}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 font-bold text-xs border border-slate-800 transition-ui flex items-center justify-center gap-2 min-h-[48px]"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{t('phoneActions.callStore')} ({pkg.pickupPhone})</span>
          </a>
        )}
      </div>
    </Modal>
  );
}
