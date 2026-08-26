import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Inbox, ShieldCheck, Sparkles, LogIn, UserPlus, PlayCircle, MessageSquarePlus, RefreshCw } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { FilterBar } from './components/FilterBar';
import { PackageCard } from './components/PackageCard';
import { PackageTable } from './components/PackageTable';
import { PackageDetailModal } from './components/PackageDetailModal';
import { AddEditPackageModal } from './components/AddEditPackageModal';
import { SmartImportModal } from './components/SmartImportModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { IngestionGuideModal } from './components/IngestionGuideModal';
import { AuthModal } from './components/AuthModal';
import { LegalConsentGate } from './components/LegalConsentGate';
import { AccountModal } from './components/AccountModal';
import { AboutModal } from './components/AboutModal';
import { FeedbackModal } from './components/FeedbackModal';
import { AdminFeedbackModal } from './components/AdminFeedbackModal';
import { ExportModal } from './components/ExportModal';
import { LockerMapModal } from './components/LockerMapModal';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { AutoArchivePromptModal } from './components/AutoArchivePromptModal';
import { findPackageByTrackingNumber } from './services/deliveryService';

import { Toast } from './components/Toast';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { deliveryService } from './services/deliveryService';
import { useLanguage, LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth, AuthProvider } from './context/AuthContext';
import { isAdminUser } from './constants/admin';
import { CARRIERS } from './types/carriers';

import { ErrorBoundary } from './components/ErrorBoundary';
import { usePackages } from './hooks/usePackages';

export function DashboardContent() {

  const { t, language, isRTL } = useLanguage();
  const { user, loading, triggerCloudSync } = useAuth();

  const {
    packages,
    setPackages,
    isDemoMode,
    startDemoMode,
    updatePackagesState,
    upsertSinglePackage,
    removeSinglePackage,
    saveError,
    clearSaveError
  } = usePackages(user, triggerCloudSync);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');

  // Modals & Active Elements
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editPackage, setEditPackage] = useState(null);
  const [smartPrefill, setSmartPrefill] = useState(null);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [selectedDetailPackage, setSelectedDetailPackage] = useState(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState('signin');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [accountInitialTab, setAccountInitialTab] = useState('profile');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isAdminFeedbackOpen, setIsAdminFeedbackOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLockerMapOpen, setIsLockerMapOpen] = useState(false);
  const [deletePackageId, setDeletePackageId] = useState(null);
  const [isAutoArchivePromptOpen, setIsAutoArchivePromptOpen] = useState(false);
  const [pendingDeliveredPkgId, setPendingDeliveredPkgId] = useState(null);

  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [smartImportInitialText, setSmartImportInitialText] = useState('');

  // Handle PWA App Shortcuts, Web Share Target & Query Parameters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;

      // 1. App Shortcut: ?action=paste
      const action = params.get('action');
      if (action === 'paste') {
        setIsSmartImportOpen(true);
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
          setSmartImportInitialText(combinedSharedText);
          setIsSmartImportOpen(true);
        }
      }

      // 4. Notification routing parameter: ?packageId=...
      const pkgIdParam = params.get('packageId');
      if (pkgIdParam) {
        const found = packages.find(p => p.id === pkgIdParam || p.trackingNumber === pkgIdParam);
        if (found) {
          setSelectedDetailPackage(found);
        }
      }

      // Clean up share/action query params from URL without reload
      if (action || tabParam || shareTitle || shareText || shareUrl || pkgIdParam) {
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete('action');
        cleanParams.delete('title');
        cleanParams.delete('text');
        cleanParams.delete('url');
        cleanParams.delete('packageId');
        
        const cleanQuery = cleanParams.toString();
        const newUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    } catch (e) {
      console.warn('[App] Failed to parse URL parameters:', e);
    }
  }, [packages]);

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

  // Toast notifications
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = (message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3500);
  };

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
  const getAutoArchiveSetting = () => {
    if (user?.preferences && typeof user.preferences.autoArchiveDelivered === 'boolean') {
      return user.preferences.autoArchiveDelivered;
    }
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem('deliveree_auto_archive_delivered');
      if (val === 'true') return true;
      if (val === 'false') return false;
    }
    return null; // not decided yet
  };

  const checkAndHandleAutoArchive = (pkgId, isNewlyDelivered) => {
    if (!isNewlyDelivered) return;
    const currentPref = getAutoArchiveSetting();
    if (currentPref === true) {
      // Auto-archive directly
      setPackages(prev => {
        const updated = prev.map(p => p.id === pkgId ? { ...p, isArchived: true } : p);
        const changed = updated.find(p => p.id === pkgId);
        if (changed) upsertSinglePackage(updated, changed);
        return updated;
      });
    } else if (currentPref === null) {
      // First time reaching delivered without preference set
      const prompted = typeof localStorage !== 'undefined' && localStorage.getItem('deliveree_auto_archive_prompted') === 'true';
      if (!prompted) {
        setPendingDeliveredPkgId(pkgId);
        setIsAutoArchivePromptOpen(true);
      }
    }
  };

  const handleConfirmAutoArchive = () => {
    if (user) {
      updateUserPreferences({
        ...(user.preferences || {}),
        autoArchiveDelivered: true
      });
    } else {
      try {
        localStorage.setItem('deliveree_auto_archive_delivered', 'true');
      } catch {}
    }
    try {
      localStorage.setItem('deliveree_auto_archive_prompted', 'true');
    } catch {}

    if (pendingDeliveredPkgId) {
      setPackages(prev => {
        const updated = prev.map(p => p.id === pendingDeliveredPkgId ? { ...p, isArchived: true } : p);
        const changed = updated.find(p => p.id === pendingDeliveredPkgId);
        if (changed) upsertSinglePackage(updated, changed);
        return updated;
      });
    }
    setIsAutoArchivePromptOpen(false);
    setPendingDeliveredPkgId(null);
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
        localStorage.setItem('deliveree_auto_archive_delivered', 'false');
      } catch {}
    }
    try {
      localStorage.setItem('deliveree_auto_archive_prompted', 'true');
    } catch {}

    setIsAutoArchivePromptOpen(false);
    setPendingDeliveredPkgId(null);
  };

  // Handlers
  const handleAddOrUpdatePackage = (pkgData) => {
    let updated;
    // Check if updating by ID or matching duplicate tracking number
    let existingPkg = packages.find(p => p.id === pkgData.id);
    if (!existingPkg && pkgData.trackingNumber) {
      existingPkg = findPackageByTrackingNumber(packages, pkgData.trackingNumber);
    }

    const targetId = existingPkg ? existingPkg.id : (pkgData.id || `pkg-${Date.now()}`);
    const isNewlyDelivered = pkgData.status === "delivered" && existingPkg?.status !== "delivered";

    if (existingPkg) {
      if (pkgData.status && pkgData.status !== existingPkg.status && !deliveryService.canTransition(existingPkg.status, pkgData.status)) {
        showToast(
          language === "he"
            ? `מעבר לא חוקי מ-${existingPkg.status} אל ${pkgData.status}`
            : `Invalid state transition from ${existingPkg.status} to ${pkgData.status}`,
          "error"
        );
        return;
      }
      // Merge/enrich existing package data while preserving existing ID and history
      const mergedPkg = {
        ...existingPkg,
        ...pkgData,
        id: targetId,
        checkpoints: pkgData.checkpoints?.length ? pkgData.checkpoints : existingPkg.checkpoints,
        userId: user?.id || existingPkg.userId,
        updatedAt: new Date().toISOString()
      };
      updated = packages.map(p => (p.id === targetId ? mergedPkg : p));
      showToast(language === "he" ? "החבילה עודכנה בהצלחה!" : "Package updated successfully!", "success");
    } else {
      const newPkgWithUser = {
        ...pkgData,
        id: targetId,
        userId: user?.id || undefined,
        createdAt: pkgData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updated = [newPkgWithUser, ...packages];
      showToast(language === "he" ? "החבילה נוספה למעקב!" : "New package added to tracking!", "success");
    }

    const changedPkg = updated.find(p => p.id === targetId);
    upsertSinglePackage(updated, changedPkg);

    if (selectedDetailPackage?.id === targetId) {
      setSelectedDetailPackage(changedPkg);
    }
    setEditPackage(null);
    setSmartPrefill(null);

    if (isNewlyDelivered) {
      checkAndHandleAutoArchive(targetId, true);
    }
  };

  const handleDeletePackage = (id) => {
    const updated = packages.filter(p => p.id !== id);
    removeSinglePackage(updated, id);
    if (selectedDetailPackage?.id === id) {
      setSelectedDetailPackage(null);
    }
    showToast(language === 'he' ? 'החבילה נמחקה' : 'Package deleted', 'info');
  };

  const handleTogglePin = (id) => {
    const updated = packages.map(p => {
      if (p.id === id) {
        return { ...p, isPinned: !p.isPinned };
      }
      return p;
    });
    const changedPkg = updated.find(p => p.id === id);
    if (changedPkg) upsertSinglePackage(updated, changedPkg);
  };

  const handleToggleArchive = (id) => {
    const updated = packages.map(p => {
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
    if (changedPkg) upsertSinglePackage(updated, changedPkg);
  };

  const handleStatusChange = (id, newStatus) => {
    const existingPkg = packages.find(p => p.id === id);
    if (existingPkg && existingPkg.status !== newStatus && !deliveryService.canTransition(existingPkg.status, newStatus)) {
      showToast(
        language === "he"
          ? `מעבר לא חוקי מ-${existingPkg.status} אל ${newStatus}`
          : `Invalid state transition from ${existingPkg.status} to ${newStatus}`,
        "error"
      );
      return;
    }

    const isNewlyDelivered = newStatus === "delivered" && existingPkg?.status !== "delivered";

    const updated = packages.map(p => {
      if (p.id === id) {
        return { ...p, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    const changedPkg = updated.find(p => p.id === id);
    if (changedPkg) upsertSinglePackage(updated, changedPkg);
    if (selectedDetailPackage?.id === id) {
      setSelectedDetailPackage(prev => ({ ...prev, status: newStatus, updatedAt: new Date().toISOString() }));
    }

    if (isNewlyDelivered) {
      checkAndHandleAutoArchive(id, true);
    }
  };

  // Display name for a carrier, in the active language.
  const carrierLabel = (pkg) => {
    const def = CARRIERS[pkg?.carrier];
    if (!def) return pkg?.carrierName || pkg?.carrier || '';
    return language === 'he' ? (def.hebrewName || def.name) : def.name;
  };

  const handleRefreshSinglePackage = async (pkg) => {
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
      const updatedList = packages.map(p => (p.id === pkg.id ? res.updatedPackage : p));
      upsertSinglePackage(updatedList, res.updatedPackage);
      if (selectedDetailPackage?.id === pkg.id) {
        setSelectedDetailPackage(res.updatedPackage);
      }
      showToast(t('tracking.refreshSuccessSingle'), 'success');
    } else if (res.rateLimited) {
      showToast(res.error || t('card.rateLimited'), 'info');
    } else {
      showToast(res.error || 'Failed to refresh tracking', 'error');
    }
  };

  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);

  const handleBatchRefreshAll = async () => {
    if (isBatchRefreshing || packages.length === 0) return;
    setIsBatchRefreshing(true);
    showToast(t('tracking.refreshingAll'), 'info');

    const { trackingService } = await import('./services/trackingService');
    const res = await trackingService.batchRefreshTracking(packages);

    if (res.updatedPackages && res.updatedPackages.length > 0) {
      updatePackagesState(res.updatedPackages);
      if (selectedDetailPackage) {
        const updatedDetail = res.updatedPackages.find(p => p.id === selectedDetailPackage.id);
        if (updatedDetail) setSelectedDetailPackage(updatedDetail);
      }
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
    setSmartPrefill(parsedData);
    setIsAddModalOpen(true);
  };

  const handleExportData = () => {
    deliveryService.exportData(packages);
    showToast(t('backup.exported'), 'success');
  };

  const handleImportData = (jsonString) => {
    const res = deliveryService.importData(jsonString);
    if (res.success) {
      updatePackagesState(res.packages);
      showToast(t('backup.imported'), 'success');
    } else {
      showToast(res.error || 'Failed to import', 'error');
    }
  };

  const handleResetData = () => {
    if (isDemoMode) {
      if (window.confirm(t('backup.resetConfirm'))) {
        const demo = deliveryService.resetToDemo(user?.id || null);
        setPackages(demo);
        showToast(t('backup.resetDone'), 'success');
      }
    } else {
      if (window.confirm(t('backup.clearAllDeliveriesConfirm'))) {
        const cleared = deliveryService.clearUserPackages(user?.id || null);
        setPackages(cleared);
        triggerCloudSync();
        showToast(t('backup.clearedDone'), 'info');
      }
    }
  };

  const handleLaunchDemoMode = () => {
    startDemoMode();
    showToast(language === 'he' ? 'הופעל מצב הדגמה חי' : 'Demo mode loaded with sample packages', 'info');
  };

  // Filter & Sort Logic (Optimized ISO date comparison without new Date() churn)
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
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

      if (activeTab === 'archived') {
        return pkg.isArchived;
      }

      if (pkg.isArchived) {
        return false;
      }

      if (activeTab === 'all') return true;
      if (activeTab === 'active') return pkg.status !== 'delivered';
      if (activeTab === 'transit') return pkg.status !== 'delivered' && pkg.status !== 'customs' && pkg.status !== 'exception';
      if (activeTab === 'in_transit') return pkg.status === 'in_transit' || pkg.status === 'shipped' || pkg.status === 'ordered';
      if (activeTab === 'out_for_delivery') return pkg.status === 'out_for_delivery';
      if (activeTab === 'delivered') return pkg.status === 'delivered';
      if (activeTab === 'customs') return pkg.status === 'customs' || pkg.status === 'exception';

      return true;
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
  }, [packages, searchQuery, selectedCarrier, activeTab, sortBy, language]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Demo Banner indicator when in Demo Mode */}
      {isDemoMode && !user && (
        <div className="bg-gradient-to-r from-indigo-900/90 to-blue-900/90 border-b border-indigo-500/30 px-4 py-2.5 text-center text-xs font-semibold text-indigo-200 flex items-center justify-center gap-2">
          <PlayCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{isRTL ? 'אתה צופה בגרסת הדגמה חיה (?demo=true)' : 'You are viewing the Interactive Demo (?demo=true)'}</span>
          <button 
            onClick={() => { setAuthInitialMode('signin'); setIsAuthOpen(true); }}
            className="underline ms-2 text-white hover:text-blue-300 cursor-pointer font-bold"
          >
            {isRTL ? 'התחבר לחשבון אמיתי' : 'Sign in to use real tracking'}
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        isDemoMode={isDemoMode}
        onOpenAddModal={() => {
          setEditPackage(null);
          setSmartPrefill(null);
          setIsAddModalOpen(true);
        }}
        onOpenSmartImport={() => setIsSmartImportOpen(true)}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenAuth={() => {
          if (user) {
            setAccountInitialTab('profile');
            setIsAccountOpen(true);
          } else {
            setAuthInitialMode('signin');
            setIsAuthOpen(true);
          }
        }}
        onOpenSettings={() => {
          setAccountInitialTab('preferences');
          setIsAccountOpen(true);
        }}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenAdminFeedback={isAdminUser(user) ? () => setIsAdminFeedbackOpen(true) : undefined}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenLockerMap={() => setIsLockerMapOpen(true)}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onResetData={handleResetData}
        onShowToast={showToast}
      />


      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              {isRTL ? 'ברוכים הבאים ל-Deliveree' : 'Welcome to Deliveree'}
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
                onClick={() => { setAuthInitialMode('signin'); setIsAuthOpen(true); }}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <LogIn className="w-4 h-4" />
                <span>{isRTL ? 'התחבר לחשבון שלך' : 'Sign In to Your Account'}</span>
              </button>
              <button
                onClick={() => { setAuthInitialMode('register'); setIsAuthOpen(true); }}
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
                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer p-2 min-h-[44px]"
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
              packages={packages.filter(p => !p.isArchived)}
              activeFilter={activeTab}
              onSelectFilter={(tabId) => setActiveTab(tabId)}
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
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer min-h-[44px]"
                  >
                    {t('filters.clearFilters')}
                  </button>
                  <button
                    onClick={() => setIsSmartImportOpen(true)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[44px]"
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
                    onOpenDetails={(p) => setSelectedDetailPackage(p)}
                    onEdit={(p) => {
                      setEditPackage(p);
                      setIsAddModalOpen(true);
                    }}
                    onDelete={(id) => setDeletePackageId(id)}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                    onStatusChange={handleStatusChange}
                    onRefreshTracking={handleRefreshSinglePackage}
                    onShowToast={showToast}
                  />
                ))}
              </div>
            ) : (
              <div className="animate-fade-in">
                <PackageTable
                  packages={filteredPackages}
                  onOpenDetails={(p) => setSelectedDetailPackage(p)}
                  onEdit={(p) => {
                    setEditPackage(p);
                    setIsAddModalOpen(true);
                  }}
                  onDelete={(id) => setDeletePackageId(id)}
                  onTogglePin={handleTogglePin}
                  onStatusChange={handleStatusChange}
                  onShowToast={showToast}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Alpha Feedback Button */}
      <aside aria-label="Alpha Feedback" className={`fixed z-30 bottom-5 ${isRTL ? 'left-5' : 'right-5'}`}>
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold shadow-xl shadow-indigo-600/30 hover:scale-105 transition-all cursor-pointer min-h-[44px]"
          title={language === 'he' ? 'משוב ודיווח תקלות' : 'Feedback & Bug Report'}
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>{language === 'he' ? 'משוב אלפא' : 'Feedback'}</span>
        </button>
      </aside>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 bg-slate-950/60 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Deliveree • {t('appTagline')}</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Supports Israel Post, AliExpress, 4PX, DHL, FedEx, UPS & Yanwen</span>
          </div>
        </div>
      </footer>

      {/* Add / Edit Package Modal */}
      <ErrorBoundary compact componentName="AddEditPackageModal" onReset={() => setIsAddModalOpen(false)}>
        <AddEditPackageModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditPackage(null);
            setSmartPrefill(null);
          }}
          onSave={handleAddOrUpdatePackage}
          editPackage={editPackage}
          initialValues={smartPrefill}
          packages={packages}
          onOpenExisting={(pkg) => {
            setSelectedDetailPackage(pkg);
          }}
        />
      </ErrorBoundary>

      {/* Smart Import from SMS / Email Modal */}
      <ErrorBoundary compact componentName="SmartImportModal" onReset={() => {
        setIsSmartImportOpen(false);
        setSmartImportInitialText('');
      }}>
        <SmartImportModal
          isOpen={isSmartImportOpen}
          initialText={smartImportInitialText}
          onClose={() => {
            setIsSmartImportOpen(false);
            setSmartImportInitialText('');
          }}
          onParsedResult={handleSmartImportResult}
          onShowToast={showToast}
          onSwitchToManual={(rawText) => {
            setIsSmartImportOpen(false);
            setSmartImportInitialText('');
            setEditPackage(null);
            setSmartPrefill(rawText?.trim() ? { notes: rawText.trim() } : null);
            setIsAddModalOpen(true);
          }}
        />
      </ErrorBoundary>

      {/* Shipment Details & Interactive Timeline Modal */}
      <ErrorBoundary compact componentName="PackageDetailModal" onReset={() => setSelectedDetailPackage(null)}>
        <PackageDetailModal
          pkg={selectedDetailPackage}
          isOpen={!!selectedDetailPackage}
          onClose={() => setSelectedDetailPackage(null)}
          onUpdatePackage={handleAddOrUpdatePackage}
          onRefreshTracking={handleRefreshSinglePackage}
          onOpenLockerMap={() => setIsLockerMapOpen(true)}
          onShowToast={showToast}
        />
      </ErrorBoundary>

      {/* Analytics & Performance Modal */}
      <ErrorBoundary compact componentName="AnalyticsModal" onReset={() => setIsAnalyticsOpen(false)}>
        <AnalyticsModal
          isOpen={isAnalyticsOpen}
          onClose={() => setIsAnalyticsOpen(false)}
          packages={packages}
        />
      </ErrorBoundary>

      {/* 1-Click Ingestion Guide Modal */}
      <ErrorBoundary compact componentName="IngestionGuideModal" onReset={() => setIsConnectModalOpen(false)}>
        <IngestionGuideModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          onOpenSmartImport={() => setIsSmartImportOpen(true)}
          onShowToast={showToast}
        />
      </ErrorBoundary>

      {/* Blocking gate for any signed-in user who hasn't accepted the
          current Terms of Use / Privacy Policy version — new OAuth
          sign-ins and pre-existing accounts alike. Renders null otherwise. */}
      <ErrorBoundary compact componentName="LegalConsentGate">
        <LegalConsentGate onShowToast={showToast} />
      </ErrorBoundary>

      {/* User Account & Cloud Sync Modal */}
      <ErrorBoundary compact componentName="AuthModal" onReset={() => setIsAuthOpen(false)}>
        <AuthModal
          isOpen={isAuthOpen}
          initialMode={authInitialMode}
          onClose={() => setIsAuthOpen(false)}
          onShowToast={showToast}
        />
      </ErrorBoundary>

      {/* Dedicated Account & Personal Settings Modal */}
      <ErrorBoundary compact componentName="AccountModal" onReset={() => setIsAccountOpen(false)}>
        <AccountModal
          isOpen={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
          initialTab={accountInitialTab}
          packages={packages}
          onExportData={handleExportData}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenAuth={() => {
            setAuthInitialMode('signin');
            setIsAuthOpen(true);
          }}
          onShowToast={showToast}
        />
      </ErrorBoundary>

      {/* Dedicated Export Center Modal */}
      <ErrorBoundary compact componentName="ExportModal" onReset={() => setIsExportOpen(false)}>
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          packages={packages}
          onShowToast={showToast}
        />
      </ErrorBoundary>

      {/* Interactive Locker & Pickup Point Modal */}
      <ErrorBoundary compact componentName="LockerMapModal" onReset={() => setIsLockerMapOpen(false)}>
        <LockerMapModal
          isOpen={isLockerMapOpen}
          onClose={() => setIsLockerMapOpen(false)}
        />
      </ErrorBoundary>

      {/* About & System Info Modal */}
      <ErrorBoundary compact componentName="AboutModal" onReset={() => setIsAboutOpen(false)}>
        <AboutModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
          onOpenFeedback={() => {
            setIsAboutOpen(false);
            setIsFeedbackOpen(true);
          }}
          onShowToast={showToast}
        />
      </ErrorBoundary>

      {/* Alpha Tester Feedback Modal */}
      <ErrorBoundary compact componentName="FeedbackModal" onReset={() => setIsFeedbackOpen(false)}>
        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          onShowToast={showToast}
        />
      </ErrorBoundary>

      {/* Admin Feedback Inspector Modal */}
      <ErrorBoundary compact componentName="AdminFeedbackModal" onReset={() => setIsAdminFeedbackOpen(false)}>
        <AdminFeedbackModal
          isOpen={isAdminFeedbackOpen}
          onClose={() => setIsAdminFeedbackOpen(false)}
          onShowToast={showToast}
        />
      </ErrorBoundary>


            {/* Auto-Archive Confirmation Prompt Modal */}
      <AutoArchivePromptModal
        isOpen={isAutoArchivePromptOpen}
        onConfirm={handleConfirmAutoArchive}
        onDecline={handleDeclineAutoArchive}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deletePackageId}
        onClose={() => setDeletePackageId(null)}
        onConfirm={() => {
          if (deletePackageId) {
            handleDeletePackage(deletePackageId);
            setDeletePackageId(null);
          }
        }}
      />

      {/* PWA Floating Update Available Banner */}
      {isUpdateAvailable && (
        <aside aria-label="App Update Ready" className="fixed top-18 left-1/2 -translate-x-1/2 z-50 animate-bounce-subtle">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-2xl border border-blue-400/30 backdrop-blur-xl">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
            <span>{isRTL ? 'גרסה חדשה של Deliveree זמינה!' : 'A new version of Deliveree is ready!'}</span>
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
