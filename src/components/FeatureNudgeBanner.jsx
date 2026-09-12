import React from 'react';
import { Bell, Mail, MapPin, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export function FeatureNudgeBanner({
  nudge,
  onAction,
  onDismiss,
  onSuppressPermanently
}) {
  const { t, isRTL } = useLanguage();

  if (!nudge) return null;

  const config = {
    push: {
      icon: Bell,
      iconBg: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
      border: 'border-blue-500/30',
      title: t('nudges.pushTitle'),
      desc: t('nudges.pushDesc'),
      actionLabel: t('nudges.pushAction'),
      btnBg: 'bg-blue-600 hover:bg-blue-500 text-white'
    },
    gmail: {
      icon: Mail,
      iconBg: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
      border: 'border-amber-500/30',
      title: t('nudges.gmailTitle'),
      desc: t('nudges.gmailDesc'),
      actionLabel: t('nudges.gmailAction'),
      btnBg: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white'
    },
    locker: {
      icon: MapPin,
      iconBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
      border: 'border-emerald-500/30',
      title: t('nudges.lockerTitle'),
      desc: t('nudges.lockerDesc'),
      actionLabel: t('nudges.lockerAction'),
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white'
    }
  }[nudge.type] || {
    icon: Bell,
    iconBg: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    border: 'border-blue-500/30',
    title: t('nudges.pushTitle'),
    desc: t('nudges.pushDesc'),
    actionLabel: t('nudges.pushAction'),
    btnBg: 'bg-blue-600 hover:bg-blue-500 text-white'
  };

  const IconComponent = config.icon;

  return (
    <div className={`w-full p-4 rounded-3xl bg-slate-900/95 border ${config.border} shadow-lg mb-4 animate-fade-in relative`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left / Start Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${config.iconBg}`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="min-w-0 pr-6 sm:pr-0">
            <h4 className="text-xs sm:text-sm font-bold text-slate-100 mb-0.5">
              {config.title}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {config.desc}
            </p>
          </div>
        </div>

        {/* Right / End Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
          <button
            type="button"
            onClick={() => onSuppressPermanently(nudge.id)}
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors underline decoration-slate-600 cursor-pointer min-h-[48px] flex items-center px-1"
          >
            {t('nudges.dontShowAgain')}
          </button>

          <button
            type="button"
            onClick={() => onAction(nudge.type)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer min-h-[48px] ${config.btnBg}`}
          >
            <span>{config.actionLabel}</span>
            {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Close button in top-end corner */}
      <button
        type="button"
        onClick={() => onDismiss(nudge.id)}
        className="absolute top-3 end-3 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
        aria-label={t('nudges.dismiss')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
