/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddEditPackageModal } from './AddEditPackageModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../services/parseCorrectionService', () => ({ recordParseCorrection: vi.fn() }));
vi.mock('../services/trainingDataService', () => ({ recordTrainingExample: vi.fn() }));
vi.mock('../services/smartImportAttemptService', () => ({ recordSmartImportAttempt: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

const { recordParseCorrection } = await import('../services/parseCorrectionService');

/**
 * The parser guesses a delivery stage and this form lets the user change it,
 * so correcting it is a parse correction — but `status` was in neither the
 * correction allowlist nor the training snapshot, so every one of those fixes
 * was discarded. Found when a real SMS saying נמסרה was saved as in_transit.
 */
describe('AddEditPackageModal — correcting the parsed delivery stage', () => {
  beforeEach(() => {
    cleanup();
    recordParseCorrection.mockReset();
  });

  it('reports a stage the user changed after Smart Import filled it', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialValues={{
          title: 'Seestarz online Order',
          trackingNumber: '48094292',
          carrierId: 'tapuz',
          status: 'in_transit',
          _autoFillSource: 'regex',
          _autoFillInputText: 'חבילה מSeestarz online מספר 48094292 נמסרה ל- סהר'
        }}
      />
    );

    // The stage picker is a radiogroup, not a select.
    await user.click(screen.getByRole('radio', { name: /delivered/i }));
    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(recordParseCorrection).toHaveBeenCalledTimes(1);
    expect(recordParseCorrection.mock.calls[0][0].editedFields).toContain('status');
  });

  it('reports nothing when the user leaves the parsed stage alone', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialValues={{
          title: 'Seestarz online Order',
          trackingNumber: '48094292',
          carrierId: 'tapuz',
          status: 'delivered',
          _autoFillSource: 'regex',
          _autoFillInputText: 'חבילה מSeestarz online מספר 48094292 נמסרה ל- סהר'
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    const call = recordParseCorrection.mock.calls[0]?.[0];
    expect(call?.editedFields || []).not.toContain('status');
  });
});
