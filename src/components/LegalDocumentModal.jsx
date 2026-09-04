import React from 'react';
import { X, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { TERMS_CONTENT, PRIVACY_CONTENT } from '../constants/legal';
import { Modal } from './Modal';

/**
 * Read-only viewer for the full Terms of Use or Privacy Policy text, opened
 * from the registration checkboxes, LegalConsentGate, and AboutModal — one
 * place that renders src/constants/legal.js so the three call sites can't
 * drift out of sync with each other.
 */
export function LegalDocumentModal({ isOpen, onClose, docType = 'terms' }) {
  const { language, isRTL } = useLanguage();

  if (!isOpen) return null;

  const content = (docType === 'privacy' ? PRIVACY_CONTENT : TERMS_CONTENT)[language] ||
    (docType === 'privacy' ? PRIVACY_CONTENT : TERMS_CONTENT).en;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="LegalDocumentModal"
      layer="top"
      overlayClassName="bg-slate-950/85"
      className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[85vh] flex flex-col"
    >
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-indigo-600/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">{content.title}</h2>
              <p className="text-xs text-slate-400">{content.updated}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-300 ${isRTL ? 'text-right' : 'text-left'}`}>
          {content.sections.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-bold text-slate-100 mb-1">{section.heading}</h3>
              <p className="leading-relaxed text-slate-400">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer min-h-[44px]"
          >
            {language === 'he' ? 'סגור' : 'Close'}
          </button>
        </div>
      </Modal>
  );
}
