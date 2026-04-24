/**
 * Inline run-status sparkline.
 *
 * Renders up to N tiny coloured tiles — one per recent run — so an
 * operator sees the recent health of a runbook without leaving the
 * current surface. Colour matches the status convention used on the
 * rest of the app (emerald = success, red = failed, sky = running,
 * amber = paused, zinc = cancelled, white/5 = empty slot).
 *
 * Empty slots are drawn with low-contrast tiles so the component
 * width is stable whatever the history depth — a runbook that ran
 * 3 times renders the same 20-slot strip as one that ran 300, with
 * the first 17 slots muted. This keeps cards and table rows aligned.
 *
 * Uses anime.js for a subtle staggered entrance when the component
 * mounts: tiles fade + translate in left→right over ~400ms. This is
 * where anime.js beats framer-motion — declarative stagger over a
 * static node list is anime's sweet spot, and the one-shot nature
 * (runs once per mount) keeps it cheap.
 */

'use client';

import anime from 'animejs';
import { useEffect, useRef } from 'react';

import { prefersReducedMotion } from '@/lib/motion';

interface SparklineProps {
  statuses: string[];
  /** Slot count. Defaults to 20. */
  slots?: number;
  /** Tile width in px. Default 4 for narrow table columns. */
  tileWidth?: number;
  /** Tile height in px. Default 16. */
  tileHeight?: number;
}

function color(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-500/80';
    case 'FAILED':
      return 'bg-red-500/80';
    case 'RUNNING':
      return 'bg-sky-500/80';
    case 'PAUSED':
      return 'bg-amber-500/80';
    case 'CANCELLED':
      return 'bg-zinc-500/60';
    default:
      return 'bg-white/5';
  }
}

export default function Sparkline({
  statuses,
  slots = 20,
  tileWidth = 4,
  tileHeight = 16,
}: SparklineProps) {
  const padded = [...Array(Math.max(0, slots - statuses.length)).fill('EMPTY'), ...statuses];
  const visible = padded.slice(-slots);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // One-shot stagger entrance on mount via anime.js. Each tile
  // starts translated 4px right + invisible, then slides to 0 with
  // a left→right stagger of 18ms. Reduced-motion pref skips the
  // animation entirely and leaves tiles in their final state.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = containerRef.current;
    if (!el) return;
    anime({
      targets: el.querySelectorAll('[data-spark-tile]'),
      translateX: [4, 0],
      opacity: [0, 1],
      easing: 'easeOutCubic',
      duration: 260,
      delay: anime.stagger(18),
    });
  }, []);

  return (
    <div ref={containerRef} className="flex items-center gap-[2px]" aria-hidden="true">
      {visible.map((s, i) => (
        <span
          key={i}
          data-spark-tile
          className={`rounded-sm ${color(s)}`}
          style={{ width: tileWidth, height: tileHeight }}
          title={s !== 'EMPTY' ? s : undefined}
        />
      ))}
    </div>
  );
}
