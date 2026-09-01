import { useEffect, useRef } from 'react';
import { recordFeatureUse } from '../services/featureUsageService';

/**
 * Records one feature-adoption row (see featureUsageService.js) the first
 * time `active` becomes true for this mount — typically a modal's `isOpen`
 * prop. Fires at most once per mount (a `useRef` guard, not a dependency
 * on `active` alone), so re-renders while the modal stays open don't spam
 * writes, and closing/reopening within the same page session is still
 * just one write per day either way (the service's own dedup).
 *
 * Takes `uid` as a plain argument rather than reading `useAuth()` itself —
 * these leaf modals (AnalyticsModal, ExportModal, SmartImportModal, ...)
 * are deliberately unit-tested standalone, without an AuthProvider
 * wrapper, same as their other props; threading `uid` down from
 * DashboardContent (which already has `user` in scope) keeps that
 * independence instead of adding a new hard dependency on auth context to
 * components that otherwise have none.
 *
 * @param {string} feature One of FEATURE_IDS (constants/featureIds.js)
 * @param {boolean} active
 * @param {string | null} [uid]
 */
export function useFeatureUsage(feature, active, uid = null) {
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!active || recordedRef.current) return;
    recordedRef.current = true;
    recordFeatureUse(feature, { uid });
  }, [active, feature, uid]);
}
