import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Copy, Check, ExternalLink, Send,
  DoorOpen, KeyRound, ShieldCheck, UserCheck, PhoneCall,
  Building, Clock, Plus, Trash2, Edit3, X, Sparkles
} from 'lucide-react';
import {
  TEMPLATE_TYPES,
  BUILTIN_PRESETS,
  generateCourierMessage,
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  buildWhatsAppUrl,
  buildSmsUrl
} from '../utils/courierTemplates';
import { copyToClipboard } from '../utils/clipboard';
import { triggerHapticFeedback } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';

const ICON_MAP = {
  DoorOpen,
  KeyRound,
  ShieldCheck,
  UserCheck,
  PhoneCall,
  Building,
  Clock,
  Sparkles
};

export function CourierActionHub({ pkg, onShowToast }) {
  const { language } = useLanguage();
  const isHe = language === 'he';

  const [customTemplates, setCustomTemplates] = useState([]);
  const [selectedType, setSelectedType] = useState(
    pkg.pickupCode ? TEMPLATE_TYPES.PROXY_PICKUP : TEMPLATE_TYPES.PORCH_DROP
  );
  const [gateCode, setGateCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Custom Template Creator Modal State
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customText, setCustomText] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    setCustomTemplates(getCustomTemplates());
  }, []);

  const allTemplates = [
    ...BUILTIN_PRESETS.map((p) => ({
      id: p.id,
      label: isHe ? p.labelHe : p.labelEn,
      icon: ICON_MAP[p.icon] || MessageSquare,
      isCustom: false
    })),
    ...customTemplates.map((c) => ({
      id: c.id,
      label: c.label,
      icon: Sparkles,
      isCustom: true
    }))
  ];

  const currentMessage = generateCourierMessage(
    selectedType,
    {
      trackingNumber: pkg.trackingNumber,
      carrierName: pkg.carrierName || pkg.carrier,
      pickupCode: pkg.pickupCode,
      pickupLocation: pkg.pickupLocation,
      gateCode: gateCode,
      notes: pkg.notes,
      title: isHe && pkg.titleHe ? pkg.titleHe : pkg.title
    },
    language,
    customTemplates
  );

  const handleCopy = async () => {
    triggerHapticFeedback(15);
    const success = await copyToClipboard(currentMessage);
    if (success) {
      setCopied(true);
      if (onShowToast) {
        onShowToast(isHe ? 'ההודעה הועתקה ללוח' : 'Message copied to clipboard', 'success');
      }
      setTimeout(() => setCopied(false), 2000);
    } else if (onShowToast) {
      onShowToast(isHe ? 'ההעתקה נכשלה' : 'Failed to copy', 'error');
    }
  };

  const handleWhatsApp = () => {
    triggerHapticFeedback(15);
    const url = buildWhatsAppUrl({ text: currentMessage });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSms = () => {
    triggerHapticFeedback(15);
    const url = buildSmsUrl({ text: currentMessage });
    window.location.href = url;
  };

  const handleSaveCustom = (e) => {
    e.preventDefault();
    if (!customLabel.trim() || !customText.trim()) return;

    const updated = saveCustomTemplate({
      id: editingId || undefined,
      label: customLabel.trim(),
      templateText: customText.trim()
    });

    setCustomTemplates(updated);
    if (!editingId) {
      setSelectedType(updated[updated.length - 1]?.id || selectedType);
    }
    setIsCreatingCustom(false);
    setCustomLabel('');
    setCustomText('');
    setEditingId(null);
    if (onShowToast) {
      onShowToast(isHe ? 'התגובה המותאמת נשמרה בהצלחה!' : 'Custom response saved!', 'success');
    }
  };

  const handleDeleteCustom = (id, e) => {
    e.stopPropagation();
    const updated = deleteCustomTemplate(id);
    setCustomTemplates(updated);
    if (selectedType === id) {
      setSelectedType(TEMPLATE_TYPES.PORCH_DROP);
    }
    if (onShowToast) {
      onShowToast(isHe ? 'התגובה נמחקה' : 'Custom response deleted', 'info');
    }
  };

  const handleOpenEditCustom = (t, e) => {
    e.stopPropagation();
    const full = customTemplates.find((c) => c.id === t.id);
    if (full) {
      setEditingId(full.id);
      setCustomLabel(full.label || '');
      setCustomText(full.templateText || '');
      setIsCreatingCustom(true);
    }
  };

  const insertPlaceholder = (ph) => {
    setCustomText((prev) => `${prev} ${ph}`);
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              {isHe ? 'תגובה מהירה לשליח (1-Click)' : 'Courier Quick Actions (1-Click)'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {isHe
                ? 'הודעות מוכנות לשליח בוואטסאפ וב-SMS, או הוסף תגובה משלך'
                : 'Pre-filled courier messages or create your own custom responses'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setCustomLabel('');
            setCustomText('');
            setIsCreatingCustom(!isCreatingCustom);
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 transition-colors min-h-[36px]"
          title={isHe ? 'הוסף תגובה חדשה' : 'Add custom template'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isHe ? 'תגובה חדשה' : 'New Response'}</span>
        </button>
      </div>

      {/* Custom Template Editor Drawer/Form */}
      {isCreatingCustom && (
        <form onSubmit={handleSaveCustom} className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {editingId ? (isHe ? 'עריכת תגובה מותאמת' : 'Edit Custom Response') : (isHe ? 'יצירת תגובה מותאמת חדשה' : 'Create Custom Response')}
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingCustom(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder={isHe ? 'שם התגובה (למשל: השאר במרפסת, במשרד...)' : 'Response Title (e.g. Leave on Balcony)'}
            className="p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            required
          />

          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={isHe ? 'טקסט ההודעה לשליח (ניתן לשלב משתנים למטה)...' : 'Courier message text (you can insert variables below)...'}
            className="p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[70px]"
            required
          />

          {/* Quick Variable Insert Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="text-slate-400">{isHe ? 'הוסף משתנה:' : 'Insert variable:'}</span>
            <button
              type="button"
              onClick={() => insertPlaceholder('{gateCode}')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 cursor-pointer"
            >
              {isHe ? '+ קוד שער' : '+ Gate Code'}
            </button>
            <button
              type="button"
              onClick={() => insertPlaceholder('{tracking}')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 cursor-pointer"
            >
              {isHe ? '+ מספר מעקב' : '+ Tracking'}
            </button>
            <button
              type="button"
              onClick={() => insertPlaceholder('{pickupCode}')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
            >
              {isHe ? '+ קוד איסוף' : '+ PIN'}
            </button>
            <button
              type="button"
              onClick={() => insertPlaceholder('{pickupLocation}')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 cursor-pointer"
            >
              {isHe ? '+ מיקום איסוף' : '+ Location'}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => setIsCreatingCustom(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              {isHe ? 'ביטול' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
            >
              {isHe ? 'שמור תגובה' : 'Save Response'}
            </button>
          </div>
        </form>
      )}

      {/* Template Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {allTemplates.map((opt) => {
          const Icon = opt.icon;
          const isActive = selectedType === opt.id;
          return (
            <div
              key={opt.id}
              className={`group relative flex items-center justify-between p-1 rounded-xl border transition-all min-h-[44px] cursor-pointer ${
                isActive
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback(10);
                  setSelectedType(opt.id);
                }}
                className="flex items-center gap-1.5 flex-1 px-2 py-1.5 min-w-0 text-xs font-semibold cursor-pointer"
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="truncate">{opt.label}</span>
              </button>

              {opt.isCustom && (
                <div className="flex items-center gap-1 px-1">
                  <button
                    type="button"
                    onClick={(e) => handleOpenEditCustom(opt, e)}
                    className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
                    title={isHe ? 'ערוך תגובה' : 'Edit'}
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustom(opt.id, e)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title={isHe ? 'מחק תגובה' : 'Delete'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gate Code Inline Input */}
      {selectedType === TEMPLATE_TYPES.GATE_CODE && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
          <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            type="text"
            value={gateCode}
            onChange={(e) => setGateCode(e.target.value)}
            placeholder={isHe ? 'הזן קוד כניסה לבניין (למשל 1423#)' : 'Enter entrance/gate code (e.g. 1423#)'}
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>
      )}

      {/* Message Preview */}
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line relative">
        <span className="text-[10px] text-slate-500 font-bold block mb-1 uppercase tracking-wider">
          {isHe ? 'תצוגה מקדימה של ההודעה:' : 'Message Preview:'}
        </span>
        {currentMessage}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleWhatsApp}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 min-h-[48px] cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{isHe ? 'שלח בוואטסאפ' : 'WhatsApp'}</span>
        </button>

        <button
          type="button"
          onClick={handleSms}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700 min-h-[48px] cursor-pointer"
        >
          <ExternalLink className="w-4 h-4" />
          <span>{isHe ? 'שלח ב-SMS' : 'SMS'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700 min-h-[48px] cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? (isHe ? 'הועתק!' : 'Copied!') : (isHe ? 'העתק טקסט' : 'Copy Text')}</span>
        </button>
      </div>
    </div>
  );
}
