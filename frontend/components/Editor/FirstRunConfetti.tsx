'use client';

import anime from 'animejs';
import { useEffect, useRef } from 'react';

import { prefersReducedMotion } from '@/lib/motion';
import { storageRead, storageWrite } from '@/lib/storage-compat';

/**
 * One-shot confetti burst the first time the user's very first run
 * completes. The design-review pass called it out as a delight
 * moment; shipping as part of the activation chain so the first
 * successful ⌘+Enter reads as "you did the thing".
 *
 * Gated on a localStorage flag so the burst never fires twice per
 * browser — operators running twice in a minute would otherwise see
 * it stick around. Flag is a sibling to `operari:hasRunFirstRunbook`
 * (OnboardingRunHint's flag) intentionally: the hint may have been
 * dismissed manually while confetti should still play on the first
 * real run.
 *
 * Reduced-motion: the confetti is purely cosmetic, so we skip it
 * entirely when `prefers-reduced-motion: reduce` matches. The flag
 * is still set so the user never gets a "pop" later if they toggle
 * their OS setting.
 */

const FLAG_KEY = 'operari:sawFirstRunConfetti';

const COLORS = [
  '#3ecf8e', // emerald (brand)
  '#facc15', // amber
  '#60a5fa', // sky
  '#f472b6', // pink
  '#a78bfa', // violet
];

interface FirstRunConfettiProps {
  /** Transition from false→true fires the burst (once, per browser).
   *  Parent should pass `true` after the run completes successfully. */
  runCompleted: boolean;
}

export default function FirstRunConfetti({ runCompleted }: FirstRunConfettiProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const prevCompletedRef = useRef(runCompleted);
  const firedRef = useRef(false);

  useEffect(() => {
    const prev = prevCompletedRef.current;
    prevCompletedRef.current = runCompleted;
    // Only fire on the false→true edge — stops re-runs of the same
    // state (parent re-renders) from triggering again.
    if (prev || !runCompleted) return;
    if (firedRef.current) return;

    // Per-browser gate via localStorage.
    if (storageRead(FLAG_KEY)) return;

    // Mark fired before the burst so even an animation failure won't
    // leave the flag clean for a double-fire on quick re-run.
    storageWrite(FLAG_KEY, '1');
    firedRef.current = true;

    if (prefersReducedMotion()) return;

    const root = rootRef.current;
    if (!root) return;

    // Spawn 40 tiny divs in the centre and ask anime to burst them
    // outward with gravity-like drift. Using a stable particle count
    // keeps the animation performant on low-end hardware.
    const particles: HTMLSpanElement[] = [];
    for (let i = 0; i < 40; i++) {
      const dot = document.createElement('span');
      dot.style.position = 'absolute';
      dot.style.top = '50%';
      dot.style.left = '50%';
      dot.style.width = '8px';
      dot.style.height = '8px';
      dot.style.borderRadius = '2px';
      dot.style.background = COLORS[i % COLORS.length];
      dot.style.pointerEvents = 'none';
      dot.style.transform = 'translate(-50%, -50%)';
      root.appendChild(dot);
      particles.push(dot);
    }

    anime({
      targets: particles,
      translateX: () => anime.random(-220, 220),
      translateY: () => anime.random(-160, 40),
      rotate: () => anime.random(-360, 360),
      opacity: [
        { value: 1, duration: 100 },
        { value: 0, duration: 700, delay: 300 },
      ],
      scale: [
        { value: 1, duration: 100 },
        { value: 0.6, duration: 700 },
      ],
      easing: 'easeOutCubic',
      duration: 1000,
      complete: () => {
        // Clean up the DOM once the animation finishes. Leaving
        // invisible particles in the layer would accumulate if the
        // burst ever fired twice (it won't, but defence in depth).
        for (const p of particles) p.remove();
      },
    });
  }, [runCompleted]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    />
  );
}
