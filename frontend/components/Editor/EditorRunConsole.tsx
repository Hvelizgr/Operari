'use client';

import { ChevronDown, ChevronUp, Eraser, Play, Terminal } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useEditorStore } from '@/state/editorStore';

/**
 * Editor-specific run console — a self-contained terminal-style panel
 * that paints each step's status as a console.log line so the operator
 * can audit a run without leaving the canvas.
 *
 * Why custom instead of reusing `Runs/ExecutionEventLog`:
 *   - That component speaks the durable event store via
 *     `/api/runs/:id/events`, which only fills when
 *     `OPERARI_DURABLE_ENGINE=true`. A self-host setup without that
 *     flag would render an empty panel forever.
 *   - It bundles retry-from-step / cancel / follow-tail UI that's
 *     redundant inside the editor — the operator already has the run
 *     control buttons in the toolbar.
 *   - It was written for the V1 RunDetail page; sharing it across both
 *     surfaces would couple their UX evolutions.
 *
 * This console reads the same data the canvas reads (live socket
 * events + `/api/runs/:id` mount fetch) and renders them as terminal
 * lines. No durable-engine dependency. No V1 carry-over. Pure viewer.
 */

type BackendStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED';

interface ConsoleLine {
  /** Local-only key — monotonic counter so React reconciles cleanly
   *  even when two lines arrive in the same millisecond. */
  key: number;
  ts: number;
  level: 'info' | 'success' | 'error' | 'warn' | 'muted';
  /** Optional step / node id this line belongs to, used to render the
   *  monospace prefix in the same colour as the level chip. */
  nodeName?: string;
  text: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const STATUS_LEVEL: Record<BackendStatus, ConsoleLine['level']> = {
  RUNNING: 'info',
  PAUSED: 'warn',
  SUCCESS: 'success',
  FAILED: 'error',
  CANCELLED: 'warn',
  SKIPPED: 'muted',
};

const STATUS_VERB: Record<BackendStatus, string> = {
  RUNNING: 'started',
  PAUSED: 'paused',
  SUCCESS: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped',
};

const LEVEL_COLOR: Record<ConsoleLine['level'], string> = {
  info: 'text-sky-400',
  success: 'text-emerald-400',
  error: 'text-rose-400',
  warn: 'text-amber-300',
  muted: 'text-zinc-500',
};

const STRINGS = {
  en: {
    title: 'Run console',
    live: 'live',
    clear: 'Clear',
    waiting: 'Waiting for events…',
  },
  es: {
    title: 'Consola del run',
    live: 'en vivo',
    clear: 'Limpiar',
    waiting: 'Esperando eventos…',
  },
} as const;

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export default function EditorRunConsole({ lang }: { lang: 'en' | 'es' }) {
  const params = useSearchParams();
  const executionId = params.get('run');
  const t = STRINGS[lang];

  const [open, setOpen] = useState(true);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const lineKeyRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Run-level paused flag. Driven off the backend `execution_status`
  // socket event + the backfill response. While true, the console
  // shows a Continue button next to the close affordance — POSTs to
  // /executions/:id/resume which advances past the breakpoint (the
  // disarmed-breakpoints set inside the engine guards against an
  // immediate re-pause at the same node). Cleared once the next
  // execution_status arrives or the console resets on a new run id.
  const [paused, setPaused] = useState(false);
  const [resuming, setResuming] = useState(false);
  // Auto-follow tail. Operator can scroll up to inspect older lines;
  // a wheel-up takes us out of follow until they scroll back to ~48 px
  // of the bottom. Same threshold the Runs page uses.
  const [autoFollow, setAutoFollow] = useState(true);
  // Live tail flips whenever any node on the canvas reads `running`.
  // Cheap store selector, narrow re-renders.
  const live = useEditorStore(s => s.nodes.some(n => n.data?.status === 'running'));

  // Helper: append a line and bump the monotonic key.
  const append = (line: Omit<ConsoleLine, 'key'>) => {
    setLines(prev => [...prev, { ...line, key: ++lineKeyRef.current }]);
  };

  // Reset on each new run id, then backfill from the persisted state
  // and subscribe to the socket for further events. Mirrors what
  // `useExecutionSocket` already does at the canvas level — both
  // consumers run independently because the canvas needs node-keyed
  // updates and the console needs append-only lines.
  useEffect(() => {
    if (!executionId) {
      setLines([]);
      return;
    }

    setLines([]);
    lineKeyRef.current = 0;
    setOpen(true);
    setPaused(false);

    const startedAt = Date.now();
    append({
      ts: startedAt,
      level: 'info',
      text: `> attaching to run ${executionId.slice(0, 8)}…`,
    });

    // Backfill: the same `/api/runs/:id` the canvas backfill uses.
    // Reading nodeLogs gives us the full per-step status story even
    // when the run already terminated before we connected.
    //
    // For dry-runs that already completed, we replay the lines with
    // ~600ms between steps to match the canvas playback pacing — both
    // the canvas and the console then animate in sync, so the
    // operator can read each terminal line as the corresponding node
    // lights up. For real runs we append immediately because the
    // live socket carries the wall-clock progression.
    const ctrl = new AbortController();
    const replayTimers: ReturnType<typeof setTimeout>[] = [];

    fetch(`${API_BASE}/api/runs/${executionId}`, {
      credentials: 'include',
      signal: ctrl.signal,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            status?: BackendStatus;
            startedAt?: string;
            completedAt?: string;
            duration?: number | null;
            dryRun?: boolean;
            steps?: Array<{
              stepId: string;
              name?: string;
              type?: string;
              status: BackendStatus;
              duration?: number | null;
              error?: string | null;
            }>;
          } | null
        ) => {
          if (!data) return;
          const runStartedAt = data.startedAt ? Date.parse(data.startedAt) : startedAt;
          append({
            ts: runStartedAt,
            level: 'muted',
            text: `run.created  status=${data.status ?? '?'}`,
          });
          // Surface the Continue affordance immediately if the run was
          // paused before we connected — covers the breakpoint-then-
          // refresh case where the operator reloaded the editor while
          // the engine sat on a paused run.
          if (data.status === 'PAUSED') setPaused(true);

          const steps = data.steps ?? [];
          const shouldReplay =
            data.dryRun === true &&
            data.status !== 'RUNNING' &&
            data.status !== 'PAUSED' &&
            steps.length > 0;

          // Pacing must match the canvas playback in
          // useExecutionSocket — both share the constant so the
          // terminal line and the node animation land at the same
          // visual instant. Bumped GAP from 80 → 250 alongside
          // useExecutionSocket so the canvas success/fail bump has
          // time to finish before the next running line lands.
          const STEP_DURATION_MS = 600;
          const STEP_GAP_MS = 250;
          const PER_STEP = STEP_DURATION_MS + STEP_GAP_MS;

          if (!shouldReplay) {
            for (const step of steps) {
              const level = STATUS_LEVEL[step.status] ?? 'muted';
              const verb = STATUS_VERB[step.status] ?? step.status;
              const dur = step.duration != null ? `  ${step.duration}ms` : '';
              append({
                ts: runStartedAt,
                level,
                nodeName: step.name || step.stepId.slice(0, 8),
                text: `${verb}${step.type ? `  ${step.type}` : ''}${dur}${step.error ? `  — ${step.error}` : ''}`,
              });
            }
            if (data.completedAt) {
              const finishedAt = Date.parse(data.completedAt);
              append({
                ts: finishedAt,
                level: data.status === 'FAILED' ? 'error' : 'success',
                text: `run.${(data.status ?? 'completed').toLowerCase()}  duration=${data.duration ?? '?'}ms`,
              });
            }
            return;
          }

          // Replay path: schedule a `started` line at step start and
          // a `completed/failed/...` line at step settle. Mirrors the
          // canvas paint sequence so the operator reads "Backup
          // database started → completed → Show pending migrations
          // started → completed → ..." line-by-line in time.
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const finalLevel = STATUS_LEVEL[step.status] ?? 'muted';
            const finalVerb = STATUS_VERB[step.status] ?? step.status;
            const startAt = i * PER_STEP;
            const settleAt = startAt + STEP_DURATION_MS;
            const nodeLabel = step.name || step.stepId.slice(0, 8);

            replayTimers.push(
              setTimeout(() => {
                append({
                  ts: Date.now(),
                  level: 'info',
                  nodeName: nodeLabel,
                  text: `started${step.type ? `  ${step.type}` : ''}`,
                });
              }, startAt)
            );
            replayTimers.push(
              setTimeout(() => {
                append({
                  ts: Date.now(),
                  level: finalLevel,
                  nodeName: nodeLabel,
                  text: `${finalVerb}${step.type ? `  ${step.type}` : ''}  ${STEP_DURATION_MS}ms${step.error ? `  — ${step.error}` : ''}`,
                });
              }, settleAt)
            );
          }

          // Final run line lands after the last step settles so the
          // operator sees the entire arc end-to-end.
          const finalAt = steps.length * PER_STEP;
          replayTimers.push(
            setTimeout(() => {
              append({
                ts: Date.now(),
                level: data.status === 'FAILED' ? 'error' : 'success',
                text: `run.${(data.status ?? 'completed').toLowerCase()}  duration=${steps.length * STEP_DURATION_MS}ms (simulated)`,
              });
            }, finalAt)
          );
        }
      )
      .catch(err => {
        if (err?.name !== 'AbortError') {
          append({
            ts: Date.now(),
            level: 'error',
            text: `! backfill failed: ${err?.message ?? 'unknown'}`,
          });
        }
      });

    // Live socket. Mirrors useExecutionSocket — we keep this connection
    // separate so the console renders even on canvases that don't host
    // a useExecutionSocket call (e.g. an embed that mounts only the
    // console). Same room semantics, different sink.
    const socket: Socket = io(API_BASE, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    const join = () => socket.emit('join_execution', executionId);
    socket.on('connect', join);
    socket.on('reconnect', join);

    socket.on(
      'node_status',
      (event: { nodeId: string; status: BackendStatus; timestamp: string; result?: unknown }) => {
        const ts = Date.parse(event.timestamp);
        const store = useEditorStore.getState();
        const node = store.nodes.find(n => n.id === event.nodeId);
        const nodeName =
          node?.data?.workflow?.title ||
          (node?.type ? `${node.type} (${event.nodeId.slice(0, 6)})` : event.nodeId.slice(0, 8));
        append({
          ts: Number.isFinite(ts) ? ts : Date.now(),
          level: STATUS_LEVEL[event.status] ?? 'muted',
          nodeName,
          text: STATUS_VERB[event.status] ?? event.status,
        });
      }
    );

    socket.on('execution_status', (event: { status: BackendStatus; timestamp: string }) => {
      const ts = Date.parse(event.timestamp);
      append({
        ts: Number.isFinite(ts) ? ts : Date.now(),
        level: event.status === 'FAILED' ? 'error' : 'success',
        text: `run.${event.status.toLowerCase()}`,
      });
      // Drive the Continue button visibility off the run status. Any
      // terminal status (SUCCESS / FAILED / CANCELLED) clears it so a
      // resumed-then-finished run doesn't leave the button hanging.
      setPaused(event.status === 'PAUSED');
    });

    return () => {
      ctrl.abort();
      // Cancel any pending replay-step timers so a fast remount
      // doesn't keep appending lines from the previous playback.
      for (const timer of replayTimers) clearTimeout(timer);
      socket.emit('leave_execution', executionId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]);

  // Auto-scroll to bottom on new lines unless the operator scrolled up.
  useEffect(() => {
    if (!autoFollow) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length, autoFollow]);

  if (!executionId) return null;

  return (
    <div
      className="absolute bottom-4 left-1/2 z-30 w-[min(820px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-white/10 bg-[#0b0e14]/95 shadow-2xl backdrop-blur"
      data-rb-run-console
    >
      <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs text-zinc-200 transition-colors hover:text-white"
        >
          <Terminal size={13} className="text-emerald-400" />
          <span className="font-medium">{t.title}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {executionId.slice(0, 8)}
          </span>
          {live ? (
            <span className="flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
              {t.live}
            </span>
          ) : null}
        </button>
        <div className="flex items-center gap-1">
          {paused ? (
            <button
              type="button"
              disabled={resuming}
              onClick={async () => {
                if (!executionId) return;
                setResuming(true);
                try {
                  const res = await fetch(`${API_BASE}/api/executions/${executionId}/resume`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: {} }),
                  });
                  if (!res.ok) {
                    append({
                      ts: Date.now(),
                      level: 'error',
                      text: `! resume failed: HTTP ${res.status}`,
                    });
                  } else {
                    append({ ts: Date.now(), level: 'info', text: '> resume requested' });
                    setPaused(false);
                  }
                } catch (err) {
                  append({
                    ts: Date.now(),
                    level: 'error',
                    text: `! resume failed: ${(err as Error)?.message ?? 'unknown'}`,
                  });
                } finally {
                  setResuming(false);
                }
              }}
              title="Continue past the breakpoint (or paused step)"
              aria-label="Continue"
              className="flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={11} />
              {resuming ? 'resuming…' : 'continue'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setLines([]);
              lineKeyRef.current = 0;
            }}
            title={t.clear}
            aria-label={t.clear}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <Eraser size={13} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>
      {open ? (
        <div
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
            setAutoFollow(distanceFromBottom < 48);
          }}
          // Stop wheel from propagating to React Flow so scrolling the
          // log doesn't accidentally pan/zoom the canvas behind it.
          onWheelCapture={e => e.stopPropagation()}
          // Fixed height (240px) so a long run doesn't push the
          // console over a third of the viewport — operators with
          // 100-step runbooks were hitting `max-h-[35vh]` and burying
          // the canvas. New content scrolls inside this box; the
          // box itself never grows. Falls back to `28vh` on very
          // short screens so the console isn't taller than the
          // remaining canvas height.
          className="h-[min(240px,28vh)] overflow-y-auto p-2 font-mono text-[11px] leading-tight"
        >
          {lines.length === 0 ? (
            <div className="px-2 py-4 text-zinc-500">{t.waiting}</div>
          ) : (
            lines.map(line => (
              <div key={line.key} className="flex gap-2 px-2 py-0.5 hover:bg-white/[0.02]">
                <span className="shrink-0 text-zinc-500">{fmtTime(line.ts)}</span>
                <span className={`shrink-0 ${LEVEL_COLOR[line.level]}`}>
                  {line.level === 'success'
                    ? '✓'
                    : line.level === 'error'
                      ? '✗'
                      : line.level === 'warn'
                        ? '!'
                        : line.level === 'muted'
                          ? '·'
                          : '►'}
                </span>
                {line.nodeName ? (
                  <span className={`shrink-0 ${LEVEL_COLOR[line.level]}`}>[{line.nodeName}]</span>
                ) : null}
                <span className="break-all text-zinc-200">{line.text}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
