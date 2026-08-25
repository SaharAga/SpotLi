import { parsePackageList } from '../schemas/packageSchema';
import { todayISO } from './dateUtils';

/**
 * Canonical CSV column order for the report export.
 *
 * CSV is a *report* format here, not a backup format: ten flat columns cannot
 * represent `checkpoints`, and they omit `titleHe`, `notesHe`, `category`,
 * `isPinned`, `isArchived`, `carrierName` and `schemaVersion`. Restoring a
 * package from these columns is impossible, and there is no CSV importer.
 * The restorable backup is `exportRawToJSON` (read by `deliveryService.importData`).
 */
export const CSV_HEADERS = Object.freeze([
  'ID',
  'Title',
  'TrackingNumber',
  'Carrier',
  'Status',
  'OrderDate',
  'ExpectedDeliveryDate',
  'Origin',
  'Destination',
  'Notes'
]);

const CSV_HEADER_LINE = CSV_HEADERS.map(h => `"${h}"`).join(',');

/**
 * Triggers a browser download of `content` using the memory-efficient Blob +
 * object URL path (no giant data: URIs). No-op outside a DOM environment.
 *
 * @param {string} content
 * @param {string} mime
 * @param {string} filename
 */
export function downloadBlob(content, mime, filename) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Characters that make a spreadsheet treat a cell as a formula when the file is
 * opened. RFC 4180 quoting does not stop Excel or LibreOffice evaluating them.
 */
const CSV_FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutralises CSV formula injection by prefixing an apostrophe to any value
 * that begins with a formula trigger (`=`, `+`, `-`, `@`, tab, CR).
 *
 * Applied at the CSV boundary rather than in `sanitizeString`, because the
 * stored value is not dangerous — only its interpretation by a spreadsheet is.
 * A title of `-5 units` must stay `-5 units` in storage and in JSON.
 *
 * @param {string} str
 * @returns {string}
 */
function neutralizeFormula(str) {
  if (str.length > 0 && CSV_FORMULA_TRIGGERS.includes(str[0])) {
    return `'${str}`;
  }
  return str;
}

/**
 * Escapes a cell value according to RFC 4180 rules:
 * - Wrap in quotes if it contains quotes, commas, or newlines
 * - Double any quotes inside the value
 *
 * Also neutralises leading formula triggers (see `neutralizeFormula`).
 * @param {any} val
 * @returns {string}
 */
export function escapeCSVCell(val) {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = neutralizeFormula(String(val));
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Formats a package record into a CSV row array conforming to RFC 4180
 * @param {import('../types/deliveree').Package} pkg
 * @returns {string[]}
 */
export function formatPackageCSVRow(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    return Array(10).fill('""');
  }

  const title = pkg.titleHe || pkg.title || '';
  const notes = pkg.notesHe || pkg.notes || '';

  return [
    escapeCSVCell(pkg.id || ''),
    escapeCSVCell(title),
    escapeCSVCell(pkg.trackingNumber || ''),
    escapeCSVCell(pkg.carrier || ''),
    escapeCSVCell(pkg.status || ''),
    escapeCSVCell(pkg.orderDate || ''),
    escapeCSVCell(pkg.expectedDeliveryDate || ''),
    escapeCSVCell(pkg.origin || ''),
    escapeCSVCell(pkg.destination || ''),
    escapeCSVCell(notes)
  ];
}

/**
 * Exports package list to a RFC 4180-compliant CSV string with UTF-8 BOM (\uFEFF)
 * for seamless Hebrew & Arabic display in Microsoft Excel.
 *
 * Routes through `parsePackageList` — the single validation entry point — not
 * `validatePackageList`: the latter's `ALLOWED_PACKAGE_KEYS` whitelist erases
 * any field outside the known set, which is exactly what the schema's
 * `.catchall()` exists to preserve. `parsePackageList` repairs the same fields
 * and never truncates.
 *
 * @param {import('../types/deliveree').Package[]} packages
 * @param {boolean} [triggerDownload=false]
 * @param {string} [filename]
 * @returns {string}
 */
export function exportToCSV(packages, triggerDownload = false, filename = '') {
  const { packages: safeList } = parsePackageList(packages);

  const rows = safeList.map(pkg => formatPackageCSVRow(pkg).join(','));
  const csvBody = [CSV_HEADER_LINE, ...rows].join('\r\n');
  const csvContentWithBOM = '\uFEFF' + csvBody;

  if (triggerDownload && typeof document !== 'undefined') {
    const defaultName = filename || `deliveree_export_${todayISO()}.csv`;
    downloadBlob(csvContentWithBOM, 'text/csv;charset=utf-8;', defaultName);
  }

  return csvContentWithBOM;
}

/**
 * Exports packages **verbatim** as JSON — no validation, no repair, no cap.
 *
 * This is the Account tab's backup path, and the format is what makes it a
 * backup: JSON is what `deliveryService.importData` reads, and it carries
 * every field — `checkpoints`, `titleHe`, `notesHe`, `category`, the flags,
 * `schemaVersion` — that reconstructing a package needs. The CSV it replaced
 * could not restore at all: ten flat columns, and no CSV importer exists.
 *
 * It is handed the blob from `deliveryService.getRawPackages` rather than the
 * in-memory list. In normal operation the two agree — everything this version
 * writes goes through `savePackages`, which validates first — so the raw read
 * is not what buys fidelity. It matters only for a legacy or
 * externally-modified blob, where it passes the stored bytes through untouched
 * instead of repairing them into the backup.
 *
 * Output is compact, not pretty-printed: a backup is machine-read, and the
 * ~26% inflation from indentation comes straight off the restore ceiling,
 * since `MAX_IMPORT_SIZE_BYTES` is measured on the exported file.
 *
 * @param {object[]} packages
 * @param {boolean} [triggerDownload=false]
 * @param {string} [filename]
 * @returns {string}
 */
export function exportRawToJSON(packages, triggerDownload = false, filename = '') {
  const list = Array.isArray(packages) ? packages : [];
  const jsonString = JSON.stringify(list);

  if (triggerDownload && typeof document !== 'undefined') {
    const defaultName = filename || `deliveree_backup_${todayISO()}.json`;
    downloadBlob(jsonString, 'application/json;charset=utf-8;', defaultName);
  }

  return jsonString;
}

/**
 * Exports package list to clean, indented JSON string with optional direct download.
 *
 * @param {import('../types/deliveree').Package[]} packages
 * @param {boolean} [triggerDownload=false]
 * @param {string} [filename]
 * @returns {string}
 */
export function exportToJSON(packages, triggerDownload = false, filename = '') {
  const { packages: safeList } = parsePackageList(packages);
  const jsonString = JSON.stringify(safeList, null, 2);

  if (triggerDownload && typeof document !== 'undefined') {
    const defaultName = filename || `deliveree_backup_${todayISO()}.json`;
    downloadBlob(jsonString, 'application/json;charset=utf-8;', defaultName);
  }

  return jsonString;
}

/**
 * Generates an accessible, clean, bilingual printable HTML document summary
 * and optionally opens a print dialog or new printable tab.
 *
 * @param {import('../types/deliveree').Package[]} packages
 * @param {string} [language='he']
 * @param {boolean} [triggerPrint=false]
 * @returns {string} Clean HTML string
 */
export function generatePrintableSummary(packages, language = 'he', triggerPrint = false) {
  const { packages: safeList } = parsePackageList(packages);
  const isRTL = language === 'he';

  const statusTranslations = {
    he: {
      ordered: 'הוזמן',
      shipped: 'נשלח',
      in_transit: 'בדרך לישראל',
      customs: 'בבדיקת מכס',
      out_for_delivery: 'נמסר לחלוקה / לאיסוף',
      delivered: 'נמסר בהצלחה',
      exception: 'חריגה / עיכוב',
      archived: 'בארכיון'
    },
    en: {
      ordered: 'Ordered',
      shipped: 'Shipped',
      in_transit: 'In Transit',
      customs: 'Customs',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      exception: 'Exception',
      archived: 'Archived'
    }
  };

  const tStatus = statusTranslations[language] || statusTranslations.en;

  const titleText = isRTL ? 'דוח ריכוז משלוחים — Deliveree' : 'Deliveree — Shipment Summary Report';
  const generatedAtText = isRTL ? 'הופק בתאריך:' : 'Generated On:';
  const totalCountText = isRTL ? 'סה״כ חבילות בדוח:' : 'Total Packages:';
  const activeCountText = isRTL ? 'משלוחים פעילים:' : 'Active Shipments:';
  const deliveredCountText = isRTL ? 'נמסרו:' : 'Delivered:';

  const colTitle = isRTL ? 'פריט / תיאור' : 'Title / Item';
  const colTracking = isRTL ? 'מספר מעקב' : 'Tracking Number';
  const colCarrier = isRTL ? 'חברת שילוח' : 'Carrier';
  const colStatus = isRTL ? 'סטטוס' : 'Status';
  const colExpected = isRTL ? 'צפי הגעה' : 'Expected';
  const colNotes = isRTL ? 'הערות / לוקר' : 'Notes / Locker';

  const activeCount = safeList.filter(p => p.status !== 'delivered' && !p.isArchived).length;
  const deliveredCount = safeList.filter(p => p.status === 'delivered').length;
  const formattedDate = new Date().toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const tableRows = safeList.map((pkg, idx) => {
    const title = (isRTL ? (pkg.titleHe || pkg.title) : pkg.title) || '—';
    const notes = (isRTL ? (pkg.notesHe || pkg.notes) : pkg.notes) || '';
    const statusLabel = tStatus[pkg.status] || pkg.status || '—';
    const carrier = pkg.carrierName || pkg.carrier || '—';
    const expected = pkg.expectedDeliveryDate || '—';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="padding: 10px 12px; font-weight: 600;">${escapeHtml(title)}</td>
        <td style="padding: 10px 12px; font-family: monospace; font-size: 13px;">${escapeHtml(pkg.trackingNumber || '—')}</td>
        <td style="padding: 10px 12px;">${escapeHtml(carrier)}</td>
        <td style="padding: 10px 12px;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; ${getStatusBadgeStyle(pkg.status)}">
            ${escapeHtml(statusLabel)}
          </span>
        </td>
        <td style="padding: 10px 12px; font-size: 13px;">${escapeHtml(expected)}</td>
        <td style="padding: 10px 12px; font-size: 12px; color: #64748b;">${escapeHtml(notes)}</td>
      </tr>
    `;
  }).join('');

  const htmlDoc = `<!DOCTYPE html>
<html lang="${isRTL ? 'he' : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titleText)}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 15mm; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #1e3a8a;
    }
    .meta-bar {
      display: flex;
      gap: 24px;
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .meta-item strong {
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: ${isRTL ? 'right' : 'left'};
      font-size: 13px;
    }
    th {
      background-color: #e2e8f0;
      color: #334155;
      padding: 10px 12px;
      font-weight: 700;
      border-top: 1px solid #cbd5e1;
      border-bottom: 2px solid #cbd5e1;
    }
    .footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    .btn-print {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(37,99,235,0.2);
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(titleText)}</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">${generatedAtText} ${formattedDate}</p>
    </div>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">${isRTL ? '🖨️ הדפס דוח / שמור כ-PDF' : '🖨️ Print / Save as PDF'}</button>
    </div>
  </div>

  <div class="meta-bar">
    <div class="meta-item"><strong>${totalCountText}</strong> ${safeList.length}</div>
    <div class="meta-item"><strong>${activeCountText}</strong> ${activeCount}</div>
    <div class="meta-item"><strong>${deliveredCountText}</strong> ${deliveredCount}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${colTitle}</th>
        <th>${colTracking}</th>
        <th>${colCarrier}</th>
        <th>${colStatus}</th>
        <th>${colExpected}</th>
        <th>${colNotes}</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">${isRTL ? 'אין משלוחים להצגה בדוח' : 'No shipments found for report'}</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <span>Deliveree Package Tracker</span>
    <span>https://deliveree.app</span>
  </div>
</body>
</html>`;

  if (triggerPrint && typeof window !== 'undefined') {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlDoc);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch {
          // Ignore print dialog cancellations
        }
      }, 250);
    }
  }

  return htmlDoc;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getStatusBadgeStyle(status) {
  switch (status) {
    case 'delivered':
      return 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
    case 'out_for_delivery':
      return 'background-color: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe;';
    case 'in_transit':
    case 'shipped':
      return 'background-color: #fef9c3; color: #a16207; border: 1px solid #fef08a;';
    case 'customs':
    case 'exception':
      return 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
    default:
      return 'background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;';
  }
}

export const exportUtils = {
  downloadBlob,
  escapeCSVCell,
  formatPackageCSVRow,
  exportToCSV,
  exportRawToJSON,
  exportToJSON,
  generatePrintableSummary
};
