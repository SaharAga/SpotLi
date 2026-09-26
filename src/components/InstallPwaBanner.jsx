import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { recordFeatureUse } from '../services/featureUsageService';
import { FEATURE_IDS } from '../constants/featureIds';
import { isStandalonePwa } from '../utils/displayMode';
import { InstallGuideDialog } from './InstallGuideDialog';

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
    // 1. Check if already running as standalone PWA.
    // Held in a local too: the state setter below is asynchronous, so `isStandalone`
    // is still false further down this same effect, and step 3 needs the real answer.
    const standalone = isStandalonePwa();
    setIsStandalone(standalone);

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
    if (isIOSDevice && isSafari && !standalone) {
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
            className="text-blue-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 min-h-[48px] min-w-[48px] flex items-center justify-center"
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
            className="px-3 py-2 text-xs font-medium text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer min-h-[48px]"
          >
            {isRTL ? 'לא עכשיו' : 'Not now'}
          </button>
        </div>
      </div>

      {/* Installation Instruction Modal */}
      <InstallGuideDialog
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
        isIOS={isIOS}
        isRTL={isRTL}
      />
    </>
  );
}
