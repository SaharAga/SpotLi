import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Sparkles, CheckCircle2, Copy, RefreshCw, Plus, Trash2, ArrowLeft, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard } from '../utils/clipboard';
import {
  buildIngestionEmailAddress,
  fetchIngestionToken,
  getConnectedServices,
  getGmailConnectionStatus,
  removeConnectedAccount,
  disconnectService,
  connectGmail,
  requestOutlookForwardingSetup
} from '../services/emailSyncService';
import { DEFAULT_FORWARDING_FILTER_QUERY } from '../constants/emailFilters';
import { Modal } from './Modal';

export function IngestionGuideModal({
  isOpen,
  onClose,
  onOpenSmartImport,
  onOpenAuth,
  onShowToast
}) {
  const { language } = useLanguage();
  const { user, loginWithGoogle } = useAuth();
  
  const [copiedEmail, setCopiedEmail] = useState(false);
  const copyEmailTimerRef = useRef(null);
  const [ingestionToken, setIngestionToken] = useState(null);
  const [isRotatingAddress, setIsRotatingAddress] = useState(false);
  const [copiedFilter, setCopiedFilter] = useState(false);
  const copyFilterTimerRef = useRef(null);
  const [showQR, setShowQR] = useState(false);
  const [showForwarding, setShowForwarding] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState('gmail'); // 'gmail' | 'outlook' | 'icloud' | 'yahoo'
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isConnectingOutlook, setIsConnectingOutlook] = useState(false);
  const [connectedServices, setConnectedServicesState] = useState(() => getConnectedServices(user));
  const [gmailRenewalError, setGmailRenewalError] = useState(null);
  // True while we're waiting on the server-verified gmailConnectionStatus
  // call (or waiting for Firebase Auth to rehydrate `user` after the full-page
  // OAuth redirect back into the app) — so the button can show a neutral
  // "Checking..." state instead of flashing "Connect Gmail" before we
  // actually know the answer.
  const [isCheckingGmailStatus, setIsCheckingGmailStatus] = useState(false);
  const userUid = user?.uid || user?.id;

  // The client can't read gmailConnections/{uid} directly (Firestore rules
  // deny it — the doc holds a refresh token), so localStorage alone can't
  // tell us whether Gmail is actually connected. This merges the real
  // server-verified Gmail status into the Outlook-accurate localStorage
  // state getConnectedServices() returns.
  const refreshConnectedServices = async () => {
    const local = getConnectedServices(user);
    const nonGmailAccounts = (local.accounts || []).filter((a) => a.service !== 'gmail');

    if (!userUid) {
      setConnectedServicesState({ ...local, gmail: false, accounts: nonGmailAccounts });
      setGmailRenewalError(null);
      return;
    }

    setIsCheckingGmailStatus(true);
    try {
      const gmailStatus = await getGmailConnectionStatus();
      let gmailAccounts = [];
      if (gmailStatus.connected) {
        if (Array.isArray(gmailStatus.accounts) && gmailStatus.accounts.length > 0) {
          gmailAccounts = gmailStatus.accounts.map((acc) => ({
            email: acc.email || acc.emailAddress || user?.email || 'Gmail Account',
            service: 'gmail',
            status: acc.status || 'active',
            connectedAt: acc.connectedAt
          }));
        } else {
          gmailAccounts = [
            {
              email: gmailStatus.emailAddress || user?.email || 'Gmail Account',
              service: 'gmail',
              status: 'active',
              connectedAt: gmailStatus.connectedAt
            }
          ];
        }
      }
      const accounts = [...nonGmailAccounts, ...gmailAccounts];
      setConnectedServicesState({ ...local, gmail: Boolean(gmailStatus.connected), accounts });
      setGmailRenewalError(gmailStatus.connected ? gmailStatus.lastRenewalError || null : null);
    } finally {
      setIsCheckingGmailStatus(false);
    }
  };

  // The forwarding address carries a server-issued token, never the uid.
  useEffect(() => {
    if (!isOpen || !userUid) {
      setIngestionToken(null);
      return undefined;
    }
    let cancelled = false;
    fetchIngestionToken()
      .then((token) => { if (!cancelled) setIngestionToken(token); })
      .catch((err) => console.warn('[IngestionGuideModal] Failed to load ingestion address:', err));
    return () => { cancelled = true; };
  }, [isOpen, userUid]);

  // Sync state whenever user ID changes or modal opens
  useEffect(() => {
    if (isOpen) {
      refreshConnectedServices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUid, isOpen]);

  // The ?gmail=connected|error redirect-back from the Gmail OAuth flow lands
  // on a freshly-loaded app, and Firebase Auth's rehydration of `user` can
  // lag behind this modal's first render (App.jsx opens it immediately after
  // handling the redirect param). If the modal opens before `userUid` is
  // available, the effect above runs once with no uid and never re-checks
  // once auth catches up. This retries shortly after open so we don't get
  // stuck showing "Connect Gmail" for an account that's actually connected.
  useEffect(() => {
    if (!isOpen || userUid) return undefined;
    const timer = setTimeout(() => {
      if (isOpen) refreshConnectedServices();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userUid]);

  useEffect(() => {
    return () => {
      if (copyEmailTimerRef.current) clearTimeout(copyEmailTimerRef.current);
      if (copyFilterTimerRef.current) clearTimeout(copyFilterTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://spotliapp.com';
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appOrigin)}`;
  const ingestionEmail = buildIngestionEmailAddress(ingestionToken);

  const handleRotateAddress = async () => {
    setIsRotatingAddress(true);
    try {
      const token = await fetchIngestionToken({ rotate: true });
      setIngestionToken(token);
      if (onShowToast) onShowToast(
        language === 'he'
          ? 'נוצרה כתובת חדשה. הכתובת הקודמת בוטלה — עדכנו את כללי ההעברה.'
          : 'New address created. The old one no longer works — update your forwarding rules.',
        'success'
      );
    } catch {
      if (onShowToast) onShowToast(language === 'he' ? 'יצירת כתובת חדשה נכשלה' : 'Failed to create a new address', 'error');
    } finally {
      setIsRotatingAddress(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!ingestionEmail) return;
    const success = await copyToClipboard(ingestionEmail);
    if (success) {
      setCopiedEmail(true);
      if (onShowToast) onShowToast(language === 'he' ? 'כתובת האימייל הועתקה ללוח' : 'Email copied to clipboard', 'success');
      if (copyEmailTimerRef.current) clearTimeout(copyEmailTimerRef.current);
      copyEmailTimerRef.current = setTimeout(() => setCopiedEmail(false), 2500);
    } else if (onShowToast) {
      onShowToast(language === 'he' ? 'ההעתקה ללוח נכשלה' : 'Failed to copy to clipboard', 'error');
    }
  };

  const handleCopyFilter = async () => {
    const success = await copyToClipboard(DEFAULT_FORWARDING_FILTER_QUERY);
    if (success) {
      setCopiedFilter(true);
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'שאילתת המסנן הועתקה ללוח' : 'Filter query copied to clipboard',
          'success'
        );
      }
      if (copyFilterTimerRef.current) clearTimeout(copyFilterTimerRef.current);
      copyFilterTimerRef.current = setTimeout(() => setCopiedFilter(false), 2500);
    } else if (onShowToast) {
      onShowToast(language === 'he' ? 'ההעתקה ללוח נכשלה' : 'Failed to copy to clipboard', 'error');
    }
  };

  const handleConnectGmail = async () => {
    // Bound how many Gmail accounts one user can connect to prevent abuse
    // and protect Spark/Blaze quotas.
    const currentGmailCount = (connectedServices.accounts || []).filter(
      (a) => a.service === 'gmail'
    ).length;
    if (currentGmailCount >= 5) {
      if (onShowToast) {
        onShowToast(
          language === 'he'
            ? 'הגעת למגבלת החשבונות המרבית (5 תיבות Gmail מחוברות).'
            : 'Maximum Gmail account limit reached (5 connected inboxes).',
          'info'
        );
      }
      return;
    }

    setIsConnectingGmail(true);
    try {
      let currentUser = user;
      if (!currentUser) {
        if (loginWithGoogle) {
          const signedIn = await loginWithGoogle();
          if (!signedIn) {
            setIsConnectingGmail(false);
            return;
          }
          currentUser = signedIn;
        } else {
          if (onShowToast) onShowToast(
            language === 'he' ? 'נא להתחבר לחשבון כדי להפעיל סנכרון אוטומטי' : 'Please sign in to enable auto-sync',
            'info'
          );
          setIsConnectingGmail(false);
          return;
        }
      }

      // connectGmail navigates the whole page away to Google's consent
      // screen on success — there's no in-place pending/polling state to
      // manage here anymore. The outcome is picked up on mount via the
      // `?gmail=connected|error` redirect-back query param (see effect
      // above), after the app re-loads.
      const res = await connectGmail();
      if (!res.ok && onShowToast) {
        onShowToast(
          language === 'he' ? `החיבור ל-Gmail נכשל: ${res.error}` : `Gmail connection failed: ${res.error}`,
          'error'
        );
      }
    } catch {
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'החיבור ל-Gmail נכשל, נסה את המדריך הידני' : 'Gmail connection failed, try manual setup',
          'error'
        );
      }
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleConnectOutlook = async () => {
    setIsConnectingOutlook(true);
    try {
      let currentUser = user;
      if (!currentUser) {
        if (onShowToast) onShowToast(
          language === 'he' ? 'נא להתחבר לחשבון כדי להפעיל סנכרון אוטומטי' : 'Please sign in to enable auto-sync',
          'info'
        );
        setIsConnectingOutlook(false);
        return;
      }

      const activeIngestionEmail = ingestionEmail || buildIngestionEmailAddress(await fetchIngestionToken());
      if (!activeIngestionEmail) throw new Error(language === 'he' ? 'כתובת ההעברה אינה זמינה' : 'Forwarding address unavailable');
      const res = await requestOutlookForwardingSetup(activeIngestionEmail);
      setConnectedServicesState(getConnectedServices(currentUser));

      if (res.alreadyConnected) {
        if (onShowToast) {
          onShowToast(
            language === 'he' ? `החשבון ${res.email} כבר מחובר לסנכרון` : `Account ${res.email} is already connected`,
            'info'
          );
        }
      } else if (res.ok) {
        if (onShowToast) {
          onShowToast(
            language === 'he' 
              ? `החשבון ${res.email} חובר בהצלחה! אישורי הזמנות יועברו אוטומטית 🎉` 
              : `Account ${res.email} connected! Orders will sync automatically 🎉`,
            'success'
          );
        }
      } else {
        if (onShowToast) {
          onShowToast(
            language === 'he' ? `החיבור ל-Outlook נכשל: ${res.error}` : `Outlook connection failed: ${res.error}`,
            'error'
          );
        }
      }
    } catch {
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'החיבור ל-Outlook נכשל, נסה את המדריך הידני' : 'Outlook connection failed, try manual setup',
          'error'
        );
      }
    } finally {
      setIsConnectingOutlook(false);
    }
  };

  const handleDisconnectAccount = async (accountEmail) => {
    await removeConnectedAccount(accountEmail);
    await refreshConnectedServices();
    if (onShowToast) {
      onShowToast(
        language === 'he'
          ? `החשבון ${accountEmail} נותק והכללים הוסרו בהצלחה`
          : `Account ${accountEmail} unlinked and rules removed`,
        'info'
      );
    }
  };

  const handleDisconnectService = async (service) => {
    await disconnectService(service);
    await refreshConnectedServices();
    if (onShowToast) {
      onShowToast(
        language === 'he' ? `סנכרון ${service} נותק בהצלחה` : `${service} sync disconnected`,
        'info'
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="ingestion-guide-title"
      componentName="IngestionGuideModal"
      overlayClassName="p-3 sm:p-4"
      className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
    >
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 shrink-0">
        <div className="flex flex-1 min-w-0 items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 id="ingestion-guide-title" className="text-base sm:text-lg font-bold text-slate-100">
              {language === 'he' ? 'קליטת משלוחים אוטומטית' : 'Automatic Shipment Ingestion'}
            </h2>
            <p className="text-xs text-slate-400">
              {language === 'he' ? 'חיבור אימייל אוטומטי, העברת הודעות והדבקה חכמה' : 'Automated Email Connect, Forwarding & Smart Paste'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="order-first me-3 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
          aria-label={language === 'he' ? 'חזרה' : 'Back'}
        >
          <ArrowLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
        
        {/* Method 1: Automated Ingestion (Gmail & Outlook) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 dark:from-indigo-950/40 via-slate-950 to-blue-500/10 dark:to-blue-950/40 border border-indigo-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs tracking-wide uppercase border border-indigo-500/30">
                  {language === 'he' ? 'מומלץ' : 'Recommended'}
                </span>
                <h3 className="text-sm font-bold text-slate-100">
                  {language === 'he' ? 'חיבור תיבת דוא״ל אוטומטי' : 'Automated Email Sync'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'he'
                  ? 'חיבור מאובטח לקבלת אישורי משלוחים ישירות לחשבונך'
                  : 'Secure sync to receive shipping updates directly to your account'}
              </p>
            </div>

            {/* Service Connect Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={isConnectingGmail || isCheckingGmailStatus}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-ui shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer min-h-[48px]"
              >
                {isConnectingGmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'he' ? 'מתחבר...' : 'Connecting...'}</span>
                  </>
                ) : isCheckingGmailStatus ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'he' ? 'בודק סטטוס...' : 'Checking status...'}</span>
                  </>
                ) : connectedServices.gmail ? (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'he' ? '+ Gmail נוסף' : '+ Add Gmail'}</span>
                  </>
                ) : (
                  <span>{language === 'he' ? 'חבר Gmail' : 'Connect Gmail'}</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleConnectOutlook}
                disabled={isConnectingOutlook}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-ui shadow-md shadow-sky-600/20 disabled:opacity-50 cursor-pointer min-h-[48px]"
              >
                {isConnectingOutlook ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'he' ? 'מתחבר...' : 'Connecting...'}</span>
                  </>
                ) : connectedServices.outlook ? (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'he' ? '+ Outlook נוסף' : '+ Add Outlook'}</span>
                  </>
                ) : (
                  <span>{language === 'he' ? 'חבר Outlook' : 'Connect Outlook'}</span>
                )}
              </button>
            </div>
          </div>

          {/* Connected Accounts & Inboxes List */}
          {((connectedServices.accounts && connectedServices.accounts.length > 0) ||
            connectedServices.gmail ||
            connectedServices.outlook) && (
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {language === 'he' ? 'תיבות מחוברות להעברה אוטומטית:' : 'Active Connected Inboxes:'}
                </span>
                {(connectedServices.gmail || connectedServices.outlook) && (
                  <button
                    onClick={() => {
                      if (connectedServices.gmail) handleDisconnectService('gmail');
                      if (connectedServices.outlook) handleDisconnectService('outlook');
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer p-1"
                  >
                    {language === 'he' ? 'נתק הכל' : 'Disconnect All'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {connectedServices.accounts && connectedServices.accounts.length > 0 ? (
                  connectedServices.accounts.map((acc) => (
                    <div
                      key={acc.email}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase ${
                          acc.service === 'outlook' ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30' : 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {acc.service || 'Gmail'}
                        </span>
                        <span className="truncate font-medium text-xs" title={acc.email}>
                          {acc.email}
                        </span>
                        {acc.status === 'pending' ? (
                          <span className="px-1.5 py-0.2 rounded text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse shrink-0">
                            {language === 'he' ? 'בהמתנה לאימות' : 'Setting up...'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                            {language === 'he' ? 'פעיל' : 'Active'}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDisconnectAccount(acc.email)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer text-xs font-semibold shrink-0 ml-1 min-h-[40px]"
                        title={language === 'he' ? 'נתק חשבון' : 'Unlink account'}
                        aria-label={`Unlink ${acc.email}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{language === 'he' ? 'נתק' : 'Unlink'}</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 text-xs col-span-full">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-medium">
                        {connectedServices.gmail ? (user?.email || 'Gmail Auto-Sync') : 'Outlook Auto-Sync'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDisconnectService(connectedServices.gmail ? 'gmail' : 'outlook')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer text-xs font-semibold min-h-[40px]"
                      aria-label="Unlink service"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'he' ? 'נתק' : 'Unlink'}</span>
                    </button>
                  </div>
                )}
              </div>

              {gmailRenewalError && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">
                  <RefreshCw className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {language === 'he'
                      ? 'החידוש האוטומטי של Gmail נכשל לאחרונה — ייתכן שקבלת אימיילים חדשים הופסקה. נתקו וחברו מחדש את Gmail.'
                      : 'Gmail auto-sync renewal recently failed — new emails may have stopped syncing. Disconnect and reconnect Gmail to fix it.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Multi-email info note */}
          <div className="text-xs text-slate-400/90 pt-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>
              {language === 'he'
                ? 'תמיכה מלאה בריבוי אימיילים: באפשרותך לחבר מספר תיבות (פרטי, עבודה, משפחה) לאותו הדשבורד!'
                : 'Full Multi-Email Support: Connect multiple inboxes (personal, work, family) to sync to one dashboard!'}
            </span>
          </div>
        </div>

        {/* The forwarding rule is the fallback for people who cannot or will
            not connect an inbox above. Showing its address, provider tabs and
            numbered steps unprompted buried the one-tap path it backs up, so it
            opens on request. */}
        <div className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowForwarding((v) => !v)}
            aria-expanded={showForwarding}
            aria-controls="forwarding-guide-section"
            className="w-full flex items-center gap-3 p-4 sm:p-5 text-start cursor-pointer hover:bg-slate-900/60 transition-colors min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-slate-100">
                {language === 'he' ? 'אין לך Gmail או Outlook?' : "Don't use Gmail or Outlook?"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'he'
                  ? 'הגדרת כלל העברה חד-פעמי לתיבה האישית שלך'
                  : 'Set up a one-time forwarding rule to your personal box'}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${showForwarding ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        
          {showForwarding && (
          <div id="forwarding-guide-section" className="p-4 sm:p-5 pt-0 space-y-4">
          {/* Email Copy Card / Guest Sign-in Gate */}
          {!userUid ? (
            <div className="p-4 bg-slate-900 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-bold block uppercase tracking-wider">
                    {language === 'he' ? 'נדרשת התחברות לכתובת ייחודית' : 'Account required for forwarding'}
                  </span>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {language === 'he'
                      ? 'כתובת ההעברה האישית משויכת לחשבון שלך כדי לנתב חבילות ישירות אליך. התחברו כדי להפיק את הכתובת הייחודית שלכם.'
                      : 'Your forwarding address is linked to your account to securely route incoming packages. Sign in to generate your unique address.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (onOpenAuth) {
                    onOpenAuth({ initialMode: 'signin', reason: 'gmail_sync' });
                  } else if (loginWithGoogle) {
                    await loginWithGoogle();
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <span>{language === 'he' ? 'התחברות להפקת כתובת אישית' : 'Sign in to generate address'}</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs text-slate-500 block uppercase font-bold">
                  {language === 'he' ? 'כתובת ההעברה הייחודית שלך:' : 'Your Private Ingestion Address:'}
                </span>
                <span className="font-mono text-xs text-blue-400 font-semibold truncate block select-all">
                  <bdi dir="ltr">{ingestionEmail || '…'}</bdi>
                </span>
              </div>
              <button
                onClick={handleRotateAddress}
                disabled={isRotatingAddress || !ingestionEmail}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[48px] disabled:opacity-50"
                aria-label={language === 'he' ? 'צור כתובת העברה חדשה ובטל את הקודמת' : 'Create a new forwarding address and revoke the old one'}
                title={language === 'he' ? 'כתובת חדשה' : 'New address'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRotatingAddress ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleCopyEmail}
                disabled={!ingestionEmail}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[48px]"
                aria-label={language === 'he' ? 'העתק כתובת אימייל פרטית' : 'Copy private ingestion email'}
              >
                {copiedEmail ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEmail ? (language === 'he' ? 'הועתק!' : 'Copied!') : (language === 'he' ? 'העתק' : 'Copy')}</span>
              </button>
            </div>
          )}

          {/* Interactive Guides Tab Bar */}
          <div className="space-y-3 pt-2">
            <div
              role="tablist"
              aria-label={language === 'he' ? 'מדריכי ספקי דוא״ל' : 'Email provider guides'}
              className="flex gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto"
            >
              {[
                { id: 'gmail', label: 'Gmail' },
                { id: 'outlook', label: 'Outlook / Hotmail' },
                { id: 'icloud', label: 'Apple iCloud' },
                { id: 'yahoo', label: 'Yahoo Mail' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  id={`ingestion-tab-${tab.id}`}
                  role="tab"
                  aria-selected={selectedGuide === tab.id}
                  aria-controls={`ingestion-panel-${tab.id}`}
                  onClick={() => setSelectedGuide(tab.id)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-ui cursor-pointer min-h-[48px] ${
                    selectedGuide === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Guide Step Details */}
            <div
              role="tabpanel"
              id={`ingestion-panel-${selectedGuide}`}
              aria-labelledby={`ingestion-tab-${selectedGuide}`}
              className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2 text-xs text-slate-300"
            >
              {selectedGuide === 'gmail' && (
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>{language === 'he' ? 'פתחו את Gmail במחשב ולחצו על גלגל השיניים (הגדרות) ⚙️.' : 'Open Gmail on desktop and click the Settings gear ⚙️.'}</li>
                  <li>{language === 'he' ? 'עברו ללשונית "מסננים וכתובות חסומות" ולחצו "צור מסנן חדש".' : 'Go to "Filters and Blocked Addresses" and click "Create a new filter".'}</li>
                  <li>
                    <span>{language === 'he' ? 'בשדה "כולל את המילים", הזינו:' : 'In the "Has the words" field, enter:'}</span>
                    <div className="my-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <code className="flex-1 font-mono text-xs text-blue-400 select-all break-all" dir="ltr">
                        {DEFAULT_FORWARDING_FILTER_QUERY}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyFilter}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[40px] transition-colors"
                        aria-label={language === 'he' ? 'העתק שאילתת מסנן' : 'Copy filter query'}
                      >
                        {copiedFilter ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedFilter ? (language === 'he' ? 'הועתק!' : 'Copied!') : (language === 'he' ? 'העתק מסנן' : 'Copy Filter')}</span>
                      </button>
                    </div>
                  </li>
                  <li>{language === 'he' ? 'סמנו "העבר אל" ובחרו בכתובת ה-SpotLi שהעתקתם למעלה.' : 'Check "Forward it to" and enter your SpotLi address above.'}</li>
                </ol>
              )}

              {selectedGuide === 'outlook' && (
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>{language === 'he' ? 'פתחו את Outlook.com ולחצו על הגדרות (גלגל שיניים ⚙️).' : 'Open Outlook.com and open Settings (gear icon ⚙️).'}</li>
                  <li>{language === 'he' ? 'עברו אל דואר ➔ כללים ולחצו על "הוסף כלל חדש".' : 'Navigate to Mail ➔ Rules and click "Add new rule".'}</li>
                  <li>{language === 'he' ? 'תנו לכלל שם (למשל: SpotLi) והגדירו תנאי: "נושא או גוף ההודעה כוללים \'tracking\' או \'shipped\'".' : 'Name the rule (e.g. SpotLi) and condition: "Subject or body includes \'tracking\' or \'shipped\'".'}</li>
                  <li>{language === 'he' ? 'בפעולה בחרו: "העבר אל" והדביקו את כתובת ה-SpotLi שלכם.' : 'Under action select "Forward to" and paste your SpotLi ingestion address.'}</li>
                </ol>
              )}

              {selectedGuide === 'icloud' && (
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>{language === 'he' ? 'היכנסו ל-iCloud.com/mail מדפדפן מחשב.' : 'Log in to iCloud.com/mail on a desktop browser.'}</li>
                  <li>{language === 'he' ? 'לחצו על גלגל השיניים ⚙️ בפינה התחתונה/עליונה ובחרו "כללים".' : 'Click the Gear icon ⚙️ and choose "Rules".'}</li>
                  <li>{language === 'he' ? 'הוסיפו כלל: "אם הנושא מכיל tracking" ➔ "העבר אל" כתובת ה-SpotLi שלכם.' : 'Add rule: "If subject contains tracking" ➔ "Forward to" your SpotLi address.'}</li>
                </ol>
              )}

              {selectedGuide === 'yahoo' && (
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>{language === 'he' ? 'פתחו את Yahoo Mail ולחצו על הגדרות ➔ עוד הגדרות.' : 'Open Yahoo Mail and tap Settings ➔ More Settings.'}</li>
                  <li>{language === 'he' ? 'בחרו בלשונית "מסננים" ולחצו "הוסף מסננים חדשים".' : 'Select "Filters" and tap "Add new filters".'}</li>
                  <li>{language === 'he' ? 'הגדירו מילת מפתח "shipped" או "tracking" והפנו אל כתובת המשלוחים שלכם.' : 'Set keyword "shipped" or "tracking" and forward to your SpotLi box.'}</li>
                </ol>
              )}
            </div>
          </div>
          </div>
          )}
        </div>

        {/* Method 4: Mobile App QR Code */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="font-bold text-sm text-slate-100">
                  {language === 'he' ? 'התקנה בטלפון הנייד (PWA)' : 'Mobile Phone Installation (PWA)'}
                </h3>
                <span className="text-xs text-slate-400 font-semibold">
                  {language === 'he' ? 'שימוש נוח במסך הבית' : 'Seamless Home Screen Access'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowQR(!showQR)}
              aria-expanded={showQR}
              aria-controls="pwa-qr-section"
              className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer min-h-[48px]"
            >
              {showQR ? (language === 'he' ? 'הסתר QR' : 'Hide QR') : (language === 'he' ? 'סרוק QR' : 'Scan QR')}
            </button>
          </div>

          {showQR && (
            <div id="pwa-qr-section" className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 animate-fade-in">
              <div className="p-2 bg-white rounded-xl shadow-lg shrink-0">
                <img src={qrCodeImageUrl} alt="QR Code" className="w-32 h-32" />
              </div>
              <div className="space-y-1.5 text-start">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  {language === 'he' ? 'כיצד לפתוח בטלפון:' : 'How to open on phone:'}
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-xs">
                  <li>{language === 'he' ? 'סרוק את הברקוד במצלמת הטלפון.' : 'Scan QR code with phone camera.'}</li>
                  <li>{language === 'he' ? 'האפליקציה תיפתח מיידית בדפדפן הנייד.' : 'SpotLi opens immediately.'}</li>
                  <li>{language === 'he' ? 'לחץ "הוסף למסך הבית" להתקנה כאפליקציה חלקה.' : 'Tap "Add to Home Screen" to install.'}</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer min-h-[48px]"
        >
          {language === 'he' ? 'הבנתי, תודה' : 'Got it, Thanks'}
        </button>
      </div>
    </Modal>
  );
}
