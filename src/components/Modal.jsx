import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * The one modal shell.
 *
 * Fourteen modals used to hand-roll `fixed inset-0 …` overlays, and the
 * duplication had produced divergence rather than mere repetition: Escape
 * closed none of them, nothing trapped or restored focus, the page behind
 * kept scrolling, twelve backdrops were inert, and only one modal portalled
 * (so stacking depended on JSX order, which is why one of them had to
 * hand-pick `z-[70]` to climb out).
 *
 * Everything a dialog owes a keyboard user now lives here exactly once:
 * portal, backdrop, Escape, focus trap, initial focus, focus restore, body
 * scroll lock, ARIA, and the z-layer stack.
 */

/**
 * Named stacking layers. Every modal picks one of these instead of inventing
 * a z-index; because the shell portals to `document.body`, DOM order no
 * longer fights the layer.
 */
export const MODAL_LAYERS = {
  base: 'z-50',
  gate: 'z-[65]',
  top: 'z-[70]'
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Open modals, oldest first. Escape is answered by the last entry only, so a
 * modal opened on top of another (a legal document over the consent gate)
 * closes itself rather than everything beneath it.
 */
const openModals = [];

/**
 * Body scroll lock is reference counted: the second modal must not clear the
 * lock the first one took, and the last one out restores the original value
 * rather than blindly writing `''`.
 */
let scrollLockCount = 0;
let previousBodyOverflow = null;

export function acquireScrollLock() {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

export function releaseScrollLock() {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow || '';
    previousBodyOverflow = null;
  }
}

function getFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  );
}

export function Modal({
  isOpen = true,
  onClose,
  children,
  className,
  overlayClassName,
  /**
   * A short confirmation rather than a screen. Below `lg` a Modal takes the
   * whole viewport (see index.css) because in this app a modal IS the page —
   * but a three-line "are you sure?" is not a page. A full screen for one
   * yes/no reads as heavier than the decision and hides the thing being
   * decided about. `compact` keeps those centred at every width.
   */
  compact = false,
  style,
  dir,
  layer = 'base',
  scrollable = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  labelledBy,
  describedBy,
  ariaLabel,
  componentName,
  initialFocusRef
}) {
  const panelRef = useRef(null);
  const overlayRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    if (typeof onCloseRef.current === 'function') onCloseRef.current();
  }, []);

  // Escape, focus capture/restore, scroll lock and the modal stack all share
  // one mount/unmount lifecycle so they can never get out of step.
  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const entry = { close: closeOnEscape ? requestClose : null };
    openModals.push(entry);
    acquireScrollLock();

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' && event.key !== 'Esc') return;
      if (openModals[openModals.length - 1] !== entry) return;
      if (!entry.close) return;
      event.stopPropagation();
      entry.close();
    };

    document.addEventListener('keydown', handleKeyDown);

    // Initial focus. If the content already claimed focus (an `autoFocus`
    // input) leave it alone; otherwise use the caller's choice, falling back
    // to the panel itself rather than to whatever happens to be first.
    const panel = panelRef.current;
    const alreadyInside = panel && panel.contains(document.activeElement);
    if (!alreadyInside) {
      const target =
        (initialFocusRef && initialFocusRef.current) || panel;
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = openModals.indexOf(entry);
      if (index !== -1) openModals.splice(index, 1);
      releaseScrollLock();

      const restoreTo = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (restoreTo && typeof restoreTo.focus === 'function' && document.contains(restoreTo)) {
        restoreTo.focus({ preventScroll: true });
      }
    };
    // `closeOnEscape` and `initialFocusRef` are read once on open by design;
    // a modal does not change its dismissal contract mid-life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, requestClose]);

  // Focus trap. Tab and Shift+Tab wrap inside the panel instead of walking
  // out into the (inert, scroll-locked) page behind the dialog.
  const handleKeyDownCapture = useCallback((event) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusable = getFocusable(panel);
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!panel.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }, []);

  // Backdrop dismissal fires on mousedown-then-click of the overlay itself.
  // Guarding on the mousedown target stops a text selection that starts
  // inside the panel and ends on the backdrop from closing the dialog.
  const backdropArmedRef = useRef(false);

  const handleMouseDown = useCallback((event) => {
    backdropArmedRef.current = event.target === event.currentTarget;
  }, []);

  const handleClick = useCallback(
    (event) => {
      if (!closeOnBackdrop) return;
      if (event.target !== event.currentTarget) return;
      if (!backdropArmedRef.current) return;
      backdropArmedRef.current = false;
      requestClose();
    },
    [closeOnBackdrop, requestClose]
  );

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const overlayClasses = twMerge(
    clsx(
      'fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in',
      MODAL_LAYERS[layer] || MODAL_LAYERS.base,
      scrollable && 'overflow-y-auto',
      overlayClassName
    )
  );

  const panelClasses = twMerge(clsx('relative outline-none animate-modal-pop', className));

  // `data-modal-*` are hooks for the mobile full-screen rules in index.css.
  // They exist because every caller passes its own max-w/rounded/my-* classes,
  // and a CSS media query can override those regardless of what was passed —
  // whereas merging Tailwind utilities here could not, without auditing all
  // sixteen call sites for conflicts.

  return createPortal(
    <div
      ref={overlayRef}
      className={overlayClasses}
      data-modal-overlay={compact ? undefined : ""}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={labelledBy ? undefined : ariaLabel}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <div ref={panelRef} tabIndex={-1} data-modal-panel={compact ? undefined : ""} className={panelClasses} style={style} dir={dir}>
        <ErrorBoundary compact componentName={componentName} onReset={requestClose}>
          {children}
        </ErrorBoundary>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
