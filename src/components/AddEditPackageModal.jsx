import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Package } from 'lucide-react';
import { CARRIERS, CARRIER_LIST } from '../types/carriers';
import { STAGES, CATEGORIES } from '../types/stages';
import { detectCarrier } from '../utils/carrierDetector';
import { useLanguage } from '../context/LanguageContext';
import { recordParseCorrection } from '../services/parseCorrectionService';

// Smart Import fields worth watching for a post-autofill edit. Excludes
// `destination`, which is always a static guess ("Israel") rather than
// something the parser extracted — editing it says nothing about parse
// quality. Matches the allowlist enforced in firestore.rules for
// parseCorrections.
const AUTOFILL_TRACKED_FIELDS = ['title', 'trackingNumber', 'carrier', 'origin', 'notes'];

export function AddEditPackageModal({
  isOpen,
  onClose,
  onSave,
  editPackage = null,
  initialValues = null
}) {
  const { t, language } = useLanguage();

  const [title, setTitle] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('other');
  const [isManualCarrier, setIsManualCarrier] = useState(false);
  const [category, setCategory] = useState('electronics');
  const [orderDate, setOrderDate] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('in_transit');

  // Snapshot of what Smart Import auto-filled, so a save can detect which
  // fields the user corrected before submitting — the implicit half of the
  // mis-parse detection signal. Null outside a fresh Smart Import prefill
  // (editing an existing package is not a "correction" of anything).
  const autoFillSnapshotRef = useRef(null);

  // Auto-detect carrier on tracking number typing
  useEffect(() => {
    if (!isManualCarrier && trackingNumber) {
      const detection = detectCarrier(trackingNumber);
      if (detection.confidence !== 'none') {
        setCarrier(detection.carrierId);
      }
    }
  }, [trackingNumber, isManualCarrier]);

  // Load existing package for edit mode or initial smart import values
  useEffect(() => {
    if (editPackage) {
      setTitle(editPackage.title || '');
      setTrackingNumber(editPackage.trackingNumber || '');
      setCarrier(editPackage.carrier || 'other');
      setIsManualCarrier(true);
      setCategory(editPackage.category || 'electronics');
      setOrderDate(editPackage.orderDate || '');
      setExpectedDeliveryDate(editPackage.expectedDeliveryDate || '');
      setOrigin(editPackage.origin || '');
      setDestination(editPackage.destination || '');
      setNotes(editPackage.notes || '');
      setStatus(editPackage.status || 'in_transit');
      autoFillSnapshotRef.current = null;
    } else if (initialValues) {
      const title = initialValues.title || '';
      const trackingNumber = initialValues.trackingNumber || '';
      const carrier = initialValues.carrierId || 'other';
      const origin = initialValues.origin || '';
      const destination = initialValues.destination || 'Tel Aviv, Israel';
      const notes = initialValues.notes || '';

      setTitle(title);
      setTrackingNumber(trackingNumber);
      setCarrier(carrier);
      setIsManualCarrier(false);
      setCategory('electronics');
      setOrderDate(new Date().toISOString().slice(0, 10));
      // Default expected date 14 days ahead
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      setExpectedDeliveryDate(nextDate.toISOString().slice(0, 10));
      setOrigin(origin);
      setDestination(destination);
      setNotes(notes);
      setStatus('in_transit');

      // Only Smart Import (regex or AI) prefills carry _autoFillSource —
      // manual "new package" has no initialValues.carrierId either, so this
      // also naturally excludes the plain-manual-entry case.
      autoFillSnapshotRef.current = initialValues.carrierId || initialValues.trackingNumber
        ? {
            source: initialValues._autoFillSource || 'regex',
            confidence: initialValues._autoFillConfidence || null,
            values: { title, trackingNumber, carrier, origin, notes }
          }
        : null;
    } else {
      // Clean form defaults
      setTitle('');
      setTrackingNumber('');
      setCarrier('other');
      setIsManualCarrier(false);
      setCategory('electronics');
      setOrderDate(new Date().toISOString().slice(0, 10));
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      setExpectedDeliveryDate(nextDate.toISOString().slice(0, 10));
      setOrigin('');
      setDestination('Tel Aviv, Israel');
      setNotes('');
      setStatus('in_transit');
      autoFillSnapshotRef.current = null;
    }
  }, [editPackage, initialValues, isOpen]);

  if (!isOpen) return null;

  // Fire-and-forget: compares the current form values against what Smart
  // Import auto-filled, and logs which fields the user changed before
  // saving. Never blocks or fails the actual save.
  const reportAutoFillCorrections = () => {
    const snapshot = autoFillSnapshotRef.current;
    if (!snapshot) return;

    const currentValues = { title, trackingNumber, carrier, origin, notes };
    const editedFields = AUTOFILL_TRACKED_FIELDS.filter((field) => {
      const originalValue = snapshot.values[field];
      if (!originalValue) return false; // parser left it blank — not a correction
      return originalValue.trim() !== String(currentValues[field] || '').trim();
    });

    if (editedFields.length > 0) {
      recordParseCorrection({ source: snapshot.source, confidence: snapshot.confidence, editedFields });
    }
    autoFillSnapshotRef.current = null; // report once per prefill, not on every future save
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !trackingNumber.trim()) return;

    reportAutoFillCorrections();

    const carrierObj = CARRIERS[carrier] || CARRIERS['other'];

    const packageData = {
      id: editPackage ? editPackage.id : `pkg-${Date.now()}`,
      title: title.trim(),
      titleHe: title.trim(),
      trackingNumber: trackingNumber.trim().toUpperCase(),
      carrier: carrier,
      carrierName: carrierObj.name,
      category: category,
      orderDate: orderDate || new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: expectedDeliveryDate || '',
      origin: origin.trim(),
      destination: destination.trim() || 'Israel',
      notes: notes.trim(),
      notesHe: notes.trim(),
      status: status,
      isPinned: editPackage ? editPackage.isPinned : false,
      isArchived: editPackage ? editPackage.isArchived : false,
      checkpoints: editPackage?.checkpoints || [
        {
          id: `cp-${Date.now()}`,
          title: STAGES.find(s => s.id === status)?.label || 'Order Registered',
          titleHe: STAGES.find(s => s.id === status)?.hebrewLabel || 'המשלוח נקלט במערכת',
          location: origin.trim() || 'Origin Logistics Hub',
          description: 'Package registered into Deliveree tracker',
          descriptionHe: 'החבילה נוספה למעקב במערכת',
          timestamp: new Date().toISOString(),
          isCompleted: true
        }
      ],
      createdAt: editPackage ? editPackage.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(packageData);
    onClose();
  };

  const detectedCarrierObj = CARRIERS[carrier] || CARRIERS['other'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">
              {editPackage ? t('modal.editPackage') : t('modal.addNew')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Item Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t('modal.itemTitle')} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('modal.itemTitlePlaceholder')}
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[44px]"
            />
          </div>

          {/* Tracking Number with Auto-detection Indicator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                {t('modal.trackingNum')} *
              </label>
              {carrier !== 'other' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  <Sparkles className="w-3 h-3" />
                  <span>{t('modal.carrierAutoDetected')}: {language === 'he' ? detectedCarrierObj.hebrewName : detectedCarrierObj.name}</span>
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder={t('modal.trackingNumPlaceholder')}
              className="w-full font-mono bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[44px]"
            />
          </div>

          {/* Carrier & Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Carrier Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {t('modal.carrier')}
              </label>
              <select
                value={carrier}
                onChange={(e) => {
                  setCarrier(e.target.value);
                  setIsManualCarrier(true);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
              >
                {CARRIER_LIST.map((c) => (
                  <option key={c.id} value={c.id}>
                    {language === 'he' ? c.hebrewName : c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {t('modal.category')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {language === 'he' ? cat.hebrewLabel : cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {t('modal.orderDate')}
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {t('modal.expectedDelivery')}
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
              />
            </div>
          </div>

          {/* Origin & Destination Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {t('modal.origin')}
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder={t('modal.originPlaceholder')}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {t('modal.destination')}
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={t('modal.destinationPlaceholder')}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Current Status Stage */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t('modal.status')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STAGES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setStatus(s.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center min-h-[40px] cursor-pointer ${
                    status === s.id
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {language === 'he' ? s.hebrewLabel : s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes / Locker / Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t('modal.notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('modal.notesPlaceholder')}
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
            >
              {editPackage ? t('modal.save') : t('modal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
