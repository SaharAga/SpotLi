import React from 'react';
import { Mail, MessageSquareText, Sparkles, Plus, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * The onboarding gate shown when the package list is empty.
 *
 * `isGmailConnected` exists because this used to take no account state at
 * all: the Gmail tile rendered for everyone, badged "Recommended", including
 * users whose Gmail was already connected and syncing. Being told to connect
 * something you already connected reads as the app having lost your account.
 * Connection state is resolved once by useFeatureNudges (local flag first,
 * then confirmed against the server) and passed down, rather than looked up
 * again here — a second lookup would mean a second callable per empty render.
 */
export function FirstTimeEmptyState({
  onConnectGmail,
  onStartSmartImport,
  onLoadDemoPackage,
  isGmailConnected = false
}) {
  const { t, isRTL, language } = useLanguage();
  const showGmailTile = !isGmailConnected;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 max-w-4xl mx-auto animate-fade-in my-2">
      {/* Header */}
      <div className="text-center max-w-lg mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-3 shadow-inner">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{language === 'he' ? 'ברוכים הבאים ל-SpotLi' : 'Welcome to SpotLi'}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-100 mb-2 tracking-tight">
          {t('firstTimeEmpty.welcomeTitle')}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          {t('firstTimeEmpty.welcomeSubtitle')}
        </p>
      </div>

      {/* Action tiles — three, or two once Gmail is connected. */}
      <div className={`grid grid-cols-1 ${showGmailTile ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 w-full`}>
        {/* Tile 1: Gmail Sync (Hero) — omitted once Gmail is already connected. */}
        {showGmailTile && (
        <div className="flex flex-col justify-between p-5 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-900/90 border-2 border-amber-500/40 hover:border-amber-400 transition-ui shadow-xl shadow-amber-950/20 relative group">
          <div className="absolute top-4 end-4">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
              {t('firstTimeEmpty.gmailTileBadge')}
            </span>
          </div>

          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-md" aria-hidden="true">
              <Mail className="w-6 h-6" />
            </div>
            <h3 id="gmail-tile-heading" className="text-sm font-bold text-slate-100 mb-1.5">
              {t('firstTimeEmpty.gmailTileTitle')}
            </h3>
            <p id="gmail-tile-desc" className="text-xs text-slate-400 leading-relaxed mb-6">
              {t('firstTimeEmpty.gmailTileDesc')}
            </p>
          </div>

          <button
            type="button"
            onClick={onConnectGmail}
            aria-describedby="gmail-tile-desc"
            className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20 cursor-pointer min-h-[48px]"
          >
            <span>{t('firstTimeEmpty.gmailTileTitle')}</span>
            {isRTL ? <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> : <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
        </div>
        )}

        {/* Tile 2: Smart Import (SMS / Link) */}
        <div className="flex flex-col justify-between p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-ui shadow-xl relative group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 shadow-md" aria-hidden="true">
              <MessageSquareText className="w-6 h-6" />
            </div>
            <h3 id="sms-tile-heading" className="text-sm font-bold text-slate-100 mb-1.5">
              {t('firstTimeEmpty.smsTileTitle')}
            </h3>
            <p id="sms-tile-desc" className="text-xs text-slate-400 leading-relaxed mb-6">
              {t('firstTimeEmpty.smsTileDesc')}
            </p>
          </div>

          <button
            type="button"
            onClick={onStartSmartImport}
            aria-describedby="sms-tile-desc"
            className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[48px]"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{t('firstTimeEmpty.smsTileTitle')}</span>
          </button>
        </div>

        {/* Tile 3: Explore with Demo Package */}
        <div className="flex flex-col justify-between p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-ui shadow-xl relative group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-md" aria-hidden="true">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 id="demo-tile-heading" className="text-sm font-bold text-slate-100 mb-1.5">
              {t('firstTimeEmpty.demoTileTitle')}
            </h3>
            <p id="demo-tile-desc" className="text-xs text-slate-400 leading-relaxed mb-6">
              {t('firstTimeEmpty.demoTileDesc')}
            </p>
          </div>

          <button
            type="button"
            onClick={onLoadDemoPackage}
            aria-describedby="demo-tile-desc"
            className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 text-xs font-semibold border border-slate-700 transition-all cursor-pointer min-h-[48px]"
          >
            <span>{t('firstTimeEmpty.demoTileTitle')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
