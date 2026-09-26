import React from "react";
import { Archive, Check, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { Modal } from './Modal';

export function AutoArchivePromptModal({
  isOpen,
  onConfirm,
  onDecline
}) {
  const { t, language } = useLanguage();

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDecline}
      componentName="AutoArchivePromptModal"
      compact
      scrollable={false}
      overlayClassName="bg-black/60 backdrop-blur-sm"
      labelledBy="auto-archive-title"
      className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 text-slate-100 animate-scale-up"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h3 id="auto-archive-title" className="text-base sm:text-lg font-bold text-slate-100">
              {t("autoArchive.promptTitle")}
            </h3>
            <p className="text-xs text-slate-400">
              SpotLi Smart Workflows
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDecline}
          aria-label={language === 'he' ? 'סגור' : 'Close'}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-slate-200 mb-3 leading-relaxed">
        {t("autoArchive.promptQuestion")}
      </p>

      <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-6 flex items-start gap-2">
        <span className="shrink-0 text-amber-600 dark:text-amber-400">ℹ️</span>
        <span>{t("autoArchive.promptHint")}</span>
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <button
          type="button"
          onClick={onDecline}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
        >
          <X className="w-4 h-4" />
          {t("autoArchive.confirmNo")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-600/25 transition-ui flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
        >
          <Check className="w-4 h-4" />
          {t("autoArchive.confirmYes")}
        </button>
      </div>
    </Modal>
  );
}
