import React, { useState, useEffect } from 'react';
import { 
  Mail, Bell, Sparkles, CheckCircle2, ChevronRight, ChevronLeft, 
  ArrowRight, ArrowLeft, Loader2, Info
} from 'lucide-react';
import { Modal } from './Modal';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { connectGmail, getConnectedServices } from '../services/emailSyncService';
import { notificationService } from '../services/notificationService';

export function PostAuthSetupWizard({
  isOpen,
  onClose,
  onComplete,
  onShowToast
}) {
  const { t, isRTL, language } = useLanguage();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: Gmail, 2: Notifications
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const [pushStatus, setPushStatus] = useState('default'); // 'default' | 'granted' | 'denied' | 'unsupported'

  // Check current statuses on mount
  useEffect(() => {
    if (!isOpen) return;
    const services = getConnectedServices(user);
    if (services.gmail) {
      setIsGmailConnected(true);
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(window.Notification.permission || 'default');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const isIosSafari = typeof window !== 'undefined' && 
    /iPhone|iPad|iPod/.test(navigator.userAgent) && 
    !window.navigator.standalone;

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true);
    try {
      const res = await connectGmail();
      if (!res.ok && res.error) {
        if (onShowToast) onShowToast(res.error, 'error');
        setIsConnectingGmail(false);
      }
      // If ok, window will redirect to Google OAuth
    } catch (err) {
      console.error('[PostAuthSetupWizard] connectGmail error:', err);
      setIsConnectingGmail(false);
    }
  };

  const handleRequestPush = async () => {
    setIsRequestingPush(true);
    try {
      const uid = user?.id || user?.uid;
      const permission = await notificationService.requestNotificationPermission(uid);
      setPushStatus(permission);
      if (permission === 'granted') {
        if (onShowToast) {
          onShowToast(
            language === 'he' ? 'התראות הופעלו בהצלחה!' : 'Notifications enabled successfully!',
            'success'
          );
        }
      }
    } finally {
      setIsRequestingPush(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    if (onComplete) onComplete();
    if (onClose) onClose();
  };

  return (
    <Modal
      componentName="PostAuthSetupWizard"
      layer="base"
      overlayClassName="bg-slate-950/85 backdrop-blur-sm"
      className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col text-slate-100"
      closeOnBackdrop={false}
      closeOnEscape={true}
      onClose={handleFinish}
    >
      {/* Top Header & Step Tracker */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">
              {language === 'he' ? 'הגדרת חשבון מהירה' : 'Quick Account Setup'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {t('wizard.step').replace('{current}', String(step)).replace('{total}', '2')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFinish}
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-800 min-h-[48px] flex items-center justify-center cursor-pointer transition-colors"
        >
          {t('wizard.skipStep')}
        </button>
      </div>

      {/* Wizard Body */}
      <div className="p-6 flex-1 flex flex-col items-center text-center">
        {step === 1 ? (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-950/30">
              <Mail className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5">
              {t('wizard.step1Title')}
            </h3>
            <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
              {t('wizard.step1Desc')}
            </p>

            {isGmailConnected ? (
              <div className="w-full p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold mb-6">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t('wizard.gmailConnected')}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={isConnectingGmail}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20 cursor-pointer min-h-[48px] mb-4 disabled:opacity-60"
              >
                {isConnectingGmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('wizard.connecting')}</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>{t('wizard.connectGmailBtn')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-950/30">
              <Bell className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5">
              {t('wizard.step2Title')}
            </h3>
            <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
              {t('wizard.step2Desc')}
            </p>

            {isIosSafari && pushStatus !== 'granted' && (
              <div className="w-full p-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-start gap-2.5 text-start text-xs text-slate-300 mb-4">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>{t('wizard.iosPwaHint')}</span>
              </div>
            )}

            {pushStatus === 'granted' ? (
              <div className="w-full p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold mb-6">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t('wizard.notificationsEnabled')}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRequestPush}
                disabled={isRequestingPush}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer min-h-[48px] mb-4 disabled:opacity-60"
              >
                {isRequestingPush ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('wizard.enabling')}</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    <span>{t('wizard.enableNotificationsBtn')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-5 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3">
        {step === 2 ? (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer min-h-[48px]"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span>{t('onboarding.prev')}</span>
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={handleNextStep}
          className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700 cursor-pointer min-h-[48px]"
        >
          <span>{step === 1 ? t('onboarding.next') : t('wizard.finishBtn')}</span>
          {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </Modal>
  );
}
