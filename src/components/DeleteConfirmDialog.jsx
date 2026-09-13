import React, { useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Modal } from './Modal';

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  packageTitle
}) {
  const { t, language } = useLanguage();
  const cancelBtnRef = useRef(null);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="DeleteConfirmDialog"
      compact
      scrollable={false}
      labelledBy="delete-confirm-title"
      describedBy="delete-confirm-description"
      initialFocusRef={cancelBtnRef}
      className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-rose-400">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 id="delete-confirm-title" className="text-base font-bold text-slate-100">
            {t('deleteDialog.title')}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={language === 'he' ? 'סגור' : 'Close'}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div id="delete-confirm-description" className="space-y-2">
        <p className="text-xs text-slate-400 leading-relaxed">
          {t('deleteDialog.message')}
        </p>
        {packageTitle && (
          <p className="text-xs font-semibold text-slate-200 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 truncate">
            📦 <bdi dir="auto">{packageTitle}</bdi>
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          ref={cancelBtnRef}
          type="button"
          onClick={onClose}
          className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 text-xs sm:text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 flex items-center justify-center"
        >
          {t('deleteDialog.cancel')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof onConfirm === 'function') onConfirm();
            if (typeof onClose === 'function') onClose();
          }}
          className="min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold transition-ui shadow-md shadow-rose-600/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 flex items-center justify-center"
        >
          {t('deleteDialog.confirm')}
        </button>
      </div>
    </Modal>
  );
}

export default DeleteConfirmDialog;

