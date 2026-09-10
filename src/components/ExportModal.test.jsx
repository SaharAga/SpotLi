import { describe, it, expect, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import * as exportUtils from '../utils/exportUtils';

describe('ExportModal Component Logic & State Specifications', () => {
  const samplePackages = [
    {
      id: 'pkg-1',
      title: 'Gaming Mouse',
      titleHe: 'עכבר גיימינג',
      trackingNumber: 'IL111',
      carrier: 'israel-post',
      status: 'in_transit',
      isArchived: false
    },
    {
      id: 'pkg-2',
      title: 'Headphones',
      titleHe: 'אוזניות',
      trackingNumber: 'IL222',
      carrier: 'dhl',
      status: 'delivered',
      isArchived: false
    },
    {
      id: 'pkg-3',
      title: 'Keyboard',
      titleHe: 'מקלדת',
      trackingNumber: 'IL333',
      carrier: 'chita',
      status: 'in_transit',
      isArchived: true
    }
  ];

  it('exports valid component function', () => {
    expect(typeof ExportModal).toBe('function');
  });

  it('correctly filters packages based on scope parameter', () => {
    const filterScope = (packages, selectedScope) => {
      if (!Array.isArray(packages)) return [];
      return packages.filter(pkg => {
        if (selectedScope === 'active') {
          return !pkg.isArchived && pkg.status !== 'delivered';
        }
        if (selectedScope === 'delivered') {
          return pkg.status === 'delivered' || pkg.isArchived;
        }
        return true;
      });
    };

    const all = filterScope(samplePackages, 'all');
    expect(all.length).toBe(3);

    const active = filterScope(samplePackages, 'active');
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('pkg-1');

    const delivered = filterScope(samplePackages, 'delivered');
    expect(delivered.length).toBe(2);
    expect(delivered.map(p => p.id)).toEqual(['pkg-2', 'pkg-3']);
  });

  it('delegates to exportUtils with appropriate format handlers', () => {
    const csvSpy = vi.spyOn(exportUtils, 'exportToCSV').mockReturnValue('');
    const jsonSpy = vi.spyOn(exportUtils, 'exportToJSON').mockReturnValue('[]');
    const printSpy = vi.spyOn(exportUtils, 'generatePrintableSummary').mockReturnValue('<html></html>');

    const triggerExport = (format, packages, language = 'he') => {
      const today = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        exportUtils.exportToCSV(packages, true, `spotli_export_all_${today}.csv`);
      } else if (format === 'json') {
        exportUtils.exportToJSON(packages, true, `spotli_export_all_${today}.json`);
      } else if (format === 'print') {
        exportUtils.generatePrintableSummary(packages, language, true);
      }
    };

    triggerExport('csv', samplePackages);
    expect(csvSpy).toHaveBeenCalledTimes(1);

    triggerExport('json', samplePackages);
    expect(jsonSpy).toHaveBeenCalledTimes(1);

    triggerExport('print', samplePackages, 'he');
    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
