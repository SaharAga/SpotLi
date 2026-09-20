import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, Cloud, Check, AlertCircle,
  Mail, User, Lock, Loader2, LogOut, Trash2, ArrowLeft, Sparkles, Smartphone, ChevronRight, Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { isStandalonePwa } from '../utils/displayMode';
import { InstallGuideDialog } from './InstallGuideDialog';
const LegalDocumentModal = React.lazy(() => import('./LegalDocumentModal').then(module => ({ default: module.LegalDocumentModal })));
import { APP_VERSION } from '../constants/version';
import { Modal } from './Modal';

export function calculatePasswordStrength(password) {
  const str = typeof password === 'string' ? password : '';
  const criteria = {
    length: str.length >= 8,
    lowercase: /[a-zא-ת]/.test(str),
    uppercase: /[A-Z]/.test(str),
    number: /[0-9]/.test(str),
    symbol: /[^A-Za-z0-9א-ת]/.test(str)
  };

  if (!str) {
    return {
      score: 0,
      level: 'none',
      labelHe: '',
      labelEn: '',
      colorClass: 'bg-slate-800',
      textClass: 'text-slate-500',
      criteria
    };
  }

  const charVariety = [
    criteria.lowercase,
    criteria.uppercase,
    criteria.number,
    criteria.symbol
  ].filter(Boolean).length;

  if (str.length < 6 || charVariety <= 1) {
    return {
      score: 1,
      level: 'weak',
      labelHe: 'חלשה',
      labelEn: 'Weak',
      colorClass: 'bg-rose-500',
      textClass: 'text-rose-400',
      criteria
    };
  }

  if (charVariety === 2 || str.length < 8) {
    return {
      score: 2,
      level: 'fair',
      labelHe: 'בינונית',
      labelEn: 'Fair',
      colorClass: 'bg-amber-500',
      textClass: 'text-amber-400',
      criteria
    };
  }

  const isSecure = str.length >= 8 && (charVariety >= 4 || (charVariety >= 3 && criteria.symbol && str.length >= 10));

  if (isSecure) {
    return {
      score: 4,
      level: 'secure',
      labelHe: 'מאובטחת',
      labelEn: 'Secure',
      colorClass: 'bg-emerald-500',
      textClass: 'text-emerald-400',
      criteria
    };
  }

  return {
    score: 3,
    level: 'strong',
    labelHe: 'חזקה',
    labelEn: 'Strong',
    colorClass: 'bg-blue-500',
    textClass: 'text-blue-400',
    criteria
  };
}

export function AuthModal({
  isOpen,
  initialMode = 'signin',
  reason = null,
  onClose,
  onShowToast
}) {
  const {
    user,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail, 
    resetPassword,
    deleteUserAccountAndData,
    logout 
  } = useAuth();
  
  const { language, toggleLanguage, isRTL } = useLanguage();
  const bodyRef = useRef(null);

  const scrollBodyToTop = () => {
    if (typeof bodyRef.current?.scrollTo === 'function') {
      bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  };

  const [activeTab, setActiveTab] = useState(initialMode || 'signin'); // 'signin' | 'register' | 'forgot'

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode || 'signin');
      setFormError('');
      setFormSuccess('');
      setAgreedToTerms(false);
      setAiOptIn(false);
    }
  }, [isOpen, initialMode]);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Only iOS: see the note where this is rendered.
  const suggestInstallFirst = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isIOSDevice = /iPad|iPhone|iPod/.test(window.navigator.userAgent || '');
    return isIOSDevice && !isStandalonePwa();
  }, []);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Registration-only legal consent — mandatory ToS/Privacy acceptance and
  // an optional, unchecked-by-default AI-training opt-in. OAuth sign-in has
  // no form step, so brand-new OAuth users get the same choice post-login
  // via LegalConsentGate instead.
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [aiOptIn, setAiOptIn] = useState(false);
  const [openLegalDoc, setOpenLegalDoc] = useState(null); // 'terms' | 'privacy' | null

  const passwordStrength = useMemo(() => {
    return calculatePasswordStrength(passwordInput);
  }, [passwordInput]);

  const hasMinLength = passwordInput.length >= 8;
  const hasLettersAndNumbers = /(?=.*[A-Za-zא-ת])(?=.*[0-9])/.test(passwordInput);
  const hasSpecialChar = /[^A-Za-z0-9א-ת]/.test(passwordInput);
  const passwordsMatch = useMemo(() => {
    return passwordInput.length > 0 && confirmPasswordInput.length > 0 && passwordInput === confirmPasswordInput;
  }, [passwordInput, confirmPasswordInput]);

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const cleanEmail = emailInput.trim();
    const cleanPassword = passwordInput;
    const cleanConfirm = confirmPasswordInput;
    const cleanName = nameInput.trim();

    if (!cleanEmail) {
      setFormError(language === 'he' ? 'נא להזין כתובת אימייל' : 'Please enter an email address');
      scrollBodyToTop();
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setFormError(language === 'he' ? 'כתובת האימייל אינה תקינה (לדוגמה: name@domain.com)' : 'Please enter a valid email address (e.g. name@domain.com)');
      scrollBodyToTop();
      return;
    }

    if (activeTab === 'forgot') {
      setIsLoading(true);
      try {
        await resetPassword(cleanEmail);
        setFormSuccess(
          language === 'he'
            ? 'קישור לאיפוס סיסמה נשלח לתיבת האימייל שלך!'
            : 'Password reset link has been sent to your email!'
        );
      } catch (err) {
        setFormError(err.message || 'Error sending password reset email');
        scrollBodyToTop();
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!cleanPassword) {
      setFormError(language === 'he' ? 'נא להזין סיסמה' : 'Please enter a password');
      scrollBodyToTop();
      return;
    }

    if (cleanPassword.length < 8) {
      setFormError(language === 'he' ? 'הסיסמה חייבת להכיל לפחות 8 תווים' : 'Password must be at least 8 characters');
      scrollBodyToTop();
      return;
    }

    if (activeTab === 'register') {
      if (!/(?=.*[A-Za-zא-ת])(?=.*[0-9])/.test(cleanPassword)) {
        setFormError(language === 'he' ? 'הסיסמה חייבת לכלול שילוב של אותיות ומספרים' : 'Password must include both letters and numbers');
        scrollBodyToTop();
        return;
      }
      if (!/[^A-Za-z0-9א-ת]/.test(cleanPassword)) {
        setFormError(language === 'he' ? 'הסיסמה חייבת לכלול לפחות תו מיוחד אחד (כגון !@#$%)' : 'Password must contain at least one special character (!@#$%)');
        scrollBodyToTop();
        return;
      }
      if (!cleanName) {
        setFormError(language === 'he' ? 'נא להזין שם מלא' : 'Please enter your full name');
        scrollBodyToTop();
        return;
      }
      if (cleanPassword !== cleanConfirm) {
        setFormError(language === 'he' ? 'הסיסמאות אינן תואמות. נא להזין שוב.' : 'Passwords do not match. Please re-enter.');
        scrollBodyToTop();
        return;
      }
      if (!agreedToTerms) {
        setFormError(
          language === 'he'
            ? 'יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך'
            : 'You must agree to the Terms of Use and Privacy Policy to continue'
        );
        scrollBodyToTop();
        return;
      }
    }

    setIsLoading(true);
    try {
      if (activeTab === 'register') {
        await registerWithEmail(cleanEmail, cleanPassword, cleanName, { aiTrainingOptIn: aiOptIn });
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem('spotli_post_auth_wizard_pending', 'true');
          }
        } catch {
          // Ignore storage errors
        }
        if (onShowToast) onShowToast(language === 'he' ? 'החשבון נוצר בהצלחה!' : 'Account created successfully!', 'success');
      } else {
        await loginWithEmail(cleanEmail, cleanPassword);
        if (onShowToast) onShowToast(language === 'he' ? 'התחברת בהצלחה!' : 'Logged in successfully!', 'success');
      }
      onClose();
    } catch (err) {
      setFormError(err.message || (language === 'he' ? 'שגיאה באימות' : 'Authentication error'));
      scrollBodyToTop();
    } finally {
      setIsLoading(false);
    }
  };

  const wasLoggedInOnOpenRef = useRef(Boolean(user));
  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      wasLoggedInOnOpenRef.current = Boolean(user);
    }
    if (!user) {
      wasLoggedInOnOpenRef.current = false;
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, user]);

  // Auto-close modal when user transitions from unauthenticated to authenticated
  useEffect(() => {
    if (user && isOpen && !wasLoggedInOnOpenRef.current) {
      if (onShowToast) onShowToast(language === 'he' ? 'התחברת בהצלחה!' : 'Logged in successfully!', 'success');
      onClose();
    }
  }, [user, isOpen, onClose, onShowToast, language]);

  const handleGoogleClick = async () => {
    setIsGoogleLoading(true);
    setFormError('');
    try {
      const u = await loginWithGoogle();
      if (u) {
        if (onShowToast) onShowToast(language === 'he' ? 'התחברת בהצלחה!' : 'Logged in successfully!', 'success');
        onClose();
      }
    } catch (err) {
      if (err && err.message) {
        setFormError(err.message);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await deleteUserAccountAndData();
      if (onShowToast) onShowToast(language === 'he' ? 'החשבון והנתונים נמחקו לצמיתות' : 'Account & data deleted permanently', 'info');
      onClose();
    } catch (err) {
      setFormError(err.message || (language === 'he' ? 'שגיאה במחיקת חשבון' : 'Error deleting account'));
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="AuthModal"
      className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
    >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex flex-col bg-slate-900 shrink-0">
          <div className="w-10 h-1 bg-slate-700/80 rounded-full mx-auto -mt-2 mb-4 shrink-0 lg:hidden" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-sm">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>{language === 'he' ? 'חשבון וסנכרון ענן' : 'Account & Cloud Sync'}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">v{APP_VERSION}</span>
                </h2>
                <p className="text-xs text-slate-400">
                  {language === 'he' ? 'סנכרון החבילות שלך מכל מכשיר' : 'Access your packages from any device'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] text-xs font-bold"
                aria-label={language === 'he' ? 'Switch to English' : 'החלף לעברית'}
                title={language === 'he' ? 'Switch to English' : 'החלף לעברית'}
              >
                <Globe className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                <span>{language === 'he' ? 'EN' : 'עב'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-5 text-xs pb-[max(2rem,env(safe-area-inset-bottom))]">
          {/* Active User Card if already logged in */}
          {user ? (
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full relative shrink-0 overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md border-2 border-blue-500/40">
                    <span>{user.name?.charAt(0) || 'U'}</span>
                    {user.avatar && (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{user.name}</h3>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  {language === 'he' ? 'מחובר' : 'Active'}
                </span>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      logout();
                      if (onShowToast) onShowToast(language === 'he' ? 'התנתקת מהחשבון' : 'Logged out', 'info');
                    }}
                    className="flex items-center gap-2 text-slate-300 hover:text-slate-100 font-semibold text-xs cursor-pointer min-h-[48px] px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{language === 'he' ? 'התנתק מהחשבון' : 'Sign Out'}</span>
                  </button>

                  <button
                    onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                    className="flex items-center gap-2 text-rose-400 hover:text-rose-300 font-semibold text-xs cursor-pointer min-h-[48px] px-3 py-2 rounded-xl hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{language === 'he' ? 'מחיקת חשבון' : 'Delete Account'}</span>
                  </button>
                </div>

                {/* Delete Confirmation Warning Box */}
                {showDeleteConfirm && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2.5 animate-fade-in">
                    <p className="text-xs text-rose-300 font-medium leading-relaxed">
                      {language === 'he'
                        ? 'פעולה זו תמחק לצמיתות את החשבון, נתוני המעקב והחבילות שלך מכל השרתים.'
                        : 'This action will permanently delete your account, tracking data, and packages from all servers.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <span>{language === 'he' ? 'אשר מחיקה לצמיתות' : 'Confirm Deletion'}</span>
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        {language === 'he' ? 'ביטול' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Install first, on the one platform where signing in here is
                  wasted work. iOS gives a home-screen app its own storage
                  container, so a session created in Safari is invisible to the
                  installed app and the person signs in twice — reported by a
                  first-time user who did exactly that. Advisory, not a gate:
                  the form below stays usable for anyone who wants the browser.
                  Android and desktop share storage between the browser and the
                  installed app, so they are deliberately not shown this. */}
              {suggestInstallFirst && activeTab !== 'forgot' && (
                <button
                  type="button"
                  onClick={() => setShowInstallGuide(true)}
                  aria-haspopup="dialog"
                  className="w-full mb-4 px-3 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer flex items-center gap-2.5 text-start min-h-[48px]"
                >
                  <Smartphone className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-slate-200">
                      {language === 'he'
                        ? 'משתמשים באייפון? התקינו את האפליקציה קודם'
                        : 'Using an iPhone? Install the app first'}
                    </span>
                    <span className="block text-[11px] text-blue-400/90 font-medium">
                      {language === 'he'
                        ? 'לחצו להוראות התקנה מהירות בספארי'
                        : 'Tap for quick Safari installation steps'}
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-blue-400 shrink-0 ${isRTL ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
              )}

              {/* Social / OAuth Sign-in Buttons */}
              {activeTab !== 'forgot' && (
                <>
                  {/* Contextual Educational Banner when prompted by Gmail sync */}
                  {reason === 'gmail_sync' && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-amber-300 animate-fade-in">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5 text-xs">
                        <h4 className="font-bold text-amber-200">
                          {language === 'he' ? 'חיבור עם Google לסנכרון Gmail' : 'Connect with Google for Gmail Sync'}
                        </h4>
                        <p className="text-amber-300/80 leading-relaxed">
                          {language === 'he'
                            ? 'חיבור לחשבון Google נדרש כדי לאפשר סנכרון חבילות אוטומטי מתיבת ה-Gmail שלך בבטחה.'
                            : 'A Google Account is required to automatically connect and sync packages from your Gmail inbox securely.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Google Sign-in Button — the only OAuth provider actually
                      configured. Apple was previously offered here but was
                      never set up in Firebase/Apple Developer, so it could
                      only ever fail; removed rather than leave a broken
                      option in front of users. */}
                  <button
                    type="button"
                    onClick={handleGoogleClick}
                    disabled={isGoogleLoading || isLoading}
                    className={`w-full flex items-center justify-center gap-2.5 p-3 rounded-2xl bg-white hover:bg-slate-50 text-neutral-900 border border-slate-200 dark:border-slate-800 font-bold text-xs transition-ui shadow-md cursor-pointer min-h-[48px] disabled:opacity-50 ${
                      reason === 'gmail_sync' ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-amber-500/20' : ''
                    }`}
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                    )}
                    <span>{language === 'he' ? 'המשך עם Google' : 'Continue with Google'}</span>
                  </button>

                  <div className="flex items-center gap-2 text-slate-500 my-2">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-xs uppercase font-bold text-slate-400">
                      {language === 'he' ? 'או באמצעות אימייל וסיסמה' : 'Or with Email & Password'}
                    </span>
                    <div className="flex-1 h-px bg-slate-800" />
                  </div>
                </>
              )}

              {/* Tabs / Forgot Header */}
              {activeTab === 'forgot' ? (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setFormError('');
                      setFormSuccess('');
                    }}
                    aria-label={language === 'he' ? 'חזרה להתחברות' : 'Back to sign in'}
                    className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-slate-100 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
                  >
                    <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                  </button>
                  <h3 className="font-bold text-sm text-slate-100">
                    {language === 'he' ? 'איפוס סיסמה' : 'Reset Password'}
                  </h3>
                </div>
              ) : (
                <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setFormError('');
                      setFormSuccess('');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-ui cursor-pointer min-h-[48px] ${
                      activeTab === 'signin'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {language === 'he' ? 'התחברות' : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setFormError('');
                      setFormSuccess('');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-ui cursor-pointer min-h-[48px] ${
                      activeTab === 'register'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {language === 'he' ? 'הרשמה חדשה' : 'Register'}
                  </button>
                </div>
              )}

              {/* Form Messages */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-relaxed animate-fade-in flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs leading-relaxed animate-fade-in flex items-start gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Email + Password Form */}
              <form onSubmit={handleEmailSubmit} noValidate className="space-y-3">
                {activeTab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {language === 'he' ? 'שם מלא' : 'Full Name'} *
                    </label>
                    <div className="relative">
                      <User className={`w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3`} />
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder={language === 'he' ? 'לדוגמה: אלכס כהן' : 'e.g. Alex Cohen'}
                        className={`w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none min-h-[48px] ps-9 pe-3`}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {language === 'he' ? 'כתובת אימייל' : 'Email Address'} *
                  </label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3`} />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="you@domain.com"
                      className={`w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none min-h-[48px] ps-9 pe-3`}
                    />
                  </div>
                </div>

                {activeTab !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-300">
                        {language === 'he' ? 'סיסמה' : 'Password'} *
                      </label>
                      {activeTab === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('forgot');
                            setFormError('');
                            setFormSuccess('');
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-medium"
                        >
                          {language === 'he' ? 'שכחת סיסמה?' : 'Forgot password?'}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className={`w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3`} />
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none min-h-[48px] ps-9 pe-3`}
                      />
                    </div>
                  </div>
                )}

                {/* Confirm Password & Criteria on Register */}
                {activeTab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {language === 'he' ? 'אימות סיסמה' : 'Confirm Password'} *
                    </label>
                    <div className="relative">
                      <Lock className={`w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3`} />
                      <input
                        type="password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none min-h-[48px] ps-9 pe-3`}
                      />
                    </div>

                    {/* NIST / OWASP Password Checklist */}
                    <div className="mt-2.5 space-y-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-2 text-xs">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasMinLength ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span className={hasMinLength ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          {language === 'he' ? 'לפחות 8 תווים' : 'At least 8 characters'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasLettersAndNumbers ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span className={hasLettersAndNumbers ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          {language === 'he' ? 'שילוב של אותיות ומספרים' : 'Combination of letters and numbers'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasSpecialChar ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span className={hasSpecialChar ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          {language === 'he' ? 'לפחות תו מיוחד אחד (!@#$%)' : 'At least one special character (!@#$%)'}
                        </span>
                      </div>
                      
                      {confirmPasswordInput.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${passwordsMatch ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span className={passwordsMatch ? 'text-emerald-400 font-medium' : 'text-rose-400'}>
                            {passwordsMatch 
                              ? (language === 'he' ? 'הסיסמאות תואמות' : 'Passwords match') 
                              : (language === 'he' ? 'הסיסמאות אינן תואמות' : 'Passwords do not match')}
                          </span>
                        </div>
                      )}

                      {/* Visual Strength Bar */}
                      {passwordInput.length > 0 && (
                        <div className="pt-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-400">{language === 'he' ? 'חוזק סיסמה:' : 'Strength:'}</span>
                            <span className={`font-bold ${passwordStrength.textClass}`}>
                              {language === 'he' ? passwordStrength.labelHe : passwordStrength.labelEn}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                            {[1, 2, 3, 4].map((step) => (
                              <div
                                key={step}
                                className={`h-full rounded-full transition-ui duration-300 ${
                                  passwordStrength.score >= step ? passwordStrength.colorClass : 'bg-slate-800'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Legal consent — mandatory ToS/Privacy + optional AI-training opt-in */}
                {activeTab === 'register' && (
                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      <span className="text-xs text-slate-300 leading-snug">
                        {language === 'he' ? 'קראתי ואני מסכים/ה ל' : 'I agree to the'}{' '}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setOpenLegalDoc('terms'); }}
                          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
                        >
                          {language === 'he' ? 'תנאי השימוש' : 'Terms of Use'}
                        </button>
                        {' '}{language === 'he' ? 'ול' : 'and'}{' '}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setOpenLegalDoc('privacy'); }}
                          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
                        >
                          {language === 'he' ? 'מדיניות הפרטיות' : 'Privacy Policy'}
                        </button>
                        {' *'}
                      </span>
                    </label>

                    <label className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/20 cursor-pointer min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={aiOptIn}
                        onChange={(e) => setAiOptIn(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      <span className="text-xs text-slate-300 leading-snug flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <span>
                          {language === 'he'
                            ? 'עזרו לשפר דיוק: שמרו טקסט מודבק ותיקונים שאבצע כדי לשפר את מנוע החילוץ (ללא תמונות). ניתן לשנות בהגדרות.'
                            : 'Help us improve accuracy: store pasted text and my corrections to improve the parser (never images). Changeable in Settings anytime.'}
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-50 mt-3"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <span>
                    {activeTab === 'forgot'
                      ? (language === 'he' ? 'שלח קישור לאיפוס סיסמה' : 'Send Reset Link')
                      : activeTab === 'register'
                      ? (language === 'he' ? 'צור חשבון והתחל לסנכרן' : 'Create Account & Sync')
                      : (language === 'he' ? 'התחבר לחשבון' : 'Sign In')}
                  </span>
                </button>
              </form>
            </>
          )}
        </div>
      </Modal>

      <React.Suspense fallback={null}><LegalDocumentModal
        isOpen={!!openLegalDoc}
        onClose={() => setOpenLegalDoc(null)}
        docType={openLegalDoc || 'terms'}
      /></React.Suspense>

      <InstallGuideDialog
        isOpen={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
        isIOS
        isRTL={isRTL}
      />
    </>
  );
}
