import React, { useState } from 'react';
import {
  MessageSquare, Copy, Check, ExternalLink, Send,
  DoorOpen, KeyRound, ShieldCheck, UserCheck
} from 'lucide-react';
import {
  TEMPLATE_TYPES,
  generateCourierMessage,
  buildWhatsAppUrl,
  buildSmsUrl
} from '../utils/courierTemplates';
import { copyToClipboard } from '../utils/clipboard';
import { triggerHapticFeedback } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';

export function CourierActionHub({ pkg, onShowToast }) {
  const { language } = useLanguage();
  const isHe = language === 'he';

  const [selectedType, setSelectedType] = useState(
    pkg.pickupCode ? TEMPLATE_TYPES.PROXY_PICKUP : TEMPLATE_TYPES.PORCH_DROP
  );
  const [gateCode, setGateCode] = useState('');
  const [copied, setCopied] = useState(false);

  const templateOptions = [
    {
      id: TEMPLATE_TYPES.PORCH_DROP,
      label: isHe ? 'השאר ליד הדלת' : 'Porch Drop',
      icon: DoorOpen
    },
    {
      id: TEMPLATE_TYPES.GATE_CODE,
      label: isHe ? 'קוד כניסה / שער' : 'Gate Code',
      icon: KeyRound
    },
    {
      id: TEMPLATE_TYPES.SAFE_PLACE,
      label: isHe ? 'מקום בטוח / שכן' : 'Safe Place',
      icon: ShieldCheck
    },
    {
      id: TEMPLATE_TYPES.PROXY_PICKUP,
      label: isHe ? 'ייפוי כוח לאיסוף' : 'Proxy Pickup',
      icon: UserCheck
    }
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
    language
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
                ? 'הודעות מוכנות לשליח בוואטסאפ וב-SMS (השאר ליד הדלת, קוד כניסה, ייפוי כוח)'
                : 'Pre-filled messages for WhatsApp & SMS (Porch drop, gate code, proxy pickup)'}
            </p>
          </div>
        </div>
      </div>

      {/* Template Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {templateOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = selectedType === opt.id;
          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => {
                triggerHapticFeedback(10);
                setSelectedType(opt.id);
              }}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all min-h-[44px] cursor-pointer ${
                isActive
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="truncate">{opt.label}</span>
            </button>
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
