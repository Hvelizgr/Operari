'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Decoded-text reveal — each character cycles through random glyphs
 * until it "settles" on the real character, left-to-right. Reads as
 * a terminal/SRE flourish without being cursy.
 *
 * v3 of anime.js (what we ship) does NOT include the scrambleText
 * primitive that landed in v4, so this is a hand-rolled
 * implementation. The cost is ~30 LOC; the upgrade-to-v4 cost is a
 * breaking-change rewrite of the 5 existing anime call-sites
 * (Hero terminal, MetricsBar counter, Comparison table stagger,
 * Templates / TriggerSources stagger hook), which is not worth the
 * one missing helper.
 *
 * Algorithm:
 *   - On mount, mark every char unsettled and start a ~33fps loop.
 *   - Each tick, every unsettled char gets a random glyph; once per
 *     interval ticks we settle the leftmost unsettled char.
 *   - Stops once all settled. Total wall time ≈
 *     `text.length * settleEvery * tickMs`.
 *
 * `prefers-reduced-motion` short-circuits to the static text — no
 * loop, no randomness, accessibility-correct.
 */

interface ScrambleTextProps {
  text: string;
  /** Fixed glyph pool the scrambler samples from. Kept narrow + ASCII
   *  so RTL / locale-glyph rendering stays predictable. */
  glyphs?: string;
  /** ms between scramble ticks. Lower = jitterier. */
  tickMs?: number;
  /** How many ticks each char scrambles before settling. */
  settleEvery?: number;
  /** Delay before the loop starts, in ms. Pairs with the rest of the
   *  hero's stagger so the headline doesn't decode before the badge
   *  has faded in. */
  startDelayMs?: number;
  className?: string;
  /** When true, skip animation (used for the gradient sub-line that
   *  must stay solid for the gradient mask to paint, not jitter). */
  staticOnly?: boolean;
}

const DEFAULT_GLYPHS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]<>/\\|*$#@';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ScrambleText({
  text,
  glyphs = DEFAULT_GLYPHS,
  tickMs = 30,
  settleEvery = 2,
  startDelayMs = 0,
  className,
  staticOnly = false,
}: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (staticOnly) {
      setDisplay(text);
      return;
    }
    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }

    // Start fully scrambled so the first paint isn't the real text
    // briefly before the loop kicks in.
    const initial = text
      .split('')
      .map(ch =>
        ch === ' ' || ch === '\n' ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]
      )
      .join('');
    setDisplay(initial);

    let settledCount = 0;
    let tickCount = 0;

    const start = () => {
      intervalRef.current = setInterval(() => {
        tickCount += 1;
        // Settle one more char every `settleEvery` ticks. Whitespace
        // counts as settled for free so we don't waste ticks on it.
        if (tickCount % settleEvery === 0) {
          settledCount += 1;
        }
        const next = text
          .split('')
          .map((ch, idx) => {
            if (idx < settledCount) return ch;
            if (ch === ' ' || ch === '\n') return ch;
            return glyphs[Math.floor(Math.random() * glyphs.length)];
          })
          .join('');
        setDisplay(next);
        if (settledCount >= text.length && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setDisplay(text);
        }
      }, tickMs);
    };

    if (startDelayMs > 0) {
      startTimerRef.current = setTimeout(start, startDelayMs);
    } else {
      start();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
    };
  }, [text, glyphs, tickMs, settleEvery, startDelayMs, staticOnly]);

  return <span className={className}>{display}</span>;
}
