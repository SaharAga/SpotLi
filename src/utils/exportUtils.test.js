import { describe, it, expect, vi } from 'vitest';
import {
  escapeCSVCell,
  formatPackageCSVRow,
  exportToCSV,
  exportToJSON,
  generatePrintableSummary,
  exportUtils,
  downloadBlob
} from './exportUtils';

describe('exportUtils Unit Tests', () => {
  const samplePackages = [
    {
      id: 'pkg-1',
      title: 'Mechanical Keyboard',
      titleHe: 'מקלדת מכנית',
      trackingNumber: 'IL123456789',
      carrier: 'israel-post',
      carrierName: 'דואר ישראל',
      status: 'in_transit',
      orderDate: '2026-08-01',
      expectedDeliveryDate: '2026-08-25',
      origin: 'Shenzhen, China',
      destination: 'Tel Aviv',
      notes: 'Contains "quotes" and, commas\nnewline',
      notesHe: 'מכיל "גרשיים" ו, פסיקים\nשורה חדשה'
    },
    {
      id: 'pkg-2',
      title: 'Coffee Beans',
      titleHe: '',
      trackingNumber: 'LP987654321',
      carrier: 'chita',
      carrierName: 'צ\'יטה שליחויות',
      status: 'delivered',
      orderDate: '2026-08-05',
      expectedDeliveryDate: '2026-08-10',
      origin: 'Haifa',
      destination: 'Jerusalem',
      notes: '',
      notesHe: ''
    }
  ];

  describe('escapeCSVCell', () => {
    it('handles null and undefined values cleanly', () => {
      expect(escapeCSVCell(null)).toBe('""');
      expect(escapeCSVCell(undefined)).toBe('""');
    });

    it('wraps strings in quotes and doubles inner quotes according to RFC 4180', () => {
      expect(escapeCSVCell('hello')).toBe('"hello"');
      expect(escapeCSVCell('hello "world"')).toBe('"hello ""world"""');
      expect(escapeCSVCell('line1\nline2')).toBe('"line1\nline2"');
      expect(escapeCSVCell('one,two')).toBe('"one,two"');
    });

    it('handles Hebrew and special unicode characters cleanly', () => {
      expect(escapeCSVCell('דואר ישראל')).toBe('"דואר ישראל"');
      expect(escapeCSVCell('קוד איסוף "1234"')).toBe('"קוד איסוף ""1234"""');
    });
  });

  describe('formatPackageCSVRow', () => {
    it('formats a package into a 10-column escaped CSV row', () => {
      const row = formatPackageCSVRow(samplePackages[0]);
      expect(row.length).toBe(10);
      expect(row[0]).toBe('"pkg-1"');
      expect(row[1]).toBe('"מקלדת מכנית"');
      expect(row[2]).toBe('"IL123456789"');
      expect(row[3]).toBe('"israel-post"');
      expect(row[4]).toBe('"in_transit"');
      expect(row[5]).toBe('"2026-08-01"');
      expect(row[6]).toBe('"2026-08-25"');
      expect(row[7]).toBe('"Shenzhen, China"');
      expect(row[8]).toBe('"Tel Aviv"');
      expect(row[9]).toBe('"מכיל ""גרשיים"" ו, פסיקים\nשורה חדשה"');
    });

    it('gracefully handles invalid / empty package objects', () => {
      const row = formatPackageCSVRow(null);
      expect(row.length).toBe(10);
      row.forEach(cell => expect(cell).toBe('""'));
    });
  });

  describe('exportToCSV', () => {
    it('generates a CSV with UTF-8 BOM prefix (\uFEFF) and correct headers', () => {
      const csv = exportToCSV(samplePackages);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('"ID","Title","TrackingNumber","Carrier","Status","OrderDate","ExpectedDeliveryDate","Origin","Destination","Notes"');
      expect(csv).toContain('"pkg-1"');
      expect(csv).toContain('"מקלדת מכנית"');
      expect(csv).toContain('"pkg-2"');
    });

    it('triggers browser download when requested in browser environment', () => {
      const mockAnchor = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn()
      };
      const mockDocument = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      };
      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn().mockReturnValue('blob:test'),
        revokeObjectURL: vi.fn()
      });

      const csv = exportToCSV(samplePackages, true, 'test_export.csv');
      expect(csv).toBeDefined();
      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.setAttribute).toHaveBeenCalledWith('download', 'test_export.csv');
      expect(mockAnchor.click).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('exportToJSON', () => {
    it('generates a valid formatted JSON string representing the packages', () => {
      const jsonStr = exportToJSON(samplePackages);
      const parsed = JSON.parse(jsonStr);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(parsed[0].id).toBe('pkg-1');
      expect(parsed[1].id).toBe('pkg-2');
    });

    it('triggers JSON blob download when requested', () => {
      const mockAnchor = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn()
      };
      const mockDocument = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      };
      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn().mockReturnValue('blob:json'),
        revokeObjectURL: vi.fn()
      });

      const jsonStr = exportToJSON(samplePackages, true, 'test.json');
      expect(jsonStr).toBeDefined();
      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.setAttribute).toHaveBeenCalledWith('download', 'test.json');
      expect(mockAnchor.click).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('generatePrintableSummary', () => {
    it('generates a valid HTML document in Hebrew (RTL)', () => {
      const html = generatePrintableSummary(samplePackages, 'he');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="he"');
      expect(html).toContain('דוח ריכוז משלוחים — Deliveree');
      expect(html).toContain('מקלדת מכנית');
      expect(html).toContain('IL123456789');
      expect(html).toContain('בדרך לישראל');
      expect(html).toContain('נמסר בהצלחה');
    });

    it('generates a valid HTML document in English (LTR)', () => {
      const html = generatePrintableSummary(samplePackages, 'en');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('dir="ltr"');
      expect(html).toContain('lang="en"');
      expect(html).toContain('Deliveree — Shipment Summary Report');
      expect(html).toContain('Tracking Number');
      expect(html).toContain('In Transit');
    });

    it('safely handles empty package list', () => {
      const html = generatePrintableSummary([], 'he');
      expect(html).toContain('אין משלוחים להצגה בדוח');
    });

    it('triggers window.print when requested in browser', () => {
      const mockPrintWindow = {
        document: {
          open: vi.fn(),
          write: vi.fn(),
          close: vi.fn()
        },
        focus: vi.fn(),
        print: vi.fn()
      };
      const mockWindow = {
        open: vi.fn().mockReturnValue(mockPrintWindow)
      };
      vi.stubGlobal('window', mockWindow);

      const html = generatePrintableSummary(samplePackages, 'he', true);
      expect(html).toBeDefined();
      expect(mockWindow.open).toHaveBeenCalled();
      expect(mockPrintWindow.document.write).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('exportUtils module export', () => {
    it('exports all utility functions cleanly on the exportUtils object', () => {
      expect(exportUtils.exportToCSV).toBe(exportToCSV);
      expect(exportUtils.exportToJSON).toBe(exportToJSON);
      expect(exportUtils.generatePrintableSummary).toBe(generatePrintableSummary);
      expect(exportUtils.downloadBlob).toBe(downloadBlob);
    });
  });

  describe('downloadBlob', () => {
    it('is a no-op outside a DOM environment', () => {
      expect(typeof document).toBe('undefined');
      expect(() => downloadBlob('x', 'text/csv;charset=utf-8;', 'a.csv')).not.toThrow();
    });
  });
});
