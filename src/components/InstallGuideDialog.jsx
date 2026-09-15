import React from 'react';
import { X, Share, PlusSquare, Smartphone } from 'lucide-react';

/**
 * How to install the app, for a platform that gives no install prompt of its
 * own.
 *
 * Extracted from InstallPwaBanner when the sign-in screen needed the same
 * steps: on iPhone the installed app keeps its own session, so a person who
 * signs in first and installs second signs in twice. AuthModal offers the
 * install *before* the form, and it has to be able to show these exact steps
 * without restating them — two copies of an instruction like this drift the
 * moment iOS moves a menu item.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {boolean} props.isIOS iOS gets the Share-sheet steps; everything else the browser-menu ones
 * @param {boolean} props.isRTL
 */
export function InstallGuideDialog({ isOpen, onClose, isIOS, isRTL }) {
  if (!isOpen) return null;

  return (
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
            onClick={() => onClose()}
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
          onClick={() => onClose()}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition-colors min-h-[48px]"
        >
          {isRTL ? 'הבנתי, תודה!' : 'Got it!'}
        </button>
      </div>
    </div>
  );
}
