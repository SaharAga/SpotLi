import { describe, it, expect, vi } from 'vitest';
import {
  escapeCSVCell,
  formatPackageCSVRow,
  exportToCSV,
  exportRawToJSON,
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
    it('generates a valid formatted JSON manifest string representing the packages', () => {
      const jsonStr = exportToJSON(samplePackages, false, '', { scope: 'all' });
      const parsed = JSON.parse(jsonStr);
      expect(parsed).toHaveProperty('schemaVersion', 1);
      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed).toHaveProperty('appVersion');
      expect(parsed).toHaveProperty('scope', 'all');
      expect(parsed).toHaveProperty('packageCount', 2);
      expect(Array.isArray(parsed.packages)).toBe(true);
      expect(parsed.packages.length).toBe(2);
      expect(parsed.packages[0].id).toBe('pkg-1');
      expect(parsed.packages[1].id).toBe('pkg-2');
    });

    it('leaves scope absent when undeclared in options', () => {
      const jsonStr = exportToJSON(samplePackages);
      const parsed = JSON.parse(jsonStr);
      expect(parsed).not.toHaveProperty('scope');
      expect(parsed.scope).toBeUndefined();
      expect(parsed.packageCount).toBe(2);
    });

    it('sets scope from options (object or string)', () => {
      const explicitObj = exportToJSON(samplePackages, false, '', { scope: 'delivered' });
      expect(JSON.parse(explicitObj).scope).toBe('delivered');

      const explicitStr = exportToJSON(samplePackages, false, '', 'active');
      expect(JSON.parse(explicitStr).scope).toBe('active');
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
      expect(exportUtils.exportRawToJSON).toBe(exportRawToJSON);
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

describe('exportRawToJSON — the backup path', () => {
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
    notesHe: 'הערות',
    category: 'electronics',
    isPinned: true,
    isArchived: false,
    carrierName: 'Some Courier',
    schemaVersion: 3,
    checkpoints: [{ id: 'cp-1', status: 'in_transit', location: 'Haifa', timestamp: '2026-08-01T00:00:00.000Z' }]
  };

  it('wraps the backup in a manifest with schemaVersion, appVersion, and scope: all', () => {
    const parsed = JSON.parse(exportRawToJSON([raw]));
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed).toHaveProperty('exportedAt');
    expect(parsed).toHaveProperty('appVersion');
    expect(parsed.scope).toBe('all');
    expect(parsed.packageCount).toBe(1);
    expect(Array.isArray(parsed.packages)).toBe(true);
  });

  it('applies no repair pass to carrier, status, dates or tracking number', () => {
    const parsed = JSON.parse(exportRawToJSON([raw]));
    const [out] = parsed.packages;
    expect(out.carrier).toBe('not_a_known_carrier');
    expect(out.status).toBe('not_a_known_status');
    expect(out.trackingNumber).toBe('lower case/tracking#');
    expect(out.orderDate).toBe('');
    expect(out.destination).toBe('');
  });

  it('does not truncate long notes the way sanitizeString does', () => {
    const parsed = JSON.parse(exportRawToJSON([raw]));
    const [out] = parsed.packages;
    expect(out.notes).toBe('a'.repeat(2000));
  });

  it('keeps the Hebrew fields the CSV backup dropped (#53)', () => {
    const parsed = JSON.parse(exportRawToJSON([raw]));
    const [out] = parsed.packages;
    expect(out.title).toBe('Widget');
    expect(out.titleHe).toBe('ווידג׳ט');
    expect(out.notesHe).toBe('הערות');
  });

  it('carries the fields no CSV column set can represent', () => {
    const parsed = JSON.parse(exportRawToJSON([raw]));
    const [out] = parsed.packages;
    expect(out.checkpoints).toEqual(raw.checkpoints);
    expect(out.category).toBe('electronics');
    expect(out.isPinned).toBe(true);
    expect(out.isArchived).toBe(false);
    expect(out.carrierName).toBe('Some Courier');
    expect(out.schemaVersion).toBe(3);
  });

  it('reproduces the input array in packages exactly', () => {
    const parsed = JSON.parse(exportRawToJSON([raw]));
    expect(parsed.packages).toEqual([raw]);
  });

  it('emits every item with no cap', () => {
    const many = Array.from({ length: 2500 }, (_, i) => ({ id: `p${i}` }));
    const parsed = JSON.parse(exportRawToJSON(many));
    expect(parsed.packages).toHaveLength(2500);
    expect(parsed.packageCount).toBe(2500);
  });

  it('tolerates non-array input', () => {
    expect(JSON.parse(exportRawToJSON(null)).packages).toEqual([]);
    expect(JSON.parse(exportRawToJSON(undefined)).packages).toEqual([]);
  });
});

describe('CSV formula injection (#54)', () => {
  it('neutralises every leading formula trigger', () => {
    expect(escapeCSVCell('=HYPERLINK("http://attacker/","click")')).toBe(
      '"\'=HYPERLINK(""http://attacker/"",""click"")"'
    );
    expect(escapeCSVCell('+1+1')).toBe('"\'+1+1"');
    expect(escapeCSVCell('-2+3')).toBe('"\'-2+3"');
    expect(escapeCSVCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(escapeCSVCell('\tcmd')).toBe('"\'\tcmd"');
    expect(escapeCSVCell('\r=1')).toBe('"\'\r=1"');
  });

  it('neutralises formula triggers even when preceded by whitespace', () => {
    expect(escapeCSVCell('   =HYPERLINK("http://attacker/","click")')).toBe(
      '"\'   =HYPERLINK(""http://attacker/"",""click"")"'
    );
    expect(escapeCSVCell('  +1+1')).toBe('"\'  +1+1"');
    expect(escapeCSVCell(' \t -2+3')).toBe('"\' \t -2+3"');
    expect(escapeCSVCell('   @SUM(A1)')).toBe('"\'   @SUM(A1)"');
  });

  it('leaves benign values untouched', () => {
    expect(escapeCSVCell('Widget')).toBe('"Widget"');
    expect(escapeCSVCell('דואר ישראל')).toBe('"דואר ישראל"');
    expect(escapeCSVCell('a=b')).toBe('"a=b"');
    expect(escapeCSVCell('')).toBe('""');
    expect(escapeCSVCell(0)).toBe('"0"');
  });

  it('protects the report export end to end', () => {
    const csv = exportToCSV([
      { id: 'x1', title: '=HYPERLINK("http://attacker/","click")', trackingNumber: 'TRK1', carrier: 'other', status: 'in_transit' }
    ]);
    expect(csv).toContain('"\'=HYPERLINK(');
    expect(csv).not.toContain('"=HYPERLINK(');
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
    expect(parsed.packages[0].customerReference).toBe('PO-9981');
    expect(parsed.packages[0].someFutureField).toEqual({ nested: true });
  });

  it('the raw backup never validates, so nothing can be stripped', () => {
    const parsed = JSON.parse(exportRawToJSON([withUnknown]));
    expect(parsed.packages).toEqual([withUnknown]);
  });
});

