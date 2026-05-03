'use client';

import anime from 'animejs';
import { useEffect, useRef } from 'react';

/**
 * Animated grid background — discrete cells in a fixed-size grid pulse
 * outward from the centre on a long, looped beat. Reads as "data
 * flowing through a system" without the hand-rolled-vibes feel of
 * particle canvases.
 *
 * Anime.js v3 stagger with `grid: [cols, rows]` + `from: 'center'`
 * gives the radial timing for free; we just animate opacity on the
 * cells. Runs ~once every 6s so the section never feels twitchy.
 *
 * `prefers-reduced-motion` short-circuits to a static low-opacity
 * grid (no JS loop). Same colours, same density — only motion
 * differs, so the visual contract holds.
 *
 * `pointer-events-none` + `aria-hidden` so the grid never affects
 * hit-testing or assistive tech; it's pure decoration.
 */

interface PulseGridBackgroundProps {
  /** Grid density. 16x10 fits a typical landing section without
   *  stuttering on low-end mobile (160 cells). */
  cols?: number;
  rows?: number;
  /** Tailwind colour class for the active-pulse glyph. Default
   *  matches the rest of the marketing accent palette. */
  className?: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PulseGridBackground({
  cols = 16,
  rows = 10,
  className,
}: PulseGridBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (prefersReducedMotion()) return;

    const cells = containerRef.current.querySelectorAll<HTMLElement>('[data-pulse-cell]');
    if (cells.length === 0) return;

    // The loop runs forever; we keep the anime instance around so
    // unmount can pause + reset (otherwise React StrictMode would
    // queue two parallel animations on the same elements during
    // dev double-mount).
    const animation = anime({
      targets: Array.from(cells),
      opacity: [
        { value: 0.05, duration: 0 },
        { value: 0.5, duration: 700, easing: 'easeOutQuad' },
        { value: 0.05, duration: 1200, easing: 'easeInQuad' },
      ],
      delay: anime.stagger(60, {
        grid: [cols, rows],
        from: 'center',
      }),
      loop: true,
      // Long pause between loops so the section doesn't feel
      // strobe-y. Total beat ≈ 6s.
      endDelay: 3500,
    });

    return () => {
      animation.pause();
    };
  }, [cols, rows]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => (
          <span
            key={i}
            data-pulse-cell
            className="border-r border-t border-emerald-400/10"
            style={{ opacity: 0.05 }}
          />
        ))}
      </div>
    </div>
  );
}
