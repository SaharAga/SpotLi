/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../utils/exportUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exportToCSV: vi.fn().mockReturnValue('mock-csv-data'),
    exportToJSON: vi.fn().mockReturnValue('{"mock": "json"}'),
    generatePrintableSummary: vi.fn().mockReturnValue('<html>mock print</html>')
  };
});

vi.mock('../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true)
}));

const { ExportModal } = await import('./ExportModal');
const exportUtils = await import('../utils/exportUtils');
const { copyToClipboard } = await import('../utils/clipboard');
const { LanguageProvider } = await import('../context/LanguageContext');

const samplePackages = [
  {
    id: 'pkg-1',
    title: 'Mechanical Keyboard',
    titleHe: 'מקלדת מכנית',
    trackingNumber: 'RS948219481IL',
    carrier: 'israel-post',
    status: 'in_transit',
    isArchived: false,
    orderDate: '2026-08-01T00:00:00Z'
  },
  {
    id: 'pkg-2',
    title: 'Wireless Headphones',
    titleHe: 'אוזניות אלחוטיות',
    trackingNumber: '4829104821',
    carrier: 'dhl',
    status: 'delivered',
    isArchived: false,
    orderDate: '2026-08-05T00:00:00Z'
  },
  {
    id: 'pkg-3',
    title: 'Archived USB Cable',
    titleHe: 'כבל ישן בארכיון',
    trackingNumber: 'LP00582910482CN',
    carrier: 'cainiao',
    status: 'in_transit',
    isArchived: true,
    orderDate: '2026-07-20T00:00:00Z'
  }
];

const renderModal = (props = {}) => render(
  <LanguageProvider>
    <ExportModal
      isOpen={true}
      onClose={() => {}}
      packages={samplePackages}
      onShowToast={() => {}}
      {...props}
    />
  </LanguageProvider>
);

describe('ExportModal DOM Integration & User Interactions', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders nothing when closed', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders format and scope options with WAI-ARIA radiogroup semantics', () => {
    renderModal();

    const radiogroups = screen.getAllByRole('radiogroup');
    expect(radiogroups.length).toBe(2);

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons.length).toBe(6); // 3 formats + 3 scopes

    // Default format: CSV
    const csvRadio = screen.getByRole('radio', { name: /csv/i });
    expect(csvRadio.getAttribute('aria-checked')).toBe('true');

    // Default scope: all
    const allRadio = screen.getByRole('radio', { name: /all packages/i });
    expect(allRadio.getAttribute('aria-checked')).toBe('true');
  });

  it('filters package counts dynamically when scope changes', () => {
    renderModal();

    // Default 'all' -> 3 packages
    expect(document.body.textContent).toContain('3 items');

    // Switch to 'active' -> 1 package (pkg-1)
    const activeRadio = screen.getByRole('radio', { name: /active only/i });
    fireEvent.click(activeRadio);
    expect(document.body.textContent).toContain('1 items');

    // Switch to 'delivered' -> 2 packages (pkg-2 delivered, pkg-3 archived)
    const deliveredRadio = screen.getByRole('radio', { name: /delivered/i });
    fireEvent.click(deliveredRadio);
    expect(document.body.textContent).toContain('2 items');
  });

  it('triggers CSV download on export button click by default', () => {
    const onClose = vi.fn();
    const onShowToast = vi.fn();
    renderModal({ onClose, onShowToast });

    const exportBtn = screen.getByRole('button', { name: /download export/i });
    fireEvent.click(exportBtn);

    expect(exportUtils.exportToCSV).toHaveBeenCalledTimes(1);
    expect(onShowToast).toHaveBeenCalledWith(expect.stringContaining('CSV'), 'success');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers JSON export with appropriate metadata when JSON format is chosen', () => {
    const onClose = vi.fn();
    const onShowToast = vi.fn();
    renderModal({ onClose, onShowToast });

    // Select JSON format
    const jsonRadio = screen.getByRole('radio', { name: /json/i });
    fireEvent.click(jsonRadio);
    expect(jsonRadio.getAttribute('aria-checked')).toBe('true');

    const exportBtn = screen.getByRole('button', { name: /download export/i });
    fireEvent.click(exportBtn);

    expect(exportUtils.exportToJSON).toHaveBeenCalledTimes(1);
    expect(onShowToast).toHaveBeenCalledWith(expect.stringContaining('JSON'), 'success');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers printable summary when Print format is chosen', () => {
    const onClose = vi.fn();
    const onShowToast = vi.fn();
    renderModal({ onClose, onShowToast });

    // Select Print format
    const printRadio = screen.getByRole('radio', { name: /print/i });
    fireEvent.click(printRadio);

    const exportBtn = screen.getByRole('button', { name: /download export/i });
    fireEvent.click(exportBtn);

    expect(exportUtils.generatePrintableSummary).toHaveBeenCalledTimes(1);
    expect(onShowToast).toHaveBeenCalledWith(expect.any(String), 'info');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('copies exported content to clipboard when clicking Copy button', async () => {
    const onShowToast = vi.fn();
    renderModal({ onShowToast });

    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(copyToClipboard).toHaveBeenCalledTimes(1);
      expect(onShowToast).toHaveBeenCalledWith(expect.stringContaining('copied to clipboard'), 'success');
    });
  });

  it('disables export and copy buttons when 0 packages match scope', () => {
    renderModal({ packages: [] });

    const exportBtn = screen.getByRole('button', { name: /download export/i });
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i });

    expect(exportBtn.hasAttribute('disabled')).toBe(true);
    expect(copyBtn.hasAttribute('disabled')).toBe(true);
  });

  it('supports full Hebrew RTL localization with mirrored direction', () => {
    localStorage.setItem('deliveree_lang', 'he');
    render(
      <LanguageProvider>
        <ExportModal
          isOpen={true}
          onClose={() => {}}
          packages={samplePackages}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('מרכז ייצוא ודוחות')).toBeDefined();
    expect(screen.getByRole('radio', { name: /כל החבילות/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /פעילות בלבד/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /נמסרו \/ ארכיון/i })).toBeDefined();
    expect(screen.getByText(/ייצא עכשיו/i)).toBeDefined();
  });
});
