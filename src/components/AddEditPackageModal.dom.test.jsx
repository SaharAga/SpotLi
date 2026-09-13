/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddEditPackageModal } from './AddEditPackageModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

// This is the app's primary write path: every package a user creates or
// edits goes through this form. Before this file it had no rendered
// coverage at all — only the pure detectCarrier/schema utilities it calls
// were tested.
describe('AddEditPackageModal (rendered)', () => {
  beforeEach(() => {
    cleanup();
  });

  it('does not submit when the required fields are empty', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={onSave} />
    );

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('auto-detects the carrier as the tracking number is typed', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} />
    );

    const trackingInput = screen.getByPlaceholderText(/RS948219481IL/i);
    await user.type(trackingInput, 'RS948219481IL');

    // "Auto-detected" and the carrier name render as separate text nodes
    // inside one badge, so assert on the badge's combined text rather than
    // an exact node match.
    await screen.findByText(/auto-detected/i);
    expect(document.body.textContent).toContain('Israel Post');
  });

  it('submits a normalized package on save and closes the modal', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={onClose} onSave={onSave} />
    );

    await user.type(screen.getByPlaceholderText(/mechanical keyboard/i), '  New Headphones  ');
    await user.type(screen.getByPlaceholderText(/RS948219481IL/i), '  rs948219481il  ');
    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    // Title is trimmed, tracking number is trimmed and upper-cased — the
    // form must not persist stray whitespace or mixed-case tracking IDs.
    expect(saved.title).toBe('New Headphones');
    expect(saved.trackingNumber).toBe('RS948219481IL');
    expect(saved.carrier).toBe('israel-post');
    expect(saved.id).toMatch(/^pkg-/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pre-fills from an existing package in edit mode and preserves its id on save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const editPackage = {
      id: 'pkg-existing-1',
      title: 'Existing Item',
      trackingNumber: 'HFD90481029',
      carrier: 'hfd',
      category: 'electronics',
      status: 'in_transit',
      isPinned: true,
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      checkpoints: []
    };

    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={onSave} editPackage={editPackage} />
    );

    expect(screen.getByDisplayValue('Existing Item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HFD90481029')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save package/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.id).toBe('pkg-existing-1');
    expect(saved.isPinned).toBe(true);
    expect(saved.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });


  it("warns about duplicate tracking numbers and provides a button to open the existing package", async () => {
    const existing = [
      { id: "pkg-existing-1", trackingNumber: "IL123456789IL", title: "Existing Phone Case", carrier: "israel-post", status: "in_transit" }
    ];
    const handleOpenExisting = vi.fn();
    const handleClose = vi.fn();

    renderWithLanguage(
      <AddEditPackageModal
        isOpen={true}
        onClose={handleClose}
        onSave={vi.fn()}
        packages={existing}
        onOpenExisting={handleOpenExisting}
      />
    );

    const user = userEvent.setup();
    const inputs = screen.getAllByRole("textbox");
    const trackingInput = inputs[1];

    await user.type(trackingInput, "IL-123-456-789-IL");

    const openBtn = screen.getByRole("button", { name: /Open Existing Package|פתח חבילה קיימת/i });
    expect(openBtn).toBeDefined();

    await user.click(openBtn);
    expect(handleOpenExisting).toHaveBeenCalledWith(existing[0]);
    expect(handleClose).toHaveBeenCalled();
  });

  it('pre-fills pickup fields and status from smart import initialValues', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const initialValues = {
      title: 'ASOS Order',
      trackingNumber: 'HFD90481029',
      carrierId: 'hfd',
      status: 'ready_for_pickup',
      pickupCode: '4892',
      pickupLocation: 'Super Yuda Ben Yehuda 45',
      pickupPhone: '03-5123456',
      pickupHours: '08:00 - 22:00',
      category: 'clothing'
    };

    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={onSave} initialValues={initialValues} />
    );

    expect(screen.getByDisplayValue('ASOS Order')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HFD90481029')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4892')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Super Yuda Ben Yehuda 45')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.trackingNumber).toBe('HFD90481029');
    expect(saved.status).toBe('ready_for_pickup');
    expect(saved.pickupCode).toBe('4892');
    expect(saved.pickupLocation).toBe('Super Yuda Ben Yehuda 45');
    expect(saved.pickupPhone).toBe('03-5123456');
    expect(saved.pickupHours).toBe('08:00 - 22:00');
  });

  it('pre-fills extracted expectedDeliveryDate and orderDate from smart import initialValues (#135)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const initialValues = {
      title: 'Target Delivery',
      trackingNumber: 'RR948219481IL',
      carrierId: 'israel-post',
      status: 'out_for_delivery',
      expectedDeliveryDate: '2026-08-19',
      orderDate: '2026-08-15',
      category: 'electronics'
    };

    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={onSave} initialValues={initialValues} />
    );

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.expectedDeliveryDate).toBe('2026-08-19');
    expect(saved.orderDate).toBe('2026-08-15');
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithLanguage(
      <AddEditPackageModal isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('connects dialog aria-labelledby to the title and verifies status radiogroup semantics', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'add-edit-package-title');
    const title = document.getElementById('add-edit-package-title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent(/add (new )?package|הוסף חבילה/i);

    const radiogroup = screen.getByRole('radiogroup');
    expect(radiogroup).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    const inTransitRadio = radios.find(r => r.textContent.includes('In Transit') || r.textContent.includes('בדרך'));
    expect(inTransitRadio).toHaveAttribute('aria-checked', 'true');

    // Select Delivered
    const deliveredRadio = radios.find(r => r.textContent.includes('Delivered') || r.textContent.includes('נמסר'));
    if (deliveredRadio) {
      await user.click(deliveredRadio);
      expect(deliveredRadio).toHaveAttribute('aria-checked', 'true');
      expect(inTransitRadio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('isolates detected PIN in bdi dir="ltr" and enforces >= 48px touch targets', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} />
    );

    const trackingInput = screen.getByPlaceholderText(/RS948219481IL/i);
    // Paste Israeli locker SMS into tracking field to trigger live intelligence
    await user.type(trackingInput, 'חבילתך 12345678 בלוקר קוד איסוף 8492');

    const pinEl = await screen.findByText('8492');
    expect(pinEl.tagName.toLowerCase()).toBe('bdi');
    expect(pinEl).toHaveAttribute('dir', 'ltr');

    const applyBtn = screen.getByRole('button', { name: /auto-fill details|החל פרטים/i });
    expect(applyBtn.className).toContain('min-h-[48px]');

    const submitBtn = screen.getByRole('button', { name: /add to tracking|הוסף למעקב/i });
    expect(submitBtn.className).toContain('min-h-[48px]');
  });
});

