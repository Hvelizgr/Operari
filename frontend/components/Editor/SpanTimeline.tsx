'use client';

import { useEffect, useState } from 'react';

import { formatDateTime } from '@/lib/datetime';

interface SpanTimelineProps {
  /** ISO string or epoch ms when the step started — null when it hasn't run yet. */
  startedAt: string | number | null | undefined;
  /** Final duration in ms once the step terminated; null while still running. */
  durationMs: number | null | undefined;
  lang: 'en' | 'es';
}

const STRINGS = {
  en: { started: 'Started', finished: 'Finished', running: 'Running…', noRun: 'No run yet' },
  es: { started: 'Inició', finished: 'Terminó', running: 'En curso…', noRun: 'Sin ejecuciones' },
} as const;

/**
 * Compact horizontal "span" view (trigger.dev parity) shown in the
 * inspector for the selected step. Reads as `started ── duration ── finished`
 * with the timestamps left- and right-anchored. Renders a live "Running…"
 * pill when the step is in flight (no durationMs yet).
 *
 * The component is dimension-only — it tells the operator WHEN, not
 * WHAT. The output / error / config slots above already cover content;
 * this fills the temporal context that "ran 2.3s" alone misses.
 */
export function SpanTimeline({ startedAt, durationMs, lang }: SpanTimelineProps) {
  const t = STRINGS[lang] ?? STRINGS.en;
  // Tick once per second while the step is running so the live
  // duration label keeps moving. Cleared when durationMs lands.
  const [, setTick] = useState(0);
  const isRunning = startedAt != null && durationMs == null;
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  if (startedAt == null) {
    return <p className="px-1 py-2 text-[10px] italic text-gray-500">{t.noRun}</p>;
  }

  const start = typeof startedAt === 'string' ? new Date(startedAt) : new Date(startedAt);
  const elapsed = durationMs ?? Date.now() - start.getTime();
  const end = durationMs != null ? new Date(start.getTime() + durationMs) : null;

  return (
    <div className="space-y-1 px-1 py-2">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-300">
        <span>{t.started}</span>
        <span>{end ? t.finished : t.running}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
        <span className="shrink-0 tabular-nums">{formatDateTime(start, lang)}</span>
        <div className="h-px flex-1 bg-white/10" />
        <span
          className="shrink-0 rounded-full bg-emerald-700/40 px-2 py-0.5 font-mono text-[9px] text-emerald-200"
          title={`${elapsed} ms`}
        >
          {formatElapsed(elapsed)}
        </span>
        <div className="h-px flex-1 bg-white/10" />
        <span className="shrink-0 tabular-nums">
          {end ? formatDateTime(end, lang) : <span className="text-gray-600">—</span>}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact ms → human duration: "240ms" / "2.4s" / "1m 25s" / "2h 14m".
 * Mirrors trigger.dev's `formatSpanDuration` behaviour but reads ms,
 * not ns, since Operari speaks ms throughout.
 */
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSecs = Math.round(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${secs}s`;
}
