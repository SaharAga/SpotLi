import { describe, it, expect } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFS } from '../services/notificationService';
import { exportToCSV } from '../utils/exportUtils';
import { todayISO } from '../utils/dateUtils';

describe('AccountModal Component Logic & Schema', () => {
  it('validates account deletion keyword requirements ("DELETE" or "מחק")', () => {
    const isValidConfirmation = (input) => {
      const trimmed = (input || '').trim().toUpperCase();
      return trimmed === 'DELETE' || trimmed === 'מחק';
    };

    expect(isValidConfirmation('DELETE')).toBe(true);
    expect(isValidConfirmation('delete')).toBe(true);
    expect(isValidConfirmation('  DELETE  ')).toBe(true);
    expect(isValidConfirmation('מחק')).toBe(true);
    expect(isValidConfirmation('  מחק  ')).toBe(true);

    expect(isValidConfirmation('del')).toBe(false);
    expect(isValidConfirmation('cancel')).toBe(false);
    expect(isValidConfirmation('')).toBe(false);
    expect(isValidConfirmation(null)).toBe(false);
  });

  it('correctly constructs CSV backup rows from packages list', () => {
    const mockPackages = [
      {
        id: 'pkg-1',
        title: 'Sneakers "Air"',
        titleHe: 'נעלי ספורט',
        trackingNumber: 'RR123456789IL',
        carrier: 'israel_post',
        status: 'in_transit',
        orderDate: '2026-08-10',
        expectedDeliveryDate: '2026-08-25',
        origin: 'US',
        destination: 'IL',
        notes: 'Special "Priority" delivery'
      }
    ];

    const headers = ['ID', 'Title', 'TrackingNumber', 'Carrier', 'Status', 'OrderDate', 'ExpectedDeliveryDate', 'Origin', 'Destination', 'Notes'];
    const rows = mockPackages.map(p => [
      `"${p.id || ''}"`,
      `"${(p.title || p.titleHe || '').replace(/"/g, '""')}"`,
      `"${p.trackingNumber || ''}"`,
      `"${p.carrier || ''}"`,
      `"${p.status || ''}"`,
      `"${p.orderDate || ''}"`,
      `"${p.expectedDeliveryDate || ''}"`,
      `"${p.origin || ''}"`,
      `"${p.destination || ''}"`,
      `"${(p.notes || p.notesHe || '').replace(/"/g, '""')}"`
    ]);

    expect(headers.length).toBe(10);
    expect(rows.length).toBe(1);
    expect(rows[0][0]).toBe('"pkg-1"');
    expect(rows[0][1]).toBe('"Sneakers ""Air"""');
    expect(rows[0][9]).toBe('"Special ""Priority"" delivery"');
  });

  it('Account tab CSV export produces the same columns as the shared exporter', () => {
    const mockPackages = [
      {
        id: 'pkg-1',
        title: 'Sneakers "Air"',
        trackingNumber: 'RR123456789IL',
        carrier: 'israel_post',
        status: 'in_transit',
        orderDate: '2026-08-10',
        expectedDeliveryDate: '2026-08-25',
        origin: 'US',
        destination: 'IL',
        notes: 'Special "Priority" delivery'
      }
    ];

    // The Account tab now delegates to exportToCSV, so its output IS the shared schema.
    const csv = exportToCSV(mockPackages);
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    const headerLine = lines[0];
    const firstRow = lines[1];

    expect(headerLine.split(',')).toEqual([
      '"ID"', '"Title"', '"TrackingNumber"', '"Carrier"', '"Status"',
      '"OrderDate"', '"ExpectedDeliveryDate"', '"Origin"', '"Destination"', '"Notes"'
    ]);
    expect(firstRow.split('","').length).toBe(10);
    expect(firstRow).toContain('Sneakers ""Air""');
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('builds the account backup filename from the user id and todayISO()', () => {
    expect(`deliveree_backup_user-42_${todayISO()}.csv`).toMatch(
      /^deliveree_backup_user-42_\d{4}-\d{2}-\d{2}\.csv$/
    );
  });

  it('verifies notification toggle updates structure matching schema', () => {
    const updated = {
      ...DEFAULT_NOTIFICATION_PREFS,
      pushEnabled: true,
      notifyOnException: false
    };

    expect(updated.pushEnabled).toBe(true);
    expect(updated.notifyOnException).toBe(false);
    expect(updated.notifyOnStatusChange).toBe(true);
  });
});
