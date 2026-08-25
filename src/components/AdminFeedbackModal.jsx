import React, { useState, useEffect, useCallback } from 'react';
import {
  X, MessageSquare, Star, Trash2,
  Bug, Lightbulb, Heart, RefreshCw, CloudOff, Cloud, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../constants/admin';
import {
  fetchAllFeedback,
  mergeFeedbackSources,
  getLocalFeedbackHistory,
  LOCAL_FEEDBACK_HISTORY_KEY
} from '../services/feedbackService';
import { fetchAllCrashReports, groupCrashReports } from '../services/crashReportService';

export function AdminFeedbackModal({
  isOpen,
  onClose,
  onShowToast
}) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [localFeedbacks, setLocalFeedbacks] = useState(() => getLocalFeedbackHistory());
  const [cloudFeedbacks, setCloudFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cloudError, setCloudError] = useState(null);

  const [activeTab, setActiveTab] = useState('feedback');
  const [crashGroups, setCrashGroups] = useState(null);
  const [isLoadingCrashes, setIsLoadingCrashes] = useState(false);
  const [crashError, setCrashError] = useState(null);

  const feedbacks = mergeFeedbackSources(cloudFeedbacks, localFeedbacks);

  const loadCloudFeedback = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setCloudError(null);
    const result = await fetchAllFeedback();
    setCloudFeedbacks(result.items);
    setCloudError(result.ok ? null : result.error);
    setIsLoading(false);
  }, [isAdmin]);

  const loadCrashReports = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingCrashes(true);
    setCrashError(null);
    const result = await fetchAllCrashReports();
    setCrashGroups(result.ok ? groupCrashReports(result.items) : []);
    setCrashError(result.ok ? null : result.error);
    setIsLoadingCrashes(false);
  }, [isAdmin]);

  // Pull the cloud log whenever an admin opens the inspector, so feedback from
  // other testers' devices is visible — local history alone only ever shows
  // submissions made in this browser.
  useEffect(() => {
    if (isOpen && isAdmin) {
      loadCloudFeedback();
    }
  }, [isOpen, isAdmin, loadCloudFeedback]);

  // Crash reports are fetched lazily on first switch to that tab, not on
  // open — most admin visits are about triaging feedback, so this avoids an
  // extra Firestore read on every open.
  useEffect(() => {
    if (isOpen && isAdmin && activeTab === 'crashes' && crashGroups === null) {
      loadCrashReports();
    }
  }, [isOpen, isAdmin, activeTab, crashGroups, loadCrashReports]);

  if (!isOpen) return null;

  const handleClearHistory = () => {
    // Clears only this device's buffer; cloud records are immutable from clients.
    localStorage.removeItem(LOCAL_FEEDBACK_HISTORY_KEY);
    setLocalFeedbacks([]);
    if (onShowToast) {
      onShowToast(language === 'he' ? 'היסטוריית המשובים המקומית נוקתה' : 'Local feedback buffer cleared', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-blue-600/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>{language === 'he' ? 'יומן משובי אלפא' : 'Alpha Feedback Inspector'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {activeTab === 'feedback' ? feedbacks.length : (crashGroups?.length ?? 0)}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={activeTab === 'feedback' ? loadCloudFeedback : loadCrashReports}
                disabled={activeTab === 'feedback' ? isLoading : isLoadingCrashes}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                aria-label={language === 'he' ? 'רענן' : 'Refresh'}
              >
                <RefreshCw className={`w-5 h-5 ${(activeTab === 'feedback' ? isLoading : isLoadingCrashes) ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch — crash reports are kept out of the feedback list
            entirely (own Firestore collection, own fetch) so a burst of
            automatic crash reports can never crowd out human feedback. */}
        {isAdmin && (
          <div className="px-5 sm:px-6 pt-3 flex items-center gap-2 border-b border-slate-800">
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer min-h-[44px] ${
                activeTab === 'feedback' ? 'text-indigo-300 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {language === 'he' ? 'משוב' : 'Feedback'}
            </button>
            <button
              onClick={() => setActiveTab('crashes')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5 ${
                activeTab === 'crashes' ? 'text-orange-300 border-b-2 border-orange-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {language === 'he' ? 'קריסות' : 'Crashes'}
            </button>
          </div>
        )}

        {/* Source banner — makes it unambiguous whether this list includes
            other testers' submissions or only this device's. */}
        {activeTab === 'feedback' && (
        <div className="px-5 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 text-[11px]">
          {!isAdmin ? (
            <>
              <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-300/90">
                {language === 'he'
                  ? 'תצוגה מקומית בלבד — משובים ממכשירים אחרים אינם מוצגים.'
                  : 'This device only — other testers’ feedback is not shown.'}
              </span>
            </>
          ) : cloudError ? (
            <>
              <CloudOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-rose-300/90">
                {language === 'he'
                  ? `טעינת המשובים מהענן נכשלה (${cloudError}) — מוצגים מקומיים בלבד.`
                  : `Couldn’t load cloud feedback (${cloudError}) — showing local only.`}
              </span>
            </>
          ) : (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-300/90">
                {language === 'he'
                  ? `כולל משובים מכל הבודקים (${cloudFeedbacks.length} מהענן).`
                  : `Includes all testers’ feedback (${cloudFeedbacks.length} from cloud).`}
              </span>
            </>
          )}
        </div>
        )}

        {activeTab === 'crashes' && crashError && (
          <div className="px-5 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 text-[11px]">
            <CloudOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="text-rose-300/90">
              {language === 'he'
                ? `טעינת דוחות הקריסה נכשלה (${crashError}).`
                : `Couldn’t load crash reports (${crashError}).`}
            </span>
          </div>
        )}

        {/* Content */}
        {activeTab === 'feedback' ? (
        <div className="p-5 sm:p-6 text-xs text-slate-200 max-h-[60vh] overflow-y-auto space-y-3">
          {isLoading && feedbacks.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <RefreshCw className="w-8 h-8 text-slate-600 mx-auto animate-spin" />
              <p className="text-sm font-semibold text-slate-400">
                {language === 'he' ? 'טוען משובים...' : 'Loading feedback...'}
              </p>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">
                {language === 'he' ? 'אין משובים כרגע' : 'No feedback submissions yet'}
              </p>
              <p className="text-[11px] text-slate-500">
                {language === 'he' ? 'כל משוב שיישלח דרך האפליקציה ייקלט כאן.' : 'Every feedback submitted will be recorded here.'}
              </p>
            </div>
          ) : (
            feedbacks.map((fb, idx) => (
              <div key={fb.id || idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg text-xs ${
                      fb.type === 'bug' ? 'bg-rose-500/10 text-rose-400' :
                      fb.type === 'feature' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {fb.type === 'bug' ? <Bug className="w-3.5 h-3.5" /> : fb.type === 'feature' ? <Lightbulb className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                    </span>
                    <span className="font-bold text-slate-200 capitalize">{fb.type}</span>
                    <span className="text-amber-400 font-bold text-[11px] flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400" /> {fb.rating}/5
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {fb.timestamp ? new Date(fb.timestamp).toLocaleString() : ''}
                  </span>
                </div>

                <p className="text-xs text-slate-100 bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                  {fb.message}
                </p>

                {fb.screenshot && (
                  <a
                    href={fb.screenshot}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-500/50 transition-colors"
                    title={language === 'he' ? 'פתח בגודל מלא' : 'Open full size'}
                  >
                    <img
                      src={fb.screenshot}
                      alt={language === 'he' ? 'צילום מסך מהבודק' : 'Tester screenshot'}
                      loading="lazy"
                      className="w-full max-h-56 object-contain bg-slate-900"
                    />
                  </a>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span className="truncate flex items-center gap-1.5">
                    👤 Anonymous Tester
                    {fb.source === 'cloud' && (
                      <Cloud className="w-3 h-3 text-emerald-400/70" aria-label="From cloud" />
                    )}
                  </span>
                  <span>📱 {fb.screenWidth}x{fb.screenHeight} • v{fb.appVersion}</span>
                </div>
              </div>
            ))
          )}
        </div>
        ) : (
        <div className="p-5 sm:p-6 text-xs text-slate-200 max-h-[60vh] overflow-y-auto space-y-3">
          {isLoadingCrashes && crashGroups === null ? (
            <div className="text-center py-10 space-y-2">
              <RefreshCw className="w-8 h-8 text-slate-600 mx-auto animate-spin" />
              <p className="text-sm font-semibold text-slate-400">
                {language === 'he' ? 'טוען דוחות קריסה...' : 'Loading crash reports...'}
              </p>
            </div>
          ) : !crashGroups || crashGroups.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">
                {language === 'he' ? 'אין דוחות קריסה' : 'No crash reports'}
              </p>
              <p className="text-[11px] text-slate-500">
                {language === 'he'
                  ? 'שגיאות שלא נתפסו יופיעו כאן אוטומטית, מקובצות לפי סוג התקלה.'
                  : 'Uncaught errors will appear here automatically, grouped by distinct failure.'}
              </p>
            </div>
          ) : (
            crashGroups.map((group) => (
              <div key={group.signature} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg text-xs bg-orange-500/10 text-orange-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                    {group.componentName && (
                      <span className="font-bold text-slate-200">{group.componentName}</span>
                    )}
                    <span className="text-orange-400 font-bold text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                      {language === 'he' ? `${group.count} מופעים` : `${group.count}×`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {group.lastSeen ? new Date(group.lastSeen).toLocaleString() : ''}
                  </span>
                </div>

                <p className="text-xs text-slate-100 bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 leading-relaxed font-mono whitespace-pre-wrap">
                  {group.message}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>
                    {language === 'he' ? 'נראה לראשונה' : 'First seen'}: {group.firstSeen ? new Date(group.firstSeen).toLocaleString() : '—'}
                  </span>
                  <span>v{group.appVersion}</span>
                </div>
              </div>
            ))
          )}
        </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {activeTab === 'feedback' && feedbacks.length > 0 ? (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors text-xs font-semibold cursor-pointer min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" />
              <span>{language === 'he' ? 'נקה יומן משובים' : 'Clear Log'}</span>
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer min-h-[44px]"
          >
            {language === 'he' ? 'סגור' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
