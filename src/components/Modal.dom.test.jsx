/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Modal } from './Modal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function getDialog() {
  return document.body.querySelector('[role="dialog"]');
}

/** A trigger outside the dialog, so focus has somewhere real to return to. */
function Harness({ modalProps = {}, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open dialog
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} labelledBy="t" {...modalProps}>
        <h2 id="t">Dialog title</h2>
        {children ?? (
          <>
            <button type="button">first</button>
            <button type="button">second</button>
          </>
        )}
      </Modal>
    </div>
  );
}

describe('Modal — dismissal', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} labelledBy="t">
        <h2 id="t">Title</h2>
      </Modal>
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on accidental touch swipe gestures inside modal', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} labelledBy="t">
        <h2 id="t">Title</h2>
      </Modal>
    );

    const dialog = getDialog();
    // Simulate touch swipe left-to-right (dx > 70px)
    fireEvent.touchStart(dialog, {
      touches: [{ clientX: 100, clientY: 100 }]
    });
    fireEvent.touchEnd(dialog, {
      changedTouches: [{ clientX: 220, clientY: 105 }]
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on Escape when closeOnEscape is false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} closeOnEscape={false} ariaLabel="gate">
        <p>blocking gate</p>
      </Modal>
    );

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sends Escape only to the topmost modal', async () => {
    const user = userEvent.setup();
    const closeOuter = vi.fn();
    const closeInner = vi.fn();

    render(
      <>
        <Modal isOpen onClose={closeOuter} ariaLabel="outer">
          <p>outer</p>
        </Modal>
        <Modal isOpen onClose={closeInner} ariaLabel="inner">
          <p>inner</p>
        </Modal>
      </>
    );

    await user.keyboard('{Escape}');
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });

  it('closes when the backdrop itself is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} ariaLabel="d">
        <p>body</p>
      </Modal>
    );

    await user.click(getDialog());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the click lands inside the panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} ariaLabel="d">
        <button type="button">inside</button>
      </Modal>
    );

    await user.click(screen.getByRole('button', { name: 'inside' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on the backdrop when closeOnBackdrop is false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} closeOnBackdrop={false} ariaLabel="d">
        <p>body</p>
      </Modal>
    );

    await user.click(getDialog());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Modal — focus', () => {
  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    await waitFor(() => {
      expect(getDialog().contains(document.activeElement)).toBe(true);
    });
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));

    const first = screen.getByRole('button', { name: 'first' });
    const second = screen.getByRole('button', { name: 'second' });

    first.focus();
    await user.tab();
    expect(document.activeElement).toBe(second);

    // Past the last focusable, focus wraps back to the first rather than
    // escaping to the page behind the dialog.
    await user.tab();
    expect(document.activeElement).toBe(first);
  });

  it('traps Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));

    const first = screen.getByRole('button', { name: 'first' });
    const second = screen.getByRole('button', { name: 'second' });

    first.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(second);
  });

  it('returns focus to the trigger when it closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'open dialog' });
    await user.click(trigger);
    await waitFor(() => expect(getDialog()).toBeTruthy());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(getDialog()).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('honours initialFocusRef', async () => {
    const user = userEvent.setup();

    function WithInitialFocus() {
      const ref = React.useRef(null);
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            open dialog
          </button>
          <Modal
            isOpen={open}
            onClose={() => setOpen(false)}
            ariaLabel="d"
            initialFocusRef={ref}
          >
            <button type="button">first</button>
            <button type="button" ref={ref}>
              preferred
            </button>
          </Modal>
        </div>
      );
    }

    render(<WithInitialFocus />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'preferred' }));
    });
  });
});

describe('Modal — body scroll lock', () => {
  it('locks the body while open and restores it on close', () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} ariaLabel="d">
        <p>body</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    // index.css clips <html> horizontally, which makes <html> — not <body> —
    // the viewport's scroller; a body-only lock left the page scrollable.
    expect(document.documentElement.style.overflowY).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={() => {}} ariaLabel="d">
        <p>body</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflowY).toBe('');
  });

  it('keeps the lock while a second modal is still open', () => {
    const { rerender } = render(
      <>
        <Modal isOpen onClose={() => {}} ariaLabel="a">
          <p>a</p>
        </Modal>
        <Modal isOpen onClose={() => {}} ariaLabel="b">
          <p>b</p>
        </Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen onClose={() => {}} ariaLabel="a">
          <p>a</p>
        </Modal>
        <Modal isOpen={false} onClose={() => {}} ariaLabel="b">
          <p>b</p>
        </Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen={false} onClose={() => {}} ariaLabel="a">
          <p>a</p>
        </Modal>
        <Modal isOpen={false} onClose={() => {}} ariaLabel="b">
          <p>b</p>
        </Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Modal — structure and ARIA', () => {
  it('exposes role=dialog, aria-modal and a label', () => {
    render(
      <Modal isOpen onClose={() => {}} labelledBy="the-title">
        <h2 id="the-title">The title</h2>
      </Modal>
    );

    const dialog = getDialog();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'the-title');
  });

  it('falls back to aria-label when there is no labelling element', () => {
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Delete package">
        <p>body</p>
      </Modal>
    );
    expect(getDialog()).toHaveAttribute('aria-label', 'Delete package');
  });

  it('portals to document.body rather than nesting where it was written', () => {
    const { container } = render(
      <Modal isOpen onClose={() => {}} ariaLabel="d">
        <p>body</p>
      </Modal>
    );

    expect(container).toBeEmptyDOMElement();
    expect(getDialog().parentElement).toBe(document.body);
  });

  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} ariaLabel="d">
        <p>body</p>
      </Modal>
    );
    expect(getDialog()).toBeNull();
  });

  it('merges caller classes over the shared shell instead of duplicating them', () => {
    render(
      <Modal
        isOpen
        onClose={() => {}}
        ariaLabel="d"
        layer="top"
        scrollable={false}
        overlayClassName="bg-black/60 backdrop-blur-sm"
        className="max-w-sm"
      >
        <p>body</p>
      </Modal>
    );

    const dialog = getDialog();
    // The caller's backdrop wins; the default one is dropped, not stacked.
    expect(dialog.className).toContain('bg-black/60');
    expect(dialog.className).not.toContain('bg-slate-950/80');
    expect(dialog.className).toContain('backdrop-blur-sm');
    expect(dialog.className).not.toContain('backdrop-blur-md');
    // Layer comes from the named stack, not a hand-picked z-index.
    expect(dialog.className).toContain('z-[70]');
    expect(dialog.className).not.toContain('overflow-y-auto');
    // Shared shell survives.
    expect(dialog.className).toContain('fixed');
    expect(dialog.className).toContain('inset-0');

    expect(dialog.firstElementChild.className).toContain('max-w-sm');
  });

  it('sets data-flush-bottom attribute when flushBottom is true', () => {
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="d" flushBottom>
        <p>body</p>
      </Modal>
    );

    const dialog = getDialog();
    expect(dialog.firstElementChild.getAttribute('data-flush-bottom')).toBe('true');
  });

  it('catches a crash in its content instead of taking the app down', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Boom() {
      throw new Error('boom');
    }

    render(
      <Modal isOpen onClose={() => {}} ariaLabel="d" componentName="Boomy">
        <Boom />
      </Modal>
    );

    expect(document.body.textContent).toContain('Boomy');
    spy.mockRestore();
  });
});
