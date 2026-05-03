'use client';

import { useEffect, useState } from 'react';

interface LiveCountdownProps {
  /** Target time as a Date / ISO string / epoch ms. */
  endTime: Date | string | number;
  /**
   * Tick frequency in ms. Default 250 — reads as a smooth countdown
   * for sub-minute remaining; bump to 1000 for hour-scale countdowns
   * if the rerender cost matters.
   */
  updateInterval?: number;
  /** Custom "expired" copy shown after the countdown hits zero. */
  expiredText?: string;
  /** When true, prefixes the rendered string with "in " — useful for
   *  "next run in 14s" lines. */
  prefix?: boolean;
  className?: string;
}

/**
 * Live countdown to a future timestamp (trigger.dev parity). Stops
 * ticking once the target is in the past so an expired deadline does
 * not keep re-rendering the parent forever.
 *
 * Used in Operari for:
 *   - Approval timeouts ("auto-reject in 1h 23m")
 *   - Wait-step remaining time ("wait — 4m 12s left")
 *   - Scheduled runs in the dashboard ("next run in 38s")
 *
 * The format follows the same units the inspector's duration footer
 * uses so the operator sees a consistent "<N>h <N>m <N>s" everywhere
 * — no off-by-one between e.g. "1h" and "60m" depending on which
 * helper rendered it.
 */
export function LiveCountdown({
  endTime,
  updateInterval = 250,
  expiredText = 'expired',
  prefix = false,
  className,
}: LiveCountdownProps) {
  const targetMs =
    typeof endTime === 'number'
      ? endTime
      : (typeof endTime === 'string' ? new Date(endTime) : endTime).getTime();

  const [now, setNow] = useState(() => Date.now());
  const remaining = targetMs - now;

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= targetMs) clearInterval(id);
    }, updateInterval);
    return () => clearInterval(id);
    // `targetMs` is the only relevant identity — `remaining` would
    // re-create the interval on every tick, defeating the steady cadence.
  }, [targetMs, updateInterval, remaining]);

  if (remaining <= 0) {
    return <span className={className}>{expiredText}</span>;
  }

  const text = formatRemaining(remaining);
  return <span className={className}>{prefix ? `in ${text}` : text}</span>;
}

/**
 * Render a positive duration as a compact unit string.
 *   ms < 1s          → "Xms"
 *   ms < 1m          → "Xs"
 *   ms < 1h          → "Xm Ys"
 *   otherwise        → "Xh Ym"
 *
 * Mirrors trigger.dev's `formatDuration` short-style output so the
 * countdown shape matches the inline footer the rest of the editor
 * already shows.
 */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  if (totalSecs < 3600) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  }
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}
