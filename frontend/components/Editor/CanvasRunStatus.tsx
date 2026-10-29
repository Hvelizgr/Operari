'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { HelixSpinner } from '@/components/Brand/HelixSpinner';
import { motionFor, overlayPillVariants, reducedOverlayPillVariants } from '@/lib/motion';

/**
 * Canvas-level run status pill.
 *
 * Sits absolute top-center over the editor canvas during an active
 * execution so an author glancing at the graph knows the run is
 * still in flight (vs. the topbar Run button which also indicates
 * this but lives outside the canvas focus area). Shows elapsed time
 * so the operator can eyeball "has this been stuck?" without
 * opening the event log.
 *
 * Visual states
 *   - executing && !hasFailedNode  → sky pulse, "Running · 0:42"
 *   - executing && hasFailedNode   → red pulse, "Running · step failed"
 *   - !executing                   → nothing (component returns null)
 *
 * This component does NOT touch node rendering or the drag-and-drop
 * path — it's purely an overlay. Zero interaction with FlowCanvas.
 */

interface CanvasRunStatusProps {
  executing: boolean;
  hasFailedNode: boolean;
  /** Wall-clock ms when the current run started. When null we render
   *  without the timer so an unknown start doesn't show "0:00" forever. */
  startedAt: number | null;
  lang: 'en' | 'es';
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const LABELS = {
  en: { running: 'Running', failed: 'step failed' },
  es: { running: 'Ejecutando', failed: 'paso falló' },
} as const;

export default function CanvasRunStatus({
  executing,
  hasFailedNode,
  startedAt,
  lang,
}: CanvasRunStatusProps) {
  // Tick every second to keep the elapsed time honest. Starts only
  // while executing so idle editors don't pay for this timer.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!executing) return;
    const id = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(id);
  }, [executing]);

  const t = LABELS[lang];
  const elapsed = executing && startedAt ? formatElapsed(Date.now() - startedAt) : null;
  const variants = motionFor(overlayPillVariants, reducedOverlayPillVariants);

  return (
    <AnimatePresence>
      {executing && (
        <motion.div
          key="canvas-run-status"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`pointer-events-none absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md ${
            hasFailedNode
              ? 'border-red-500/40 bg-red-950/70 text-red-100'
              : 'border-sky-500/40 bg-sky-950/70 text-sky-100'
          }`}
          style={{ x: '-50%' }}
          role="status"
          aria-live="polite"
        >
          {hasFailedNode ? (
            <AlertTriangle size={12} className="shrink-0" />
          ) : (
            <HelixSpinner size={12} className="shrink-0" />
          )}
          <span>{t.running}</span>
          {hasFailedNode && <span className="opacity-80">· {t.failed}</span>}
          {elapsed && <span className="font-mono tabular-nums opacity-80">· {elapsed}</span>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
