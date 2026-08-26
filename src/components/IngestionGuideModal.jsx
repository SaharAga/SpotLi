import React, { useState } from 'react';
import { 
  X, ClipboardCheck, Mail, Smartphone, 
  Sparkles, ArrowRight, CheckCircle2, Copy 
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard } from '../utils/clipboard';
import { Modal } from './Modal';

export function IngestionGuideModal({
  isOpen,
  onClose,
  onOpenSmartImport,
  onShowToast
}) {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen) return null;

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://deliveree.app';
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appOrigin)}`;
  const ingestionEmail = user?.ingestionEmail || 'your-id.pkg@in.deliveree.app';

  const handleCopyEmail = async () => {
    const success = await copyToClipboard(ingestionEmail);
    if (success) {
      setCopiedEmail(true);
      if (onShowToast) onShowToast(language === 'he' ? 'כתובת האימייל הועתקה ללוח' : 'Email copied to clipboard', 'success');
      setTimeout(() => setCopiedEmail(false), 2500);
    } else if (onShowToast) {
      onShowToast(language === 'he' ? 'ההעתקה ללוח נכשלה' : 'Failed to copy to clipboard', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="IngestionGuideModal"
      overlayClassName="p-3 sm:p-4"
      className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
    >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                {language === 'he' ? 'מדריך קליטת חבילות אוטומטית' : 'Automatic Package Ingestion Guide'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'he' ? 'איך להזין חבילות בשניות מ-SMS, אימייל ולוח ההעתקה' : 'Ingest shipments in seconds via SMS, Email & Clipboard'}
              </p>
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

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Method 1: 1-Click Clipboard Auto-Paste */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    {language === 'he' ? '1. הדבקה חכמה מהירה מהלוח' : '1. Rapid 1-Click Clipboard Paste'}
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    {language === 'he' ? 'השיטה המהירה והמומלצת ביותר ⚡' : 'Fastest & Recommended Method ⚡'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  if (onOpenSmartImport) onOpenSmartImport();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[40px]"
              >
                <span>{language === 'he' ? 'פתח הדבקה' : 'Open Paste'}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {language === 'he'
                ? 'מעתיקים את הודעת ה-SMS, מספר המעקב או אימייל ההזמנה מכל אפליקציה — לוחצים על כפתור "+" או "הדבקה חכמה", והמערכת מזהה אוטומטית את הספק, מספר המעקב, קוד הנעילה ונקודת האיסוף.'
                : 'Copy any SMS, tracking number, or shipping confirmation email. Tap "+" or Smart Paste and Deliveree automatically extracts carrier, tracking code, locker pin, and pickup branch.'}
            </p>
          </div>

          {/* Method 2: Email Forwarding Box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    {language === 'he' ? '2. העברת אימיילים לתיבה האישית' : '2. Ingestion Email Forwarding'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {language === 'he' ? 'ייבוא אישורי הזמנה מחנויות' : 'Import order receipts from stores'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">{language === 'he' ? 'תיבת המשלוחים שלך:' : 'Your Ingestion Box:'}</span>
                <span className="font-mono text-xs text-blue-400 font-semibold truncate block select-all">
                  {ingestionEmail}
                </span>
              </div>
              <button
                onClick={handleCopyEmail}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[36px]"
              >
                {copiedEmail ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEmail ? (language === 'he' ? 'הועתק!' : 'Copied!') : (language === 'he' ? 'העתק' : 'Copy')}</span>
              </button>
            </div>
          </div>

          {/* Method 3: Mobile Phone Pairing */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    {language === 'he' ? '3. התקנה ושימוש בטלפון הנייד' : '3. Mobile Phone Installation'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {language === 'he' ? 'הוסף למסך הבית (PWA)' : 'Add to Home Screen (PWA)'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowQR(!showQR)}
                className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer min-h-[36px]"
              >
                {showQR ? (language === 'he' ? 'הסתר QR' : 'Hide QR') : (language === 'he' ? 'סרוק QR' : 'Scan QR')}
              </button>
            </div>

            {showQR && (
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 animate-fade-in">
                <div className="p-2 bg-white rounded-xl shadow-lg shrink-0">
                  <img src={qrCodeImageUrl} alt="QR Code" className="w-32 h-32" />
                </div>
                <div className="space-y-1.5 text-start">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                    {language === 'he' ? 'כיצד לפתוח בטלפון:' : 'How to open on phone:'}
                  </span>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
                    <li>{language === 'he' ? 'סרוק את הברקוד במצלמת הטלפון.' : 'Scan QR code with phone camera.'}</li>
                    <li>{language === 'he' ? 'האפליקציה תיפתח מיידית בדפדפן הנייד.' : 'Deliveree opens immediately.'}</li>
                    <li>{language === 'he' ? 'לחץ "הוסף למסך הבית" להתקנה כאפליקציה חלקה.' : 'Tap "Add to Home Screen" to install.'}</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
          >
            {language === 'he' ? 'הבנתי, תודה' : 'Got it, Thanks'}
          </button>
        </div>
      </Modal>
  );
}
