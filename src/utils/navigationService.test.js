// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NAV_APPS,
  buildNavigationUrl,
  getPreferredNavigationApp,
  setPreferredNavigationApp,
  clearPreferredNavigationApp,
  openNavigationApp,
  getNavigationAppList
} from './navigationService';
import { STORAGE_KEYS } from '../constants/storageKeys';

describe('navigationService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('buildNavigationUrl', () => {
    it('generates Waze URL with query text when no coordinates are supplied', () => {
      const url = buildNavigationUrl(NAV_APPS.WAZE, { location: 'Dizengoff Center, Tel Aviv' });
      expect(url).toBe('https://waze.com/ul?q=Dizengoff%20Center%2C%20Tel%20Aviv&navigate=yes');
    });

    it('generates Waze URL with coordinates when coordinates are supplied', () => {
      const url = buildNavigationUrl(NAV_APPS.WAZE, { lat: 32.0754, lng: 34.7750 });
      expect(url).toBe('https://waze.com/ul?ll=32.0754,34.775&navigate=yes');
    });

    it('generates Google Maps URL with location query string', () => {
      const url = buildNavigationUrl(NAV_APPS.GOOGLE_MAPS, { location: 'רחוב הרצל 15, תל אביב' });
      expect(url).toContain('https://www.google.com/maps/search/?api=1&query=');
      expect(url).toContain(encodeURIComponent('רחוב הרצל 15, תל אביב'));
    });

    it('generates Apple Maps URL with coordinates and title', () => {
      const url = buildNavigationUrl(NAV_APPS.APPLE_MAPS, { lat: 32.0834, lng: 34.8016, title: 'Bursa Locker' });
      expect(url).toBe('https://maps.apple.com/?ll=32.0834,34.8016&q=Bursa%20Locker');
    });

    it('generates Moovit URL with coordinates and destination title', () => {
      const url = buildNavigationUrl(NAV_APPS.MOOVIT, { lat: 31.8974, lng: 34.9658, location: 'Modiin Logistics Center' });
      expect(url).toBe('https://moovitapp.com/?dest_lat=31.8974&dest_lon=34.9658&dest_name=Modiin%20Logistics%20Center');
    });

    it('generates Moovit URL with query text fallback', () => {
      const url = buildNavigationUrl(NAV_APPS.MOOVIT, { location: 'עזריאלי תל אביב' });
      expect(url).toBe(`https://moovitapp.com/?to=${encodeURIComponent('עזריאלי תל אביב')}`);
    });

    it('generates Android OS default geo: scheme with coordinates and query', () => {
      const url = buildNavigationUrl(NAV_APPS.OS_DEFAULT, { lat: 32.0741, lng: 34.7922, location: 'Azrieli Center' });
      expect(url).toBe('geo:32.0741,34.7922?q=Azrieli%20Center');
    });

    it('falls back gracefully to Google Maps for unknown app id', () => {
      const url = buildNavigationUrl('unknown_app', { location: 'Jerusalem Central' });
      expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Jerusalem%20Central');
    });
  });

  describe('preferred app storage persistence', () => {
    it('returns null when no preference is saved', () => {
      expect(getPreferredNavigationApp()).toBeNull();
    });

    it('persists and retrieves valid preferred navigation app', () => {
      const ok = setPreferredNavigationApp(NAV_APPS.WAZE);
      expect(ok).toBe(true);
      expect(getPreferredNavigationApp()).toBe(NAV_APPS.WAZE);
      expect(localStorage.getItem(STORAGE_KEYS.PREFERRED_NAV_APP)).toBe(NAV_APPS.WAZE);
    });

    it('rejects saving invalid app ids', () => {
      const ok = setPreferredNavigationApp('invalid_nav_tool');
      expect(ok).toBe(false);
      expect(getPreferredNavigationApp()).toBeNull();
    });

    it('clears stored preference cleanly', () => {
      setPreferredNavigationApp(NAV_APPS.MOOVIT);
      expect(getPreferredNavigationApp()).toBe(NAV_APPS.MOOVIT);

      const cleared = clearPreferredNavigationApp();
      expect(cleared).toBe(true);
      expect(getPreferredNavigationApp()).toBeNull();
    });
  });

  describe('openNavigationApp', () => {
    it('calls window.open with secure attributes for web deep links', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      openNavigationApp(NAV_APPS.WAZE, { location: 'Dizengoff 50' });

      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledWith(
        'https://waze.com/ul?q=Dizengoff%2050&navigate=yes',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  describe('getNavigationAppList', () => {
    it('returns 4 primary navigation apps with localized labels', () => {
      const apps = getNavigationAppList('he');
      expect(apps).toHaveLength(4);
      const appIds = apps.map((a) => a.id);
      expect(appIds).toEqual([
        NAV_APPS.WAZE,
        NAV_APPS.GOOGLE_MAPS,
        NAV_APPS.APPLE_MAPS,
        NAV_APPS.MOOVIT
      ]);
    });
  });
});
