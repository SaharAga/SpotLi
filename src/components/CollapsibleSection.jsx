import React, { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A titled section that starts folded away.
 *
 * Built for the add/edit package form, where sixteen fields — fourteen of them
 * optional — made a 1,878px scroll on a phone with 633px of window. Two fields
 * are required; the rest are answers most people do not have when they are
 * typing a tracking number in.
 *
 * `defaultOpen` exists for the case that makes this safe: a section holding
 * data the user cannot see is worse than a long form. Callers pass true when
 * the fields inside are already filled — editing a package that has pickup
 * details, or a Smart Import that guessed some — so nothing is ever hidden
 * behind a closed door without a hint.
 *
 * Kept uncontrolled on purpose: the open/closed state is presentation, and
 * lifting it into the form would put it one useState away from being saved.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.defaultOpen=false]
 * @param {string} [props.summary] short hint shown on the closed header, e.g. what is filled in
 */
export function CollapsibleSection({ title, children, defaultOpen = false, summary }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  // Content can arrive after mount — a Smart Import 1-tap auto-fill fills
  // fields in sections the user has never touched. Open for it, but never
  // close: pulling a section shut under someone who opened it deliberately
  // would be the worse half of "helpful".
  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center gap-3 px-4 py-3 text-start min-h-[48px] cursor-pointer"
      >
        <span className="flex-1 text-sm font-bold text-slate-200">{title}</span>
        {summary && !isOpen && (
          <span className="text-xs text-slate-400 truncate max-w-[45%]">{summary}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Unmounted rather than hidden: these are form fields, and a collapsed
          section that still renders inputs keeps them in the tab order. */}
      {isOpen && (
        <div id={contentId} className="px-4 pb-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
