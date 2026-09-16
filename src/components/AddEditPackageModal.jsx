import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, AlertTriangle, ExternalLink, MapPin, Key, ShoppingBag, Wand2 } from 'lucide-react';
import { CARRIER_LIST, getCarrier } from '../types/carriers.js';
import { CATEGORIES, SELECTABLE_STATUSES, getStatusMeta } from '../types/stages.js';
import { toLocalISODate } from '../utils/dateUtils';
import { findPackageByAnyTrackingNumber } from '../services/deliveryService.js';
import { detectCarrier } from '../utils/carrierDetector.js';
import { parseSmartText } from '../utils/smartParser.js';
import { useLanguage } from '../context/LanguageContext';
import { ModalHeader } from './ui/Primitives';
import { useAuth } from '../context/AuthContext';
import { recordParseCorrection } from '../services/parseCorrectionService';
import { recordSmartImportAttempt } from '../services/smartImportAttemptService';
import { recordTrainingExample } from '../services/trainingDataService';
import { Modal } from './Modal';
import { CollapsibleSection } from './CollapsibleSection';

// Smart Import fields worth watching for a post-autofill edit. Excludes
// `destination`, which is always a static guess ("Israel") rather than
// something the parser extracted — editing it says nothing about parse
// quality. Matches the allowlist enforced in firestore.rules for
// parseCorrections.
//
// `status` was missing until a real SMS came back marked in_transit when it
// said נמסרה. The parser extracts a delivery stage and the form lets the user
// change it, so correcting it is a parse correction like any other — it just
// produced no signal anywhere, in either the correction counts or the training
// examples. There is deliberately no `store`: the form has no store field, so
// a wrong merchant is corrected as a `title` edit, which is already here.
const AUTOFILL_TRACKED_FIELDS = ['title', 'trackingNumber', 'carrier', 'origin', 'notes', 'status'];

export function AddEditPackageModal({
  isOpen,
  onClose,
  onSave,
  editPackage = null,
  initialValues = null,
  packages = [],
  onOpenExisting = null
}) {
  const { t, language } = useLanguage();
  const { user } = useAuth();

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
  const [pickupCode, setPickupCode] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupHours, setPickupHours] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [shelfNumber, setShelfNumber] = useState('');
  const [isRedirected, setIsRedirected] = useState(false);
  const [originalPickupLocation, setOriginalPickupLocation] = useState('');
  const [redirectReason, setRedirectReason] = useState('');
  const [pickupDeadline, setPickupDeadline] = useState('');
  const [returnDeadline, setReturnDeadline] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Snapshot of what Smart Import auto-filled, so a save can detect which
  // fields the user corrected before submitting — the implicit half of the
  // mis-parse detection signal. Null outside a fresh Smart Import prefill
  // (editing an existing package is not a "correction" of anything).
  const autoFillSnapshotRef = useRef(null);

  // A drawer that holds something opens itself, and never shuts on its own.
  //
  // Hiding data the user cannot see is worse than a long form. This is read
  // from the live field values rather than from `editPackage`, because the
  // fields arrive by three routes: editing a package, a Smart Import prefill
  // passed as initialValues, and the 1-tap auto-fill that lands *after* mount.
  // Only the first of those is known when the modal opens.
  //
  // Order date and expected delivery are deliberately not counted: the form
  // fills them in for you (today, and today + 14), so treating them as
  // content would open this drawer on every blank add — which is the one
  // thing it exists to avoid.
  const hasOrderDetails = Boolean(
    (category && category !== 'electronics') || origin || notes
    // 'Tel Aviv, Israel' is this form's own placeholder guess for destination,
    // not something the user or the parser supplied (see the note at the top
    // of this file), so it does not count as content either.
    || (destination && destination !== 'Tel Aviv, Israel' && destination !== 'Israel')
  );
  const hasPickupDetails = Boolean(
    pickupCode || shelfNumber || pickupDeadline || pickupLocation || originalPickupLocation
  );
  const hasReturnDetails = Boolean(returnDeadline || returnNotes);

  // Check for duplicate tracking number against existing package list
  const duplicatePackage = React.useMemo(() => {
    if (!trackingNumber || !trackingNumber.trim()) return null;
    // Alias-aware, to match what the save path in App.jsx will actually do —
    // otherwise Smart Import can hand over a package whose alias matches an
    // existing one, show no duplicate warning, and then merge on save.
    return findPackageByAnyTrackingNumber(
      packages,
      [trackingNumber, ...(Array.isArray(initialValues?.aliases) ? initialValues.aliases : [])],
      editPackage?.id || null
    );
  }, [packages, trackingNumber, initialValues?.aliases, editPackage?.id]);

  // Live courier & SMS intelligence extraction from typed or pasted tracking field
  const liveIntelligence = React.useMemo(() => {
    if (!trackingNumber || trackingNumber.trim().length < 3) return null;
    const parsed = parseSmartText(trackingNumber);
    const hasDetectedDetails = Boolean(
      (parsed.trackingNumber && parsed.trackingNumber !== trackingNumber.trim().toUpperCase()) ||
      (parsed.carrier && parsed.carrier !== 'other') ||
      parsed.store ||
      parsed.pickupLocation ||
      parsed.lockerPin
    );
    return hasDetectedDetails ? parsed : null;
  }, [trackingNumber]);

  // Auto-detect carrier on tracking number typing
  useEffect(() => {
    if (!isManualCarrier && trackingNumber) {
      const detection = detectCarrier(trackingNumber);
      if (detection.confidence !== 'none') {
        setCarrier(detection.carrierId);
      } else if (liveIntelligence?.carrier && liveIntelligence.carrier !== 'other') {
        setCarrier(liveIntelligence.carrier);
      }
    }
  }, [trackingNumber, isManualCarrier, liveIntelligence]);

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
      setPickupCode(editPackage.pickupCode || '');
      setShelfNumber(editPackage.shelfNumber || '');
      setPickupLocation(editPackage.pickupLocation || '');
      setPickupHours(editPackage.pickupHours || '');
      setPickupPhone(editPackage.pickupPhone || '');
      setIsRedirected(Boolean(editPackage.isRedirected));
      setOriginalPickupLocation(editPackage.originalPickupLocation || '');
      setRedirectReason(editPackage.redirectReason || '');
      setPickupDeadline(editPackage.pickupDeadline || '');
      setReturnDeadline(editPackage.returnDeadline || '');
      setReturnNotes(editPackage.returnNotes || '');
      autoFillSnapshotRef.current = null;
    } else if (initialValues) {
      const title = initialValues.title || '';
      const trackingNumber = initialValues.trackingNumber || '';
      const carrier = initialValues.carrierId || 'other';
      const origin = initialValues.origin || '';
      const destination = initialValues.destination || 'Tel Aviv, Israel';
      const notes = initialValues.notes || '';
      const status = initialValues.status || 'in_transit';
      const category = initialValues.category || 'electronics';
      const pickupLocation = initialValues.pickupLocation || '';
      const pickupCode = initialValues.pickupCode || initialValues.lockerPin || '';
      const shelfNumberVal = initialValues.shelfNumber || '';
      const pickupHours = initialValues.pickupHours || '';
      const pickupPhone = initialValues.pickupPhone || '';
      const isRedirected = initialValues.isRedirected || false;
      const originalPickupLocation = initialValues.originalPickupLocation || '';
      const redirectReason = initialValues.redirectReason || '';

      setTitle(title);
      setTrackingNumber(trackingNumber);
      setCarrier(carrier);
      setIsManualCarrier(false);
      setCategory(category);
      const todayISO = toLocalISODate();
      setOrderDate(initialValues.orderDate || todayISO);

      if (initialValues.expectedDeliveryDate) {
        setExpectedDeliveryDate(initialValues.expectedDeliveryDate);
      } else if (status === 'delivered') {
        setExpectedDeliveryDate(todayISO);
      } else {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 14);
        setExpectedDeliveryDate(toLocalISODate(nextDate));
      }
      setOrigin(origin);
      setDestination(destination);
      setNotes(notes);
      setStatus(status);
      setPickupCode(pickupCode);
      setShelfNumber(shelfNumberVal);
      setPickupLocation(pickupLocation);
      setPickupHours(pickupHours);
      setPickupPhone(pickupPhone);
      setIsRedirected(isRedirected);
      setOriginalPickupLocation(originalPickupLocation);
      setRedirectReason(redirectReason);

      // Only Smart Import (regex or AI) prefills carry _autoFillSource —
      // manual "new package" has no initialValues.carrierId either, so this
      // also naturally excludes the plain-manual-entry case.
      autoFillSnapshotRef.current = initialValues.carrierId || initialValues.trackingNumber
        ? {
            source: initialValues._autoFillSource || 'regex',
            confidence: initialValues._autoFillConfidence || null,
            inputText: initialValues._autoFillInputText || '',
            // `status` belongs here for the same reason it is in
            // AUTOFILL_TRACKED_FIELDS: without a snapshot value, the edited-field
            // check below short-circuits on `if (!originalValue)` and a
            // corrected stage can never be detected.
            values: { title, trackingNumber, carrier, origin, notes, status }
          }
        : null;
    } else {
      // Clean form defaults
      setTitle('');
      setTrackingNumber('');
      setCarrier('other');
      setIsManualCarrier(false);
      setCategory('electronics');
      setOrderDate(toLocalISODate());
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      setExpectedDeliveryDate(toLocalISODate(nextDate));
      setOrigin('');
      setDestination('Tel Aviv, Israel');
      setNotes('');
      setStatus('in_transit');
      setPickupCode('');
      setShelfNumber('');
      setPickupLocation('');
      setPickupHours('');
      setPickupPhone('');
      setIsRedirected(false);
      setOriginalPickupLocation('');
      setRedirectReason('');
      setPickupDeadline('');
      setReturnDeadline('');
      setReturnNotes('');
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

    const currentValues = { title, trackingNumber, carrier, origin, notes, status };
    const editedFields = AUTOFILL_TRACKED_FIELDS.filter((field) => {
      const originalValue = snapshot.values[field];
      if (!originalValue) return false; // parser left it blank — not a correction
      return originalValue.trim() !== String(currentValues[field] || '').trim();
    });

    // Always recorded, corrected or not — parseCorrections only ever logs a
    // correction, so on its own there's no denominator to compute a miss
    // rate against. This is that denominator: one row per Smart-Import-filled
    // save, carrying the parser's own carrier guess (not the user's possibly-
    // corrected one) so miss rate can be broken down per carrier.
    recordSmartImportAttempt({
      source: snapshot.source,
      confidence: snapshot.confidence,
      carrier: snapshot.values.carrier,
      corrected: editedFields.length > 0
    });

    if (editedFields.length > 0) {
      recordParseCorrection({ source: snapshot.source, confidence: snapshot.confidence, editedFields });

      // Real values, not just field names — only ever sent when the user
      // has explicitly opted in (AccountModal / LegalConsentGate). Rules
      // re-check the same flag server-side; this client check just avoids
      // a doomed write attempt for everyone else.
      if (user?.aiTrainingOptIn) {
        recordTrainingExample({
          userId: user.id,
          source: snapshot.source,
          confidence: snapshot.confidence,
          inputText: snapshot.inputText,
          initialValues: snapshot.values,
          correctedValues: currentValues
        });
      }
    }
    autoFillSnapshotRef.current = null; // report once per prefill, not on every future save
  };

  const handleApplySmartDetection = () => {
    if (!liveIntelligence) return;

    if (liveIntelligence.trackingNumber) {
      setTrackingNumber(liveIntelligence.trackingNumber);
    }
    if (liveIntelligence.carrier && liveIntelligence.carrier !== 'other') {
      setCarrier(liveIntelligence.carrier);
      setIsManualCarrier(false);
    }
    if (liveIntelligence.store && (!title || title.trim() === '')) {
      setTitle(language === 'he' && liveIntelligence.titleHe ? liveIntelligence.titleHe : liveIntelligence.title);
    }
    if (liveIntelligence.category && liveIntelligence.category !== 'other' && category === 'electronics') {
      setCategory(liveIntelligence.category);
    }
    if (liveIntelligence.pickupLocation && (!destination || destination === 'Tel Aviv, Israel' || destination === 'Israel')) {
      setDestination(liveIntelligence.pickupLocation);
    }
    if (liveIntelligence.pickupLocation || liveIntelligence.lockerPin) {
      const parts = [];
      if (liveIntelligence.pickupLocation) {
        parts.push(`${t('modal.detectedPickup')}: ${liveIntelligence.pickupLocation}`);
      }
      if (liveIntelligence.lockerPin) {
        parts.push(`${t('modal.detectedPin')}: ${liveIntelligence.lockerPin}`);
      }
      const snippet = parts.join(' | ');
      if (snippet && !notes.includes(liveIntelligence.lockerPin || liveIntelligence.pickupLocation)) {
        setNotes(notes ? `${notes}\n${snippet}` : snippet);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !trackingNumber.trim()) return;

    reportAutoFillCorrections();

    const carrierObj = getCarrier(carrier);

    const packageData = {
      id: editPackage ? editPackage.id : `pkg-${Date.now()}`,
      title: title.trim(),
      titleHe: title.trim(),
      trackingNumber: trackingNumber.trim().toUpperCase(),
      carrier: carrier,
      carrierName: carrierObj.name,
      category: category,
      orderDate: orderDate || toLocalISODate(),
      expectedDeliveryDate: expectedDeliveryDate || '',
      origin: origin.trim(),
      destination: destination.trim() || 'Israel',
      notes: notes.trim(),
      notesHe: notes.trim(),
      status: status,
      pickupCode: pickupCode.trim(),
      shelfNumber: shelfNumber.trim() || undefined,
      pickupLocation: pickupLocation.trim(),
      pickupHours: pickupHours.trim(),
      pickupPhone: pickupPhone.trim(),
      isRedirected: Boolean(isRedirected),
      originalPickupLocation: originalPickupLocation.trim(),
      redirectReason: redirectReason.trim(),
      pickupDeadline: pickupDeadline.trim(),
      returnDeadline: returnDeadline.trim(),
      returnNotes: returnNotes.trim(),
      localTrackingNumber: editPackage?.localTrackingNumber || initialValues?.localTrackingNumber || undefined,
      localCarrier: editPackage?.localCarrier || initialValues?.localCarrier || undefined,
      aliases: editPackage?.aliases || initialValues?.aliases || undefined,
      customsDetails: editPackage?.customsDetails || initialValues?.customsDetails || undefined,
      isPinned: editPackage ? editPackage.isPinned : false,
      isArchived: editPackage ? editPackage.isArchived : false,
      checkpoints: editPackage?.checkpoints || [
        {
          id: `cp-${Date.now()}`,
          title: getStatusMeta(status)?.label || 'Order Registered',
          titleHe: getStatusMeta(status)?.hebrewLabel || 'המשלוח נקלט במערכת',
          location: origin.trim() || 'Origin Logistics Hub',
          description: 'Package registered into SpotLi tracker',
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

  const detectedCarrierObj = getCarrier(carrier);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="AddEditPackageModal"
      labelledBy="add-edit-package-title"
      className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
    >
      {/* Header */}
      <ModalHeader
        titleId="add-edit-package-title"
        title={editPackage ? t('modal.editPackage') : t('modal.addNew')}
        onClose={onClose}
        closeLabel={language === 'he' ? 'חזרה' : 'Back'}
      />

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[75vh] lg:max-h-[70vh]">
        {/* Always visible: the two required fields, plus the two
            answers a person adding a package by hand always has. */}
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
            className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-ui min-h-[48px]"
          />
        </div>

        {/* Tracking Number with Auto-detection Indicator & Live Badges */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              {t('modal.trackingNum')} *
            </label>
            {carrier !== 'other' && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
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
            className={`w-full font-mono bg-slate-950 border ${
              duplicatePackage ? 'border-amber-500/50 focus:border-amber-500 focus:ring-amber-500' : 'border-slate-800 focus:border-blue-500 focus:ring-blue-500'
            } text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 transition-ui min-h-[48px]`}
          />

          {/* Live Ingestion Badges & 1-Tap Quick Action */}
          {liveIntelligence && (
            <div className="mt-2.5 p-2.5 bg-slate-950/80 border border-blue-500/25 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
              <div className="flex flex-wrap items-center gap-1.5">
                {liveIntelligence.store && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 font-medium">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{language === 'he' && liveIntelligence.storeHe ? liveIntelligence.storeHe : liveIntelligence.store}</span>
                  </span>
                )}
                {liveIntelligence.pickupLocation && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{liveIntelligence.pickupLocation}</span>
                  </span>
                )}
                {liveIntelligence.lockerPin && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 dark:border-amber-500/25 font-mono font-medium">
                    <Key className="w-3.5 h-3.5" />
                    <span>{t('modal.detectedPin')}: <bdi dir="ltr">{liveIntelligence.lockerPin}</bdi></span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleApplySmartDetection}
                className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 border border-blue-500/30 rounded-xl font-semibold transition-ui flex items-center gap-1.5 min-h-[48px] cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{t('modal.applyAllAction')}</span>
              </button>
            </div>
          )}

          {duplicatePackage && (
            <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-400 animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {t('modal.duplicateTrackingWarning')}
                  {duplicatePackage.title ? <bdi dir="auto"> ("{duplicatePackage.title}")</bdi> : ''}
                </span>
              </div>
              {onOpenExisting && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenExisting(duplicatePackage);
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 rounded-lg font-medium transition-colors shrink-0 flex items-center gap-1 min-h-[48px] cursor-pointer"
                >
                  <span>{t('modal.openExistingPackage')}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Carrier */}
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
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[48px]"
            >
              <optgroup label={language === 'he' ? 'חברות משלוחים בישראל' : 'Domestic Israeli Couriers'}>
                {CARRIER_LIST.filter((c) => c.country === 'Israel').map((c) => (
                  <option key={c.id} value={c.id}>
                    {language === 'he' ? c.hebrewName : c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={language === 'he' ? 'משלוחים בינלאומיים' : 'International Couriers'}>
                {CARRIER_LIST.filter((c) => c.country !== 'Israel' && c.id !== 'other').map((c) => (
                  <option key={c.id} value={c.id}>
                    {language === 'he' ? c.hebrewName : `${c.name} (${c.country})`}
                  </option>
                ))}
              </optgroup>
              <optgroup label={language === 'he' ? 'אחר' : 'Other'}>
                {CARRIER_LIST.filter((c) => c.id === 'other').map((c) => (
                  <option key={c.id} value={c.id}>
                    {language === 'he' ? c.hebrewName : c.name}
                  </option>
                ))}
              </optgroup>
            </select>
        </div>

        {/* Current Status Stage */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            {t('modal.status')}
          </label>
          <div
            role="radiogroup"
            aria-label={t('modal.status')}
            className="grid grid-cols-2 sm:grid-cols-3 gap-2"
          >
            {SELECTABLE_STATUSES.map((s) => (
              <button
                type="button"
                role="radio"
                aria-checked={status === s.id}
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-ui text-center min-h-[48px] cursor-pointer ${
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


        {/* Everything below is optional, and folded away by default.
            A section opens itself when it already holds something, so
            an edited package or a Smart Import guess is never hidden. */}
        <CollapsibleSection
          title={language === 'he' ? 'פרטי הזמנה' : 'Order details'}
          defaultOpen={hasOrderDetails}
        >
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t('modal.category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[48px]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {language === 'he' ? cat.hebrewLabel : cat.label}
                </option>
              ))}
            </select>
          </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t('modal.orderDate')}
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[48px]"
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
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer min-h-[48px]"
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
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[48px]"
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
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 min-h-[48px]"
            />
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
            className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-ui resize-none min-h-[48px]"
          />
        </div>

        {/* Pickup Details */}
        </CollapsibleSection>

        <CollapsibleSection
          title={language === 'he' ? 'פרטי איסוף ולוקר' : 'Pickup & locker details'}
          defaultOpen={hasPickupDetails}
        >
          <div className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {language === 'he' ? 'קוד איסוף' : 'Pickup Code'}
              </label>
              <input
                type="text"
                value={pickupCode}
                onChange={(e) => setPickupCode(e.target.value)}
                placeholder={language === 'he' ? 'למשל: 12345' : 'e.g. 12345'}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {language === 'he' ? 'מספר מדף / תא' : 'Shelf / Bin #'}
              </label>
              <input
                type="text"
                value={shelfNumber}
                onChange={(e) => setShelfNumber(e.target.value)}
                placeholder={language === 'he' ? 'למשל: ג693 או 12' : 'e.g. B-12 or 412'}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {language === 'he' ? 'תאריך אחרון לאיסוף' : 'Last Day to Pickup'}
              </label>
              <input
                type="date"
                value={pickupDeadline}
                onChange={(e) => setPickupDeadline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {language === 'he' ? 'נקודת איסוף (כתובת)' : 'Pickup Location (Address)'}
            </label>
            <input
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder={language === 'he' ? 'רחוב הרצל 1, תל אביב' : '1 Herzl St, Tel Aviv'}
              className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]"
            />
          </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title={language === 'he' ? 'חלון החזרה לחנות' : 'Store return window'}
          defaultOpen={hasReturnDetails}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-end">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 14);
                  setReturnDeadline(toLocalISODate(d));
                }}
                className="px-3 min-h-[48px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 text-xs font-semibold transition-colors"
              >
                +14 {language === 'he' ? 'ימים' : 'days'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 30);
                  setReturnDeadline(toLocalISODate(d));
                }}
                className="px-3 min-h-[48px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 text-xs font-semibold transition-colors"
              >
                +30 {language === 'he' ? 'ימים' : 'days'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {language === 'he' ? 'תאריך אחרון להחזרה' : 'Return Deadline Date'}
              </label>
              <input
                type="date"
                value={returnDeadline}
                onChange={(e) => setReturnDeadline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {language === 'he' ? 'הערות החזרה / מספר שטר' : 'Return Notes / Waybill #'}
              </label>
              <input
                type="text"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder={language === 'he' ? 'למשל: דרוש שובר החזרה מסניף דואר' : 'e.g. Return label generated'}
                className="w-full bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]"
              />
            </div>
          </div>
          </div>
        </CollapsibleSection>
        </div>

        {/* Pinned. The form is far taller than the window, and this row used to
            sit at the very bottom of that scroll: on a phone you travelled the
            whole thing to reach "Add to Tracking". */}
        <div className="shrink-0 flex items-center justify-end gap-3 p-4 sm:px-6 border-t border-slate-800 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 text-xs font-semibold transition-colors min-h-[48px] cursor-pointer"
          >
            {t('modal.cancel')}
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-ui shadow-md shadow-blue-500/20 min-h-[48px] cursor-pointer"
          >
            {editPackage ? t('modal.save') : t('modal.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
