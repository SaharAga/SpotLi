import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { MODAL_LAYERS } from './Modal';

/**
 * What a lazily-loaded dialog shows while its chunk is in flight.
 *
 * Deliberately *not* a <Modal>. The real dialog is about to mount its own
 * <Modal>, and that shell captures `document.activeElement` on mount so it
 * can restore focus on close. If the fallback were a <Modal> too, it would
 * capture the trigger button, then release it on unmount (focusing it again)
 * a frame before the real dialog captured it a second time — visible focus
 * churn, plus a scroll-lock refcount that drops to zero in between and
 * flashes the page's scrollbar back.
 *
 * So this renders the backdrop and a spinner only: no focus capture, no
 * Escape handler, no scroll lock. `activeElement` is left on the trigger,
 * which is exactly where the real <Modal> expects to find it.
 *
 * The backdrop matters. Rendering nothing while the chunk loads leaves the
 * click looking like it did nothing; rendering an empty modal shell is worse
 * still, because the panel then re-lays-out when the content arrives.
 */
export function ModalLoadingFallback({ label = 'Loading…' }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in ${MODAL_LAYERS.base}`}
      data-testid="modal-loading-fallback"
    >
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3 text-slate-300"
      >
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </div>
    </div>,
    document.body
  );
}

export default ModalLoadingFallback;
