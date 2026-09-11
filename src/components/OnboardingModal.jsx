import React, { useState } from 'react';
import { 
  Mail, MessageSquareText, MapPin, ChevronRight, ChevronLeft, 
  Sparkles, Sun, CheckCircle2, ArrowRight
} from 'lucide-react';
import { Modal } from './Modal';
import { useLanguage } from '../context/LanguageContext';

export function OnboardingModal({
  isOpen,
  onClose,
  onGetStartedGoogle,
  onStartManual
}) {
  const { t, isRTL, language } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      id: 'gmail-sync',
      tag: t('onboarding.slide1Tag'),
      tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      title: t('onboarding.slide1Title'),
      desc: t('onboarding.slide1Desc'),
      icon: Mail,
      accentGradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
      illustration: (
        <div className="w-full bg-slate-900/95 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-start">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-100 truncate">Amazon / AliExpress / Couriers</div>
              <div className="text-xs text-slate-400">order-update@courier.co.il</div>
            </div>
            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              {language === 'he' ? 'אוטומטי' : 'Auto'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-slate-200 font-semibold text-xs sm:text-sm">
                {language === 'he' ? 'חבילה זוהתה וסונכרנה למעקב' : 'Package detected & auto-tracked'}
              </span>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>
        </div>
      )
    },
    {
      id: 'smart-import',
      tag: t('onboarding.slide2Tag'),
      tagColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      title: t('onboarding.slide2Title'),
      desc: t('onboarding.slide2Desc'),
      icon: MessageSquareText,
      accentGradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
      illustration: (
        <div className="w-full space-y-3 text-start">
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 shadow-lg leading-relaxed">
            <span className="text-blue-400 font-bold">SMS: </span>
            {language === 'he' 
              ? 'שלום, חבילתך ממתינה בלוקר שופרסל. קוד איסוף: 48291'
              : 'Hi, your package awaits at Shufersal locker. PIN: 48291'}
          </div>
          <div className="flex justify-center text-slate-500 py-0.5">
            <ArrowRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''} text-blue-400 animate-pulse`} />
          </div>
          <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-xl">
            <div>
              <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{language === 'he' ? 'צ\'יטה שליחויות' : 'Cheetah Delivery'}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">CH-849201</span>
              </div>
              <div className="text-xs sm:text-sm text-emerald-400 mt-1 font-semibold">
                {language === 'he' ? 'קוד איסוף חולץ: 48291' : 'Locker PIN extracted: 48291'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'pickup-mode',
      tag: t('onboarding.slide3Tag'),
      tagColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      title: t('onboarding.slide3Title'),
      desc: t('onboarding.slide3Desc'),
      icon: MapPin,
      accentGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      illustration: (
        <div className="w-full bg-slate-900/95 border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-center">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400 mb-3 border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>{language === 'he' ? 'מסך בהיר פעיל' : 'Screen Wake Lock'}</span>
            </span>
            <span className="font-mono text-xs text-slate-400 font-semibold">{language === 'he' ? 'מדף B-14' : 'Shelf B-14'}</span>
          </div>
          <div className="text-xs uppercase font-black tracking-widest text-emerald-400 mb-1.5">
            {language === 'he' ? 'קוד איסוף ללוקר' : 'Locker Pickup PIN'}
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-white py-2.5 bg-slate-950/90 rounded-2xl border border-emerald-500/30 shadow-inner my-2">
            7 3 9 1 0
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-xs text-slate-300 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 font-semibold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
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
      onClose={onClose}
    >
      {/* Header bar with Skip button */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className="p-2 min-h-[48px] flex items-center justify-center cursor-pointer"
              aria-label={`Slide ${idx + 1}`}
            >
              <span
                className={`h-2 rounded-full transition-all block ${
                  idx === currentSlide 
                    ? 'w-8 bg-blue-500' 
                    : 'w-2.5 bg-slate-700 hover:bg-slate-600'
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors px-3 py-2 rounded-xl hover:bg-slate-800/80 min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer"
        >
          {t('onboarding.skip')}
        </button>
      </div>

      {/* Slide Body */}
      <div className="px-6 py-6 sm:py-8 flex-1 flex flex-col items-center justify-between text-center overflow-y-auto">
        <div className="w-full flex flex-col items-center">
          {/* Tag badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-black px-4 py-1 rounded-full border mb-4 shadow-sm ${slide.tagColor}`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{slide.tag}</span>
          </span>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight leading-snug px-2">
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
                className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-bold transition-all border border-slate-700/60 cursor-pointer min-h-[52px] shrink-0"
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
              <span>{t('onboarding.next')}</span>
              {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-3">
            <div className="w-full flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={onStartManual}
                className="w-full sm:w-1/2 flex items-center justify-center px-5 py-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-sm font-bold border border-slate-700 transition-colors cursor-pointer min-h-[52px]"
              >
                {t('onboarding.startManual')}
              </button>
              <button
                type="button"
                onClick={onGetStartedGoogle}
                className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-black transition-all shadow-lg shadow-blue-500/25 cursor-pointer min-h-[52px]"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t('onboarding.getStarted')}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handlePrev}
              className="self-center flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 py-2 transition-colors cursor-pointer min-h-[48px]"
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
