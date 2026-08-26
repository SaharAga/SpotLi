import React from "react";
import { Archive, Check, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export function AutoArchivePromptModal({
  isOpen,
  onConfirm,
  onDecline
}) {
  const { t, isRTL } = useLanguage();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-archive-title"
    >
      <div
        className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl max-w-md w-full p-6 text-[var(--text-main)] animate-scale-up"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h3 id="auto-archive-title" className="text-lg font-bold text-[var(--text-main)]">
              {t("autoArchive.promptTitle")}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Deliveree Smart Workflows
            </p>
          </div>
        </div>

        <p className="text-sm text-[var(--text-main)] mb-3 leading-relaxed">
          {t("autoArchive.promptQuestion")}
        </p>

        <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-card-hover)] p-3 rounded-lg border border-[var(--border-color)] mb-6">
          ℹ️ {t("autoArchive.promptHint")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            type="button"
            onClick={onDecline}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            {t("autoArchive.confirmNo")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover shadow-md hover:shadow-primary/25 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {t("autoArchive.confirmYes")}
          </button>
        </div>
      </div>
    </div>
  );
}
