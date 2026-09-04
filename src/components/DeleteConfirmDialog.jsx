import React from 'react';
import { Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Modal } from './Modal';

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm
}) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="DeleteConfirmDialog"
      compact
      scrollable={false}
      className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4"
    >
        <div className="flex items-center gap-3 text-rose-400">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <Trash2 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-100">
            {t('deleteDialog.title')}
          </h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {t('deleteDialog.message')}
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            {t('deleteDialog.cancel')}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20"
          >
            {t('deleteDialog.confirm')}
          </button>
        </div>
      </Modal>
  );
}
