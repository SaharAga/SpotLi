import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Pin, Trash2, Edit3, CheckCircle } from 'lucide-react';
import { CARRIERS } from '../types/carriers';
import { copyToClipboard } from '../utils/clipboard';
import { STAGES } from '../types/stages';
import { useLanguage } from '../context/LanguageContext';
import { formatDate, getDaysRemaining } from '../utils/dateUtils';
import confetti from 'canvas-confetti';

function PackageTableImpl({
  packages = [],
  onOpenDetails,
  onEdit,
  onDelete,
  onTogglePin,
  onStatusChange,
  onShowToast
}) {
  const { t, language } = useLanguage();
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = async (id, trackingNumber, e) => {
    e.stopPropagation();
    const success = await copyToClipboard(trackingNumber);
    if (success) {
      setCopiedId(id);
      if (onShowToast) onShowToast(t('card.copied'), 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } else if (onShowToast) {
      onShowToast(language === 'he' ? 'ההעתקה ללוח נכשלה' : 'Failed to copy to clipboard', 'error');
    }
  };

  const handleMarkDelivered = (pkg, e) => {
    e.stopPropagation();
    if (pkg.status !== 'delivered') {
      confetti({ particleCount: 60, spread: 50 });
      onStatusChange(pkg.id, 'delivered');
      if (onShowToast) onShowToast(language === 'he' ? 'החבילה סומנה כנמסרה! 🎉' : 'Package marked as delivered! 🎉', 'success');
    } else {
      onStatusChange(pkg.id, 'in_transit');
      if (onShowToast) onShowToast(language === 'he' ? 'החבילה הוחזרה למצב פעיל' : 'Package marked as active', 'info');
    }
  };

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-sm">
      <table className="w-full text-start text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
            <th className="py-3.5 px-4 text-start w-10"></th>
            <th className="py-3.5 px-4 text-start">{t('modal.itemTitle')}</th>
            <th className="py-3.5 px-4 text-start">{t('card.trackingNumber')}</th>
            <th className="py-3.5 px-4 text-start">{t('modal.carrier')}</th>
            <th className="py-3.5 px-4 text-start">{t('modal.status')}</th>
            <th className="py-3.5 px-4 text-start">{t('modal.expectedDelivery')}</th>
            <th className="py-3.5 px-4 text-start">{t('modal.destination')}</th>
            <th className="py-3.5 px-4 text-end"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {packages.map((pkg) => {
            const carrier = CARRIERS[pkg.carrier] || CARRIERS['other'];
            const stage = STAGES.find(s => s.id === pkg.status) || STAGES[0];
            const daysInfo = getDaysRemaining(pkg.expectedDeliveryDate, language);
            const itemTitle = (language === 'he' && pkg.titleHe) ? pkg.titleHe : pkg.title;

            return (
              <tr
                key={pkg.id}
                onClick={() => onOpenDetails(pkg)}
                className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
              >
                {/* Pin button */}
                <td className="py-3 px-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(pkg.id);
                    }}
                    className={`p-1 rounded-md transition-colors ${
                      pkg.isPinned ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <Pin className={`w-3.5 h-3.5 ${pkg.isPinned ? 'fill-blue-400' : ''}`} />
                  </button>
                </td>

                {/* Title */}
                <td className="py-3 px-4 font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                  {itemTitle}
                </td>

                {/* Tracking Number */}
                <td className="py-3 px-4 font-mono text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                      {pkg.trackingNumber}
                    </span>
                    <button
                      onClick={(e) => handleCopy(pkg.id, pkg.trackingNumber, e)}
                      className="text-slate-500 hover:text-white transition-colors"
                      title={t('card.copyTracking')}
                    >
                      {copiedId === pkg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>

                {/* Carrier */}
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${carrier.badgeBg}`}>
                    {language === 'he' ? carrier.hebrewName : carrier.name}
                  </span>
                </td>

                {/* Status Stage */}
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${stage.badgeClass}`}>
                    {language === 'he' ? stage.hebrewLabel : stage.label}
                  </span>
                </td>

                {/* Expected Delivery */}
                <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{formatDate(pkg.expectedDeliveryDate, language)}</span>
                    {daysInfo && pkg.status !== 'delivered' && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${daysInfo.isUrgent ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                        {daysInfo.text}
                      </span>
                    )}
                  </div>
                </td>

                {/* Destination */}
                <td className="py-3 px-4 text-slate-400 truncate max-w-[120px]">
                  {pkg.destination || '-'}
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-end">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleMarkDelivered(pkg, e)}
                      title={t('card.markDelivered')}
                      className={`p-1.5 rounded-lg transition-colors ${
                        pkg.status === 'delivered' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <a
                      href={carrier.getTrackingUrl(pkg.trackingNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                      title={t('card.viewCarrier')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => onEdit(pkg)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title={t('card.edit')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(pkg.id)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      title={t('card.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Same reasoning as PackageCard: the table body is the whole list, and it
// only needs to re-render when the list or its handlers actually change.
export const PackageTable = React.memo(PackageTableImpl);
