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
        <div className="relative w-full py-4 flex flex-col items-center justify-center">
          <div className="w-full max-w-xs bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-3 border-b border-slate-800 pb-2.5">
              <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-200 truncate">Amazon / AliExpress / Courier</div>
                <div className="text-[10px] text-slate-400">order-update@courier.co.il</div>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Auto</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300 font-medium">{language === 'he' ? 'חבילה זוהתה וסונכרנה' : 'Package detected & tracked'}</span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
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
        <div className="relative w-full py-4 flex flex-col items-center justify-center">
          <div className="w-full max-w-xs space-y-2">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-[11px] text-slate-300 shadow-lg leading-relaxed">
              <span className="text-blue-400 font-semibold">SMS: </span>
              {language === 'he' 
                ? 'שלום, חבילתך מצ\'יטה ממתינה בלוקר שופרסל. קוד איסוף: 48291'
                : 'Hi, your package from Cheetah awaits at Shufersal locker. PIN: 48291'}
            </div>
            <div className="flex justify-center text-slate-500 py-0.5">
              <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''} text-blue-400 animate-pulse`} />
            </div>
            <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-3 flex items-center justify-between shadow-xl">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{language === 'he' ? 'צ\'יטה שליחויות' : 'Cheetah Delivery'}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">CH-849201</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-0.5">{language === 'he' ? 'קוד איסוף חולץ: 48291' : 'Locker PIN extracted: 48291'}</div>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
              </div>
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
        <div className="relative w-full py-4 flex flex-col items-center justify-center">
          <div className="w-full max-w-xs bg-slate-900/90 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-2xl relative overflow-hidden text-center">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'he' ? 'מסך בהיר פעיל' : 'Screen Wake Lock'}</span>
              </span>
              <span className="font-mono text-xs text-slate-400">{language === 'he' ? 'מדף B-14' : 'Shelf B-14'}</span>
            </div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-1">
              {language === 'he' ? 'קוד איסוף ללוקר' : 'Locker Pickup PIN'}
            </div>
            <div className="text-2xl font-mono font-black tracking-widest text-white py-1 bg-slate-950/80 rounded-xl border border-emerald-500/20 shadow-inner">
              7 3 9 1 0
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-[10px] text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span>Waze / Maps</span>
              </span>
            </div>
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
      overlayClassName="bg-slate-950/80 backdrop-blur-sm"
      className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col text-slate-100"
      closeOnBackdrop={true}
      closeOnEscape={true}
      onClose={onClose}
    >
      {/* Header bar with Skip button */}
      <div className="px-6 pt-5 pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentSlide 
                  ? 'w-6 bg-blue-500' 
                  : 'w-2 bg-slate-700 hover:bg-slate-600'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors px-3 py-2 rounded-xl hover:bg-slate-800/80 min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer"
        >
          {t('onboarding.skip')}
        </button>
      </div>

      {/* Slide Body */}
      <div className="px-6 py-4 flex-1 flex flex-col items-center text-center">
        {/* Tag badge */}
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border mb-3 ${slide.tagColor}`}>
          <Sparkles className="w-3 h-3" />
          <span>{slide.tag}</span>
        </span>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
          {slide.title}
        </h2>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto mb-2 leading-relaxed">
          {slide.desc}
        </p>

        {/* Visual Graphic */}
        <div className="w-full my-auto">
          {slide.illustration}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-6 pt-2 border-t border-slate-800/80 bg-slate-950/40 shrink-0">
        {!isLast ? (
          <div className="flex items-center justify-between gap-3">
            {currentSlide > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer min-h-[48px]"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                <span>{t('onboarding.prev')}</span>
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[48px]"
            >
              <span>{t('onboarding.next')}</span>
              {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={onStartManual}
                className="w-full sm:w-1/2 flex items-center justify-center px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer min-h-[48px]"
              >
                {t('onboarding.startManual')}
              </button>
              <button
                type="button"
                onClick={onGetStartedGoogle}
                className="w-full sm:w-1/2 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25 cursor-pointer min-h-[48px]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('onboarding.getStarted')}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handlePrev}
              className="self-center flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-3 py-1 transition-colors cursor-pointer min-h-[36px]"
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
