'use client';

import { useEffect, useRef } from 'react';

/**
 * Magnetic-button hook — when the cursor enters a `radius` zone
 * around the element, the element translates a fraction of the way
 * toward the cursor. Reads as "this button wants to be clicked"
 * without being a heavy hover effect. Apple / Linear / Vercel
 * landing-page pattern.
 *
 * The translation is bounded by `strength` (0..1, default 0.35) so
 * the button never drifts more than ~40% of the way to the cursor —
 * keeping focus targets predictable for keyboard users (we never
 * mutate layout, only `transform`).
 *
 * Honors `prefers-reduced-motion`: the hook short-circuits and the
 * element stays static. Touch devices skip too because pointermove
 * doesn't fire idiomatically there (the listener attaches but the
 * event sequence on tap doesn't hover-feel).
 *
 * Pointer math:
 *   - dx, dy = cursor offset from element centre
 *   - distance = euclidean
 *   - if distance > radius → reset transform
 *   - else translate by (dx * strength, dy * strength) with smooth
 *     CSS transition. We don't lerp manually because rAF + transform
 *     fights the CSS transition; one of them owns the easing.
 */

interface UseMagneticOptions {
  /** Pixels from the element centre at which the magnetism kicks in. */
  radius?: number;
  /** Fraction of the cursor offset the element follows (0..1). */
  strength?: number;
}

export function useMagnetic<T extends HTMLElement>({
  radius = 100,
  strength = 0.35,
}: UseMagneticOptions = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Pointer-fine media query — magnetism only fires on devices
    // with a precise pointer (mouse / trackpad). Touch devices and
    // hybrid laptops in tablet mode skip.
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) {
        el.style.transform = '';
        return;
      }
      el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
    };

    const onLeave = () => {
      el.style.transform = '';
    };

    // Listen on window so we get the cursor approaching from outside;
    // a listener on the element itself would only fire after entry,
    // missing the "magnetism kicks in before contact" sensation.
    window.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    // Smooth CSS transition for the snap-back when the cursor leaves
    // the radius. Inline so the consumer doesn't have to duplicate it
    // on every magnetic button.
    const prevTransition = el.style.transition;
    el.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';

    return () => {
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transform = '';
      el.style.transition = prevTransition;
    };
  }, [radius, strength]);

  return ref;
}
