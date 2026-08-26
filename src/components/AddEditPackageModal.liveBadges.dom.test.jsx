/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddEditPackageModal } from './AddEditPackageModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

describe('AddEditPackageModal — Live Ingestion Badges & 1-Tap Action', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders live store, pickup, and locker PIN badges when raw SMS or tracking text is entered', async () => {
    const user = userEvent.setup();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={vi.fn()} />
    );

    const trackingInput = screen.getByPlaceholderText(/RS948219481IL/i);
    await user.type(
      trackingInput,
      "חבילה מ-SHEIN (GSH12345678901) מחכה בלוקר שרונה. קוד איסוף: 9812"
    );

    // Badges should render dynamically
    expect(await screen.findByText('SHEIN')).toBeInTheDocument();
    expect(screen.getByText(/שרונה/i)).toBeInTheDocument();
    expect(screen.getByText(/9812/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto-fill details|החל פרטים/i })).toBeInTheDocument();
  });

  it('populates tracking, carrier, title and notes on clicking 1-tap auto-fill', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithLanguage(
      <AddEditPackageModal isOpen onClose={vi.fn()} onSave={onSave} />
    );

    const trackingInput = screen.getByPlaceholderText(/RS948219481IL/i);
    await user.type(
      trackingInput,
      "באזר שליחויות: החבילה שלך BZR84920194 הגיעה ללוקר קניון עזריאלי. קוד איסוף: 6632"
    );

    const autoFillBtn = await screen.findByRole('button', { name: /auto-fill details|החל פרטים/i });
    await user.click(autoFillBtn);

    // Form inputs should be updated
    expect(screen.getByDisplayValue('BZR84920194')).toBeInTheDocument();
    expect(screen.getByDisplayValue('קניון עזריאלי')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Locker PIN: 6632/i)).toBeInTheDocument();

    // Carrier selector should reflect buzzr
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes[0].value).toBe('buzzr');
  });
});
