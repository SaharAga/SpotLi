/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { AddEditPackageModal } from './AddEditPackageModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    isDemoMode: false
  })
}));

describe('AddEditPackageModal Carrier Picker (#137)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders domestic and international optgroups with clean Hebrew labels in RTL', () => {
    renderWithLanguage(
      <AddEditPackageModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} existingPackages={[]} />,
      { language: 'he' }
    );

    const domesticGroup = screen.getByRole('group', { name: 'חברות משלוחים בישראל' });
    expect(domesticGroup).toBeInTheDocument();

    const intlGroup = screen.getByRole('group', { name: 'משלוחים בינלאומיים' });
    expect(intlGroup).toBeInTheDocument();

    // Verify no ugly "(Israel)" suffix is appended in Hebrew mode
    expect(domesticGroup.innerHTML).not.toContain('(Israel)');
    expect(domesticGroup.innerHTML).toContain('בוקסיט (BoxIt)');
  });

  it('renders English optgroups in LTR', () => {
    renderWithLanguage(
      <AddEditPackageModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} existingPackages={[]} />,
      { language: 'en' }
    );

    expect(screen.getByRole('group', { name: 'Domestic Israeli Couriers' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'International Couriers' })).toBeInTheDocument();
  });
});
