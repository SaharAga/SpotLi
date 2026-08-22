import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, CheckCircle2, ArrowRight, 
  AlertCircle
} from 'lucide-react';
import { parseSmartText } from '../utils/smartParser';
import { CARRIERS } from '../types/carriers';
import { useLanguage } from '../context/LanguageContext';

export function SmartImportModal({
  isOpen,
  onClose,
  onParsedResult,
  onSwitchToManual,
  initialText = ''
}) {
  const { t, language, isRTL } = useLanguage();
  const [rawText, setRawText] = useState(initialText || '');
  const [parsed, setParsed] = useState(() => {
    if (initialText && initialText.trim()) {
      return parseSmartText(initialText.trim());
    }
    return null;
  });
  const [hasSearched, setHasSearched] = useState(() => !!(initialText && initialText.trim()));

  useEffect(() => {
    if (initialText && initialText.trim() && isOpen) {
      const trimmed = initialText.trim();
      setRawText(trimmed);
      const result = parseSmartText(trimmed);
      if (result) {
        setParsed(result);
        setHasSearched(true);
      }
    }
  }, [initialText, isOpen]);

  // Auto-read clipboard on modal mount when permission is granted
  useEffect(() => {
    let isMounted = true;

    async function checkAndAutoReadClipboard() {
      if (!isOpen) return;
      if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;

      try {
        if (navigator.permissions?.query) {
          try {
            const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' });
            if (permissionStatus.state !== 'granted') {
              return;
            }
          } catch {
            // Some browsers do not support 'clipboard-read' permission query; fallback safely
          }
        }

        const text = await navigator.clipboard.readText();
        if (isMounted && text && text.trim()) {
          const trimmed = text.trim();
          setRawText(trimmed);
          const result = parseSmartText(trimmed);
          if (result && result.trackingNumber) {
            setParsed(result);
            setHasSearched(true);
          }
        }
      } catch (err) {
        // Silently catch clipboard access denial on automatic read
        console.debug?.('[SmartImportModal] Auto-read clipboard skipped:', err?.message);
      }
    }

    checkAndAutoReadClipboard();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleParseText = (e) => {
    if (e) e.preventDefault();
    if (!rawText.trim()) return;

    const result = parseSmartText(rawText);
    setParsed(result);
    setHasSearched(true);
  };

  // 1-Click Clipboard Auto-Paste
  const handleClipboardPaste = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setRawText(text.trim());
          const result = parseSmartText(text.trim());
          setParsed(result);
          setHasSearched(true);
          return;
        }
      }
    } catch (err) {
      console.warn('[SmartImportModal] Clipboard read permission denied or unavailable:', err);
    }
  };

  const handleApply = () => {
    if (parsed && parsed.trackingNumber) {
      onParsedResult({
        title: parsed.title,
        titleHe: parsed.titleHe,
        trackingNumber: parsed.trackingNumber,
        carrierId: parsed.carrier || 'other',
        notes: parsed.notes,
        origin: parsed.origin || '',
        destination: parsed.destination || 'Israel',
        pickupLocation: parsed.pickupLocation || ''
      });
      onClose();
    }
  };


  const sampleSMS = [
    {
      label: language === 'he' ? 'דוגמת SMS מדואר ישראל' : 'Israel Post SMS Example',
      text: 'שלום, דבר דואר שמספרו RS948219481IL נמסר לחלוקה ביחידת הדואר דיזנגוף סנטר. שעות פתיחה: 08:00-19:00.'
    },
    {
      label: language === 'he' ? 'דוגמת הודעת AliExpress / קאיניאו' : 'AliExpress / Cainiao Example',
      text: 'AliExpress update: Your order for "Mechanical Keyboard" (LP00582910482CN) has arrived at the destination sorting facility in Israel.'
    },
    {
      label: language === 'he' ? 'דוגמת הודעת DHL Express' : 'DHL Express Example',
      text: 'DHL Express shipment AWB 4829104821 is out for delivery today with courier Aviad.'
    }
  ];

  const detectedCarrierObj = parsed ? (CARRIERS[parsed.carrier] || CARRIERS['other']) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-indigo-600/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {language === 'he' ? 'ייבוא חכם מהודעה או טקסט' : 'Smart Import from Message or Text'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'he' ? 'הדבק טקסט, הודעת SMS או אימייל לחילוץ פרטי משלוח' : 'Paste text, SMS message, or confirmation email to extract details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {onSwitchToManual && (
            <button
              type="button"
              onClick={() => onSwitchToManual(rawText)}
              className="text-[11px] font-semibold text-slate-400 hover:text-blue-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              {language === 'he' ? 'להזין ידנית במקום זאת' : 'Enter details manually instead'}
            </button>
          )}

          {/* Quick Paste Button */}
          <div className="flex items-center justify-between p-3.5 bg-blue-950/40 border border-blue-500/30 rounded-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-200">
                {language === 'he' ? 'העתקת הודעה מהודעות או מהאימייל?' : 'Copied a tracking code or SMS?'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClipboardPaste}
              className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[48px] flex items-center justify-center"
            >
              {language === 'he' ? 'הדבק מלוח ההעתקה 📋' : 'Paste from Clipboard 📋'}
            </button>
          </div>

          <div className="space-y-4 animate-fade-in">
            {/* Quick Examples */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                {language === 'he' ? 'או בחר דוגמת הודעה מוכנה לבדיקה:' : 'Or try a sample message:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {sampleSMS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRawText(s.text);
                      const result = parseSmartText(s.text);
                      setParsed(result);
                      setHasSearched(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-all text-start cursor-pointer min-h-[48px] flex items-center"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <form onSubmit={handleParseText} className="space-y-3">
              <textarea
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={t('smartModal.pastePlaceholder')}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-2xl p-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[48px]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{language === 'he' ? 'חלץ פרטי משלוח' : 'Extract Shipping Details'}</span>
                </button>
              </div>
            </form>
          </div>


          {/* Parsed Result Display */}
          {hasSearched && (
            <div className="animate-fade-in pt-2">
              {parsed && parsed.trackingNumber ? (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('smartModal.parsedSuccess')}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">{t('modal.itemTitle')}</span>
                      <p className="font-semibold text-slate-200 mt-0.5">{parsed.title}</p>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">{t('modal.trackingNum')}</span>
                      <p className="font-mono font-bold text-blue-400 mt-0.5">{parsed.trackingNumber}</p>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">{t('modal.carrier')}</span>
                      <p className="font-semibold text-slate-200 mt-0.5">
                        {language === 'he' ? detectedCarrierObj.hebrewName : detectedCarrierObj.name}
                      </p>
                    </div>

                    {parsed.pickupLocation && (
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">{language === 'he' ? 'נקודת איסוף' : 'Pickup Point'}</span>
                        <p className="font-semibold text-amber-300 mt-0.5">{parsed.pickupLocation}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleApply}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer min-h-[48px]"
                    >
                      <span>{language === 'he' ? 'המשך להוספת חבילה זו למעקב' : 'Add this Package to Tracker'}</span>
                      <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 space-y-3">
                  <div className="flex items-center gap-3 text-rose-300 text-xs">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{t('smartModal.noMatchAlert')}</span>
                  </div>
                  {onSwitchToManual && (
                    <button
                      type="button"
                      onClick={() => onSwitchToManual(rawText)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
                    >
                      {language === 'he' ? 'הזן פרטים ידנית' : 'Enter Details Manually'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer min-h-[48px] min-w-[80px]"
          >
            {t('modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
