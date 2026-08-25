import { describe, it, expect, vi } from 'vitest';
import {
  escapeCSVCell,
  formatPackageCSVRow,
  formatRawPackageCSVRow,
  exportToCSV,
  exportRawToCSV,
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

describe('exportRawToCSV — the backup path', () => {
  const raw = {
    id: 'raw-1',
    title: 'Widget',
    titleHe: 'ווידג׳ט',
    trackingNumber: 'lower case/tracking#',
    carrier: 'not_a_known_carrier',
    status: 'not_a_known_status',
    orderDate: '',
    expectedDeliveryDate: '',
    origin: '',
    destination: '',
    notes: 'a'.repeat(2000),
    notesHe: 'הערות'
  };

  const rowOf = (csv) => csv.replace(/^\uFEFF/, '').split('\r\n')[1];

  it('shares the header row with the validated exporter', () => {
    const rawHeader = exportRawToCSV([]).replace(/^\uFEFF/, '').split('\r\n')[0];
    const validatedHeader = exportToCSV([]).replace(/^\uFEFF/, '').split('\r\n')[0];
    expect(rawHeader).toBe(validatedHeader);
  });

  it('keeps the UTF-8 BOM and CRLF line endings', () => {
    const csv = exportRawToCSV([raw]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('\r\n');
  });

  it('applies no repair pass to carrier, status, dates or tracking number', () => {
    const row = rowOf(exportRawToCSV([raw]));
    expect(row).toContain('"not_a_known_carrier"');
    expect(row).toContain('"not_a_known_status"');
    expect(row).toContain('"lower case/tracking#"');
    expect(row).not.toContain('UNTRACKED');
    expect(row).not.toContain('"other"');
    expect(row).not.toContain('"in_transit"');
  });

  it('does not truncate long notes the way sanitizeString does', () => {
    const row = rowOf(exportRawToCSV([raw]));
    expect(row).toContain('a'.repeat(2000));
  });

  it('prefers the English title/notes, unlike formatPackageCSVRow', () => {
    const row = rowOf(exportRawToCSV([raw]));
    expect(row).toContain('"Widget"');
    expect(row).not.toContain('ווידג׳ט');
    expect(formatPackageCSVRow(raw)[1]).toBe('"ווידג׳ט"');
    expect(formatRawPackageCSVRow(raw)[1]).toBe('"Widget"');
  });

  it('still escapes quotes per RFC 4180', () => {
    const row = rowOf(exportRawToCSV([{ id: 'x', title: 'He said "hi"' }]));
    expect(row).toContain('"He said ""hi"""');
  });

  it('emits one row per item with no cap', () => {
    const many = Array.from({ length: 2500 }, (_, i) => ({ id: `p${i}` }));
    const lines = exportRawToCSV(many).replace(/^\uFEFF/, '').split('\r\n');
    expect(lines.length).toBe(2501);
  });

  it('tolerates non-array and malformed input', () => {
    expect(exportRawToCSV(null).replace(/^\uFEFF/, '').split('\r\n')).toHaveLength(1);
    const row = rowOf(exportRawToCSV([null]));
    expect(row).toBe(Array(10).fill('""').join(','));
  });
});

describe('validated exports preserve unknown fields (#41)', () => {
  const withUnknown = {
    id: 'unk-1',
    title: 'Has extras',
    trackingNumber: 'RR123456789IL',
    carrier: 'israel_post',
    status: 'in_transit',
    schemaVersion: 3,
    customerReference: 'PO-9981',
    someFutureField: { nested: true }
  };

  it('exportToJSON keeps fields outside the known key set', () => {
    const parsed = JSON.parse(exportToJSON([withUnknown]));
    expect(parsed[0].customerReference).toBe('PO-9981');
    expect(parsed[0].someFutureField).toEqual({ nested: true });
  });

  it('the raw backup never validates, so nothing can be stripped', () => {
    const csv = exportRawToCSV([withUnknown]);
    expect(csv).toContain('unk-1');
  });
});
