import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, MapPin, Clock, Phone, Navigation, ExternalLink, ShieldCheck, Search, Flag, AlertCircle, ArrowLeft, Layers, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Modal } from './Modal';
import { getPreferredNavigationApp, openNavigationApp } from '../utils/navigationService';
import { getLiveStoreStatus } from '../utils/openingHoursService';
import { submitFeedback } from '../services/feedbackService';
import { areLocationsMatching } from '../utils/locationBundling';

export const POPULAR_PICKUP_POINTS = [
  {
    id: 'locker-tlv-01',
    name: 'Dizengoff Center Locker Hub (BoxIt #142)',
    nameHe: 'דיזנגוף סנטר - לוקר BoxIt #142',
    address: 'Dizengoff St 50, Tel Aviv-Yafo (Building A, Floor -1)',
    addressHe: 'רחוב דיזנגוף 50, תל אביב-יפו (בניין א׳, קומה 1- ליד הסופר)',
    hours: '24/7 (Always Open)',
    hoursHe: '24/7 (פתוח תמיד)',
    phone: '*2694',
    distance: '0.4 km',
    lat: 32.0754,
    lng: 34.7750,
    type: 'locker',
    carrier: 'BoxIt / Israel Post'
  },
  {
    id: 'locker-tlv-02',
    name: 'Azrieli Center Automated Pickup Station',
    nameHe: 'עזריאלי תל אביב - תחנת איסוף אוטומטית',
    address: 'Derech Menachem Begin 132, Tel Aviv (Floor 1 entrance)',
    addressHe: 'דרך מנחם בגין 132, תל אביב (קומה 1 בכניסה לקניון)',
    hours: 'Sun-Thu 07:00-23:00, Fri 07:00-15:00',
    hoursHe: 'א׳-ה׳ 07:00-23:00, ו׳ 07:00-15:00',
    phone: '03-6081111',
    distance: '1.2 km',
    lat: 32.0741,
    lng: 34.7922,
    type: 'pickup_point',
    carrier: 'Cheetah / HFD'
  },
  {
    id: 'locker-modiin-01',
    name: 'Modiin Logistics Center Branch',
    nameHe: 'סניף דואר ראשי מודיעין',
    address: 'Sderot HaMiktsoot 1, Modiin Hub',
    addressHe: 'שדרות המקצועות 1, פארק טכנולוגי מודיעין',
    hours: 'Sun-Thu 08:00-19:00',
    hoursHe: 'א׳-ה׳ 08:00-19:00',
    phone: '171',
    distance: '4.8 km',
    lat: 31.8974,
    lng: 34.9658,
    type: 'post_office',
    carrier: 'Israel Post'
  },
  {
    id: 'locker-ramat-gan-01',
    name: 'Bursa Diamond Exchange 24/7 Locker',
    nameHe: 'מתחם הבורסה רמת גן - לוקר 24/7',
    address: 'Abba Hillel Silver Rd 7, Ramat Gan',
    addressHe: 'אבא הלל סילבר 7, מתחם הבורסה, רמת גן',
    hours: '24/7 (Always Open)',
    hoursHe: '24/7 (פתוח תמיד)',
    phone: '*8890',
    distance: '2.1 km',
    lat: 32.0834,
    lng: 34.8016,
    type: 'locker',
    carrier: 'BoxIt / DHL ServicePoint'
  }
];

export function LockerMapModal({
  isOpen,
  onClose,
  initialSearch = '',
  selectedLocation = null,
  packages = [],
  onOpenLockerMode,
  onOpenNavigation,
  onShowToast
}) {
  const { t, isRTL, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const userPickupPoints = useMemo(() => {
    if (!Array.isArray(packages)) return [];
    const activeWithLocation = packages.filter((p) => (
      p &&
      !p.isArchived &&
      p.status !== 'archived' &&
      p.status !== 'delivered' &&
      Boolean(p.pickupLocation)
    ));

    const groups = [];
    for (const pkg of activeWithLocation) {
      let match = groups.find((g) => areLocationsMatching(g.location, pkg.pickupLocation));
      if (match) {
        match.packages.push(pkg);
      } else {
        groups.push({
          id: `user-point-${groups.length + 1}`,
          isUserPickup: true,
          name: pkg.pickupLocation,
          nameHe: pkg.pickupLocation,
          address: pkg.pickupLocation,
          addressHe: pkg.pickupLocation,
          hours: pkg.pickupHours || '24/7',
          hoursHe: pkg.pickupHours || '24/7',
          phone: pkg.pickupPhone || '*2694',
          distance: '0.2 km',
          lat: 32.0715,
          lng: 34.7872,
          type: 'locker',
          carrier: pkg.carrierName || pkg.carrier || 'BoxIt',
          location: pkg.pickupLocation,
          packages: [pkg]
        });
      }
    }
    return groups;
  }, [packages]);

  const initialPoint = useMemo(() => {
    if (selectedLocation) {
      return (
        userPickupPoints.find((p) => areLocationsMatching(p.location, selectedLocation)) ||
        POPULAR_PICKUP_POINTS.find((p) => areLocationsMatching(p.address, selectedLocation) || areLocationsMatching(p.addressHe, selectedLocation)) ||
        selectedLocation
      );
    }
    return userPickupPoints[0] || POPULAR_PICKUP_POINTS[0];
  }, [selectedLocation, userPickupPoints]);

  const [activePoint, setActivePoint] = useState(() => initialPoint);
  const detailRef = useRef(null);
  // Below md the list and the detail share one scroller, so picking a point
  // has to bring its detail into view — otherwise the tap looks like it did
  // nothing.
  const selectPoint = (point) => {
    setActivePoint(point);
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActivePoint(initialPoint);
    }
  }, [isOpen, initialPoint]);

  const [now, setNow] = useState(() => new Date());
  const [isReportingHours, setIsReportingHours] = useState(false);
  const [reportedHours, setReportedHours] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredUserPoints = useMemo(() => {
    if (!searchQuery.trim()) return userPickupPoints;
    const q = searchQuery.toLowerCase();
    return userPickupPoints.filter((point) => (
      point.name.toLowerCase().includes(q) ||
      point.address.toLowerCase().includes(q) ||
      point.carrier.toLowerCase().includes(q) ||
      point.packages.some((p) => (p.title || '').toLowerCase().includes(q) || (p.titleHe || '').includes(q))
    ));
  }, [userPickupPoints, searchQuery]);

  const filteredPoints = POPULAR_PICKUP_POINTS.filter((point) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      point.name.toLowerCase().includes(q) ||
      point.nameHe.includes(q) ||
      point.address.toLowerCase().includes(q) ||
      point.addressHe.includes(q) ||
      point.carrier.toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  const handleReportWrongHours = async (e) => {
    e.preventDefault();
    if (!reportedHours.trim() || !activePoint) return;
    setIsSubmittingReport(true);
    try {
      await submitFeedback({
        type: 'bug',
        message: `[שעות פתיחה שגויות] נקודת איסוף בלוקר מפה: "${activePoint.nameHe || activePoint.name}" (${activePoint.addressHe || activePoint.address}). שעות שדווחו: ${reportedHours.trim()}`,
        rating: 5,
        isAnonymous: true
      });
      setIsReportingHours(false);
      setReportedHours('');
      if (onShowToast) {
        onShowToast(
          language === 'he'
            ? 'תודה! הדיווח נשלח לצוות לבדיקה ועדכון ❤️'
            : 'Thank you! Report submitted for verification ❤️',
          'success'
        );
      }
    } catch {
      if (onShowToast) {
        onShowToast(
          language === 'he' ? 'שגיאה בשליחת הדיווח' : 'Error sending report',
          'error'
        );
      }
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const getWazeUrl = (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const getGoogleMapsUrl = (lat, lng, query) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || `${lat},${lng}`)}`;

  const handleLaunchNavigation = () => {
    if (!activePoint) return;
    const preferred = getPreferredNavigationApp();
    const pointLocation = language === 'he' ? activePoint.addressHe : activePoint.address;
    const pointTitle = language === 'he' ? activePoint.nameHe : activePoint.name;

    if (preferred) {
      openNavigationApp(preferred, {
        location: pointLocation,
        lat: activePoint.lat,
        lng: activePoint.lng,
        title: pointTitle
      });
    } else if (onOpenNavigation) {
      onOpenNavigation({
        location: pointLocation,
        lat: activePoint.lat,
        lng: activePoint.lng,
        title: pointTitle
      });
    } else {
      openNavigationApp('google_maps', {
        location: pointLocation,
        lat: activePoint.lat,
        lng: activePoint.lng,
        title: pointTitle
      });
    }
  };

  const activeStatus = activePoint ? getLiveStoreStatus(activePoint.hours, { now, locationName: activePoint.name }) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="LockerMapModal"
      className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col"
    >
        {/* Header */}
        <div className="p-3 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/50">
          <button
            onClick={onClose}
            className="shrink-0 me-3 flex shrink-0 items-center justify-center min-h-[48px] min-w-[48px] rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
            aria-label={isRTL ? 'חזרה' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <div className="flex flex-1 min-w-0 items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100">
                {isRTL ? 'איתור נקודת איסוף ולוקרים' : 'Pickup Points & Locker Locator'}
              </h3>
              <p className="hidden sm:block text-xs text-slate-400">
                {isRTL ? 'ניווט, שעות פעילות ומידע על לוקרים קרובים' : 'Waze & Google Maps navigation, hours & details'}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/80">
          <div className="relative">
            <Search className={`w-4 h-4 text-slate-400 absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'חיפוש סניף, קניון, לוקר או עיר...' : 'Search locker name, branch, city or carrier...'}
              className={`w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl py-2.5 ${
                isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'
              } focus:outline-none focus:border-blue-500`}
            />
          </div>
        </div>

        {/* Content Layout (Split: List & Interactive Preview) */}
        {/* The split is a desktop layout. Below md the two halves used to get
            their own scrollers at a fixed 2fr/3fr share, which on a 667px
            phone left two cramped windows (~190px and ~280px) scrolling
            independently. Now they stack in ONE scroller — list first, detail
            after — and selecting a point scrolls its detail into view. */}
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-visible md:grid md:grid-cols-2 md:grid-rows-1 divide-y md:divide-y-0 md:divide-x md:rtl:divide-x-reverse divide-slate-800">
          {/* Pickup List */}
          <div className="md:min-h-0 p-4 space-y-3 md:overflow-y-auto">
            {filteredUserPoints.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300 px-1">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {t('locationBundling.myActivePickups') || (language === 'he' ? 'החבילות שלך שממתינות לאיסוף' : 'Your Packages Ready for Pickup')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 dark:bg-indigo-500/20 border border-indigo-500/30 text-[11px] font-extrabold text-indigo-800 dark:text-indigo-200">
                    {filteredUserPoints.reduce((sum, pt) => sum + pt.packages.length, 0)}
                  </span>
                </div>
                {filteredUserPoints.map((point) => {
                  const isSelected = activePoint?.id === point.id;
                  const count = point.packages.length;
                  return (
                    <div
                      key={point.id}
                      onClick={() => selectPoint(point)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          selectPoint(point);
                        }
                      }}
                      className={`p-4 rounded-2xl border transition-ui cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-500/15 dark:bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
                          : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-500/30 hover:border-indigo-400/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                          <span>{point.name}</span>
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 dark:bg-indigo-500/30 text-indigo-900 dark:text-indigo-200 border border-indigo-400/40 text-xs font-extrabold shrink-0">
                          {count === 1
                            ? (language === 'he' ? 'חבילה אחת' : '1 package')
                            : (language === 'he' ? `${count} חבילות כאן` : `${count} packages here`)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {point.packages.map((p) => (
                          <span key={p.id} className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-900/90 border border-indigo-500/30 text-slate-200 font-semibold truncate max-w-[140px]">
                            {language === 'he' && p.titleHe ? p.titleHe : p.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 pb-1 border-t border-slate-800 text-xs font-bold text-slate-400 px-1">
                  {language === 'he' ? 'נקודות איסוף ולוקרים נוספים:' : 'All Pickup Points & Lockers:'}
                </div>
              </div>
            )}

            {filteredPoints.length === 0 && filteredUserPoints.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                {isRTL ? 'לא נמצאו נקודות איסוף תואמות' : 'No pickup locations match your search'}
              </div>
            ) : (
              filteredPoints.map((point) => {
                const isSelected = activePoint?.id === point.id;
                const name = language === 'he' ? point.nameHe : point.name;
                const address = language === 'he' ? point.addressHe : point.address;
                const hours = language === 'he' ? point.hoursHe : point.hours;
                const pointStatus = getLiveStoreStatus(point.hours, { now, locationName: point.name });

                return (
                  <div
                    key={point.id}
                    onClick={() => selectPoint(point)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        selectPoint(point);
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-ui cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500/60 ring-1 ring-blue-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-100">{name}</h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${pointStatus.badgeClass}`}>
                          {language === 'he' ? pointStatus.badgeTextHe : pointStatus.badgeTextEn}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-blue-400 font-semibold">
                          {point.distance}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{address}</span>
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{hours}</span>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="text-blue-700 dark:text-blue-300 font-medium">{point.carrier}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Location Detail & 1-Click Nav Card */}
          <div ref={detailRef} className="md:min-h-0 md:overflow-y-auto scroll-mt-2 p-4 sm:p-6 bg-slate-950/40 flex flex-col justify-between space-y-6">
            {activePoint ? (
              <>
                <div className="space-y-4">
                  {/* Simulated Map Visual Header */}
                  <div className="relative h-44 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-500/25 border border-slate-800 flex flex-col items-center justify-center p-4 text-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
                    <div className="relative w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 mb-2">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <span className="relative text-xs font-bold text-slate-200">
                      {language === 'he' ? activePoint.nameHe : activePoint.name}
                    </span>
                    <span className="relative text-xs text-blue-400 mt-0.5">
                      GPS: {activePoint.lat != null ? Number(activePoint.lat).toFixed(4) : '—'}, {activePoint.lng != null ? Number(activePoint.lng).toFixed(4) : '—'}
                    </span>
                  </div>

                  {/* If user packages exist at this location */}
                  {activePoint.packages && activePoint.packages.length > 0 && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 dark:from-indigo-950/70 via-slate-900/90 to-blue-500/10 dark:to-blue-950/70 border-2 border-indigo-500/40 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            {activePoint.packages.length > 1
                              ? (language === 'he' ? `ממתינות ${activePoint.packages.length} חבילות במיקום זה:` : `${activePoint.packages.length} packages waiting here:`)
                              : (language === 'he' ? 'חבילה ממתינה במיקום זה:' : 'Package waiting here:')}
                          </span>
                        </span>
                        {onOpenLockerMode && (
                          <button
                            type="button"
                            onClick={() => onOpenLockerMode(activePoint.packages[0])}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                            <span>{t('locationBundling.openLockerMode') || (language === 'he' ? 'פתח מסך איסוף מוגדל' : 'Open Locker Mode')}</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {activePoint.packages.map((pkgItem) => {
                          const itemTitle = (language === 'he' && pkgItem.titleHe) ? pkgItem.titleHe : pkgItem.title;
                          return (
                            <div key={pkgItem.id} className="p-2.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-100 truncate max-w-[170px] sm:max-w-xs">{itemTitle}</p>
                                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{pkgItem.trackingNumber}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {pkgItem.shelfNumber && (
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                                    {language === 'he' ? `מדף: ${pkgItem.shelfNumber}` : `Shelf: ${pkgItem.shelfNumber}`}
                                  </span>
                                )}
                                {pkgItem.pickupCode && (
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30 text-xs font-mono font-black shadow-inner">
                                    PIN: {pkgItem.pickupCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Metadata Specs */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{language === 'he' ? activePoint.addressHe : activePoint.address}</span>
                    </div>

                    {/* Live Operating Hours Badge */}
                    {activeStatus && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border ${activeStatus.badgeClass}`}>
                              <span className={`w-2 h-2 rounded-full ${activeStatus.isOpen ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                              <span>{language === 'he' ? activeStatus.badgeTextHe : activeStatus.badgeTextEn}</span>
                            </span>
                            <span className="text-slate-300 text-xs">
                              {language === 'he' ? activeStatus.nextChangeHe : activeStatus.nextChangeEn}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsReportingHours(!isReportingHours)}
                            className="text-xs text-indigo-700 dark:text-indigo-300 hover:text-indigo-200 underline font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <Flag className="w-3 h-3" />
                            <span>{t('openingHours.reportWrongHours')}</span>
                          </button>
                        </div>

                        {(activeStatus.warningHe || activeStatus.warningEn) && (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-medium">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{language === 'he' ? activeStatus.warningHe : activeStatus.warningEn}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Report Incorrect Hours Box */}
                    {isReportingHours && (
                      <form onSubmit={handleReportWrongHours} className="p-3 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-2 animate-fade-in text-xs">
                        <label className="block text-xs font-bold text-indigo-800 dark:text-indigo-200">
                          {t('openingHours.reportPromptTitle')}
                        </label>
                        <input
                          type="text"
                          required
                          value={reportedHours}
                          onChange={(e) => setReportedHours(e.target.value)}
                          placeholder={t('openingHours.reportPlaceholder')}
                          className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsReportingHours(false)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs"
                          >
                            {t('modal.cancel')}
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmittingReport}
                            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm"
                          >
                            {isSubmittingReport ? '...' : (language === 'he' ? 'שלח דיווח' : 'Submit')}
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{language === 'he' ? activePoint.hoursHe : activePoint.hours}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                      <a href={`tel:${activePoint.phone}`} className="underline text-blue-400 hover:text-blue-300">
                        {activePoint.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{isRTL ? 'מאומת ברשת השילוח' : 'Verified Pickup Partner'}: {activePoint.carrier}</span>
                    </div>
                  </div>
                </div>

                {/* 1-Click Navigation Buttons */}
                <div className="space-y-2.5 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold uppercase block">
                      {isRTL ? 'ניווט מהיר ליעד' : 'Direct Navigation'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const pointLocation = language === 'he' ? activePoint.addressHe : activePoint.address;
                        const pointTitle = language === 'he' ? activePoint.nameHe : activePoint.name;
                        if (onOpenNavigation) {
                          onOpenNavigation({
                            location: pointLocation,
                            lat: activePoint.lat,
                            lng: activePoint.lng,
                            title: pointTitle
                          });
                        }
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                    >
                      {isRTL ? 'בחר אפליקציה אחרת' : 'Choose app'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleLaunchNavigation}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-ui flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>{isRTL ? 'פתח ניווט ללוקר זה' : 'Navigate to Locker'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <a
                      href={getWazeUrl(activePoint.lat, activePoint.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-700 dark:text-cyan-300 hover:text-slate-100 text-xs font-bold border border-cyan-500/30 transition-ui cursor-pointer min-h-[48px]"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Waze</span>
                    </a>
                    <a
                      href={getGoogleMapsUrl(
                        activePoint.lat,
                        activePoint.lng,
                        language === 'he' ? activePoint.addressHe : activePoint.address
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-ui cursor-pointer min-h-[48px]"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                      <span>Google Maps</span>
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-500">
                {isRTL ? 'בחר נקודת איסוף להצגת פרטי ניווט' : 'Select a location to view navigation'}
              </div>
            )}
          </div>
        </div>
      </Modal>
  );
}
