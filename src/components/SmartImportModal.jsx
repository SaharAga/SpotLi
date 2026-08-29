import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Sparkles, CheckCircle2, ArrowRight,
  AlertCircle, ImagePlus, Trash2, Loader2, ShieldAlert, Flag
} from 'lucide-react';
import { parseSmartText } from '../utils/smartParser';
import { getCarrier } from '../types/carriers';
import { findPackageByTrackingNumber } from '../services/deliveryService';
import { useLanguage } from '../context/LanguageContext';
import { parseWithAi } from '../services/aiParseService';
import { compressImageFile, extractImageFromPaste, ACCEPTED_IMAGE_TYPES } from '../utils/imageCompressor';
import { submitFeedback } from '../services/feedbackService';
import { Modal } from './Modal';

/**
 * Maps the AI fallback's response shape to the same shape parseSmartText()
 * returns, so the rest of this component (and AddEditPackageModal
 * downstream) never needs to know which path produced a result.
 */
function mapAiResultToParsed(aiResult, isGroundedCandidate = false) {
  const carrierObj = getCarrier(aiResult.carrier);
  const title = aiResult.title || (aiResult.trackingNumber ? `Package ${aiResult.trackingNumber.slice(0, 8)}...` : '');
  return {
    title,
    titleHe: title,
    trackingNumber: aiResult.trackingNumber || '',
    carrier: aiResult.carrier || 'other',
    carrierName: carrierObj.name,
    category: 'other',
    origin: aiResult.origin || carrierObj.country || '',
    destination: 'Israel',
    notes: aiResult.notes || '',
    notesHe: aiResult.notes || '',
    pickupLocation: aiResult.pickupLocation || '',
    isGroundedCandidate
  };
}

function verifiedParserResult(result) {
  return result?.trackingNumber && result.candidateStatus === 'verified' ? result : null;
}

export function SmartImportModal({
  isOpen,
  onClose,
  onParsedResult,
  onSwitchToManual,
  onShowToast,
  initialText = '',
  packages = []
}) {
  const { t, language, isRTL } = useLanguage();
  const [rawText, setRawText] = useState(initialText || '');
  const [parsed, setParsed] = useState(() => {
    if (initialText && initialText.trim()) {
      return verifiedParserResult(parseSmartText(initialText.trim()));
    }
    return null;
  });
  const [hasSearched, setHasSearched] = useState(() => !!(initialText && initialText.trim()));
  // Tracks how the current `parsed` result was produced — used to show a
  // "double-check this" hint for lower-confidence AI results, and passed
  // through to onParsedResult so a later edit can be attributed correctly
  // (the mis-parse detection signal in AddEditPackageModal).
  const [parseSource, setParseSource] = useState(null); // 'regex' | 'ai' | null
  const [aiConfidence, setAiConfidence] = useState(null);
  const [isAiParsing, setIsAiParsing] = useState(false);

  const [screenshot, setScreenshot] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState(null);

  // Explicit half of the mis-parse detection signal — a user actively
  // flagging a result, routed through the existing feedback pipeline
  // instead of a new reporting system.
  const [isReportingWrong, setIsReportingWrong] = useState(false);
  const [reportedWrong, setReportedWrong] = useState(false);

  const matchedExistingPackage = React.useMemo(() => {
    if (!parsed || !parsed.trackingNumber) return null;
    return findPackageByTrackingNumber(packages, parsed.trackingNumber);
  }, [packages, parsed]);

  useEffect(() => {
    if (initialText && initialText.trim() && isOpen) {
      const trimmed = initialText.trim();
      setRawText(trimmed);
      const result = parseSmartText(trimmed);
      if (result) {
        setParsed(verifiedParserResult(result));
        setParseSource('regex');
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
            setParsed(verifiedParserResult(result));
            setParseSource('regex');
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

  /**
   * Tries the deterministic parser first; only calls the paid AI fallback
   * when it comes back empty. Most pastes match a known pattern and never
   * reach the network at all.
   */
  const runTextParse = useCallback(async (text) => {
    setReportedWrong(false);
    const regexResult = parseSmartText(text);

    if (regexResult && regexResult.trackingNumber && regexResult.candidateStatus === 'verified') {
      setParsed(regexResult);
      setParseSource('regex');
      setAiConfidence(null);
      setHasSearched(true);
      return;
    }

    setIsAiParsing(true);
    try {
      const aiResponse = await parseWithAi({
        mode: 'text-fallback',
        text,
        // Gemini receives identifiers for deterministic candidates, never an
        // instruction to manufacture a tracking number from raw prose.
        candidates: regexResult?.candidates || []
      });
      if (aiResponse?.success && aiResponse.data?.trackingNumber && aiResponse.data.confidence !== 'none') {
        const isGroundedCandidate = (regexResult?.candidates || [])
          .some((candidate) => (
            candidate.value === aiResponse.data.trackingNumber && candidate.status === 'verified'
          ));
        setParsed(mapAiResultToParsed(aiResponse.data, isGroundedCandidate));
        setParseSource('ai');
        setAiConfidence(aiResponse.data.confidence);
      } else {
        // AI found nothing either (or is unavailable) — fallback to deterministic result if available
        setParsed(regexResult?.candidateStatus === 'verified' ? regexResult : null);
        setParseSource('regex');
        setAiConfidence(null);
      }
    } finally {
      setIsAiParsing(false);
      setHasSearched(true);
    }
  }, []);

  const attachImage = useCallback(async (file) => {
    setImageError(null);
    setReportedWrong(false);
    setIsProcessingImage(true);
    try {
      const result = await compressImageFile(file);
      setScreenshot(result);
      setIsProcessingImage(false);

      setIsAiParsing(true);
      try {
        // There is no deterministic OCR candidate list for screenshots yet;
        // the server deliberately abstains rather than letting a model invent
        // a tracking number from image pixels.
        const aiResponse = await parseWithAi({ mode: 'image', imageBase64: result.dataUrl, candidates: [] });
        if (aiResponse.success && aiResponse.data?.trackingNumber && aiResponse.data.confidence !== 'none') {
          setParsed(mapAiResultToParsed(aiResponse.data, false));
          setParseSource('ai');
          setAiConfidence(aiResponse.data.confidence);
        } else {
          setParsed(null);
          setParseSource('ai');
          setAiConfidence('none');
          if (aiResponse.unavailable) {
            setImageError(
              language === 'he'
                ? 'ניתוח תמונה חכם אינו זמין כרגע. אפשר להזין את הפרטים ידנית.'
                : 'AI screenshot parsing isn’t available right now. You can still enter details manually.'
            );
          } else if (aiResponse.rateLimited) {
            setImageError(aiResponse.error);
          }
        }
      } finally {
        setIsAiParsing(false);
        setHasSearched(true);
      }
    } catch (err) {
      setIsProcessingImage(false);
      const reason = err?.message;
      const messages = {
        'unsupported-type': language === 'he'
          ? 'סוג קובץ לא נתמך. נסו PNG, JPEG, WEBP או GIF.'
          : 'Unsupported file type. Try PNG, JPEG, WEBP, or GIF.',
        'too-large': language === 'he'
          ? 'התמונה גדולה מדי גם אחרי דחיסה. נסו לחתוך אותה ולצרף שוב.'
          : 'Image is still too large after compression. Try cropping it and attaching again.'
      };
      setImageError(
        messages[reason] ||
        (language === 'he' ? 'לא הצלחנו לעבד את התמונה.' : 'Could not process that image.')
      );
    }
  }, [language]);

  const handleImagePaste = useCallback((event) => {
    const file = extractImageFromPaste(event);
    if (file) {
      event.preventDefault();
      attachImage(file);
    }
  }, [attachImage]);

  if (!isOpen) return null;

  const handleParseText = (e) => {
    if (e) e.preventDefault();
    if (!rawText.trim()) return;
    runTextParse(rawText);
  };

  // 1-Click Clipboard Auto-Paste
  const handleClipboardPaste = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setRawText(text.trim());
          await runTextParse(text.trim());
          return;
        }
      }
    } catch (err) {
      console.warn('[SmartImportModal] Clipboard read permission denied or unavailable:', err);
    }
  };

  const handleApply = () => {
    const canApply = parsed?.trackingNumber && (
      (parseSource === 'regex' && parsed.candidateStatus === 'verified') ||
      (parseSource === 'ai' && parsed.isGroundedCandidate === true && aiConfidence && aiConfidence !== 'none')
    );
    if (canApply) {
      onParsedResult({
        title: parsed.title,
        titleHe: parsed.titleHe,
        trackingNumber: parsed.trackingNumber,
        carrierId: parsed.carrier || 'other',
        category: parsed.category || 'electronics',
        status: parsed.status || 'ready_for_pickup',
        notes: parsed.notes,
        origin: parsed.origin || '',
        destination: parsed.destination || 'Israel',
        pickupLocation: parsed.pickupLocation || '',
        pickupCode: parsed.lockerPin || parsed.pickupCode || '',
        pickupHours: parsed.pickupHours || '',
        pickupPhone: parsed.pickupPhone || '',
        isRedirected: parsed.isRedirected || false,
        originalPickupLocation: parsed.originalPickupLocation || '',
        redirectReason: parsed.redirectReason || '',
        // Not part of the package schema — consumed by AddEditPackageModal
        // to know which fields were auto-filled and how confidently, so an
        // edit before saving can be logged as a correction signal.
        _autoFillSource: parseSource,
        _autoFillConfidence: aiConfidence,
        // The raw pasted text, only used if the user has opted in to the
        // AI-training data collection (empty for image-sourced parses,
        // which is fine — we never retain the image either).
        _autoFillInputText: rawText || ''
      });
      onClose();
    }
  };

  // Explicit "this wasn't right" report — reuses the feedback pipeline
  // rather than a second reporting system. Non-blocking to the rest of the
  // flow: the user can still Apply or keep editing regardless.
  const handleReportWrongParse = async () => {
    if (!parsed || isReportingWrong || reportedWrong) return;
    setIsReportingWrong(true);
    try {
      const sourceLabel = parseSource === 'ai' ? `AI (${aiConfidence || 'unknown'} confidence)` : 'the built-in parser';
      const message = `[Smart Import mis-parse] Source: ${sourceLabel}. ` +
        `Extracted trackingNumber="${parsed.trackingNumber || ''}", carrier="${parsed.carrier || ''}". ` +
        'Reported as incorrect by the user before saving.';

      await submitFeedback({
        type: 'bug',
        message,
        rating: 2,
        isAnonymous: true,
        user: 'Anonymous Tester',
        screenshot: screenshot?.dataUrl || null
      });

      setReportedWrong(true);
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'תודה, הדיווח נשלח לצוות.' : 'Thanks, that’s been reported to the team.',
          'success'
        );
      }
    } catch (err) {
      console.warn('[SmartImportModal] Failed to report mis-parse:', err);
      if (onShowToast) {
        onShowToast(language === 'he' ? 'שליחת הדיווח נכשלה.' : 'Could not send that report.', 'error');
      }
    } finally {
      setIsReportingWrong(false);
    }
  };


  const sampleSMS = [
    {
      label: language === 'he' ? 'דוגמת SMS מדואר ישראל' : 'Israel Post SMS Example',
      text: 'שלום, דבר דואר שמספרו RS948219483IL נמסר לחלוקה ביחידת הדואר דיזנגוף סנטר. שעות פתיחה: 08:00-19:00.'
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




  const detectedCarrierObj = parsed ? getCarrier(parsed.carrier) : null;
  const showLowConfidenceHint = parseSource === 'ai' && (aiConfidence === 'low' || aiConfidence === 'medium');
  const canApplyParsed = parsed?.trackingNumber && (
    (parseSource === 'regex' && parsed.candidateStatus === 'verified') ||
    (parseSource === 'ai' && parsed.isGroundedCandidate === true && aiConfidence && aiConfidence !== 'none' && aiConfidence !== 'uncertain')
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="SmartImportModal"
      className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
    >
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
                      runTextParse(s.text);
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
                onPaste={handleImagePaste}
                placeholder={t('smartModal.pastePlaceholder')}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-2xl p-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAiParsing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[48px] disabled:opacity-50"
                >
                  {isAiParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>
                    {isAiParsing
                      ? (language === 'he' ? 'מנתח עם AI...' : 'Trying AI parsing...')
                      : (language === 'he' ? 'חלץ פרטי משלוח' : 'Extract Shipping Details')}
                  </span>
                </button>
              </div>
            </form>

            {/* Screenshot attach — a screenshot has no text to run the
                deterministic parser on, so this always goes straight to AI. */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                {language === 'he' ? 'או צרפו צילום מסך' : 'Or attach a screenshot'}
              </label>

              {screenshot ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img
                    src={screenshot.dataUrl}
                    alt={language === 'he' ? 'צילום מסך מצורף' : 'Attached screenshot'}
                    className="w-full max-h-40 object-contain bg-slate-900"
                  />
                  <div className="flex items-center justify-between px-3 py-2 text-[10px] text-slate-400">
                    <span>{screenshot.width}×{screenshot.height} • {Math.round(screenshot.bytes / 1024)}KB</span>
                    <button
                      type="button"
                      onClick={() => { setScreenshot(null); setImageError(null); }}
                      className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'he' ? 'הסר' : 'Remove'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed cursor-pointer transition-colors min-h-[48px] ${
                    isProcessingImage
                      ? 'border-slate-700 text-slate-500'
                      : 'border-slate-700 text-slate-400 hover:border-blue-500/60 hover:text-blue-300'
                  }`}
                >
                  {isProcessingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  <span className="text-xs font-semibold">
                    {isProcessingImage
                      ? (language === 'he' ? 'מעבד תמונה...' : 'Processing image...')
                      : (language === 'he' ? 'צרף צילום מסך (Ctrl+V בתיבת הטקסט)' : 'Attach a screenshot (or paste into the box above)')}
                  </span>
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    className="hidden"
                    disabled={isProcessingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) attachImage(file);
                    }}
                  />
                </label>
              )}

              {imageError && <p className="text-[10px] text-rose-400 mt-1.5">{imageError}</p>}
            </div>
          </div>


          {/* Parsed Result Display */}
          {hasSearched && !isAiParsing && (
            <div className="animate-fade-in pt-2">
              {parsed && parsed.trackingNumber ? (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('smartModal.parsedSuccess')}</span>
                    </div>
                    {matchedExistingPackage && (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-medium flex items-center gap-1">
                        <span>{language === 'he' ? 'חבילה קיימת מעודכנת' : 'Matching Existing Package'}</span>
                      </span>
                    )}
                  </div>
                  {matchedExistingPackage && (
                    <p className="text-[11px] text-blue-200/80 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                      ℹ️ {t('modal.existingMatchFound')}
                    </p>
                  )}

                  {showLowConfidenceHint && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        {language === 'he'
                          ? 'AI לא בטוח לגמרי בתוצאה הזו — כדאי לבדוק את הפרטים לפני השמירה.'
                          : 'AI wasn’t fully confident here — worth double-checking the details before saving.'}
                      </p>
                    </div>
                  )}

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

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleReportWrongParse}
                      disabled={isReportingWrong || reportedWrong}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-400 transition-colors cursor-pointer disabled:cursor-default disabled:hover:text-slate-500"
                    >
                      {isReportingWrong ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Flag className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {reportedWrong
                          ? (language === 'he' ? 'הדיווח נשלח, תודה' : 'Reported, thanks')
                          : (language === 'he' ? 'זה לא נכון?' : 'This wasn’t right?')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={!canApplyParsed}
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
      </Modal>
  );
}
