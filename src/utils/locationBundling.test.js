import { describe, it, expect } from 'vitest';
import {
  normalizeLocation,
  areLocationsMatching,
  findSameLocationPackages,
  getBundledLocations
} from './locationBundling';

describe('locationBundling utility', () => {
  describe('normalizeLocation', () => {
    it('normalizes common punctuation and noise words', () => {
      expect(normalizeLocation('Dizengoff Center, BoxIt #142')).toBe('dizengoff center 142');
      expect(normalizeLocation('סניף דיזנגוף סנטר (נקודת איסוף)')).toBe('דיזנגוף סנטר');
      expect(normalizeLocation('קניון עזריאלי - לוקר צהוב')).toBe('עזריאלי צהוב');
    });

    it('handles empty or non-string inputs safely', () => {
      expect(normalizeLocation('')).toBe('');
      expect(normalizeLocation(null)).toBe('');
      expect(normalizeLocation(undefined)).toBe('');
    });
  });

  describe('areLocationsMatching', () => {
    it('detects matching locations with minor wording differences', () => {
      expect(areLocationsMatching('Dizengoff Center BoxIt #142', 'Dizengoff Center 142')).toBe(true);
      expect(areLocationsMatching('סופר יודה - בן יהודה 45', 'סניף סופר יודה, בן יהודה 45')).toBe(true);
    });

    it('rejects clearly different locations', () => {
      expect(areLocationsMatching('Dizengoff Center #142', 'Azrieli Mall Locker 5')).toBe(false);
      expect(areLocationsMatching('Ibn Gabirol 30', 'Herzl 88')).toBe(false);
    });
  });

  describe('findSameLocationPackages', () => {
    const pkg1 = { id: 'pkg-1', pickupLocation: 'Dizengoff Center BoxIt #142', status: 'ready_for_pickup' };
    const pkg2 = { id: 'pkg-2', pickupLocation: 'Dizengoff Center 142', status: 'ready_for_pickup', pickupCode: '4821' };
    const pkg3 = { id: 'pkg-3', pickupLocation: 'Dizengoff Center 142', status: 'delivered', pickupCode: '9999' };
    const pkg4 = { id: 'pkg-4', pickupLocation: 'Dizengoff Center 142', isArchived: true };
    const pkg5 = { id: 'pkg-5', pickupLocation: 'Azrieli Mall', status: 'ready_for_pickup' };

    it('returns only active, non-delivered, non-archived sibling packages at the same location', () => {
      const result = findSameLocationPackages(pkg1, [pkg1, pkg2, pkg3, pkg4, pkg5]);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('pkg-2');
    });

    it('returns empty array when no matches are found', () => {
      const result = findSameLocationPackages(pkg5, [pkg1, pkg2, pkg3, pkg4, pkg5]);
      expect(result).toEqual([]);
    });
  });

  describe('getBundledLocations', () => {
    it('clusters packages by shared locations and returns only bundles with >= 2 packages', () => {
      const packages = [
        { id: 'p1', pickupLocation: 'BoxIt Dizengoff #142', status: 'ready_for_pickup' },
        { id: 'p2', pickupLocation: 'Dizengoff 142', status: 'ready_for_pickup' },
        { id: 'p3', pickupLocation: 'Azrieli Mall #5', status: 'ready_for_pickup' },
        { id: 'p4', pickupLocation: 'Azrieli Mall #5', status: 'delivered' }
      ];

      const bundles = getBundledLocations(packages);
      expect(bundles.length).toBe(1);
      expect(bundles[0].packages.length).toBe(2);
      expect(bundles[0].packages.map(p => p.id)).toEqual(['p1', 'p2']);
    });
  });
});
