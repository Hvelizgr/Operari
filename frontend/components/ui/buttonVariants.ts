import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Centralised variant API for the small icon buttons that line the
 * editor's floating toolbars (NodeContextToolbar, EdgeContextMenu,
 * help-drawer toggles, soon: Toolbar more-menu items).
 *
 * Why cva over inline ternaries: every action toolbar in the editor
 * was hand-rolling the same shape (square 7×7 button with hover bg)
 * plus a per-action hover tint (mostly-neutral default, moss-green
 * for "run from here", red for destructive deletes, emerald for
 * "active" toggles like breakpoints + open drawers). The ternary
 * approach (`${base} ${active ? on : off}`) drifts across files —
 * one site uses `bg-emerald-900/30`, another uses `bg-emerald-700/20`,
 * and the eye notices. A single cva variant set is the source of
 * truth.
 *
 * Apply with: `<button className={iconButton({ tone: 'destructive' })}>`
 *
 * The variants are intentionally narrow — adding more is fine, but
 * any new component shouldn't reach for cva until the pattern repeats
 * twice; otherwise it adds indirection without saving lines.
 */
export const iconButton = cva(
  'flex items-center justify-center rounded transition-colors disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'h-6 w-6',
        md: 'h-7 w-7',
        lg: 'h-8 w-8',
      },
      tone: {
        /** Default: low-contrast neutral hover. Used by Duplicate,
         *  Detach, anything that doesn't need to telegraph severity. */
        neutral: 'text-[color:var(--rb-node-text)] hover:bg-white/10 disabled:opacity-40',
        /** Run / launch / "go" actions. Moss-green hover tint matches
         *  the editor's primary success palette. */
        primary:
          'text-[color:var(--rb-node-text)] hover:bg-[color:var(--op-moss)]/15 hover:text-[color:var(--op-moss)] disabled:opacity-40',
        /** Destructive: delete, drop, revoke. Red hover tint, never the
         *  default — operator should have to aim for it. */
        destructive:
          'text-[color:var(--rb-node-text)] hover:bg-[color:var(--rb-edge-failed)]/20 hover:text-[color:var(--rb-edge-failed)] disabled:opacity-40',
      },
      /** Active state — toggle is engaged (breakpoint armed, panel
       *  open). Renders the foreground in the tone color regardless
       *  of hover, so the operator can spot it at a glance. */
      active: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        active: true,
        tone: 'destructive',
        class: 'text-[color:var(--rb-edge-failed)]',
      },
      {
        active: true,
        tone: 'primary',
        class: 'text-[color:var(--op-moss)]',
      },
    ],
    defaultVariants: {
      size: 'md',
      tone: 'neutral',
      active: false,
    },
  }
);

export type IconButtonVariants = VariantProps<typeof iconButton>;

/**
 * Bordered chip-style buttons used in toolbar headers (Help, Templates,
 * Send), where the surface is a strip rather than a floating panel. The
 * key visual difference vs `iconButton`: bordered, taller, gap between
 * icon + label, and an "active" state that swaps to an emerald accent
 * to signal an open drawer / pinned mode.
 */
export const chipButton = cva(
  'flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      tone: {
        neutral: 'border-zinc-700 text-zinc-300 hover:bg-zinc-800',
        primary: 'border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
);

export type ChipButtonVariants = VariantProps<typeof chipButton>;
