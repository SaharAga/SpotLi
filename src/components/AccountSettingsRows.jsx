import React, { useState, useEffect } from 'react';
import { Palette, Languages, CalendarDays, Navigation, Archive, Download, FileJson, Check } from 'lucide-react';
import { Modal } from './Modal';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NAV_APPS, getPreferredNavigationApp, setPreferredNavigationApp, clearPreferredNavigationApp } from '../utils/navigationService';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { exportRawToJSON } from '../utils/exportUtils';
import { deliveryService } from '../services/deliveryService';
import { todayISO, setDateFormatPreference } from '../utils/dateUtils';
import { Section, SettingRow, Toggle, ModalHeader } from './ui/Primitives';

/**
 * The Account tab's settings, as rows.
 *
 * These were bordered cards with label-above-value grids, inset native selects
 * and switches in their own boxes — a different geometry from the tab's own
 * list, which is why they read as a separate product no matter what colours
 * they used. Every setting is now the same 52px row: label, current value,
 * chevron. Choosing a value opens a Picker rather than embedding a control
 * whose height and platform styling vary per row.
 *
 * This is the only implementation — AccountModal renders it too, rather than
 * keeping a parallel card version that would drift.
 */

/** A single-choice list. One shape for every setting that has options. */
function Picker({ isOpen, onClose, title, options, value, onSelect }) {
  const { language } = useLanguage();
  const he = language === 'he';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="SettingPicker"
      overlayClassName="p-3 sm:p-4"
      ariaLabel={title}
      className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
    >
      <ModalHeader title={title} onClose={onClose} closeLabel={he ? 'חזרה' : 'Back'} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={title}>
          {options.map((opt) => (
            <SettingRow
              key={opt.value}
              label={opt.label}
              hint={opt.hint}
              role="radio"
              aria-checked={opt.value === value}
              onClick={() => { onSelect(opt.value); onClose(); }}
              control={
                opt.value === value
                  ? <Check className="w-4 h-4 shrink-0 text-blue-400" aria-hidden="true" />
                  : <span className="w-4 h-4 shrink-0" aria-hidden="true" />
              }
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

/**
 * A guest has no `user.preferences` to read the date format back out of, so
 * their choice lives in localStorage — the same fallback this file already
 * uses for the auto-archive toggle.
 */
function readGuestDateFormat() {
  try {
    return localStorage.getItem(STORAGE_KEYS.DATE_FORMAT) || 'DD/MM/YYYY';
  } catch {
    return 'DD/MM/YYYY';
  }
}

export function AccountSettingsRows({ onOpenExport, onShowToast }) {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, updateUserPreferences } = useAuth();
  const he = language === 'he';

  const [picker, setPicker] = useState(null);
  const [navApp, setNavApp] = useState(() => getPreferredNavigationApp() || 'auto');

  useEffect(() => {
    setNavApp(getPreferredNavigationApp() || 'auto');
  }, []);

  const prefs = user?.preferences || {
    dateFormat: readGuestDateFormat(),
    autoArchiveDelivered: false
  };

  const [autoArchive, setAutoArchive] = useState(() => {
    if (user) return !!prefs.autoArchiveDelivered;
    try {
      return localStorage.getItem(STORAGE_KEYS.AUTO_ARCHIVE_DELIVERED) === 'true';
    } catch {
      return false;
    }
  });

  const toast = (msg) => { if (onShowToast) onShowToast(msg, 'success'); };

  const savePref = (patch) => {
    if (user) updateUserPreferences({ ...prefs, ...patch });
  };

  const THEMES = [
    { value: 'system', label: he ? 'לפי המערכת' : 'System' },
    { value: 'dark', label: he ? 'כהה' : 'Dark' },
    { value: 'light', label: he ? 'בהיר' : 'Light' }
  ];
  const LANGS = [
    { value: 'he', label: 'עברית' },
    { value: 'en', label: 'English' }
  ];
  const DATE_FORMATS = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', hint: '31/12/2026' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', hint: '12/31/2026' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', hint: '2026-12-31' }
  ];
  // NAV_APPS is a flat id map, so the display names live here.
  const NAV_LABELS = {
    [NAV_APPS.WAZE]: 'Waze',
    [NAV_APPS.GOOGLE_MAPS]: 'Google Maps',
    [NAV_APPS.APPLE_MAPS]: 'Apple Maps',
    [NAV_APPS.MOOVIT]: 'Moovit',
    [NAV_APPS.OS_DEFAULT]: he ? 'ברירת המחדל של המכשיר' : 'Device default'
  };
  const NAV_OPTIONS = [
    { value: 'auto', label: he ? 'שאל אותי בכל פעם' : 'Ask me each time' },
    ...Object.values(NAV_APPS).map((id) => ({ value: id, label: NAV_LABELS[id] || id }))
  ];

  const handleBackupJSON = () => {
    // Read from storage, not from a `packages` prop. In normal operation the
    // two match; the raw read matters for a legacy or externally-modified
    // blob, where the backup should carry the stored bytes rather than a
    // repaired copy.
    const rawPackages = deliveryService.getRawPackages(user?.id);

    if (rawPackages.length === 0) {
      if (onShowToast) onShowToast(he ? 'אין חבילות לגיבוי' : 'No packages to back up', 'info');
      return;
    }

    exportRawToJSON(rawPackages, true, `spotli_backup_${user?.id || 'guest'}_${todayISO()}.json`);
    toast(he ? 'קובץ גיבוי JSON הורד בהצלחה' : 'JSON backup downloaded');
  };

  const labelFor = (options, value, fallback) =>
    options.find((o) => o.value === value)?.label || fallback;

  return (
    <>
      <Section label={he ? 'העדפות' : 'Preferences'}>
        <div className="flex flex-col gap-2">
          <SettingRow
            icon={Palette}
            label={he ? 'ערכת נושא' : 'Theme'}
            value={labelFor(THEMES, theme || 'system', THEMES[0].label)}
            onClick={() => setPicker('theme')}
          />
          <SettingRow
            icon={Languages}
            label={he ? 'שפה' : 'Language'}
            value={labelFor(LANGS, language, 'English')}
            onClick={() => setPicker('language')}
          />
          <SettingRow
            icon={CalendarDays}
            label={he ? 'פורמט תאריך' : 'Date format'}
            value={prefs.dateFormat}
            onClick={() => setPicker('dateFormat')}
          />
        </div>
      </Section>

      <Section label={he ? 'מעקב' : 'Tracking'}>
        <div className="flex flex-col gap-2">
          <SettingRow
            icon={Navigation}
            label={he ? 'אפליקציית ניווט' : 'Navigation app'}
            value={labelFor(NAV_OPTIONS, navApp, NAV_OPTIONS[0].label)}
            onClick={() => setPicker('navApp')}
          />
          <SettingRow
            icon={Archive}
            label={he ? 'ארכוב אוטומטי' : 'Auto-archive delivered'}
            hint={he ? 'העברה לארכיון לאחר מסירה' : 'Move to archive once delivered'}
            control={
              <Toggle
                checked={autoArchive}
                label={he ? 'ארכוב אוטומטי' : 'Auto-archive delivered'}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAutoArchive(next);
                  if (user) {
                    savePref({ autoArchiveDelivered: next });
                  } else {
                    try {
                      localStorage.setItem(STORAGE_KEYS.AUTO_ARCHIVE_DELIVERED, String(next));
                    } catch (err) {
                      console.warn('Failed to set local autoArchive pref:', err);
                    }
                  }
                  toast(next
                    ? (he ? 'ארכוב אוטומטי הופעל' : 'Auto-archive enabled')
                    : (he ? 'ארכוב אוטומטי בוטל' : 'Auto-archive disabled'));
                }}
              />
            }
          />
        </div>
      </Section>

      <Section label={he ? 'נתונים וגיבוי' : 'Data & backup'}>
        <div className="flex flex-col gap-2">
          {onOpenExport && (
            <SettingRow icon={Download} label={he ? 'מרכז הייצוא' : 'Export centre'} onClick={onOpenExport} />
          )}
          <SettingRow icon={FileJson} label={he ? 'הורדת גיבוי מלא' : 'Download full backup'} hint="JSON" onClick={handleBackupJSON} />
        </div>
      </Section>

      <Picker
        isOpen={picker === 'theme'}
        onClose={() => setPicker(null)}
        title={he ? 'ערכת נושא' : 'Theme'}
        options={THEMES}
        value={theme || 'system'}
        onSelect={(v) => setTheme(v)}
      />
      <Picker
        isOpen={picker === 'language'}
        onClose={() => setPicker(null)}
        title={he ? 'שפה' : 'Language'}
        options={LANGS}
        value={language}
        onSelect={(v) => {
          setLanguage(v);
          savePref({ language: v });
          if (onShowToast) {
            onShowToast(v === 'he' ? 'שפת הממשק שונתה לעברית' : 'Language changed to English', 'success');
          }
        }}
      />
      <Picker
        isOpen={picker === 'dateFormat'}
        onClose={() => setPicker(null)}
        title={he ? 'פורמט תאריך' : 'Date format'}
        options={DATE_FORMATS}
        value={prefs.dateFormat}
        onSelect={(v) => {
          savePref({ dateFormat: v });
          // Applied and persisted here too: `savePref` only writes for a
          // signed-in user, and the module-level formatters need telling
          // straight away so already-rendered dates pick the change up.
          try { localStorage.setItem(STORAGE_KEYS.DATE_FORMAT, v); } catch { /* storage disabled */ }
          setDateFormatPreference(v);
          toast(he ? 'פורמט תאריכים עודכן' : 'Date format updated');
        }}
      />
      <Picker
        isOpen={picker === 'navApp'}
        onClose={() => setPicker(null)}
        title={he ? 'אפליקציית ניווט' : 'Navigation app'}
        options={NAV_OPTIONS}
        value={navApp}
        onSelect={(v) => {
          setNavApp(v);
          if (v === 'auto') clearPreferredNavigationApp();
          else setPreferredNavigationApp(v);
          toast(he ? 'אפליקציית הניווט המועדפת עודכנה' : 'Preferred navigation app updated');
        }}
      />
    </>
  );
}
