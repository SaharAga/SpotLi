import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Plus, Inbox, ShieldCheck, Sparkles, LogIn, UserPlus, PlayCircle, MessageSquarePlus, RefreshCw } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { FilterBar } from './components/FilterBar';
import { PackageCard } from './components/PackageCard';
import { PackageTable } from './components/PackageTable';
import { LegalConsentGate } from './components/LegalConsentGate';
import { ModalLoadingFallback } from './components/ModalLoadingFallback';
import { findPackageByTrackingNumber } from './services/deliveryService';
import { deriveMood } from './utils/ambientMood';

/**
 * Every dialog is loaded on demand.
 *
 * Sixteen modals — several over five hundred lines — used to be static
 * imports, so the entry bundle carried all of them plus everything they pull
 * in (chart code, the locker map, the legal document viewer) before the
 * package list could paint. Most sessions open none of them.
 *
 * `React.lazy` wants a module whose *default* export is the component; these
 * are all named exports, so each loader re-shapes the namespace object.
 * The `import()` specifier stays a string literal in every case, which is
 * what lets Rollup see the edge and split the chunk — a computed specifier
 * would silently fall back to bundling everything.
 */
const lazyModal = (loader, exportName) =>
  lazy(() => loader().then((mod) => ({ default: mod[exportName] })));

const PackageDetailModal = lazyModal(() => import('./components/PackageDetailModal'), 'PackageDetailModal');
const AddEditPackageModal = lazyModal(() => import('./components/AddEditPackageModal'), 'AddEditPackageModal');
const SmartImportModal = lazyModal(() => import('./components/SmartImportModal'), 'SmartImportModal');
const AnalyticsModal = lazyModal(() => import('./components/AnalyticsModal'), 'AnalyticsModal');
const IngestionGuideModal = lazyModal(() => import('./components/IngestionGuideModal'), 'IngestionGuideModal');
const AuthModal = lazyModal(() => import('./components/AuthModal'), 'AuthModal');
const AccountModal = lazyModal(() => import('./components/AccountModal'), 'AccountModal');
const AboutModal = lazyModal(() => import('./components/AboutModal'), 'AboutModal');
const FeedbackModal = lazyModal(() => import('./components/FeedbackModal'), 'FeedbackModal');
const AdminFeedbackModal = lazyModal(() => import('./components/AdminFeedbackModal'), 'AdminFeedbackModal');
const ExportModal = lazyModal(() => import('./components/ExportModal'), 'ExportModal');
const LockerMapModal = lazyModal(() => import('./components/LockerMapModal'), 'LockerMapModal');
const ActivityModal = lazyModal(() => import('./components/ActivityModal'), 'ActivityModal');
const DeleteConfirmDialog = lazyModal(() => import('./components/DeleteConfirmDialog'), 'DeleteConfirmDialog');
const AutoArchivePromptModal = lazyModal(() => import('./components/AutoArchivePromptModal'), 'AutoArchivePromptModal');
const NavigationChoiceModal = lazyModal(() => import('./components/NavigationChoiceModal'), 'NavigationChoiceModal');
const FullScreenLockerModal = lazyModal(() => import('./components/FullScreenLockerModal'), 'FullScreenLockerModal');

import { Toast } from './components/Toast';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { deliveryService } from './services/deliveryService';
import { useLanguage, LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth, AuthProvider } from './context/AuthContext';
import { isAdminUser } from './constants/admin';
import { getCarrier } from './types/carriers';
import { getTabPredicate, ARCHIVED_TAB } from './types/stages';
import { STORAGE_KEYS } from './constants/storageKeys';
import { APP_NAME, APP_COPYRIGHT } from './constants/app';

import { ErrorBoundary } from './components/ErrorBoundary';
import { usePackages, MUTATION_TYPES } from './hooks/usePackages';
import { triggerGmailBackfill } from './services/emailSyncService';
import { notificationService } from './services/notificationService';
import { recordFeatureUse } from './services/featureUsageService';
import { FEATURE_IDS } from './constants/featureIds';

/**
 * Every dialog in the app, by id. These replaced twelve `isXOpen` booleans
 * plus their companion payload state (`editPackage`, `authInitialMode`,
 * `pendingDeliveredPkgId`, …), which between them could describe states that
 * do not exist — two dialogs "open" at once with no defined stacking, or an
 * `editPackage` left dangling after its modal closed.
 */
export const MODAL = {
  ADD_EDIT: 'addEdit',
  SMART_IMPORT: 'smartImport',
  DETAIL: 'detail',
  ANALYTICS: 'analytics',
  INGESTION_GUIDE: 'ingestionGuide',
  AUTH: 'auth',
  ACCOUNT: 'account',
  EXPORT: 'export',
  LOCKER_MAP: 'lockerMap',
  ACTIVITY: 'activity',
  ABOUT: 'about',
  FEEDBACK: 'feedback',
  ADMIN_FEEDBACK: 'adminFeedback',
  AUTO_ARCHIVE: 'autoArchive',
  DELETE_CONFIRM: 'deleteConfirm',
  NAVIGATION_CHOICE: 'navigationChoice',
  FULL_SCREEN_LOCKER: 'fullScreenLocker'
};

/**
 * One value describes the whole modal layer: an ordered stack of
 * `{ id, payload }`, whose last entry is `activeModal`.
 *
 * A stack rather than a single id because these dialogs genuinely nest —
 * Account opens Export over itself, Package Details opens the Locker Map,
 * the Ingestion Guide opens Smart Import — and a lone `activeModal` string
 * would have silently closed the parent underneath.
 *
 * Every mutator is referentially stable (functional updates only), so
 * handlers built on them stay stable for the memoized list components.
 */
export function useModalRouter() {
  const [stack, setStack] = useState([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  // OS Native Back Swipe & Browser History navigation support
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePopState = () => {
      if (stackRef.current.length > 0) {
        setStack((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Re-opening a modal already in the stack moves it to the top rather than
  // duplicating it.
  const openModal = useCallback((id, payload = null) => {
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ modalRouter: true, modalId: id }, '', window.location.href);
      } catch {
        // Ignore
      }
    }
    setStack((prev) => [...prev.filter((entry) => entry.id !== id), { id, payload }]);
  }, []);

  const closeModal = useCallback((id) => {
    setStack((prev) => {
      const nextStack = id ? prev.filter((entry) => entry.id !== id) : prev.slice(0, -1);
      if (
        typeof window !== 'undefined' &&
        window.history.state?.modalRouter &&
        (!id || window.history.state?.modalId === id)
      ) {
        try {
          window.history.back();
        } catch {
          // Ignore
        }
      }
      return nextStack;
    });
  }, []);

  /**
   * Switches to a tab: the stack becomes exactly this one screen, or empty.
   *
   * Not `closeAllModals()` then `openModal()`. Closing rewinds history with
   * `history.go(-n)`, which fires `popstate` ASYNCHRONOUSLY — after the open
   * had already run — and the popstate handler then popped the screen just
   * opened. Lockers looked like it did nothing. Doing it in one update, with
   * a single forward history entry, removes the race entirely.
   */
  const goToTab = useCallback((id = null, payload = null) => {
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ modalRouter: true, modalId: id }, '', window.location.href);
      } catch {
        // Ignore
      }
    }
    setStack(id ? [{ id, payload }] : []);
  }, []);

  /**
   * Empties the stack — what a bottom-bar tab does.
   *
   * Tabs are not a stack. Tapping Status used to scroll the list that was
   * still sitting underneath whatever you had open, so the only ways back
   * were the X or the OS back gesture. A tab now returns you to its own
   * screen rather than layering another one on top.
   *
   * History is unwound entry by entry so the OS back button stays consistent
   * with what is on screen — dropping the stack without rewinding would leave
   * back gestures replaying screens you already dismissed.
   */
  const closeAllModals = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      if (typeof window !== 'undefined' && window.history.state?.modalRouter) {
        try {
          window.history.go(-prev.length);
        } catch {
          // Ignore
        }
      }
      return [];
    });
  }, []);

  // Updates the payload of an already-open modal, and does nothing if it is
  // closed — which is exactly the `if (selectedDetailPackage?.id === x)`
  // guard that used to be written out at each call site.
  const setModalPayload = useCallback((id, next) => {
    setStack((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, payload: typeof next === 'function' ? next(entry.payload) : next }
          : entry
      )
    );
  }, []);

  const isModalOpen = useCallback((id) => stack.some((entry) => entry.id === id), [stack]);
  const getModalPayload = useCallback(
    (id) => stack.find((entry) => entry.id === id)?.payload ?? null,
    [stack]
  );

  return {
    activeModal: stack.length > 0 ? stack[stack.length - 1].id : null,
    openModal,
    closeAllModals,
    goToTab,
    closeModal,
    setModalPayload,
    isModalOpen,
    getModalPayload
  };
}

export function DashboardContent() {

  const { t, language, isRTL } = useLanguage();
  // updateUserPreferences was used by the auto-archive prompt handlers below
  // without ever being pulled off the context, so confirming or declining the
  // prompt threw ReferenceError for any signed-in user.
  const { user, loading, triggerCloudSync, updateUserPreferences } = useAuth();

  const {
    packages,
    isDemoMode, startDemoMode, commit,
    saveError,
    clearSaveError
  } = usePackages(user, triggerCloudSync);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const [sortBy, setSortByState] = useState(() => {
    if (typeof window === 'undefined') return 'newest';
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SORT_BY);
      return saved && ['newest', 'expected', 'title', 'status'].includes(saved) ? saved : 'newest';
    } catch {
      return 'newest';
    }
  });

  const setSortBy = useCallback((newSort) => {
    setSortByState(newSort);
    if (typeof window !== 'undefined' && ['newest', 'expected', 'title', 'status'].includes(newSort)) {
      try {
        localStorage.setItem(STORAGE_KEYS.SORT_BY, newSort);
      } catch (err) {
        console.warn('Failed to persist sortBy preference:', err);
      }
    }
  }, []);

  const [viewMode, setViewMode] = useState('grid');

  // Modals & Active Elements — one router, not twelve booleans.
  const {
    activeModal,
    openModal,
    closeModal,
    closeAllModals,
    goToTab,
    setModalPayload,
    isModalOpen,
    getModalPayload
  } = useModalRouter();

  /**
   * Which dialogs have been opened at least once this session.
   *
   * Before code splitting, all fourteen were mounted from the first render
   * with `isOpen={false}` and each one returned null. That is now the wrong
   * shape: rendering a `React.lazy` element mounts it, and mounting it fires
   * its `import()` — so keeping the closed ones rendered would download every
   * chunk on load and split nothing.
   *
   * So a dialog is not rendered until it is first opened, and from then on it
   * stays rendered exactly as before, toggling on `isOpen`. That preserves the
   * two properties that matter:
   *
   * - Nothing observable changes while a dialog is closed. Every mount-time
   *   effect in all fourteen is already guarded on `isOpen` (checked one by
   *   one), so none of them did anything before its first open anyway.
   * - Re-opening never remounts. AddEditPackageModal and SmartImportModal
   *   both hold in-progress form state in `useState`; unmounting them on
   *   close — or re-suspending on re-open — would silently discard a
   *   half-typed package. Once the chunk has resolved, `React.lazy` returns
   *   it synchronously and Suspense never fires again for that dialog.
   *
   * A ref rather than state on purpose: this must not schedule a render of
   * its own. `openModal` has already caused the render that reads it, and an
   * extra pass here would churn the memoized card list that #60 pinned down.
   */
  const everOpenedRef = useRef(null);
  if (everOpenedRef.current === null) everOpenedRef.current = new Set();

  // The payloads a few handlers still read directly, named as they were.
  const selectedDetailPackage = getModalPayload(MODAL.DETAIL);
  const pendingDeliveredPkgId = getModalPayload(MODAL.AUTO_ARCHIVE)?.packageId ?? null;

  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  // Mutable mirrors of state that handlers need to *read* but must not be
  // re-created for. Keeping them out of the dependency arrays below is what
  // lets the memoized list components see stable props across a keystroke or
  // a package mutation.
  // (The companion `selectedDetailIdRef` is gone: the detail package now
  // lives in the modal router, and `setModalPayload` updates it only when
  // that modal is open, which is what the ref-and-compare guarded.)
  const packagesRef = useRef(packages);
  useEffect(() => {
    packagesRef.current = packages;
  });

  // Feature-adoption baseline (see featureUsageService.js /
  // constants/featureIds.js): recorded once per session, once auth state
  // has settled, regardless of screen — every other feature's adoption
  // rate is computed against this "was the app used at all today" count.
  const appActiveRecordedRef = useRef(false);
  useEffect(() => {
    if (loading || appActiveRecordedRef.current) return;
    appActiveRecordedRef.current = true;
    recordFeatureUse(FEATURE_IDS.APP_ACTIVE, { uid: user?.id || null });
  }, [loading, user?.id]);

  // Handle PWA App Shortcuts, Web Share Target & Query Parameters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;

      // 1. App Shortcut: ?action=paste
      const action = params.get('action');
      if (action === 'paste') {
        openModal(MODAL.SMART_IMPORT);
      }

      // 2. App Shortcut: ?tab=active / ?tab=archived / ?tab=customs / etc.
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      }

      // 3. Web Share Target params: ?title=...&text=...&url=...
      const shareTitle = params.get('title');
      const shareText = params.get('text');
      const shareUrl = params.get('url');

      if (shareTitle || shareText || shareUrl) {
        const combinedSharedText = [shareTitle, shareText, shareUrl]
          .filter(Boolean)
          .join(' ')
          .trim();

        if (combinedSharedText) {
          openModal(MODAL.SMART_IMPORT, { initialText: combinedSharedText });
          recordFeatureUse(FEATURE_IDS.SHARE_TARGET_IMPORT, { uid: user?.id || null });
        }
      }

      // 4. Notification routing parameter: ?packageId=...
      const pkgIdParam = params.get('packageId');
      if (pkgIdParam) {
        const found = packagesRef.current.find(p => p.id === pkgIdParam || p.trackingNumber === pkgIdParam);
        if (found) {
          openModal(MODAL.DETAIL, found);
        }
      }

      // 5. Gmail OAuth callback return: ?gmail=connected | ?gmail=error
      // Deliberately doesn't write localStorage here — the redirect param
      // only proves Google sent us back, not that the OAuth token exchange
      // in gmailOAuthCallback actually succeeded server-side. Opening the
      // modal triggers its own isOpen effect, which asks the
      // gmailConnectionStatus Cloud Function for the real, server-verified
      // state (gmailConnections/{uid} itself is unreadable from the client).
      const gmailResult = params.get('gmail');
      if (gmailResult === 'connected') {
        recordFeatureUse(FEATURE_IDS.GMAIL_SYNC, { uid: user?.id || null });
        showToast(
          language === 'he'
            ? 'Gmail חובר בהצלחה! אישורי הזמנות יסונכרנו אוטומטית 🎉'
            : 'Gmail connected! Orders will sync automatically 🎉',
          'success'
        );
        // Reports scanned/saved counts (or the failure) so a silent client-
        // side error isn't invisible — this used to be a bare
        // .catch(() => {}), which meant a failed backfill call looked
        // identical to "nothing matched in the last 30 days."
        triggerGmailBackfill().then((res) => {
          if (res.ok) {
            showToast(
              language === 'he'
                ? `נסרקו ${res.scanned ?? 0} אימיילים, נוספו ${res.saved ?? 0} חבילות`
                : `Scanned ${res.scanned ?? 0} emails, added ${res.saved ?? 0} packages`,
              'info'
            );
          } else {
            showToast(
              language === 'he'
                ? `סריקת 30 הימים האחרונים נכשלה: ${res.error || 'שגיאה לא ידועה'}`
                : `30-day scan failed: ${res.error || 'unknown error'}`,
              'error'
            );
          }
        });
        openModal(MODAL.INGESTION_GUIDE);
      } else if (gmailResult === 'error') {
        showToast(
          language === 'he' ? 'החיבור ל-Gmail נכשל, נסה שוב' : 'Gmail connection failed, please try again',
          'error'
        );
      }

      // Clean up share/action query params from URL without reload
      if (action || tabParam || shareTitle || shareText || shareUrl || pkgIdParam || gmailResult) {
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete('action');
        cleanParams.delete('title');
        cleanParams.delete('text');
        cleanParams.delete('url');
        cleanParams.delete('packageId');
        cleanParams.delete('gmail');
        
        const cleanQuery = cleanParams.toString();
        const newUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    } catch (e) {
      console.warn('[App] Failed to parse URL parameters:', e);
    }
    // Startup-only: the URL is read once and then scrubbed. It used to depend
    // on `packages`, so every add/edit/archive re-parsed the URL, re-read six
    // query params and re-ran a find. The one thing it needs from packages —
    // the ?packageId= lookup — comes from a ref instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for PWA Service Worker instant updates
  useEffect(() => {
    const handleSwUpdate = () => {
      setIsUpdateAvailable(true);
    };

    window.addEventListener('sw-update-ready', handleSwUpdate);
    return () => window.removeEventListener('sw-update-ready', handleSwUpdate);
  }, []);

  const handleApplyUpdate = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Synchronize PWA App Badge with count of active (non-delivered, non-archived) packages
  useEffect(() => {
    const activeCount = (packages || []).filter(
      (p) => !p.isArchived && p.status !== 'delivered' && p.status !== 'archived'
    ).length;
    notificationService.updateAppBadge(activeCount);
  }, [packages]);

  // Toast notifications
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // A rejected localStorage write (quota exhausted, private mode) used to be
  // indistinguishable from a successful one: state updated, nothing reached
  // disk, and the user was never told. usePackages reports the failure; this
  // is the only place it becomes visible. The error is cleared as soon as it
  // is shown, so a later failure raises a fresh toast.
  useEffect(() => {
    if (!saveError) return;
    showToast(
      language === 'he'
        ? 'השמירה במכשיר נכשלה — האחסון מלא. השינוי מוצג אך לא נשמר.'
        : 'Could not save to this device — storage is full. Your change is shown but not saved.',
      'error'
    );
    clearSaveError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError]);

  // Helper to check user auto-archive setting and prompting status
  // useCallback, not a plain function expression: this feeds
  // checkAndHandleAutoArchive, which is a dependency of handleStatusChange,
  // which is a prop of the memoized PackageCard. An unstable identity here
  // invalidates that whole chain on every keystroke.
  const getAutoArchiveSetting = useCallback(() => {
    if (user?.preferences && typeof user.preferences.autoArchiveDelivered === 'boolean') {
      return user.preferences.autoArchiveDelivered;
    }
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(STORAGE_KEYS.AUTO_ARCHIVE_DELIVERED);
      if (val === 'true') return true;
      if (val === 'false') return false;
    }
    return null; // not decided yet
    // The *value*, not `user.preferences` — that object is rebuilt whenever
    // the auth context re-creates `user`, which would give this function a new
    // identity and cascade through checkAndHandleAutoArchive into
    // handleStatusChange, re-rendering every memoized card.
  }, [user?.preferences?.autoArchiveDelivered]);

  const checkAndHandleAutoArchive = useCallback((pkgId, isNewlyDelivered) => {
    if (!isNewlyDelivered) return;
    const currentPref = getAutoArchiveSetting();
    if (currentPref === true) {
      // Auto-archive directly
      const existing = packagesRef.current.find(p => p.id === pkgId);
      if (existing) {
        commit({ type: MUTATION_TYPES.UPDATE, payload: { ...existing, isArchived: true, updatedAt: new Date().toISOString() } });
      }
    } else if (currentPref === null) {
      // First time reaching delivered without preference set
      const prompted = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.AUTO_ARCHIVE_PROMPTED) === 'true';
      if (!prompted) {
        openModal(MODAL.AUTO_ARCHIVE, { packageId: pkgId });
      }
    }
  }, [getAutoArchiveSetting, openModal, commit]);

  const handleConfirmAutoArchive = () => {
    if (user) {
      updateUserPreferences({
        ...(user.preferences || {}),
        autoArchiveDelivered: true
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEYS.AUTO_ARCHIVE_DELIVERED, 'true');
      } catch {}
    }
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_ARCHIVE_PROMPTED, 'true');
    } catch {}

    if (pendingDeliveredPkgId) {
      const existing = packagesRef.current.find(p => p.id === pendingDeliveredPkgId);
      if (existing) {
        commit({ type: MUTATION_TYPES.UPDATE, payload: { ...existing, isArchived: true, updatedAt: new Date().toISOString() } });
      }
    }
    closeModal(MODAL.AUTO_ARCHIVE);
    showToast(language === 'he' ? 'החבילה הועברה לארכיון וההגדרה נשמרה' : 'Package archived and preference saved', 'success');
  };

  const handleDeclineAutoArchive = () => {
    if (user) {
      updateUserPreferences({
        ...(user.preferences || {}),
        autoArchiveDelivered: false
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEYS.AUTO_ARCHIVE_DELIVERED, 'false');
      } catch {}
    }
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_ARCHIVE_PROMPTED, 'true');
    } catch {}

    closeModal(MODAL.AUTO_ARCHIVE);
  };

  // Handlers
  const handleAddOrUpdatePackage = (pkgData) => {
    // Check if updating by ID or matching duplicate tracking number
    let existingPkg = packages.find(p => p.id === pkgData.id);
    if (!existingPkg && pkgData.trackingNumber) {
      existingPkg = findPackageByTrackingNumber(packages, pkgData.trackingNumber);
    }

    const targetId = existingPkg ? existingPkg.id : (pkgData.id || `pkg-${Date.now()}`);
    const isNewlyDelivered = pkgData.status === "delivered" && existingPkg?.status !== "delivered";

    let changedPkg;
    if (existingPkg) {
      // Merge/enrich existing package data while preserving existing ID and history
      changedPkg = {
        ...existingPkg,
        ...pkgData,
        id: targetId,
        checkpoints: pkgData.checkpoints?.length ? pkgData.checkpoints : existingPkg.checkpoints,
        userId: user?.id || existingPkg.userId,
        updatedAt: new Date().toISOString()
      };
      commit({ type: MUTATION_TYPES.UPDATE, payload: changedPkg });
      showToast(language === "he" ? "החבילה עודכנה בהצלחה!" : "Package updated successfully!", "success");
    } else {
      changedPkg = {
        ...pkgData,
        id: targetId,
        userId: user?.id || undefined,
        createdAt: pkgData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      commit({ type: MUTATION_TYPES.ADD, payload: changedPkg });
      showToast(language === "he" ? "החבילה נוספה למעקב!" : "New package added to tracking!", "success");
    }

    setModalPayload(MODAL.DETAIL, (pkg) => (pkg?.id === targetId ? changedPkg : pkg));

    if (isNewlyDelivered) {
      checkAndHandleAutoArchive(targetId, true);
    }
  };

  const handleDeletePackage = (id) => {
    commit({ type: MUTATION_TYPES.DELETE, payload: { id } });
    if (selectedDetailPackage?.id === id) {
      closeModal(MODAL.DETAIL);
    }
    showToast(language === 'he' ? 'החבילה נמחקה' : 'Package deleted', 'info');
  };

  const handleTogglePin = useCallback((id) => {
    const updated = packagesRef.current.map(p => {
      if (p.id === id) {
        return { ...p, isPinned: !p.isPinned };
      }
      return p;
    });
    const changedPkg = updated.find(p => p.id === id);
    if (changedPkg) commit({ type: MUTATION_TYPES.UPDATE, payload: changedPkg });
  }, [commit]);

  const handleToggleArchive = useCallback((id) => {
    const updated = packagesRef.current.map(p => {
      if (p.id === id) {
        const nextArchived = !p.isArchived;
        showToast(
          nextArchived
            ? (language === 'he' ? 'החבילה הועברה לארכיון' : 'Package archived')
            : (language === 'he' ? 'החבילה הוחזרה מהארכיון' : 'Package unarchived'),
          'info'
        );
        return { ...p, isArchived: nextArchived };
      }
      return p;
    });
    const changedPkg = updated.find(p => p.id === id);
    if (changedPkg) commit({ type: MUTATION_TYPES.UPDATE, payload: changedPkg });
  }, [language, showToast, commit]);

  const handleStatusChange = useCallback((id, newStatus) => {
    const existingPkg = packagesRef.current.find(p => p.id === id);
    if (existingPkg && existingPkg.status !== newStatus && !deliveryService.canTransition(existingPkg.status, newStatus)) {
      showToast(
        language === 'he' ? 'מעבר סטטוס לא חוקי' : 'Invalid status transition',
        'error'
      );
      return;
    }
    const isNewlyDelivered = newStatus === 'delivered' && existingPkg?.status !== 'delivered';
    const changedPkg = { ...existingPkg, status: newStatus, updatedAt: new Date().toISOString() };
    
    commit({ type: MUTATION_TYPES.UPDATE, payload: changedPkg });
    setModalPayload(MODAL.DETAIL, (pkg) => (
      pkg?.id === id ? changedPkg : pkg
    ));

    if (isNewlyDelivered) {
      checkAndHandleAutoArchive(id, true);
    }
  }, [checkAndHandleAutoArchive, language, setModalPayload, showToast, commit]);

  // Display name for a carrier, in the active language.
  const carrierLabel = useCallback((pkg) => {
    const def = getCarrier(pkg?.carrier);
    if (def.id === 'other' && pkg?.carrierName) {
      return pkg.carrierName;
    }
    return language === 'he' ? (def.hebrewName || def.name) : def.name;
  }, [language]);

  const handleRefreshSinglePackage = useCallback(async (pkg) => {
    const res = await deliveryService.refreshPackageTracking(pkg, user?.id || null);

    // Lookup worked, but this carrier has no live feed. Say so plainly rather
    // than reporting a successful refresh that changed nothing.
    if (res.success && res.tracked === false) {
      const key = res.reason === 'carrier-unavailable'
        ? 'tracking.carrierUnavailable'
        : 'tracking.notSupported';
      showToast(t(key).replace('{carrier}', carrierLabel(pkg)), 'info');
      return;
    }

    if (res.success && res.updatedPackage) {
      commit({ type: MUTATION_TYPES.UPDATE, payload: res.updatedPackage });
      setModalPayload(MODAL.DETAIL, (open) => (open?.id === pkg.id ? res.updatedPackage : open));
      showToast(t('tracking.refreshSuccessSingle'), 'success');
    } else if (res.rateLimited) {
      showToast(res.error || t('card.rateLimited'), 'info');
    } else {
      showToast(res.error || 'Failed to refresh tracking', 'error');
    }
  }, [carrierLabel, setModalPayload, showToast, t, commit, user?.id]);

  // Passed straight into the memoized list components, so they must be
  // referentially stable — an inline arrow here re-rendered every card on
  // every keystroke.
  const handleOpenDetails = useCallback((p) => openModal(MODAL.DETAIL, p), [openModal]);
  const handleOpenLockerMode = useCallback((p) => openModal(MODAL.FULL_SCREEN_LOCKER, p), [openModal]);

  const handleEditFromList = useCallback(
    (p) => openModal(MODAL.ADD_EDIT, { editPackage: p }),
    [openModal]
  );

  const handleRequestDelete = useCallback(
    (id) => openModal(MODAL.DELETE_CONFIRM, { packageId: id }),
    [openModal]
  );

  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);

  const handleBatchRefreshAll = async () => {
    if (isBatchRefreshing || packages.length === 0) return;
    setIsBatchRefreshing(true);
    showToast(t('tracking.refreshingAll'), 'info');

    const { trackingService } = await import('./services/trackingService');
    const res = await trackingService.batchRefreshTracking(packages);

    if (res.updatedPackages && res.updatedPackages.length > 0) {
      commit({ type: 'UPDATE_ALL', payload: res.updatedPackages });
      setModalPayload(MODAL.DETAIL, (open) => (
        (open && res.updatedPackages.find(p => p.id === open.id)) || open
      ));
    }

    setIsBatchRefreshing(false);
    if (res.refreshedCount > 0) {
      showToast(t('tracking.refreshedSuccess').replace('{count}', String(res.refreshedCount)), 'success');
    } else if (res.rateLimitedCount > 0) {
      showToast(t('card.rateLimited'), 'info');
    } else if (res.untrackedCount > 0) {
      showToast(t('tracking.untrackedBatch').replace('{count}', String(res.untrackedCount)), 'info');
    } else {
      showToast(t('tracking.refreshSuccessSingle'), 'info');
    }
  };

  const handleSmartImportResult = (parsedData) => {
    openModal(MODAL.ADD_EDIT, { initialValues: parsedData });
  };

  const handleExportData = () => {
    deliveryService.exportData(packages);
    showToast(t('backup.exported'), 'success');
  };

  const handleImportData = (jsonString) => {
    // Scoped to the signed-in user. Without this the restore lands in the
    // guest partition (deliveree_packages_guest) no matter who is signed in —
    // deliveryService.importData defaults userId to null. The service half of
    // this fix shipped in #67; this is the call site it needed.
    const res = deliveryService.importData(jsonString, user?.id || null);
    if (res.success) {
      commit({ type: 'UPDATE_ALL', payload: res.packages });
      showToast(t('backup.imported'), 'success');
    } else {
      showToast(res.error || 'Failed to import', 'error');
    }
  };

  const handleResetData = () => {
    if (isDemoMode) {
      if (window.confirm(t('backup.resetConfirm'))) {
        const demo = deliveryService.resetToDemo(user?.id || null);
        commit({ type: 'UPDATE_ALL', payload: demo });
        showToast(t('backup.resetDone'), 'success');
      }
    } else {
      if (window.confirm(t('backup.clearAllDeliveriesConfirm'))) {
        const cleared = deliveryService.clearUserPackages(user?.id || null);
        commit({ type: 'UPDATE_ALL', payload: cleared });
        showToast(t('backup.clearedDone'), 'info');
      }
    }
  };

  const handleLaunchDemoMode = () => {
    startDemoMode();
    showToast(language === 'he' ? 'הופעל מצב הדגמה חי' : 'Demo mode loaded with sample packages', 'info');
  };

  // Filter & Sort Logic (Optimized ISO date comparison without new Date() churn)
  // The KPI row only ever counts live packages. Allocating this inline in the
  // JSX handed StatsCards a brand-new array on every render, defeating memo.
  const nonArchivedPackages = useMemo(
    () => packages.filter(p => !p.isArchived),
    [packages]
  );

  // A keystroke that does not change *which* packages match still produced a
  // brand-new array from the memo below, and a new array is a new prop for the
  // memoized PackageTable. This cache hands back the previous array whenever
  // the result is element-for-element identical, so the table only re-renders
  // when the list really changed.
  const lastFilteredRef = useRef([]);

  /**
   * Ambient mood — one derived value that tints the app chrome (header wash,
   * header hairline, app mark, bottom-nav hairline) and nothing else.
   *
   * Derived from the FULL list, not `filteredPackages`: a customs hold you
   * have filtered out of view is still a customs hold, and the whole point is
   * that the surface reports your actual situation rather than your current
   * filter. Recomputed only when packages change — it must not re-run on
   * every keystroke in the search box.
   */
  const ambientMood = useMemo(() => deriveMood(packages), [packages]);

  const filteredPackages = useMemo(() => {
    // Normalised once for the whole pass, not once per package per keystroke.
    const q = searchQuery.trim().toLowerCase();

    const next = packages.filter((pkg) => {
      if (q) {
        const matchesTitle = pkg.title?.toLowerCase().includes(q) || pkg.titleHe?.toLowerCase().includes(q);
        const matchesTrack = pkg.trackingNumber?.toLowerCase().includes(q);
        const matchesCarrier = pkg.carrier?.toLowerCase().includes(q) || pkg.carrierName?.toLowerCase().includes(q);
        const matchesNotes = pkg.notes?.toLowerCase().includes(q) || pkg.notesHe?.toLowerCase().includes(q);
        const matchesDest = pkg.destination?.toLowerCase().includes(q);

        if (!matchesTitle && !matchesTrack && !matchesCarrier && !matchesNotes && !matchesDest) {
          return false;
        }
      }

      if (selectedCarrier !== 'all' && pkg.carrier !== selectedCarrier) {
        return false;
      }

      // `archived` is a flag, not a status, so it is the one bucket that is
      // not in the predicate table.
      if (activeTab === ARCHIVED_TAB) {
        return pkg.isArchived;
      }

      if (pkg.isArchived) {
        return false;
      }

      // Every other bucket is one lookup in the shared table (the same one the
      // FilterBar and StatsCards counters use). An unrecognised tab id — they
      // can arrive from the ?tab= shortcut param — shows everything, as before.
      const predicate = getTabPredicate(activeTab);
      return predicate ? predicate(pkg) : true;
    }).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (sortBy === 'newest') {
        const timeA = a.createdAt || '';
        const timeB = b.createdAt || '';
        return timeB.localeCompare(timeA);
      }
      if (sortBy === 'expected') {
        if (!a.expectedDeliveryDate) return 1;
        if (!b.expectedDeliveryDate) return -1;
        return a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate);
      }
      if (sortBy === 'title') {
        const titleA = language === 'he' ? (a.titleHe || a.title) : a.title;
        const titleB = language === 'he' ? (b.titleHe || b.title) : b.title;
        return (titleA || '').localeCompare(titleB || '');
      }
      if (sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0;
    });

    const prev = lastFilteredRef.current;
    if (prev.length === next.length && prev.every((pkg, i) => pkg === next[i])) {
      return prev;
    }
    lastFilteredRef.current = next;
    return next;
  }, [packages, searchQuery, selectedCarrier, activeTab, sortBy, language]);

  /**
   * The modal registry. Order is render order, and because <Modal> portals
   * every dialog to document.body in that order, it is also the stacking
   * order for two dialogs open at once (Locker Map over Package Details,
   * Export over Account). It matches the order these blocks were written in
   * before, so the existing pairs stack exactly as they did.
   */
  const MODALS = [
    {
      id: MODAL.ADD_EDIT,
      componentName: 'AddEditPackageModal',
      render: (isOpen, payload) => (
        <AddEditPackageModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.ADD_EDIT)}
          onSave={handleAddOrUpdatePackage}
          editPackage={payload?.editPackage ?? null}
          initialValues={payload?.initialValues ?? null}
          packages={packages}
          onOpenExisting={(pkg) => openModal(MODAL.DETAIL, pkg)}
        />
      )
    },
    {
      id: MODAL.SMART_IMPORT,
      componentName: 'SmartImportModal',
      render: (isOpen, payload) => (
        <SmartImportModal
          isOpen={isOpen}
          initialText={payload?.initialText ?? ''}
          onClose={() => closeModal(MODAL.SMART_IMPORT)}
          onParsedResult={handleSmartImportResult}
          onShowToast={showToast}
          uid={user?.id}
          onSwitchToManual={(rawText) => {
            closeModal(MODAL.SMART_IMPORT);
            openModal(MODAL.ADD_EDIT, {
              initialValues: rawText?.trim() ? { notes: rawText.trim() } : null
            });
          }}
        />
      )
    },
    {
      id: MODAL.DETAIL,
      componentName: 'PackageDetailModal',
      render: (isOpen, payload) => {
        const livePkg = packages.find((p) => p.id === (payload?.id || payload)) || payload;
        return (
          <PackageDetailModal
            pkg={livePkg}
            packages={packages}
            isOpen={isOpen && !!livePkg}
            onClose={() => closeModal(MODAL.DETAIL)}
            onEdit={(p) => openModal(MODAL.ADD_EDIT, { editPackage: p })}
            onDelete={handleRequestDelete}
            onUpdatePackage={handleAddOrUpdatePackage}
            onStatusChange={handleStatusChange}
            onRefreshTracking={handleRefreshSinglePackage}
            onOpenLockerMap={() => openModal(MODAL.LOCKER_MAP)}
            onOpenLockerMode={(p) => openModal(MODAL.FULL_SCREEN_LOCKER, p)}
            onOpenNavigation={(target) => openModal(MODAL.NAVIGATION_CHOICE, target)}
            onSelectPackage={(p) => openModal(MODAL.DETAIL, p)}
            onShowToast={showToast}
          />
        );
      }
    },
    {
      id: MODAL.ANALYTICS,
      componentName: 'AnalyticsModal',
      render: (isOpen) => (
        <AnalyticsModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.ANALYTICS)}
          packages={packages}
          uid={user?.id}
        />
      )
    },
    {
      id: MODAL.INGESTION_GUIDE,
      componentName: 'IngestionGuideModal',
      render: (isOpen) => (
        <IngestionGuideModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.INGESTION_GUIDE)}
          onOpenSmartImport={() => openModal(MODAL.SMART_IMPORT)}
          onShowToast={showToast}
        />
      )
    },
    {
      id: MODAL.AUTH,
      componentName: 'AuthModal',
      render: (isOpen, payload) => (
        <AuthModal
          isOpen={isOpen}
          initialMode={payload?.initialMode ?? 'signin'}
          onClose={() => closeModal(MODAL.AUTH)}
          onShowToast={showToast}
        />
      )
    },
    {
      id: MODAL.ACCOUNT,
      componentName: 'AccountModal',
      render: (isOpen, payload) => (
        <AccountModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.ACCOUNT)}
          initialTab={payload?.initialTab ?? 'profile'}
          packages={packages}
          onExportData={handleExportData}
          onOpenExport={() => openModal(MODAL.EXPORT)}
          onOpenAuth={() => openModal(MODAL.AUTH, { initialMode: 'signin' })}
          onShowToast={showToast}
        />
      )
    },
    {
      id: MODAL.EXPORT,
      componentName: 'ExportModal',
      render: (isOpen) => (
        <ExportModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.EXPORT)}
          packages={packages}
          onShowToast={showToast}
          uid={user?.id}
        />
      )
    },
    {
      id: MODAL.LOCKER_MAP,
      componentName: 'LockerMapModal',
      render: (isOpen) => (
        <LockerMapModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.LOCKER_MAP)}
          onOpenNavigation={(target) => openModal(MODAL.NAVIGATION_CHOICE, target)}
          onShowToast={showToast}
        />
      )
    },
    {
      id: MODAL.ACTIVITY,
      componentName: 'ActivityModal',
      render: (isOpen) => (
        <ActivityModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.ACTIVITY)}
          packages={packages}
          onOpenPackage={(id) => {
            const target = packages.find((p) => p.id === id);
            if (target) handleOpenDetails(target);
          }}
        />
      )
    },
    {
      id: MODAL.NAVIGATION_CHOICE,
      componentName: 'NavigationChoiceModal',
      render: (isOpen, payload) => (
        <NavigationChoiceModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.NAVIGATION_CHOICE)}
          location={payload?.location || ''}
          lat={payload?.lat ?? null}
          lng={payload?.lng ?? null}
          title={payload?.title || ''}
          onShowToast={showToast}
        />
      )
    },
    {
      id: MODAL.FULL_SCREEN_LOCKER,
      componentName: 'FullScreenLockerModal',
      render: (isOpen, payload) => {
        const livePkg = packages.find((p) => p.id === (payload?.id || payload)) || payload;
        return (
          <FullScreenLockerModal
            isOpen={isOpen && !!livePkg}
            pkg={livePkg}
            packages={packages}
            onClose={() => closeModal(MODAL.FULL_SCREEN_LOCKER)}
            onMarkDelivered={handleStatusChange}
            onOpenNavigation={(target) => openModal(MODAL.NAVIGATION_CHOICE, target)}
            onShowToast={showToast}
          />
        );
      }
    },
    {
      id: MODAL.ABOUT,
      componentName: 'AboutModal',
      render: (isOpen) => (
        <AboutModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.ABOUT)}
          onOpenFeedback={() => {
            closeModal(MODAL.ABOUT);
            openModal(MODAL.FEEDBACK);
          }}
          onShowToast={showToast}
        />
      )
    },
    {
      id: MODAL.FEEDBACK,
      componentName: 'FeedbackModal',
      render: (isOpen) => (
        <FeedbackModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.FEEDBACK)}
          onShowToast={showToast}
        />
      )
    },
    {
      id: MODAL.ADMIN_FEEDBACK,
      componentName: 'AdminFeedbackModal',
      render: (isOpen) => (
        <AdminFeedbackModal
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.ADMIN_FEEDBACK)}
          onShowToast={showToast}
        />
      )
    },
    {
      id: MODAL.AUTO_ARCHIVE,
      componentName: 'AutoArchivePromptModal',
      render: (isOpen) => (
        <AutoArchivePromptModal
          isOpen={isOpen}
          onConfirm={handleConfirmAutoArchive}
          onDecline={handleDeclineAutoArchive}
        />
      )
    },
    {
      id: MODAL.DELETE_CONFIRM,
      componentName: 'DeleteConfirmDialog',
      render: (isOpen, payload) => (
        <DeleteConfirmDialog
          isOpen={isOpen}
          onClose={() => closeModal(MODAL.DELETE_CONFIRM)}
          onConfirm={() => {
            if (payload?.packageId) handleDeletePackage(payload.packageId);
          }}
        />
      )
    }
  ];

  return (
    <div
      data-active-modal={activeModal || undefined}
      data-mood={ambientMood}
      className="relative chrome-wash min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-200"
    >
      {/* Demo Banner indicator when in Demo Mode */}
      {isDemoMode && !user && (
        <div className="bg-gradient-to-r from-indigo-900/90 to-blue-900/90 border-b border-indigo-500/30 px-4 py-2.5 text-center text-xs font-semibold text-indigo-200 flex items-center justify-center gap-2">
          <PlayCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{isRTL ? 'אתה צופה בגרסת הדגמה חיה (?demo=true)' : 'You are viewing the Interactive Demo (?demo=true)'}</span>
          <button 
            onClick={() => openModal(MODAL.AUTH, { initialMode: 'signin' })}
            className="underline ms-2 text-white hover:text-blue-300 cursor-pointer font-bold"
          >
            {isRTL ? 'התחבר לחשבון אמיתי' : 'Sign in to use real tracking'}
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        isDemoMode={isDemoMode}
        activeModal={activeModal}
        onGoToTab={goToTab}
        onOpenAddModal={() => openModal(MODAL.ADD_EDIT)}
        onOpenSmartImport={() => openModal(MODAL.SMART_IMPORT)}
        onOpenAnalytics={() => openModal(MODAL.ANALYTICS)}
        onOpenConnectModal={() => openModal(MODAL.INGESTION_GUIDE)}
        onOpenAuth={() => {
          if (user) {
            openModal(MODAL.ACCOUNT, { initialTab: 'profile' });
          } else {
            openModal(MODAL.AUTH, { initialMode: 'signin' });
          }
        }}
        onOpenSettings={() => openModal(MODAL.ACCOUNT, { initialTab: 'preferences' })}
        onOpenAbout={() => openModal(MODAL.ABOUT)}
        onOpenFeedback={() => openModal(MODAL.FEEDBACK)}
        onOpenAdminFeedback={isAdminUser(user) ? () => openModal(MODAL.ADMIN_FEEDBACK) : undefined}
        onOpenExport={() => openModal(MODAL.EXPORT)}
        onOpenLockerMap={() => openModal(MODAL.LOCKER_MAP)}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onResetData={handleResetData}
        onShowToast={showToast}
      />


      {/* Main Container */}
      {/* `relative` with NO z-index on purpose. It only needs to paint above
          .chrome-wash::before (z-0), and being later in DOM order already does
          that. Adding `z-10` here created a stacking context that trapped
          everything inside it — the package row menu's z-50 could then never
          rise above the install banner or the bottom nav at z-40, so the menu
          opened underneath them.

          pb clears the fixed bottom tab bar (BottomNav) plus the home
          indicator inset; the bar is lg:hidden, so the padding is too. */}
      <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
        {loading && !user ? (
          /* SLEEK INITIAL COLD-START SKELETON / LOADING STATE */
          <div className="max-w-2xl mx-auto my-12 p-8 sm:p-12 bg-slate-900/40 border border-slate-800/60 rounded-3xl backdrop-blur-xl text-center flex flex-col items-center justify-center animate-pulse">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-blue-600/30 to-indigo-500/30 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-6 shadow-xl">
              <RefreshCw className="w-8 h-8 sm:w-10 sm:h-10 animate-spin" />
            </div>
            <div className="h-6 w-48 bg-slate-800 rounded-xl mb-3" />
            <div className="h-4 w-72 bg-slate-800/60 rounded-lg" />
          </div>
        ) : !user && !isDemoMode ? (
          /* GUEST / NEW USER WELCOME ONBOARDING GATE */
          <div className="max-w-2xl mx-auto my-6 sm:my-12 p-6 sm:p-10 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-2xl text-center animate-in fade-in slide-in-from-bottom-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/30">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              {isRTL ? `ברוכים הבאים ל-${APP_NAME}` : `Welcome to ${APP_NAME}`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mb-8 leading-relaxed">
              {isRTL 
                ? 'מעקב חכם אחר כל החבילות והמשלוחים שלך בישראל ובעולם עם סנכרון ענן אוטומטי.'
                : 'Smart tracking for all your shipments and deliveries with automatic real-time cloud sync.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto mb-8">
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-start flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-300 font-medium">
                  {isRTL ? 'סנכרון ענן מאובטח' : 'Zero-Trust Cloud Sync'}
                </span>
              </div>
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-start flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                <span className="text-xs text-slate-300 font-medium">
                  {isRTL ? 'זיהוי SMS וספקים אוטומטי' : 'Carrier Auto-Detection'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto mb-4">
              <button
                onClick={() => openModal(MODAL.AUTH, { initialMode: 'signin' })}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <LogIn className="w-4 h-4" />
                <span>{isRTL ? 'התחבר לחשבון שלך' : 'Sign In to Your Account'}</span>
              </button>
              <button
                onClick={() => openModal(MODAL.AUTH, { initialMode: 'register' })}
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span>{isRTL ? 'יצירת חשבון חדש' : 'Create New Account'}</span>
              </button>
            </div>

            {/* Direct Demo Trigger for testing without sign in */}
            <div className="pt-4 border-t border-slate-800/80">
              <button
                onClick={handleLaunchDemoMode}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer p-2 min-h-[48px]"
              >
                {isRTL ? 'או צפה בהדגמה אינטראקטיבית עם חבילות לדוגמה' : 'Or explore the interactive demo with mock packages'}
              </button>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED OR DEMO-MODE DASHBOARD */
          <>
            {/* Metric Cards */}
            <StatsCards
              packages={nonArchivedPackages}
              activeFilter={activeTab}
              onSelectFilter={setActiveTab}
            />

            {/* Filter & View Controls */}
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              selectedCarrier={selectedCarrier}
              onCarrierChange={setSelectedCarrier}
              sortBy={sortBy}
              onSortChange={setSortBy}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onRefreshAll={handleBatchRefreshAll}
              isRefreshing={isBatchRefreshing}
              packages={packages}
            />

            {/* Package Content List / Table */}
            {filteredPackages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/40 border border-slate-800 rounded-3xl text-center backdrop-blur-xl animate-fade-in my-4">
                <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
                  <Inbox className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-200 mb-1">
                  {t('filters.noPackages')}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mb-6">
                  {searchQuery || selectedCarrier !== 'all' || activeTab !== 'all'
                    ? (language === 'he' ? 'נסה לשנות את הסינון או מונחי החיפוש' : 'Try adjusting your search or active filters')
                    : (language === 'he' ? 'אין עדיין חבילות במעקב. הוסף חבילה ראשונה!' : 'No packages tracked yet. Add your first delivery!')}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCarrier('all');
                      setActiveTab('all');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer min-h-[48px]"
                  >
                    {t('filters.clearFilters')}
                  </button>
                  <button
                    onClick={() => openModal(MODAL.SMART_IMPORT)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[48px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('addPackage')}</span>
                  </button>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5 animate-fade-in">
                {/* auto-fit (not auto-fill) collapses unused column tracks to
                    0fr, so a handful of cards stretch to fill the row
                    instead of leaving a wide empty gap next to a fixed grid. */}
                {filteredPackages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    packages={packages}
                    onOpenDetails={handleOpenDetails}
                    onEdit={handleEditFromList}
                    onDelete={handleRequestDelete}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                    onStatusChange={handleStatusChange}
                    onRefreshTracking={handleRefreshSinglePackage}
                    onOpenLockerMode={handleOpenLockerMode}
                    onShowToast={showToast}
                  />
                ))}
              </div>
            ) : (
              <div className="animate-fade-in">
                <PackageTable
                  packages={filteredPackages}
                  onOpenDetails={handleOpenDetails}
                  onEdit={handleEditFromList}
                  onDelete={handleRequestDelete}
                  onTogglePin={handleTogglePin}
                  onStatusChange={handleStatusChange}
                  onShowToast={showToast}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Alpha Feedback Button.
          It sat at z-30, bottom-5 — directly behind the bottom tab bar
          (z-[60]) — so on a phone it had been completely invisible since the
          bar landed. During alpha this is the app's only channel for hearing
          about anything broken, so it needs to actually be on screen: above
          the bar, clear of the safe-area inset, and on the opposite edge from
          the centre FAB so the two do not compete. */}
      <aside
        aria-label={language === 'he' ? 'משוב אלפא' : 'Alpha feedback'}
        className="fixed z-[61] end-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-5 lg:end-5"
      >
        <button
          onClick={() => openModal(MODAL.FEEDBACK)}
          className="flex items-center gap-2 px-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/40 transition-colors cursor-pointer min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus:outline-none"
          title={language === 'he' ? 'משוב ודיווח תקלות' : 'Feedback & Bug Report'}
        >
          <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
          <span>{language === 'he' ? 'משוב' : 'Feedback'}</span>
        </button>
      </aside>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 bg-slate-950/60 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>{APP_COPYRIGHT} • {t('appTagline')}</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Supports Israel Post, AliExpress, 4PX, DHL, FedEx, UPS & Yanwen</span>
          </div>
        </div>
      </footer>

      {/* Every dialog, declared once. The shell (portal, backdrop, Escape,
          focus trap, focus restore, scroll lock, ARIA) lives in <Modal>;
          the crash boundary that used to be copied around thirteen of these
          blocks now appears exactly once, below. */}
      {MODALS.map(({ id, componentName, render }) => {
        const isOpen = isModalOpen(id);
        if (isOpen) everOpenedRef.current.add(id);
        // Never opened: render nothing at all, so its chunk is never fetched.
        if (!isOpen && !everOpenedRef.current.has(id)) return null;

        return (
          <ErrorBoundary
            key={id}
            compact
            componentName={componentName}
            onReset={() => closeModal(id)}
          >
            {/* Suspense sits *inside* the boundary, so a chunk that fails to
                download (offline, a stale hashed filename after a deploy)
                throws into the same ErrorBoundary #66 established rather than
                past it — the lazy edge widens that coverage instead of
                bypassing it. The fallback is a backdrop and a spinner, not an
                empty modal shell: the shell would re-lay-out the moment the
                content arrived. It is suppressed while the dialog is closed,
                where there is nothing to wait for. */}
            <Suspense fallback={isOpen ? <ModalLoadingFallback /> : null}>
              {render(isOpen, getModalPayload(id))}
            </Suspense>
          </ErrorBoundary>
        );
      })}

      {/* Blocking gate for any signed-in user who hasn't accepted the
          current Terms of Use / Privacy Policy version — new OAuth
          sign-ins and pre-existing accounts alike. Renders null otherwise.
          Not part of the router: nothing opens or closes it. */}
      <ErrorBoundary compact componentName="LegalConsentGate">
        <LegalConsentGate onShowToast={showToast} />
      </ErrorBoundary>

      {/* PWA Floating Update Available Banner */}
      {isUpdateAvailable && (
        <aside aria-label="App Update Ready" className="fixed top-18 left-1/2 -translate-x-1/2 z-50 animate-bounce-subtle">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-2xl border border-blue-400/30 backdrop-blur-xl">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
            <span>{isRTL ? `גרסה חדשה של ${APP_NAME} זמינה!` : `A new version of ${APP_NAME} is ready!`}</span>
            <button
              onClick={handleApplyUpdate}
              className="px-3 py-1 rounded-xl bg-white text-blue-600 font-bold hover:bg-blue-50 transition-colors cursor-pointer"
            >
              {isRTL ? 'רענן כעת' : 'Update Now'}
            </button>
          </div>
        </aside>
      )}

      {/* Floating PWA Installation Banner */}
      <InstallPwaBanner />

      {/* Floating Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <DashboardContent />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
