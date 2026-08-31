import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { recordFeatureUse } from '../services/featureUsageService';
import { FEATURE_IDS } from '../constants/featureIds';

const STORAGE_DISMISS_KEY = STORAGE_KEYS.PWA_BANNER_DISMISSED;

export function InstallPwaBanner() {
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

  if (isStandalone || dismissed) {
    return null;
  }

  return (
    <>
      <div 
        className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40 bg-gradient-to-r from-blue-900/90 to-indigo-900/90 backdrop-blur-md border border-blue-500/30 rounded-2xl p-4 shadow-2xl shadow-blue-950/60 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {isRTL ? 'התקן את Deliveree בסמארטפון' : 'Install Deliveree on Your Phone'}
              </h4>
              <p className="text-xs text-blue-200/80 mt-0.5">
                {isRTL 
                  ? 'השתמש כאפליקציה מלאה ללא הורדה מחנות האפליקציות'
                  : 'Fast, full-screen access directly from your home screen'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-blue-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-md shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isIOS 
              ? (isRTL ? 'איך להתקין באייפון?' : 'How to install on iOS?')
              : (isRTL ? 'התקן עכשיו' : 'Install App')}
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-xs font-medium text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            {isRTL ? 'לא עכשיו' : 'Not now'}
          </button>
        </div>
      </div>

      {/* Installation Instruction Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-slate-100 ${isRTL ? 'text-right' : 'text-left'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                {isIOS 
                  ? (isRTL ? 'התקנה באייפון (iOS)' : 'Install on iPhone (iOS)')
                  : (isRTL ? 'התקנה בסמארטפון / מחשב' : 'Install on Mobile / Desktop')}
              </h3>
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-xs text-slate-300 mb-6">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                  <span>
                    {isRTL ? 'לחץ על כפתור השיתוף בספארי ' : 'Tap the Share button in Safari '}
                    <Share className="w-4 h-4 inline text-blue-400 mx-1" />
                    {isRTL ? 'בתחתית המסך' : 'at the bottom'}
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                  <span>
                    {isRTL ? 'גלול למטה ובחר ' : 'Scroll down and tap '}
                    <strong className="text-white">"{isRTL ? 'הוסף למסך הבית' : 'Add to Home Screen'}"</strong>
                    <PlusSquare className="w-4 h-4 inline text-blue-400 mx-1" />
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                  <span>
                    {isRTL ? 'לחץ על ' : 'Tap '}
                    <strong className="text-white">"{isRTL ? 'הוסף' : 'Add'}"</strong>
                    {isRTL ? ' בפינה העליונה' : ' in the top right corner'}
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-xs text-slate-300 mb-6">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                  <span>
                    {isRTL ? 'פתח את תפריט הדפדפן (⋮) בפינה העליונה' : 'Open browser menu (⋮) in top right'}
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                  <span>
                    {isRTL ? 'בחר ' : 'Select '}
                    <strong className="text-white">"{isRTL ? 'התקן אפליקציה' : 'Install app'}"</strong>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                  <span>
                    {isRTL ? 'אשר את ההתקנה ותיהנה מחוויית אפליקציה מלאה!' : 'Confirm install to enjoy full-screen app access!'}
                  </span>
                </li>
              </ol>
            )}

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition-colors"
            >
              {isRTL ? 'הבנתי, תודה!' : 'Got it!'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
