import React, { useState } from 'react';
import { 
  X, MapPin, Clock, Phone, Navigation, ExternalLink, ShieldCheck, Search
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Modal } from './Modal';

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
  selectedLocation = null
}) {
  const { isRTL, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activePoint, setActivePoint] = useState(selectedLocation || POPULAR_PICKUP_POINTS[0]);

  if (!isOpen) return null;

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="LockerMapModal"
      className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col"
    >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isRTL ? 'איתור נקודת איסוף ולוקרים' : 'Pickup Points & Locker Locator'}
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'ניווט בלחיצה אחת, שעות פעילות ומידע על לוקרים קרובים' : '1-Click Waze & Google Maps navigation, hours & details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
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
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-y-auto divide-y md:divide-y-0 md:divide-x md:rtl:divide-x-reverse divide-slate-800">
          {/* Pickup List */}
          <div className="p-4 space-y-3 overflow-y-auto max-h-[400px] md:max-h-full">
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
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-blue-400 font-semibold shrink-0">
                        {point.distance}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{address}</span>
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
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
          <div className="p-6 bg-slate-950/40 flex flex-col justify-between space-y-6">
            {activePoint ? (
              <>
                <div className="space-y-4">
                  {/* Simulated Map Visual Header */}
                  <div className="relative h-44 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 border border-slate-800 flex flex-col items-center justify-center p-4 text-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
                    <div className="relative w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 mb-2 animate-bounce">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <span className="relative text-xs font-bold text-slate-200">
                      {language === 'he' ? activePoint.nameHe : activePoint.name}
                    </span>
                    <span className="relative text-[10px] text-blue-400 mt-0.5">
                      GPS: {activePoint.lat.toFixed(4)}, {activePoint.lng.toFixed(4)}
                    </span>
                  </div>

                  {/* Metadata Specs */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{language === 'he' ? activePoint.addressHe : activePoint.address}</span>
                    </div>
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
                <div className="space-y-2 pt-4 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase block">
                    {isRTL ? 'ניווט מהיר ליעד' : '1-Click Direct Navigation'}
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <a
                      href={getWazeUrl(activePoint.lat, activePoint.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer min-h-[44px]"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>{isRTL ? 'נווט עם Waze' : 'Drive with Waze'}</span>
                    </a>
                    <a
                      href={getGoogleMapsUrl(
                        activePoint.lat,
                        activePoint.lng,
                        language === 'he' ? activePoint.addressHe : activePoint.address
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer min-h-[44px]"
                    >
                      <ExternalLink className="w-4 h-4 text-blue-400" />
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
