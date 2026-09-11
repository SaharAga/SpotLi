/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from './Toast';

// Toast content appears/disappears with no other on-screen signal — without
// role/aria-live, a screen reader user never knows it happened at all.
describe('Toast accessibility', () => {
  it('renders nothing when there is no toast', () => {
    const { container } = render(<Toast toast={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces an error toast assertively via role="alert"', () => {
    render(<Toast toast={{ type: 'error', message: 'Something failed' }} onClose={vi.fn()} />);
    const region = screen.getByRole('alert');
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(region).toHaveTextContent('Something failed');
  });

  it('announces a success/info toast politely via role="status"', () => {
    render(<Toast toast={{ type: 'success', message: 'Saved!' }} onClose={vi.fn()} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Saved!');
  });

  it('renders an interactive action button when toast.action is provided', () => {
    const handleAction = vi.fn();
    const handleClose = vi.fn();
    render(
      <Toast
        toast={{
          type: 'info',
          message: 'Package archived',
          action: { label: 'Undo', onClick: handleAction }
        }}
        onClose={handleClose}
      />
    );

    const actionBtn = screen.getByRole('button', { name: 'Undo' });
    expect(actionBtn).toBeInTheDocument();
    actionBtn.click();
    expect(handleAction).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<Toast toast={{ type: 'info', message: 'Hello' }} onClose={handleClose} />);
    const closeBtn = screen.getByLabelText('Close notification');
    closeBtn.click();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
