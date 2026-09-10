import React from 'react';
import { STAGES } from '../types/stages';
import { useLanguage } from '../context/LanguageContext';
import { Check } from 'lucide-react';

export function QuickTimeline({ currentStatus }) {
  const { language } = useLanguage();
  
  const currentStageIndex = STAGES.findIndex(s => s.id === currentStatus);
  const effectiveIndex = currentStageIndex === -1 ? 0 : currentStageIndex;

  return (
    <div className="w-full py-2">
      {/* Progress Bar Track */}
      <div className="relative flex items-center justify-between w-full">
        <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-slate-800 rounded-full z-0">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-ui duration-500"
            style={{
              width: `${(effectiveIndex / (STAGES.length - 1)) * 100}%`
            }}
          />
        </div>

        {STAGES.map((stage, idx) => {
          const isPassed = idx < effectiveIndex;
          const isCurrent = idx === effectiveIndex;

          let circleBg = 'bg-slate-900 border-slate-700 text-slate-500';
          if (isPassed) {
            circleBg = 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20';
          } else if (isCurrent) {
            circleBg = stage.id === 'delivered'
              ? 'bg-emerald-500 border-emerald-400 text-white ring-4 ring-emerald-500/20'
              : 'bg-blue-500 border-blue-400 text-white ring-4 ring-blue-500/20';
          }

          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-ui duration-300 ${circleBg}`}
                title={language === 'he' ? stage.hebrewLabel : stage.label}
              >
                {isPassed ? (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-white" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-20">
                <div className="px-2 py-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md shadow-xl whitespace-nowrap">
                  {language === 'he' ? stage.hebrewLabel : stage.label}
                </div>
                <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 -mt-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage Name Labels */}
      <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-medium">
        <span className={effectiveIndex >= 0 ? 'text-blue-400' : ''}>
          {language === 'he' ? STAGES[0]?.hebrewLabel : STAGES[0]?.label}
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STAGES[effectiveIndex]?.badgeClass || 'bg-slate-800 text-slate-300'}`}>
          {language === 'he' ? (STAGES[effectiveIndex]?.hebrewLabel || '') : (STAGES[effectiveIndex]?.label || '')}
        </span>
        <span className={effectiveIndex === STAGES.length - 1 ? 'text-emerald-400 font-semibold' : ''}>
          {language === 'he' ? STAGES[STAGES.length - 1]?.hebrewLabel : STAGES[STAGES.length - 1]?.label}
        </span>
      </div>
    </div>
  );
}
