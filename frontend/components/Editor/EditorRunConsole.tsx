'use client';

import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import ExecutionEventLog from '@/components/Runs/ExecutionEventLog';
import { useEditorStore } from '@/state/editorStore';

/**
 * In-editor "run console" — a bottom-pinned drawer that surfaces the
 * exact same `ExecutionEventLog` rendered on the dedicated `/runs/:id`
 * page, but inside the canvas so the operator can audit a run without
 * leaving the editor. Mounted by Canvas.tsx alongside the other
 * floating panels (Inspector, Palette, Toolbar).
 *
 * Visibility rules:
 *   - Hidden when no `?run=<id>` is present in the URL — no run, no
 *     log to render.
 *   - Auto-opens the first time a run id appears, so a Simulación
 *     click immediately reveals the console without an extra step.
 *   - The operator can collapse to a thin bar via the chevron; the
 *     collapsed state is local-only and resets when the run id
 *     changes (a fresh run re-opens the panel).
 *
 * Live-tail mode flips on whenever any node on the canvas is in the
 * `running` state. The live flag tells `ExecutionEventLog` to poll
 * `/api/runs/:id/events?afterSeq=...` for the delta; once every node
 * has reached a terminal state, polling stops and the log is a
 * one-shot fetch.
 *
 * Why reuse `ExecutionEventLog` instead of a bespoke editor-only
 * console: the legacy editor's terminal panel was tied to the V1
 * canvas's socket implementation and would have to be rebuilt
 * against the React Flow store. The Runs page already has the
 * filter chips, follow-tail, jump-to-latest pill, and retry-from-step
 * affordances — duplicating that in the editor would just diverge.
 */
export default function EditorRunConsole({ lang }: { lang: 'en' | 'es' }) {
  const params = useSearchParams();
  const executionId = params.get('run');
  // Live-tail when at least one node still says it's running. The
  // store-level selector keeps re-renders narrow — flipping a single
  // node's status is the only thing that can change `live`.
  const live = useEditorStore(s => s.nodes.some(n => n.data?.status === 'running'));
  const [open, setOpen] = useState(true);

  // Re-open on each new run id so a fresh Simulación click always
  // reveals the console — even if the operator collapsed the previous
  // run's panel.
  useEffect(() => {
    if (executionId) setOpen(true);
  }, [executionId]);

  if (!executionId) return null;

  const titleLabel = lang === 'es' ? 'Consola del run' : 'Run console';

  return (
    <div
      className="absolute bottom-4 left-1/2 z-30 w-[min(720px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-white/10 bg-[#0e1117]/95 shadow-2xl backdrop-blur"
      data-rb-run-console
    >
      {/* Header row: collapse toggle + run id chip + live indicator. */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-t-lg px-3 py-2 text-xs text-zinc-200 transition-colors hover:bg-white/5"
      >
        <span className="flex items-center gap-2">
          <Terminal size={13} className="text-emerald-400" />
          <span className="font-medium">{titleLabel}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {executionId.slice(0, 8)}
          </span>
          {live ? (
            <span className="flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
              live
            </span>
          ) : null}
        </span>
        <span className="text-zinc-500">
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>
      {open ? (
        <div
          className="max-h-[40vh] overflow-y-auto border-t border-white/10"
          // Stop wheel from propagating to React Flow so scrolling the
          // log doesn't accidentally pan/zoom the canvas behind it.
          onWheelCapture={e => e.stopPropagation()}
        >
          <ExecutionEventLog runId={executionId} lang={lang} live={live} />
        </div>
      ) : null}
    </div>
  );
}
