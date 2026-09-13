import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { syncQueueService } from '../services/syncQueueService';

/**
 * OfflineBanner component
 *
 * Monitors real-time network connectivity and offline sync queue depth.
 * Staged as a non-blocking sticky strip directly beneath the main navigation bar.
 * Provides accessible, high-contrast visual cues when offline and confirms
 * automatic sync recovery when connectivity is restored.
 */
export function OfflineBanner() {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(() =>
    typeof syncQueueService?.isOnline === 'boolean'
      ? syncQueueService.isOnline
      : typeof navigator !== 'undefined'
        ? navigator.onLine
        : true
  );
  const [queueSize, setQueueSize] = useState(() =>
    typeof syncQueueService?.getQueue === 'function'
      ? syncQueueService.getQueue().length
      : 0
  );
  const [showReconnected, setShowReconnected] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const reconnectedTimerRef = useRef(null);
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const handleStatusUpdate = ({ isOnline: nextOnline, queueSize: nextQueueSize }) => {
      const wasOffline = !prevOnlineRef.current;
      prevOnlineRef.current = nextOnline;

      setIsOnline(nextOnline);
      setQueueSize(nextQueueSize ?? 0);

      if (wasOffline && nextOnline) {
        setIsDismissed(false);
        setShowReconnected(true);
        if (reconnectedTimerRef.current) {
          clearTimeout(reconnectedTimerRef.current);
        }
        reconnectedTimerRef.current = setTimeout(() => {
          setShowReconnected(false);
        }, 3500);
      } else if (!nextOnline) {
        // If transitioning to offline, un-dismiss so user is alerted
        setIsDismissed(false);
        setShowReconnected(false);
      }
    };

    const unsubscribe = syncQueueService.subscribe(handleStatusUpdate);

    const onWindowOnline = () => handleStatusUpdate({ isOnline: true, queueSize: syncQueueService.getQueue().length });
    const onWindowOffline = () => handleStatusUpdate({ isOnline: false, queueSize: syncQueueService.getQueue().length });

    window.addEventListener('online', onWindowOnline);
    window.addEventListener('offline', onWindowOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', onWindowOnline);
      window.removeEventListener('offline', onWindowOffline);
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current);
      }
    };
  }, []);

  // When online and no reconnected toast active, or if dismissed while offline
  if ((isOnline && !showReconnected) || (isDismissed && !showReconnected)) {
    return null;
  }

  const handleManualSync = async () => {
    if (!isOnline || isReplaying) return;
    try {
      setIsReplaying(true);
      await syncQueueService.replayQueue();
    } finally {
      setIsReplaying(false);
      setQueueSize(syncQueueService.getQueue().length);
    }
  };

  const isReconnectedState = isOnline && showReconnected;

  return (
    <aside
      data-testid="offline-banner"
      data-state={isReconnectedState ? 'reconnected' : 'offline'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`sticky top-16 z-25 w-full border-b backdrop-blur-md transition-all duration-300 ${
        isReconnectedState
          ? 'bg-emerald-500/15 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-200 border-emerald-500/30'
          : 'bg-amber-500/15 dark:bg-amber-950/90 text-amber-950 dark:text-amber-200 border-amber-500/30'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2.5 min-w-0">
          {isReconnectedState ? (
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="font-bold shrink-0">
            {isReconnectedState ? t('offline.backOnline') : t('offline.offlineTitle')}
          </span>
          <span className="hidden sm:inline opacity-40">•</span>
          <span className="opacity-90 truncate">
            {isReconnectedState
              ? t('offline.syncComplete')
              : queueSize > 0
                ? queueSize === 1
                  ? t('offline.pendingChanges').replace('{count}', String(queueSize))
                  : t('offline.pendingChangesPlural').replace('{count}', String(queueSize))
                : t('offline.offlineDesc')}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isReconnectedState && queueSize > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isReplaying}
              className="px-3 py-1.5 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReplaying ? 'animate-spin' : ''}`} />
              <span>{t('offline.syncNow')}</span>
            </button>
          )}

          {!isReconnectedState && (
            <button
              onClick={() => setIsDismissed(true)}
              aria-label={t('offline.dismiss')}
              className="p-2 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
