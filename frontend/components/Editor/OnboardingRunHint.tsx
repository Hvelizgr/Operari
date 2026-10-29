'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  motionFor,
  overlayPillVariants,
  reducedOverlayPillVariants,
  usePrefersReducedMotion,
} from '@/lib/motion';

/**
 * First-run hint — canvas-level.
 *
 * Research consensus on dev-tool onboarding (PostHog / Linear /
 * Supabase A/B data, 2024-25): the single most actionable moment
 * in a new-user flow is showing them the one keyboard shortcut that
 * produces visible success. Here that shortcut is Ctrl+Enter / ⌘+Enter
 * to fire a run.
 *
 * When this renders
 *   - user has a runbook on the canvas (nodes > 0)
 *   - no execution has happened YET in this tenant-session
 *     (localStorage flag `operari:hasRunFirstRunbook` is unset)
 *   - not currently executing (CanvasRunStatus owns that slot instead)
 *
 * When it stops rendering
 *   - user clicks the × to dismiss
 *   - user successfully fires their first run (parent clears the flag)
 *   - hasExecution prop becomes true (run in-flight)
 *
 * The localStorage flag persists across sessions, so the hint only
 * ever shows once per browser. Operators who signed up months ago
 * won't see it again after a new dashboard redesign.
 */

interface OnboardingRunHintProps {
  /** Number of nodes on the canvas. 0 = empty canvas, skip hint. */
  nodeCount: number;
  /** Whether a run is currently in-flight. Hides the hint so it
   *  doesn't overlap CanvasRunStatus. */
  isExecuting: boolean;
  /** Whether the tenant has any execution history. True = user has
   *  run before, hint is unnecessary and hidden. */
  hasExecution: boolean;
  lang: 'en' | 'es';
}

const STORAGE_KEY = 'operari:hasRunFirstRunbook';

const LABELS = {
  en: {
    hint: 'to run',
    dismiss: 'Dismiss',
  },
  es: {
    hint: 'para ejecutar',
    dismiss: 'Ocultar',
  },
} as const;

export default function OnboardingRunHint({
  nodeCount,
  isExecuting,
  hasExecution,
  lang,
}: OnboardingRunHintProps) {
  const reducedMotion = usePrefersReducedMotion();
  // Mount-time check against localStorage. Gated on `mounted` so the
  // SSR pass doesn't render a hint that flashes for a user who has
  // already seen it — hydration mismatch and a visual glitch both.
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Also clear the hint the moment execution starts — the hint has
    // done its job, and the canvas status pill takes this slot.
    if (hasExecution && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
  }, [hasExecution]);

  const shouldShow =
    mounted &&
    !dismissed &&
    !isExecuting &&
    nodeCount > 0 &&
    !(typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY));

  const t = LABELS[lang];
  // Browser-aware modifier label so Mac users see ⌘ and everyone
  // else sees Ctrl — matching the actual binding in useEditorTools.
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
  const mod = isMac ? '⌘' : 'Ctrl';
  const variants = motionFor(overlayPillVariants, reducedOverlayPillVariants, reducedMotion);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          key="onboarding-run-hint"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="bg-primary/20 border-primary/40 pointer-events-auto absolute left-1/2 top-3 z-40 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md"
          style={{ x: '-50%' }}
          role="status"
        >
          <Play size={11} className="shrink-0" />
          <kbd className="rounded border border-white/20 bg-black/30 px-1.5 py-0.5 font-mono text-[10px]">
            {mod}
          </kbd>
          <span className="text-white/60">+</span>
          <kbd className="rounded border border-white/20 bg-black/30 px-1.5 py-0.5 font-mono text-[10px]">
            Enter
          </kbd>
          <span>{t.hint}</span>
          <button
            onClick={() => setDismissed(true)}
            aria-label={t.dismiss}
            className="ml-1 text-white/60 hover:text-white"
          >
            <X size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
