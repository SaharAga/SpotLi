import React from 'react';

/**
 * The shared visual vocabulary.
 *
 * `Modal.jsx` only ever provided the shell — overlay, focus trap, ARIA — so
 * every surface hand-rolled its own header, sections, rows and buttons. That
 * is why the screens never matched each other: there was nothing to be
 * consistent *with*. Counted before this file existed: 61 bespoke button
 * styles across 8 modals, 25 in `PackageDetailModal` alone.
 *
 * These are deliberately small and unclever. The value is not abstraction, it
 * is that the protocol's rules get decided once here instead of re-decided at
 * every call site:
 *
 *   - every interactive element is >= 48px (CLAUDE.md, WCAG 2.5.8)
 *   - type comes off the rem scale, never an arbitrary px value
 *   - spacing and radii match the home screen
 *   - logical properties only, so RTL mirrors without a second thought
 *   - surfaces behind text are opaque, so contrast stays measurable
 *
 * Fix a touch target here and every caller inherits it.
 */

const FOCUS =
  'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus:outline-none';

/** Screen/section title. Rubik for display, matching the home header. */
export function Title({ children, className = '', id, ...rest }) {
  return (
    <h2 id={id} className={`font-display text-xl font-semibold tracking-tight text-slate-100 ${className}`} {...rest}>
      {children}
    </h2>
  );
}

/**
 * A labelled group. The label is the quiet uppercase eyebrow used across the
 * redesign — it orients without competing with the content under it.
 */
export function Section({ label, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-2.5 ${className}`}>
      {label && (
        <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">{label}</h3>
      )}
      {children}
    </section>
  );
}

/** A key/value row. `tone` colours the value for status-bearing rows. */
export function Row({ label, value, tone = 'default', className = '' }) {
  const tones = {
    default: 'text-slate-100',
    muted: 'text-slate-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
    success: 'text-emerald-400'
  };
  return (
    <div
      className={`flex items-center justify-between gap-3 min-h-[48px] px-4 rounded-xl bg-slate-900 border border-slate-800 ${className}`}
    >
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-bold text-end ${tones[tone] || tones.default}`}>{value}</span>
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white border border-transparent',
  secondary: 'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800 hover:border-slate-700',
  danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 border border-transparent'
};

/**
 * The one button. `min-h-[48px]` is not overridable by accident — it is the
 * rule the app kept breaking, 112 times, before this existed.
 */
export function Button({
  variant = 'secondary',
  icon: Icon,
  children,
  className = '',
  full = false,
  ...props
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary
      } ${full ? 'w-full' : ''} ${FOCUS} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Icon-only button. Square, still 48px — the size the icon rows kept missing. */
export function IconButton({ icon: Icon, label, variant = 'secondary', className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-xl transition-colors cursor-pointer ${
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary
      } ${FOCUS} ${className}`}
      {...props}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}

/** Status pill. Colour is never the only cue — the label always ships with it. */
export function Pill({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
    accent: 'bg-blue-500/12 text-blue-400 border-blue-500/30',
    transit: 'bg-cyan-500/12 text-cyan-400 border-cyan-500/30',
    warning: 'bg-amber-500/12 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/12 text-rose-400 border-rose-500/30',
    success: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30'
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
        tones[tone] || tones.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** A labelled form field wrapper. Inputs stay 48px and keep a visible label. */
export function Field({ label, hint, htmlFor, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-bold text-slate-400">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

/** Shared input styling, so every field in the app is the same object. */
export const inputClass =
  'w-full min-h-[48px] px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

/** An opaque surface for grouped content. Never translucent — see §3/§4. */
export function Card({ children, className = '', tone }) {
  const edge = tone
    ? { warning: 'border-amber-500/30', danger: 'border-rose-500/30', success: 'border-emerald-500/30' }[tone]
    : 'border-slate-800';
  return (
    <div className={`rounded-2xl bg-slate-900 border ${edge} p-4 ${className}`}>{children}</div>
  );
}

/**
 * Back, not close.
 *
 * An X says "this is a window over what you were doing"; a back arrow says
 * "you are one level into something". Inner pages — About inside Account,
 * Export inside Account, a package inside Status — are the latter, and the X
 * was a large part of why they still read as popups after they became
 * full-screen.
 *
 * The arrow is a directional icon, so it mirrors in RTL. Non-directional
 * icons (package, user, search) must NOT be flipped — see the bilingual rule
 * in the UI/UX protocol.
 */
export function BackButton({ onClick, label, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer ${FOCUS} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 rtl:rotate-180"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>
  );
}

/** Modal header: title, optional subtitle, and a back control. */
/**
 * One way back, in one place: a back arrow on the LEADING edge — left in
 * English, right in Hebrew, which `rtl:rotate-180` and normal flow give us for
 * free.
 *
 * This used to show a back arrow on mobile and an X on desktop, which produced
 * two problems at once. `hidden lg:inline-flex` silently lost to the
 * `inline-flex` already in IconButton's own base classes, so phones got BOTH
 * controls; and even working as intended, a screen that is reached by
 * navigating deserves the same affordance at every width. An X means "dismiss
 * this thing on top of the page" — these are pages.
 */
export function ModalHeader({ title, subtitle, onClose, closeLabel = 'Back', actions, titleId }) {
  return (
    <div className="flex flex-col border-b border-slate-800">
      {/* Native sheet drag handle indicator for mobile sheet appearance */}
      <div className="w-10 h-1 bg-slate-700/80 rounded-full mx-auto mt-2.5 -mb-1 shrink-0 lg:hidden" aria-hidden="true" />
      <div className="flex items-center gap-3 p-4 sm:p-6">
        {onClose && <BackButton onClick={onClose} label={closeLabel} className="shrink-0" />}
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <Title id={titleId}>{title}</Title>
          {subtitle && <p className="text-sm text-slate-400 leading-relaxed">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}


/** Footer action bar. Primary action last in DOM so it lands under the thumb. */
export function ModalFooter({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 p-4 sm:p-6 border-t border-slate-800 ${className}`}>
      {children}
    </div>
  );
}

/**
 * The single row shape every Account-tab list uses.
 *
 * One geometry for all of them — 52px, icon, label, optional trailing value,
 * optional trailing control — is what makes a list read as one screen. The
 * settings sections used to be bordered cards with label-above-value grids and
 * inset selects, which is why they looked borrowed from another app even once
 * their colours matched.
 *
 * A row with `onClick` and no `control` is a destination: it shows its current
 * value and a chevron, and opens a Picker. A row with a `control` owns its
 * value in place (a switch), so it gets no chevron and does not swallow the
 * control's own clicks.
 */
export function SettingRow({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
  control,
  tone = 'default',
  disabled,
  role,
  'aria-checked': ariaChecked,
  ...rest
}) {
  const tones = {
    default: 'text-slate-100',
    danger: 'text-rose-400',
    accent: 'text-blue-400'
  };
  const iconTones = {
    default: 'text-slate-400',
    danger: 'text-rose-400',
    accent: 'text-blue-400'
  };
  const base = `w-full flex items-center gap-3 min-h-[52px] px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-start ${
    onClick && !disabled ? 'hover:bg-slate-800 hover:border-slate-700 transition-colors cursor-pointer' : ''
  } ${FOCUS}`;

  const body = (
    <>
      {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconTones[tone]}`} aria-hidden="true" />}
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-bold truncate ${tones[tone] || tones.default}`}>{label}</span>
        {hint && <span className="block text-xs text-slate-500 truncate mt-0.5">{hint}</span>}
      </span>
      {value && <span className="shrink-0 text-sm text-slate-400 max-w-[45%] truncate">{value}</span>}
      {control}
      {onClick && !control && (
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          className="w-4 h-4 shrink-0 text-slate-600 rtl:rotate-180" aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </>
  );

  // Interactivity follows `onClick`, not the presence of a control: a picker
  // option carries a checkmark AND has to be clickable. A row whose control is
  // itself interactive (a Toggle) passes no onClick, so it stays a plain div
  // and never nests one interactive element inside another.
  if (!onClick) {
    return <div className={base} role={role} aria-checked={ariaChecked} {...rest}>{body}</div>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} role={role} aria-checked={ariaChecked} className={base} {...rest}>
      {body}
    </button>
  );
}

/** The switch a SettingRow carries when it owns its value in place. */
export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <label className="relative inline-flex items-center justify-center cursor-pointer shrink-0 min-h-[48px] min-w-[48px]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className="sr-only peer"
      />
      <span className="w-11 h-6 rounded-full bg-slate-700 peer-checked:bg-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-disabled:opacity-50 transition-colors" />
      {/* inset-inline-start, not a translate + rtl: pair — it already flips
          with `dir`, so one conditional class is correct both ways. */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-150 ${
          checked ? 'start-[22px]' : 'start-[2px]'
        }`}
      />
    </label>
  );
}
