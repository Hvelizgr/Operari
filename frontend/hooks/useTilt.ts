'use client';

import { useEffect, useRef } from 'react';

/**
 * 3D tilt-on-hover hook — the element rotates a few degrees on each
 * axis based on cursor position relative to its centre. Reads as
 * "this card has depth" without committing to a full 3D scene.
 *
 * Bound on `pointermove` over the element itself (not window) so the
 * effect only fires when the cursor is over the card. On
 * `pointerleave` the rotation eases back to flat with the same
 * 280ms cubic-bezier as `useMagnetic` so the gesture vocabulary
 * stays consistent across the landing.
 *
 * Skipped under `prefers-reduced-motion` AND on coarse pointers
 * (touch / hybrid laptop in tablet mode) — tap on a tilted card
 * doesn't read as intent, just as jitter.
 *
 * Pointer math:
 *   - dx, dy = cursor offset from element centre, normalised to [-1, 1]
 *   - rotateX = -dy * maxRotate  (cursor up → card tips toward viewer)
 *   - rotateY =  dx * maxRotate  (cursor right → right edge tips back)
 *
 * The wrapper element gets `transform-style: preserve-3d` and a CSS
 * `perspective` so children with their own transforms (e.g. corner
 * arrow icons) inherit the depth without stacking-context fights.
 */

interface UseTiltOptions {
  /** Max rotation in degrees on each axis. 6° feels luxe; 12° starts
   *  reading as a roller coaster. */
  maxRotate?: number;
  /** CSS perspective in px. Lower = more pronounced 3D, higher =
   *  flatter. 800 matches Apple's product cards. */
  perspective?: number;
}

export function useTilt<T extends HTMLElement>({
  maxRotate = 6,
  perspective = 800,
}: UseTiltOptions = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      const rotateX = -dy * maxRotate;
      const rotateY = dx * maxRotate;
      el.style.transform = `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    };
    const onLeave = () => {
      el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg)`;
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    const prevTransition = el.style.transition;
    const prevTransformStyle = el.style.transformStyle;
    el.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transformStyle = 'preserve-3d';

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transform = '';
      el.style.transition = prevTransition;
      el.style.transformStyle = prevTransformStyle;
    };
  }, [maxRotate, perspective]);

  return ref;
}
