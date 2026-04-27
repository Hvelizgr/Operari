/**
 * Shared motion primitives for Operari.
 *
 * One module owns every variant so timing, easing, and
 * prefers-reduced-motion behaviour stay consistent across overlays
 * and lists. Don't re-declare variants inside components — import
 * from here. If you need a new one, add it here first so the whole
 * app inherits the timing budget.
 *
 * Philosophy (matches the v2 design brief):
 *   - Motion is a signal, not decoration. Only animate things that
 *     communicate a state change.
 *   - ~180 ms for enter, ~120 ms for exit — fast enough to feel
 *     responsive, slow enough to register.
 *   - Respect prefers-reduced-motion: swap transforms for pure
 *     opacity, halve duration, kill loops.
 *
 * Tested surfaces using these variants (2026-04-24):
 *   CanvasRunStatus · OnboardingRunHint · JumpToLatestPill ·
 *   RetrySuccessBanner · event-log row append · sparkline tile stagger.
 */

import type { Transition, Variants } from 'framer-motion';

/**
 * Browser-safe reduced-motion check. Returns true during SSR so the
 * server-rendered output never includes mid-flight animation frames;
 * the client hydrates with motion re-enabled if the user hasn't
 * opted out.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Quick transition for pills / badges. Spring so the bounce reads as
 *  "something landed here", not "fading in". */
export const pillSpring: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
  mass: 0.6,
};

/** Linear fade for exits — spring on exit looks janky when combined
 *  with opacity: 0. */
export const exitFade: Transition = {
  duration: 0.12,
  ease: 'easeIn',
};

/** Overlay pill (CanvasRunStatus, OnboardingRunHint, JumpToLatestPill).
 *  Slide down from slightly above, scale 0.95→1, fade 0→1. On exit,
 *  fade out without slide so the pill dissolves in place. */
export const overlayPillVariants: Variants = {
  initial: { opacity: 0, y: -8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: pillSpring },
  exit: { opacity: 0, scale: 0.98, transition: exitFade },
};

/** Banner (RetrySuccessBanner, health banner). Slide from top, no
 *  scale — banners span more width so scale reads as "stretch". */
export const bannerVariants: Variants = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
  exit: { opacity: 0, y: -4, transition: exitFade },
};

/** Row entering a growing list (event log live tail). Small fade +
 *  short slide, keyed off seq so React's reconciler treats each row
 *  as distinct even when the list shrinks/grows. */
export const listRowVariants: Variants = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.14, ease: 'easeOut' } },
  exit: { opacity: 0, transition: exitFade },
};

/** Container that staggers its children on mount. Pair with
 *  staggerChildVariants on each child. Default 50 ms between kids —
 *  fast enough that a 4-card grid finishes inside 200 ms, slow
 *  enough that the sweep is perceptible left-to-right. */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

/** Child of a staggerContainer. Fade + tiny upward slide. */
export const staggerChildVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

/** Reduced-motion container: keep stagger short and opacity-only
 *  children. Still staggers so the sweep direction reads, but
 *  no translate + shorter duration. */
export const reducedStaggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.02,
    },
  },
};
export const reducedStaggerChildVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.08 } },
};

/** Reduced-motion variants. Components using prefersReducedMotion()
 *  should substitute these when the media query matches — pure
 *  opacity, no transform, no spring. */
export const reducedOverlayPillVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.08 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

export const reducedListRowVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.08 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

/**
 * Hook-friendly picker: returns the reduced variants when the user
 * prefers less motion, otherwise the full ones. Callers pass the
 * "normal" and "reduced" pair and get the right one back. Centralizes
 * the media-query read so individual components don't sprout
 * window.matchMedia calls.
 *
 * Usage:
 *   const v = motionFor(overlayPillVariants, reducedOverlayPillVariants);
 *   <motion.div variants={v} initial="initial" animate="animate" />
 */
export function motionFor(full: Variants, reduced: Variants): Variants {
  return prefersReducedMotion() ? reduced : full;
}
