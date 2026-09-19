/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SmartImportModal } from './SmartImportModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../services/aiParseService', () => ({
  parseWithAi: vi.fn()
}));

// jsdom has no real Canvas/Image decoding, so compressImageFile (which
// relies on createImageBitmap / canvas.getContext('2d')) can never resolve
// there — mock it directly rather than relying on a browser capability
// jsdom doesn't provide, same as any other real-media API in a unit test.
vi.mock('../utils/imageCompressor', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    compressImageFile: vi.fn().mockResolvedValue({
      dataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZQ==',
      width: 100,
      height: 100,
      bytes: 12345
    })
  };
});

const { parseWithAi } = await import('../services/aiParseService');

describe('SmartImportModal — AI fallback (rendered)', () => {
  beforeEach(() => {
    cleanup();
    parseWithAi.mockReset();
  });

  it('only calls the AI fallback when the regex parser finds nothing', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'Tracking: RR000000005IL is on its way');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    await screen.findByText('RR000000005IL');
    expect(parseWithAi).not.toHaveBeenCalled();
  });

  it('does not auto-populate an uncertain initialText candidate', async () => {
    renderWithLanguage(
      <SmartImportModal isOpen initialText="1Z999AA10123456784" onClose={vi.fn()} onParsedResult={vi.fn()} onSwitchToManual={vi.fn()} />
    );
    expect(await screen.findByRole('button', { name: 'Enter Details Manually' })).toBeInTheDocument();
    expect(screen.queryByText('1Z999AA10123456784', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('does not auto-populate an uncertain candidate read from the clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('1Z999AA10123456784') }
    });
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} onSwitchToManual={vi.fn()} />
    );
    expect(await screen.findByRole('button', { name: 'Enter Details Manually' })).toBeInTheDocument();
    expect(screen.queryByText('1Z999AA10123456784', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('falls back to AI when the regex parser finds nothing, and shows the AI result', async () => {
    parseWithAi.mockResolvedValue({
      success: true,
      data: {
        trackingNumber: 'ZZ999888777IL',
        carrier: 'israel-post',
        title: 'Mystery Package',
        pickupLocation: '',
        origin: '',
        notes: '',
        confidence: 'high'
      }
    });

    const user = userEvent.setup();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'some ambiguous message with no obvious pattern');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    expect(await screen.findByText('ZZ999888777IL')).toBeInTheDocument();
    expect(parseWithAi).toHaveBeenCalledWith({
      mode: 'text-fallback',
      text: 'some ambiguous message with no obvious pattern',
      candidates: []
    });
  });

  it('sends a non-verified deterministic candidate to AI for explicit selection, not auto-fill', async () => {
    parseWithAi.mockResolvedValue({ success: true, data: { trackingNumber: '', confidence: 'none' } });
    const user = userEvent.setup();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), '1Z999AA10123456784');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    expect(parseWithAi).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'text-fallback',
      candidates: [expect.objectContaining({ value: '1Z999AA10123456784', status: 'uncertain' })]
    }));
    expect(screen.queryByText('1Z999AA10123456784', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('shows a double-check hint for a low-confidence AI result', async () => {
    parseWithAi.mockResolvedValue({
      success: true,
      data: {
        trackingNumber: 'ZZ111', carrier: 'other', title: '', pickupLocation: '',
        origin: '', notes: '', confidence: 'low'
      }
    });

    const user = userEvent.setup();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'unclear message');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    expect(await screen.findByText(/wasn.t fully confident/i)).toBeInTheDocument();
  });

  it('falls through to the no-match state when the AI fallback also finds nothing', async () => {
    parseWithAi.mockResolvedValue({ success: true, data: { trackingNumber: '', confidence: 'none' } });

    const user = userEvent.setup();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} onSwitchToManual={vi.fn()} />
    );

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'totally unrelated text');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    expect(await screen.findByRole('button', { name: 'Enter Details Manually' })).toBeInTheDocument();
  });

  it('falls through to the no-match state (not an error) when AI is unavailable', async () => {
    parseWithAi.mockResolvedValue({ success: false, unavailable: true, error: 'AI parsing is not available right now.' });

    const user = userEvent.setup();
    renderWithLanguage(
      <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} onSwitchToManual={vi.fn()} />
    );

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'totally unrelated text');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));

    expect(await screen.findByRole('button', { name: 'Enter Details Manually' })).toBeInTheDocument();
  });

  it('enables Add button with double-check hint for an ungrounded AI result so user can review and edit', async () => {
    parseWithAi.mockResolvedValue({
      success: true,
      data: {
        trackingNumber: 'ZZ999888777IL', carrier: 'israel-post', title: 'Package',
        pickupLocation: '', origin: '', notes: '', confidence: 'medium'
      }
    });

    const user = userEvent.setup();
    const onParsedResult = vi.fn();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={onParsedResult} />);

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), 'ambiguous text');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));
    expect(await screen.findByText(/wasn.t fully confident/i)).toBeInTheDocument();
    const addButton = await screen.findByRole('button', { name: /add this package to tracker/i });
    expect(addButton).toBeEnabled();
    await user.click(addButton);
    expect(onParsedResult).toHaveBeenCalledWith(expect.objectContaining({
      trackingNumber: 'ZZ999888777IL',
      carrierId: 'israel-post'
    }));
  });

  it('enables Add button when AI selects an uncertain candidate', async () => {
    parseWithAi.mockResolvedValue({
      success: true,
      data: {
        trackingNumber: '1Z999AA10123456784', carrier: 'ups', title: 'Package',
        pickupLocation: '', origin: '', notes: '', confidence: 'medium'
      }
    });
    const user = userEvent.setup();
    const onParsedResult = vi.fn();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={onParsedResult} />);

    await user.type(screen.getByPlaceholderText(/paste|text|sms/i), '1Z999AA10123456784');
    await user.click(screen.getByRole('button', { name: /extract shipping details/i }));
    const addButton = await screen.findByRole('button', { name: /add this package to tracker/i });
    expect(addButton).toBeEnabled();
    await user.click(addButton);
    expect(onParsedResult).toHaveBeenCalledWith(expect.objectContaining({
      trackingNumber: '1Z999AA10123456784',
      carrierId: 'ups'
    }));
  });

  it('attaching a screenshot calls the AI parser in image mode and shows the result', async () => {
    parseWithAi.mockResolvedValue({
      success: true,
      data: {
        trackingNumber: 'IMG12345IL', carrier: 'israel-post', title: 'From screenshot',
        pickupLocation: '', origin: '', notes: '', confidence: 'high'
      }
    });

    const user = userEvent.setup();
    renderWithLanguage(<SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} />);

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'screenshot.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);

    expect(await screen.findByText('IMG12345IL')).toBeInTheDocument();
    expect(parseWithAi).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'image', candidates: [] })
    );
  });

  it('enables Add button and applies grounded screenshot package with pickup metadata', async () => {
    parseWithAi.mockResolvedValue({
      success: true,
      data: {
        trackingNumber: 'RR000000005IL',
        carrier: 'israel-post',
        title: 'Israel Post Package',
        pickupLocation: 'Dizengoff Center',
        lockerPin: '1234',
        pickupHours: '08:00-19:00',
        origin: 'Israel',
        notes: 'Ready for pickup',
        confidence: 'high',
        isGroundedCandidate: true
      }
    });

    const user = userEvent.setup();
    const onParsedResult = vi.fn();
    const onClose = vi.fn();
    renderWithLanguage(<SmartImportModal isOpen onClose={onClose} onParsedResult={onParsedResult} />);

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'label.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);

    expect(await screen.findByText('RR000000005IL')).toBeInTheDocument();
    expect(screen.getByText('Dizengoff Center')).toBeInTheDocument();

    const addButton = screen.getByRole('button', { name: /add this package to tracker/i });
    expect(addButton).toBeEnabled();
    await user.click(addButton);

    expect(onParsedResult).toHaveBeenCalledWith(expect.objectContaining({
      trackingNumber: 'RR000000005IL',
      carrierId: 'israel-post',
      title: 'Israel Post Package',
      pickupLocation: 'Dizengoff Center',
      pickupCode: '1234',
      pickupHours: '08:00-19:00'
    }));
    expect(onClose).toHaveBeenCalled();
  });
});
