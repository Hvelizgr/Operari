'use client';

import { useInView, useReducedMotion } from 'framer-motion';
import { type RefObject, useEffect, useRef, useState } from 'react';

/**
 * Drives a looping, frame-by-frame landing animation: `tick` goes
 * 0 → total-1 at `delays[tick]` ms per frame, then restarts. Runs only
 * while `ref` is on screen, and jumps straight to the last frame for
 * reduced-motion users so they still see the finished state.
 */
export function useSequence(
  ref: RefObject<Element | null>,
  delays: number[],
  { loop = true }: { loop?: boolean } = {}
) {
  const inView = useInView(ref, { margin: '-80px' });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const delaysRef = useRef(delays);
  delaysRef.current = delays;

  useEffect(() => {
    if (reduce) {
      setTick(delaysRef.current.length - 1);
      return;
    }
    if (!inView) return;
    const last = delaysRef.current.length - 1;
    if (tick >= last && !loop) return;
    const id = setTimeout(
      () => setTick(t => (t >= last ? 0 : t + 1)),
      delaysRef.current[Math.min(tick, last)] ?? 60
    );
    return () => clearTimeout(id);
  }, [tick, inView, reduce, loop]);

  return { tick, inView, restart: () => setTick(0) };
}
