import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function Toast({ toast, onClose }) {
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />
  };

  const borderColors = {
    success: 'border-emerald-500/30 bg-emerald-950/80 text-emerald-100',
    error: 'border-rose-500/30 bg-rose-950/80 text-rose-100',
    info: 'border-blue-500/30 bg-slate-900/90 text-slate-100'
  };

  // Errors are announced assertively (interrupt); success/info are polite —
  // otherwise this is invisible to screen reader users, since it's DOM
  // content appearing/disappearing with no other signal.
  const isError = toast.type === 'error';

  return (
    <div
      /* `end-6`, not `right-6`: this pinned to the bottom-RIGHT even in
         Hebrew. Bottom offset clears the fixed tab bar on mobile (the bar
         is lg:hidden, so the larger offset is mobile-only too). */
      className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 end-6 z-50 flex flex-col gap-2 max-w-sm w-full animate-bounce-in"
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div className={`flex items-center justify-between p-4 rounded-xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ${borderColors[toast.type || 'info']}`}>
        <div className="flex items-center gap-3">
          {icons[toast.type || 'info']}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
