import React, { useState, useCallback } from 'react';
import {
  X, MessageSquarePlus, Send,
  Bug, Lightbulb, Heart, Smartphone, ShieldCheck,
  ImagePlus, Trash2, Loader2
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { submitFeedback } from '../services/feedbackService';
import {
  compressImageFile,
  extractImageFromPaste,
  ACCEPTED_IMAGE_TYPES
} from '../utils/imageCompressor';
import { Modal } from './Modal';

export function FeedbackModal({
  isOpen,
  onClose,
  onShowToast
}) {
  const { language, isRTL } = useLanguage();

  const [feedbackType, setFeedbackType] = useState('bug'); // 'bug' | 'feature' | 'praise'
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState(null);

  /**
   * Downscales the picked image and holds it in state. The screenshot travels
   * inside the Firestore document, so oversized files are rejected here rather
   * than failing opaquely at write time.
   */
  const attachImage = useCallback(async (file) => {
    setImageError(null);
    setIsProcessingImage(true);
    try {
      const result = await compressImageFile(file);
      setScreenshot(result);
    } catch (err) {
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
    } finally {
      setIsProcessingImage(false);
    }
  }, [language]);

  // Pasting a screenshot straight into the textarea is the common path on
  // desktop; the file picker covers mobile and drag-free flows.
  const handlePaste = useCallback((event) => {
    const file = extractImageFromPaste(event);
    if (file) {
      event.preventDefault();
      attachImage(file);
    }
  }, [attachImage]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      if (onShowToast) onShowToast(
        language === 'he' ? 'נא לכתוב תוכן למשוב' : 'Please enter feedback text',
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitFeedback({
        type: feedbackType,
        message,
        rating,
        isAnonymous: true,
        user: 'Anonymous Tester',
        screenshot: screenshot?.dataUrl || null
      });

      if (onShowToast) {
        if (result.syncedToCloud) {
          onShowToast(
            language === 'he'
              ? 'תודה רבה! המשוב שלך נשלח בהצלחה לצוות הפיתוח ❤️'
              : 'Thank you! Your feedback has been synced to the team ❤️',
            'success'
          );
        } else if (!result.isOnline) {
          onShowToast(
            language === 'he'
              ? 'המשוב נשמר במכשיר ויסונכרן אוטומטית כשתחזור הרשת 📡'
              : 'Feedback saved locally and will auto-sync once online 📡',
            'info'
          );
        } else {
          onShowToast(
            language === 'he'
              ? 'המשוב נשמר במכשיר ויסונכרן בהמשך (השליחה נכשלה זמנית) ⚠️'
              : 'Feedback saved locally and queued to retry (temporary server issue) ⚠️',
            'warning'
          );
        }
      }

      setMessage('');
      setScreenshot(null);
      setImageError(null);
      onClose();
    } catch (err) {
      console.warn('[FeedbackModal] Submission error:', err);
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'שגיאה בשליחת המשוב. נסה שוב.' : 'Error sending feedback. Please try again.',
          'error'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="FeedbackModal"
      className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
    >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {language === 'he' ? 'משוב ודיווח תקלות (גרסת אלפא)' : 'Alpha Feedback & Bug Report'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'he' ? 'עזרו לנו לשפר את Deliveree לפני ההשקה' : 'Help us perfect Deliveree before launch'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Feedback Type Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {language === 'he' ? 'סוג המשוב' : 'Feedback Category'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFeedbackType('bug')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer min-h-[44px] ${
                  feedbackType === 'bug'
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'תקלה / באג' : 'Bug'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFeedbackType('feature')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer min-h-[44px] ${
                  feedbackType === 'feature'
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'הצעת ייעול' : 'Idea'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFeedbackType('praise')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer min-h-[44px] ${
                  feedbackType === 'praise'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>{language === 'he' ? 'חוויית שימוש' : 'Praise'}</span>
              </button>
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {language === 'he' ? 'דירוג חוויית השימוש שלך' : 'Rate Your Experience'}
            </label>
            <div className="flex items-center justify-between gap-2 p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    rating >= star ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  ★ {star}
                </button>
              ))}
            </div>
          </div>

          {/* Description Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {language === 'he' ? 'פירוט המשוב או תיאור הבעיה' : 'Detailed Feedback / Description'} *
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                language === 'he'
                  ? 'ספרו לנו מה אהבתם, מה היה מסורבל, או איזה כפתור לא הגיב כמצופה...'
                  : 'Tell us what felt smooth, what was confusing, or what bug you encountered...'
              }
              onPaste={handlePaste}
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl p-3 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
            />
            <p className="text-xs text-slate-500 mt-1">
              {language === 'he'
                ? 'טיפ: אפשר להדביק צילום מסך ישירות לתיבה (Ctrl+V).'
                : 'Tip: you can paste a screenshot straight into the box (Ctrl+V).'}
            </p>
          </div>

          {/* Screenshot attachment */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {language === 'he' ? 'צילום מסך (רשות)' : 'Screenshot (optional)'}
            </label>

            {screenshot ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={screenshot.dataUrl}
                  alt={language === 'he' ? 'צילום מסך מצורף' : 'Attached screenshot'}
                  className="w-full max-h-48 object-contain bg-slate-900"
                />
                <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
                  <span>
                    {screenshot.width}×{screenshot.height} • {Math.round(screenshot.bytes / 1024)}KB
                  </span>
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
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
                    : 'border-slate-700 text-slate-400 hover:border-indigo-500/60 hover:text-indigo-300'
                }`}
              >
                {isProcessingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4" />
                )}
                <span className="text-xs font-semibold">
                  {isProcessingImage
                    ? (language === 'he' ? 'מעבד תמונה...' : 'Processing image...')
                    : (language === 'he' ? 'צרף צילום מסך' : 'Attach a screenshot')}
                </span>
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  disabled={isProcessingImage}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    // Reset so re-picking the same file still fires onChange.
                    e.target.value = '';
                    if (file) attachImage(file);
                  }}
                />
              </label>
            )}

            {imageError && (
              <p className="text-xs text-rose-400 mt-1.5">{imageError}</p>
            )}

            {/* The rest of the payload is scrubbed of PII automatically; the
                contents of an image cannot be. Say so plainly. */}
            {screenshot && (
              <p className="text-xs text-amber-400/90 mt-1.5 leading-tight">
                {language === 'he'
                  ? '⚠️ שימו לב: לא ניתן להסתיר פרטים אישיים בתוך תמונה. ודאו שהצילום אינו כולל כתובת, טלפון או פרטי תשלום.'
                  : '⚠️ Note: personal details inside an image can’t be masked automatically. Check the screenshot doesn’t show an address, phone number, or payment details.'}
              </p>
            )}
          </div>

          {/* Complete Anonymity Privacy Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex flex-col space-y-0.5">
              <span className="font-bold text-xs text-indigo-200">
                {language === 'he' ? '🔒 כל המשובים נשלחים בצורה אנונימית לחלוטין' : '🔒 All feedback is submitted 100% anonymously'}
              </span>
              <span className="text-xs text-slate-400 leading-tight">
                {language === 'he'
                  ? 'ללא שמירת פרטי משתמש, מייל או מזהים אישיים (Zero Tracking & PII).'
                  : 'Zero user tracking, email extraction, or personal identification.'}
              </span>
            </div>
          </div>

          {/* Device metadata indicator */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
            <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              {language === 'he' 
                ? 'פרטי המכשיר וגודל המסך יצורפו אוטומטית כדי לעזור באיתור באגים.'
                : 'Device model and screen specs will be included automatically for debugging.'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer min-h-[48px]"
            >
              {language === 'he' ? 'ביטול' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/20 cursor-pointer min-h-[48px]"
            >
              <Send className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              <span>{isSubmitting ? (language === 'he' ? 'שולח משוב...' : 'Sending...') : (language === 'he' ? 'שלח משוב' : 'Submit Feedback')}</span>
            </button>
          </div>
        </form>
      </Modal>
  );
}
