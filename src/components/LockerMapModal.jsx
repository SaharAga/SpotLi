import React, { useState, useEffect } from 'react';
import { X, MapPin, Clock, Phone, Navigation, ExternalLink, ShieldCheck, Search, Flag, AlertCircle, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Modal } from './Modal';
import { getPreferredNavigationApp, openNavigationApp } from '../utils/navigationService';
import { getLiveStoreStatus } from '../utils/openingHoursService';
import { submitFeedback } from '../services/feedbackService';

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
  onOpenNavigation,
  onShowToast
}) {
  const { t, isRTL, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activePoint, setActivePoint] = useState(selectedLocation || POPULAR_PICKUP_POINTS[0]);
  const [now, setNow] = useState(() => new Date());
  const [isReportingHours, setIsReportingHours] = useState(false);
  const [reportedHours, setReportedHours] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/50">
          <button
            onClick={onClose}
            className="shrink-0 me-3 flex shrink-0 items-center justify-center min-h-[48px] min-w-[48px] rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
            aria-label={isRTL ? 'חזרה' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <div className="flex flex-1 min-w-0 items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isRTL ? 'איתור נקודת איסוף ולוקרים' : 'Pickup Points & Locker Locator'}
              </h3>
              <p className="text-xs text-slate-400">
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
        {/* The split is a desktop layout. On a phone both halves shared one
            scroller, and the tall detail panel squeezed the list down to a
            single visible row — the list was effectively invisible. Each half
            now scrolls on its own and the list gets a guaranteed share of the
            height. */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-1 divide-y md:divide-y-0 md:divide-x md:rtl:divide-x-reverse divide-slate-800">
          {/* Pickup List */}
          <div className="min-h-0 p-4 space-y-3 overflow-y-auto">
            {filteredPoints.length === 0 ? (
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
                    onClick={() => setActivePoint(point)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
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
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>{hours}</span>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="text-blue-300 font-medium">{point.carrier}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Location Detail & 1-Click Nav Card */}
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-950/40 flex flex-col justify-between space-y-6">
            {activePoint ? (
              <>
                <div className="space-y-4">
                  {/* Simulated Map Visual Header */}
                  <div className="relative h-44 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 border border-slate-800 flex flex-col items-center justify-center p-4 text-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
                    <div className="relative w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 mb-2">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <span className="relative text-xs font-bold text-slate-200">
                      {language === 'he' ? activePoint.nameHe : activePoint.name}
                    </span>
                    <span className="relative text-xs text-blue-400 mt-0.5">
                      GPS: {activePoint.lat.toFixed(4)}, {activePoint.lng.toFixed(4)}
                    </span>
                  </div>

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
                            className="text-xs text-indigo-300 hover:text-indigo-200 underline font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <Flag className="w-3 h-3" />
                            <span>{t('openingHours.reportWrongHours')}</span>
                          </button>
                        </div>

                        {(activeStatus.warningHe || activeStatus.warningEn) && (
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>{language === 'he' ? activeStatus.warningHe : activeStatus.warningEn}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Report Incorrect Hours Box */}
                    {isReportingHours && (
                      <form onSubmit={handleReportWrongHours} className="p-3 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-2 animate-fade-in text-xs">
                        <label className="block text-xs font-bold text-indigo-200">
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
                      <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
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
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>{isRTL ? 'פתח ניווט ללוקר זה' : 'Navigate to Locker'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <a
                      href={getWazeUrl(activePoint.lat, activePoint.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 hover:text-white text-xs font-bold border border-cyan-500/30 transition-all cursor-pointer min-h-[48px]"
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
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer min-h-[48px]"
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
