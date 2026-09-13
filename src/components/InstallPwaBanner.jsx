import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { recordFeatureUse } from '../services/featureUsageService';
import { FEATURE_IDS } from '../constants/featureIds';

const STORAGE_DISMISS_KEY = STORAGE_KEYS.PWA_BANNER_DISMISSED;

/**
 * @param {object} props
 * @param {(visible: boolean) => void} [props.onVisibilityChange] Reports whether
 *   the banner is on screen, so the caller can avoid stacking a second
 *   promotional banner underneath it.
 */
export function InstallPwaBanner({ onVisibilityChange } = {}) {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // 1. Check if already running as standalone PWA
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(checkStandalone);

    // 2. Check if user dismissed recently
    const dismissedTime = localStorage.getItem(STORAGE_DISMISS_KEY);
    if (dismissedTime) {
      const daysSinceDismiss = (Date.now() - Number(dismissedTime)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 7) {
        setDismissed(true);
      }
    }

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    if (isIOSDevice && isSafari && !checkStandalone) {
      setIsIOS(true);
    }

    // 4. Capture beforeinstallprompt event on Chromium / Android
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setDismissed(true);
          recordFeatureUse(FEATURE_IDS.PWA_INSTALL, { uid: user?.id || null });
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
        setShowIOSGuide(true);
      }
    } else {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_DISMISS_KEY, Date.now().toString());
  };

  const isVisible = !isStandalone && !dismissed;

  // Reported rather than inferred by the caller: the decision depends on
  // standalone mode, a 7-day dismissal window and `beforeinstallprompt`, none
  // of which App can see.
  useEffect(() => {
    if (onVisibilityChange) onVisibilityChange(isVisible);
  }, [isVisible, onVisibilityChange]);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div 
        className={`sticky top-16 z-30 mx-4 my-2 md:mx-auto md:max-w-xl bg-gradient-to-r from-blue-900/90 to-indigo-900/90 backdrop-blur-md border border-blue-500/30 rounded-2xl p-4 shadow-xl shadow-blue-950/40 transition-ui duration-300 animate-in fade-in slide-in-from-top-2 ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden shadow-md">
              <img src="/icons/app-icon.png" alt="SpotLi" className="w-full h-full object-cover" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {isRTL ? 'התקן את SpotLi בסמארטפון' : 'Install SpotLi on Your Phone'}
              </h4>
              <p className="text-xs text-blue-200/80 mt-0.5">
                {isRTL 
                  ? 'השתמש כאפליקציה מלאה ללא הורדה מחנות האפליקציות'
                  : 'Fast, full-screen access directly from your home screen'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-blue-300 hover:text-slate-100 p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstallClick}
            aria-label={isIOS
              ? (isRTL ? 'איך להתקין באייפון?' : 'How to install on iOS?')
              : (isRTL ? 'התקן עכשיו' : 'Install App')}
            className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-md shadow-blue-600/30 transition-ui cursor-pointer min-h-[48px]"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            {isIOS 
              ? (isRTL ? 'איך להתקין באייפון?' : 'How to install on iOS?')
              : (isRTL ? 'התקן עכשיו' : 'Install App')}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={isRTL ? 'לא עכשיו' : 'Not now'}
            className="px-3 py-2 text-xs font-medium text-blue-200 hover:text-slate-100 hover:bg-white/10 rounded-xl transition-colors cursor-pointer min-h-[48px]"
          >
            {isRTL ? 'לא עכשיו' : 'Not now'}
          </button>
        </div>
      </div>

      {/* Installation Instruction Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-guide-title"
            className={`bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-slate-100 animate-modal-pop ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="ios-guide-title" className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" aria-hidden="true" />
                {isIOS 
                  ? (isRTL ? 'התקנה באייפון (iOS)' : 'Install on iPhone (iOS)')
                  : (isRTL ? 'התקנה בסמארטפון / מחשב' : 'Install on Mobile / Desktop')}
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label={isRTL ? 'סגור הוראות התקנה' : 'Close installation guide'}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-xs text-slate-300 mb-6">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs" aria-hidden="true">1</span>
                  <span>
                    {isRTL ? 'לחץ על כפתור השיתוף בספארי ' : 'Tap the Share button in Safari '}
                    <Share className="w-4 h-4 inline text-blue-400 mx-1" aria-hidden="true" />
                    {isRTL ? 'בתחתית המסך' : 'at the bottom'}
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs" aria-hidden="true">2</span>
                  <span>
                    {isRTL ? 'גלול למטה ובחר ' : 'Scroll down and tap '}
                    <strong className="text-slate-100">"{isRTL ? 'הוסף למסך הבית' : 'Add to Home Screen'}"</strong>
                    <PlusSquare className="w-4 h-4 inline text-blue-400 mx-1" aria-hidden="true" />
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs" aria-hidden="true">3</span>
                  <span>
                    {isRTL ? 'לחץ על ' : 'Tap '}
                    <strong className="text-slate-100">"{isRTL ? 'הוסף' : 'Add'}"</strong>
                    {isRTL ? ' בפינה העליונה' : ' in the top right corner'}
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-xs text-slate-300 mb-6">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs" aria-hidden="true">1</span>
                  <span>
                    {isRTL ? 'פתח את תפריט הדפדפן (⋮) בפינה העליונה' : 'Open browser menu (⋮) in top right'}
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs" aria-hidden="true">2</span>
                  <span>
                    {isRTL ? 'בחר ' : 'Select '}
                    <strong className="text-slate-100">"{isRTL ? 'התקן אפליקציה' : 'Install app'}"</strong>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs" aria-hidden="true">3</span>
                  <span>
                    {isRTL ? 'אשר את ההתקנה ותיהנה מחוויית אפליקציה מלאה!' : 'Confirm install to enjoy full-screen app access!'}
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition-colors min-h-[48px]"
            >
              {isRTL ? 'הבנתי, תודה!' : 'Got it!'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
