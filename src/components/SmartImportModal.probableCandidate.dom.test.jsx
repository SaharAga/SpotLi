/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SmartImportModal } from './SmartImportModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../services/aiParseService', () => ({
  parseWithAi: vi.fn()
}));

const { parseWithAi } = await import('../services/aiParseService');

// The message a real Tapuz delivery SMS produced. Its number is eight digits
// with no check digit, no carrier prefix and no carrier URL, so the
// deterministic parser can rate it `probable` and never better — and the AI
// fallback is unreachable when the user is offline or the function is down.
// That combination is what made the confirm button inert while the panel above
// it said the extraction had succeeded.
const TAPUZ_SMS = [
  'חבילה 48094292 נמסרה ל- סהר',
  'Enjoy, נשמח אם תדרג את חוויית המשלוח בקישור bit.ly/4mvH1eA',
  'תודה על שיתוף הפעולה!'
].join('\n');

async function parseTapuzSms(props = {}) {
  const user = userEvent.setup();
  renderWithLanguage(
    <SmartImportModal isOpen onClose={vi.fn()} onParsedResult={vi.fn()} {...props} />
  );
  const textarea = screen.getByPlaceholderText(/paste|text|sms/i);
  await user.click(textarea);
  await user.paste(TAPUZ_SMS);
  await user.click(screen.getByRole('button', { name: /extract shipping details/i }));
  return user;
}

describe('SmartImportModal — a `probable` deterministic result', () => {
  beforeEach(() => {
    cleanup();
    parseWithAi.mockReset();
    // No second opinion available: the deterministic result stands on its own.
    parseWithAi.mockResolvedValue({ success: false });
  });

  it('can be applied — the confirm button is not inert under "extracted successfully"', async () => {
    const onParsedResult = vi.fn();
    const onClose = vi.fn();
    const user = await parseTapuzSms({ onParsedResult, onClose });

    const applyButton = await screen.findByRole('button', { name: /add this package to tracker/i });
    expect(applyButton).toBeEnabled();

    await user.click(applyButton);
    expect(onParsedResult).toHaveBeenCalledTimes(1);
    expect(onParsedResult.mock.calls[0][0].trackingNumber).toBe('48094292');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the confirm button as disabled when it is, rather than looking alive', async () => {
    await parseTapuzSms();
    const applyButton = await screen.findByRole('button', { name: /add this package to tracker/i });
    // The styling that makes an inert button legible. Without it the only
    // signal the user got was that tapping did nothing.
    expect(applyButton.className).toContain('disabled:opacity-50');
    expect(applyButton.className).toContain('disabled:cursor-not-allowed');
  });

  it('tells the user it will update the package already tracked under this number', async () => {
    const existing = [{
      id: 'pkg-1',
      title: 'סיסטארז',
      trackingNumber: '48094292',
      carrier: 'tapuz',
      status: 'out_for_delivery'
    }];

    await parseTapuzSms({ packages: existing });

    expect(await screen.findByText('48094292')).toBeInTheDocument();
    // The badge and the sentence explaining it — both were unreachable while
    // `packages` never reached this modal.
    expect(screen.getByText('Matching Existing Package')).toBeInTheDocument();
    expect(screen.getByText(/enrich existing record/i)).toBeInTheDocument();
  });

  it('says nothing about a match when the number is genuinely new', async () => {
    await parseTapuzSms({ packages: [{ id: 'pkg-9', trackingNumber: 'RS948219483IL', carrier: 'israel-post' }] });

    expect(await screen.findByText('48094292')).toBeInTheDocument();
    expect(screen.queryByText('Matching Existing Package')).not.toBeInTheDocument();
    expect(screen.queryByText(/enrich existing record/i)).not.toBeInTheDocument();
  });
});
