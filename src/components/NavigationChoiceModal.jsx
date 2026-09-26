import React, { useState } from 'react';
import {
  X, Navigation, MapPin, Compass, Bus, Car, Check, ExternalLink, RotateCcw, Smartphone
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Modal } from './Modal';
import {
  NAV_APPS,
  getNavigationAppList,
  getPreferredNavigationApp,
  setPreferredNavigationApp,
  clearPreferredNavigationApp,
  openNavigationApp
} from '../utils/navigationService';

export function NavigationChoiceModal({
  isOpen,
  onClose,
  location = '',
  lat = null,
  lng = null,
  title = '',
  onShowToast
}) {
  const { t, language, isRTL } = useLanguage();
  const [rememberChoice, setRememberChoice] = useState(false);
  const [preferredApp, setPreferredApp] = useState(() => getPreferredNavigationApp());

  if (!isOpen) return null;

  const appList = getNavigationAppList(language);
  const destinationQuery = (typeof location === 'string' ? location : '').trim() || (typeof title === 'string' ? title : '').trim() || 'Pickup Point';

  const handleSelectApp = (appId) => {
    if (rememberChoice) {
      setPreferredNavigationApp(appId);
      setPreferredApp(appId);
      if (onShowToast) {
        onShowToast(
          language === 'he'
            ? 'אפליקציית הניווט נשמרה כברירת מחדל'
            : 'Navigation app preference saved as default',
          'success'
        );
      }
    }

    openNavigationApp(appId, { location, lat, lng, title });
    onClose();
  };

  const handleResetPreference = (e) => {
    e.stopPropagation();
    clearPreferredNavigationApp();
    setPreferredApp(null);
    setRememberChoice(false);
    if (onShowToast) {
      onShowToast(
        language === 'he'
          ? 'העדפת ברירת המחדל אופסה'
          : 'Default app preference reset',
        'info'
      );
    }
  };

  const getAppIcon = (appId) => {
    switch (appId) {
      case NAV_APPS.WAZE:
        return <Car className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />;
      case NAV_APPS.GOOGLE_MAPS:
        return <Compass className="w-5 h-5 text-blue-400 shrink-0" />;
      case NAV_APPS.APPLE_MAPS:
        return <Navigation className="w-5 h-5 text-slate-300 shrink-0" />;
      case NAV_APPS.MOOVIT:
        return <Bus className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />;
      case NAV_APPS.OS_DEFAULT:
        return <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      default:
        return <MapPin className="w-5 h-5 text-blue-400 shrink-0" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      layer="top"
      componentName="NavigationChoiceModal"
      compact
      labelledBy="navigation-choice-title"
      className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col"
    >
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h3 id="navigation-choice-title" className="text-base sm:text-lg font-bold text-slate-100">
              {t('navigation.title') || 'Choose Navigation App'}
            </h3>
            <p className="text-xs text-slate-400">
              {t('navigation.subtitle') || 'Select how you would like to navigate'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
          aria-label={language === 'he' ? 'סגור' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Destination Card Preview */}
      <div className="p-4 bg-slate-950/40 border-b border-slate-800/80">
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold block">
              {t('navigation.destination') || 'Destination'}
            </span>
            <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">
              <bdi dir="auto">{destinationQuery}</bdi>
            </p>
            {lat !== null && lng !== null && (
              <span className="text-xs font-mono text-slate-500 block mt-0.5">
                <bdi dir="ltr">GPS: {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</bdi>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Providers List */}
      <div
        role="group"
        aria-label={t('navigation.title') || 'Choose Navigation App'}
        className="p-4 sm:p-5 space-y-2.5 max-h-[50vh] overflow-y-auto"
      >
        {appList.map((app) => {
          const isPreferred = preferredApp === app.id;
          const appName = language === 'he' ? app.nameHe : app.name;
          const appDesc = language === 'he' ? app.descHe : app.descEn;

          return (
            <button
              key={app.id}
              type="button"
              onClick={() => handleSelectApp(app.id)}
              aria-current={isPreferred ? 'true' : undefined}
              aria-label={`${appName} - ${appDesc}${isPreferred ? ` (${t('navigation.preferredBadge') || 'Default'})` : ''}`}
              className={`w-full p-3.5 rounded-2xl border transition-ui text-start flex items-center justify-between gap-3 cursor-pointer min-h-[52px] group ${
                isPreferred
                  ? 'bg-emerald-600/10 border-emerald-500/50 hover:bg-emerald-600/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  {getAppIcon(app.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-slate-100">
                      {appName}
                    </span>
                    {isPreferred && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                        <Check className="w-3 h-3" />
                        <span>{t('navigation.preferredBadge') || 'Default'}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {appDesc}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: Remember choice toggle & Reset button */}
      <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 min-h-[48px]">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer accent-emerald-500"
          />
          <span>{t('navigation.alwaysUse') || 'Always open with this app'}</span>
        </label>

        {preferredApp && (
          <button
            type="button"
            onClick={handleResetPreference}
            aria-label={t('navigation.clearPreference') || 'Reset saved default'}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer min-h-[48px] px-2"
          >
            <RotateCcw className="w-3.5 h-3.5 rtl:scale-x-[-1]" />
            <span>{t('navigation.clearPreference') || 'Reset saved default'}</span>
          </button>
        )}
      </div>
    </Modal>
  );
}
