/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddEditPackageModal } from './AddEditPackageModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../services/parseCorrectionService', () => ({
  recordParseCorrection: vi.fn()
}));
vi.mock('../services/trainingDataService', () => ({
  recordTrainingExample: vi.fn()
}));

const mockAuthState = vi.hoisted(() => ({ user: null }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthState.user })
}));

const { recordParseCorrection } = await import('../services/parseCorrectionService');
const { recordTrainingExample } = await import('../services/trainingDataService');

const smartImportPrefill = {
  title: 'AliExpress Order',
  trackingNumber: 'RS948219481IL',
  carrierId: 'israel-post',
  origin: 'China',
  notes: 'from parser',
  _autoFillSource: 'ai',
  _autoFillConfidence: 'medium',
  _autoFillInputText: 'Your AliExpress order RS948219481IL has shipped from China'
};

describe('AddEditPackageModal — mis-parse correction signal', () => {
  beforeEach(() => {
    cleanup();
    recordParseCorrection.mockReset();
    recordTrainingExample.mockReset();
    mockAuthState.user = null;
  });

  it('does not report a correction when the auto-filled fields are saved unchanged', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} initialValues={smartImportPrefill} />
    );

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(recordParseCorrection).not.toHaveBeenCalled();
  });

  it('reports exactly the fields the user edited before saving', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} initialValues={smartImportPrefill} />
    );

    const trackingInput = screen.getByDisplayValue('RS948219481IL');
    await user.clear(trackingInput);
    await user.type(trackingInput, 'RR111222333IL');

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(recordParseCorrection).toHaveBeenCalledWith({
      source: 'ai',
      confidence: 'medium',
      editedFields: ['trackingNumber']
    });
  });

  it('reports multiple edited fields together, in one call', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} initialValues={smartImportPrefill} />
    );

    const titleInput = screen.getByDisplayValue('AliExpress Order');
    await user.clear(titleInput);
    await user.type(titleInput, 'Corrected Title');

    const originInput = screen.getByDisplayValue('China');
    await user.clear(originInput);
    await user.type(originInput, 'Hong Kong');

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(recordParseCorrection).toHaveBeenCalledTimes(1);
    const call = recordParseCorrection.mock.calls[0][0];
    expect(call.editedFields.sort()).toEqual(['origin', 'title']);
  });

  it('does not report a correction for a field the parser left blank', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialValues={{ ...smartImportPrefill, notes: '' }}
      />
    );

    // notes was blank from the parser; user adding notes now is not "fixing
    // a wrong parse", it's filling in something the parser never claimed.
    const notesInput = screen.getByPlaceholderText(/locker code|instructions/i);
    await user.type(notesInput, 'Leave with doorman');

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(recordParseCorrection).not.toHaveBeenCalled();
  });

  it('does not report anything for plain manual entry (no Smart Import prefill)', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/mechanical keyboard/i), 'My Package');
    await user.type(screen.getByPlaceholderText(/RS948219481IL/i), 'RS948219481IL');
    await user.click(screen.getByRole('button', { name: /add to tracking/i }));

    expect(recordParseCorrection).not.toHaveBeenCalled();
  });

  it('does not report anything in edit-existing-package mode', async () => {
    const user = userEvent.setup();
    const editPackage = {
      id: 'pkg-1', title: 'Existing', trackingNumber: 'RS1IL', carrier: 'israel-post',
      category: 'other', status: 'in_transit', checkpoints: []
    };
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} editPackage={editPackage} />
    );

    const titleInput = screen.getByDisplayValue('Existing');
    await user.clear(titleInput);
    await user.type(titleInput, 'Renamed');
    await user.click(screen.getByRole('button', { name: /save package/i }));

    expect(recordParseCorrection).not.toHaveBeenCalled();
  });

  it('only reports once even if the modal is somehow submitted twice with the same prefill', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={onSave} initialValues={smartImportPrefill} />
    );

    const trackingInput = screen.getByDisplayValue('RS948219481IL');
    await user.clear(trackingInput);
    await user.type(trackingInput, 'RR111222333IL');

    await user.click(screen.getByRole('button', { name: /add to tracking/i }));
    expect(recordParseCorrection).toHaveBeenCalledTimes(1);
  });

  describe('opted-in AI training data', () => {
    it('does not record a training example for a signed-out / not-opted-in user', async () => {
      mockAuthState.user = { id: 'user-1', aiTrainingOptIn: false };
      const user = userEvent.setup();
      renderWithLanguage(
        <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} initialValues={smartImportPrefill} />
      );

      const trackingInput = screen.getByDisplayValue('RS948219481IL');
      await user.clear(trackingInput);
      await user.type(trackingInput, 'RR111222333IL');
      await user.click(screen.getByRole('button', { name: /add to tracking/i }));

      expect(recordParseCorrection).toHaveBeenCalled();
      expect(recordTrainingExample).not.toHaveBeenCalled();
    });

    it('records the real input text and before/after values for an opted-in user', async () => {
      mockAuthState.user = { id: 'user-42', aiTrainingOptIn: true };
      const user = userEvent.setup();
      renderWithLanguage(
        <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} initialValues={smartImportPrefill} />
      );

      const trackingInput = screen.getByDisplayValue('RS948219481IL');
      await user.clear(trackingInput);
      await user.type(trackingInput, 'RR111222333IL');
      await user.click(screen.getByRole('button', { name: /add to tracking/i }));

      expect(recordTrainingExample).toHaveBeenCalledTimes(1);
      const call = recordTrainingExample.mock.calls[0][0];
      expect(call.userId).toBe('user-42');
      expect(call.source).toBe('ai');
      expect(call.confidence).toBe('medium');
      expect(call.inputText).toBe(smartImportPrefill._autoFillInputText);
      expect(call.initialValues.trackingNumber).toBe('RS948219481IL');
      expect(call.correctedValues.trackingNumber).toBe('RR111222333IL');
    });

    it('does not record a training example when nothing was corrected, even if opted in', async () => {
      mockAuthState.user = { id: 'user-42', aiTrainingOptIn: true };
      const user = userEvent.setup();
      renderWithLanguage(
        <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} initialValues={smartImportPrefill} />
      );

      await user.click(screen.getByRole('button', { name: /add to tracking/i }));

      expect(recordTrainingExample).not.toHaveBeenCalled();
    });
  });
});
