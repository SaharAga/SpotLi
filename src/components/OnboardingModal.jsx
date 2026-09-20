import React, { useState } from 'react';
import { 
  Mail, MessageSquareText, MapPin, ChevronRight, ChevronLeft, 
  Sparkles, Sun, CheckCircle2, ArrowRight, Package, Globe
} from 'lucide-react';
import { Modal } from './Modal';
import { useLanguage } from '../context/LanguageContext';

export function OnboardingModal({
  isOpen,
  onClose,
  onGetStartedGoogle,
  onStartManual,
  onSignIn,
  onSignInEmail,
  onTryDemo
}) {
  const { t, isRTL, language, toggleLanguage } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      id: 'welcome',
      tag: t('onboarding.slide0Tag'),
      tagColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border-blue-200 dark:border-blue-400/20',
      title: t('onboarding.slide0Title'),
      desc: t('onboarding.slide0Desc'),
      icon: Package,
      accentGradient: 'from-blue-600/20 via-indigo-600/10 to-transparent',
      illustration: (
        <div className="w-full bg-slate-900/95 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-start space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 dark:border-blue-500/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-inner">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-100">SpotLi Hub</div>
                <div className="text-xs text-slate-400">
                  {language === 'he' ? (
                    <>
                      <bdi dir="ltr">3</bdi> חבילות במעקב פעיל
                    </>
                  ) : (
                    '3 active shipments'
                  )}
                </div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span>{language === 'he' ? 'מסונכרן' : 'Live Sync'}</span>
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                <span className="font-bold text-slate-200 truncate">Amazon</span>
                <span className="text-slate-400 font-mono text-[11px] truncate">
                  <bdi dir="ltr">#AMZ-9382</bdi>
                </span>
              </div>
              <span className="text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                {language === 'he' ? 'בדרך לארץ' : 'In Transit'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                <span className="font-bold text-slate-200 truncate">{language === 'he' ? 'צ\'יטה / לוקר' : 'Cheetah / Locker'}</span>
                <span className="text-slate-400 font-mono text-[11px] truncate">
                  <bdi dir="ltr">#CH-4821</bdi>
                </span>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                {language === 'he' ? 'מוכן לאיסוף' : 'Ready for Pickup'}
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'gmail-sync',
      tag: t('onboarding.slide1Tag'),
      tagColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/20',
      title: t('onboarding.slide1Title'),
      desc: t('onboarding.slide1Desc'),
      icon: Mail,
      accentGradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
      illustration: (
        <div className="w-full bg-slate-900/95 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-start">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 dark:border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 shadow-inner">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-100 truncate">Amazon / AliExpress / Couriers</div>
              <div className="text-xs text-slate-400">
                <bdi dir="ltr">order-update@courier.co.il</bdi>
              </div>
            </div>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
              {language === 'he' ? 'אוטומטי' : 'Auto'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-slate-200 font-semibold text-xs sm:text-sm">
                {language === 'he' ? 'חבילה זוהתה וסונכרנה למעקב' : 'Package detected & auto-tracked'}
              </span>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
        </div>
      )
    },
    {
      id: 'smart-import',
      tag: t('onboarding.slide2Tag'),
      tagColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border-blue-200 dark:border-blue-400/20',
      title: t('onboarding.slide2Title'),
      desc: t('onboarding.slide2Desc'),
      icon: MessageSquareText,
      accentGradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
      illustration: (
        <div className="w-full space-y-3 text-start">
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 shadow-lg leading-relaxed">
            <span className="text-blue-600 dark:text-blue-400 font-bold">SMS: </span>
            {language === 'he' ? (
              <>שלום, חבילתך ממתינה בלוקר שופרסל. קוד איסוף: <bdi dir="ltr">48291</bdi></>
            ) : (
              <>Hi, your package awaits at Shufersal locker. PIN: <bdi dir="ltr">48291</bdi></>
            )}
          </div>
          <div className="flex justify-center text-slate-500 py-0.5">
            <ArrowRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''} text-blue-600 dark:text-blue-400 animate-pulse`} />
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-xl">
            <div>
              <div className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{language === 'he' ? 'צ\'יטה שליחויות' : 'Cheetah Delivery'}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono font-bold">
                  <bdi dir="ltr">CH-849201</bdi>
                </span>
              </div>
              <div className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 mt-1 font-semibold">
                {language === 'he' ? (
                  <>קוד איסוף חולץ: <bdi dir="ltr">48291</bdi></>
                ) : (
                  <>Locker PIN extracted: <bdi dir="ltr">48291</bdi></>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-600/30 border border-blue-200 dark:border-blue-500/40 flex items-center justify-center text-blue-600 dark:text-blue-300 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'pickup-mode',
      tag: t('onboarding.slide3Tag'),
      tagColor: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/20',
      title: t('onboarding.slide3Title'),
      desc: t('onboarding.slide3Desc'),
      icon: MapPin,
      accentGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      illustration: (
        <div className="w-full bg-slate-900/95 border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-center">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400 mb-3 border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
              <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>{language === 'he' ? 'מסך בהיר פעיל' : 'Screen Wake Lock'}</span>
            </span>
            <span className="font-mono text-xs text-slate-400 font-semibold">
              {language === 'he' ? <>מדף <bdi dir="ltr">B-14</bdi></> : <>Shelf <bdi dir="ltr">B-14</bdi></>}
            </span>
          </div>
          <div className="text-xs uppercase font-black tracking-widest text-emerald-700 dark:text-emerald-400 mb-1.5">
            {language === 'he' ? 'קוד איסוף ללוקר' : 'Locker Pickup PIN'}
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-slate-100 py-2.5 bg-slate-950/90 rounded-2xl border border-emerald-500/30 shadow-inner my-2">
            <bdi dir="ltr">7 3 9 1 0</bdi>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-xs text-slate-300 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 font-semibold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Waze / Google Maps</span>
            </span>
          </div>
        </div>
      )
    }
  ];

  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  const handleNext = () => {
    if (!isLast) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  return (
    <Modal
      componentName="OnboardingModal"
      layer="base"
      flushBottom={true}
      overlayClassName="bg-slate-950/80 backdrop-blur-sm"
      className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col text-slate-100"
      closeOnBackdrop={true}
      closeOnEscape={true}
      labelledBy="onboarding-slide-title"
      onClose={onClose}
    >
      {/* Header bar with Skip button */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div 
          role="tablist" 
          aria-label={t('onboarding.progress')} 
          className="flex items-center"
        >
          {slides.map((_, idx) => (
            <button
              key={idx}
              id={`onboarding-slide-tab-${idx}`}
              type="button"
              role="tab"
              aria-selected={idx === currentSlide}
              aria-controls="onboarding-slide-panel"
              onClick={() => setCurrentSlide(idx)}
              className="p-2 min-h-[48px] min-w-[32px] flex items-center justify-center cursor-pointer"
              aria-label={t('onboarding.slideIndicator')
                .replace('{current}', String(idx + 1))
                .replace('{total}', String(slides.length))}
            >
              <span
                className={`h-2 rounded-full transition-all block ${
                  idx === currentSlide 
                    ? 'w-8 bg-blue-600 dark:bg-blue-500' 
                    : 'w-2.5 bg-slate-400 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600'
                }`}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] text-xs font-bold"
            aria-label={language === 'he' ? 'Switch to English' : 'החלף לעברית'}
            title={language === 'he' ? 'Switch to English' : 'החלף לעברית'}
          >
            <Globe className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
            <span>{language === 'he' ? 'EN' : 'עב'}</span>
          </button>
          <button
            type="button"
            onClick={onSignIn || onClose}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-3 py-2 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-800/80 min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer"
          >
            {onSignIn ? t('onboarding.signIn') : t('onboarding.skip')}
          </button>
        </div>
      </div>

      {/* Slide Body */}
      <div 
        id="onboarding-slide-panel"
        role="tabpanel"
        aria-labelledby={`onboarding-slide-tab-${currentSlide}`}
        className="px-6 py-6 sm:py-8 flex-1 flex flex-col items-center justify-between text-center overflow-y-auto"
      >
        <div className="w-full flex flex-col items-center">
          {/* Tag badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-black px-4 py-1 rounded-full border mb-4 shadow-sm ${slide.tagColor}`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{slide.tag}</span>
          </span>

          {/* Title */}
          <h2 id="onboarding-slide-title" className="text-2xl sm:text-3xl font-black text-slate-100 mb-3 tracking-tight leading-snug px-2">
            {slide.title}
          </h2>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-300 max-w-md mx-auto leading-relaxed mb-6 font-medium px-2">
            {slide.desc}
          </p>
        </div>

        {/* Visual Graphic */}
        <div className="w-full max-w-md my-auto flex items-center justify-center py-2">
          {slide.illustration}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] border-t border-slate-800/80 bg-slate-950/60 shrink-0">
        {!isLast ? (
          <div className="w-full flex items-center gap-3">
            {currentSlide > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 text-sm font-bold transition-all border border-slate-700/60 cursor-pointer min-h-[52px] shrink-0"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                <span>{t('onboarding.prev')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm sm:text-base font-bold transition-all shadow-lg shadow-blue-500/25 cursor-pointer min-h-[52px]"
            >
              <span>{currentSlide === 0 ? t('onboarding.seeHowItWorks') : t('onboarding.next')}</span>
              {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-3">
            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onGetStartedGoogle}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm sm:text-base font-black transition-all shadow-lg shadow-blue-500/25 cursor-pointer min-h-[52px]"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t('onboarding.continueWithGoogle') || t('onboarding.getStarted')}</span>
              </button>

              <button
                type="button"
                onClick={onSignInEmail || onStartManual}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold border border-slate-700/80 transition-colors cursor-pointer min-h-[48px]"
              >
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{t('onboarding.continueWithEmail')}</span>
              </button>

              {onTryDemo && (
                <button
                  type="button"
                  onClick={onTryDemo}
                  className="w-full flex items-center justify-center text-xs text-slate-400 hover:text-slate-200 py-1.5 transition-colors cursor-pointer min-h-[48px]"
                >
                  <span>{t('onboarding.tryDemo')}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handlePrev}
              className="self-center flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 py-1 px-3 transition-colors cursor-pointer min-h-[48px]"
            >
              {isRTL ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              <span>{t('onboarding.prev')}</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
