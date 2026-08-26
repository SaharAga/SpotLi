import React, { useState } from 'react';
import { ShieldCheck, FileText, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LegalDocumentModal } from './LegalDocumentModal';
import { Modal } from './Modal';

/**
 * Blocking, non-dismissable overlay shown to any signed-in user whose stored
 * `legalAcceptedVersion` doesn't match the current LEGAL_VERSION — brand new
 * OAuth sign-ups (who never saw a registration form) and existing accounts
 * from before this feature shipped, alike. Email/password registration
 * collects the same acceptance inline (AuthModal), so a fresh email signup
 * normally never sees this gate.
 *
 * The only way out besides accepting is signing out — there's no X button,
 * this isn't meant to be dismissable.
 */
export function LegalConsentGate({ onShowToast }) {
  const { user, acceptLegalTerms, logout } = useAuth();
  const { language } = useLanguage();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [aiOptIn, setAiOptIn] = useState(false);
  const [openDoc, setOpenDoc] = useState(null); // 'terms' | 'privacy' | null
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsConsent = !!(user && !user.legalAcceptedVersion);
  if (!needsConsent) return null;

  const handleContinue = async () => {
    if (!agreedToTerms || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await acceptLegalTerms(aiOptIn);
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'תודה, אפשר להמשיך!' : 'Thanks, you’re all set!',
          'success'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        componentName="LegalConsentGate"
        layer="gate"
        overlayClassName="bg-slate-950/95"
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
          <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  {language === 'he' ? 'לפני שממשיכים' : 'Before you continue'}
                </h2>
                <p className="text-xs text-slate-400">
                  {language === 'he'
                    ? 'עדכנו את תנאי השימוש ומדיניות הפרטיות'
                    : 'We’ve updated the Terms of Use & Privacy Policy'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <p className="text-slate-300 leading-relaxed">
              {language === 'he'
                ? 'כדי להמשיך להשתמש בחשבון שלך, יש לאשר את תנאי השימוש ומדיניות הפרטיות המעודכנים.'
                : 'To keep using your account, please review and agree to the current Terms of Use and Privacy Policy.'}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpenDoc('terms')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'תנאי שימוש' : 'Terms of Use'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenDoc('privacy')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy'}</span>
              </button>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700 focus:ring-blue-500 cursor-pointer shrink-0"
              />
              <span className="text-slate-300 leading-snug">
                {language === 'he'
                  ? 'קראתי ואני מסכים/ה לתנאי השימוש ולמדיניות הפרטיות. *'
                  : 'I have read and agree to the Terms of Use and Privacy Policy. *'}
              </span>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={aiOptIn}
                onChange={(e) => setAiOptIn(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700 focus:ring-blue-500 cursor-pointer shrink-0"
              />
              <span className="text-slate-300 leading-snug flex items-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  {language === 'he'
                    ? 'עזרו לשפר את הדיוק: שמרו את הטקסט שהדבקתי ואת התיקונים שביצעתי, כדי לשפר את מנוע החילוץ (לא כולל תמונות). ניתן לשנות בכל עת בהגדרות.'
                    : 'Help us improve accuracy: store the text I paste and any corrections I make, to improve the parser (never images). Changeable anytime in Settings.'}
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!agreedToTerms || isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer min-h-[48px]"
            >
              {language === 'he' ? 'המשך' : 'Continue'}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-1.5 text-slate-500 hover:text-slate-300 text-[11px] font-semibold cursor-pointer py-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'he' ? 'התנתקות במקום זאת' : 'Sign out instead'}</span>
            </button>
          </div>
        </Modal>

      <LegalDocumentModal isOpen={!!openDoc} onClose={() => setOpenDoc(null)} docType={openDoc || 'terms'} />
    </>
  );
}
