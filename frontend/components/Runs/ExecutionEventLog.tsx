'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import {
  bannerVariants,
  listRowVariants,
  motionFor,
  overlayPillVariants,
  reducedListRowVariants,
  reducedOverlayPillVariants,
} from '@/lib/motion';

export interface ExecutionEventRow {
  seq: string;
  type: string;
  nodeId: string | null;
  payload: unknown;
  createdAt: string;
}

interface ExecutionEventLogProps {
  runId: string;
  lang: 'en' | 'es';
  /** True while the run is still active. Switches the component into
   *  a polling "live tail" mode using ?afterSeq to only fetch the
   *  delta. False = one-shot fetch for terminal runs. */
  live?: boolean;
}

type Preset = 'all' | 'errors' | 'steps';

const ERROR_TYPES = ['run.failed', 'step.failed'];
const STEP_TYPES = ['step.queued', 'step.started', 'step.completed', 'step.failed', 'step.skipped'];

function filterFor(preset: Preset): string[] | undefined {
  if (preset === 'all') return undefined;
  if (preset === 'errors') return ERROR_TYPES;
  return STEP_TYPES;
}

// Discriminated event type → semantic color. Kept in-module because it
// mirrors the accent palette used by the rest of the run-detail page.
function typeColor(type: string): string {
  if (type.endsWith('.failed')) return 'text-red-400';
  if (type.endsWith('.completed')) return 'text-emerald-400';
  if (type.endsWith('.started') || type === 'run.created') return 'text-sky-400';
  if (type.endsWith('.cancelled')) return 'text-zinc-500';
  if (type.endsWith('.paused') || type.endsWith('.skipped')) return 'text-amber-400';
  return 'text-zinc-300';
}

function fmtDurationMs(ms: unknown): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

// Produce a one-line summary for a row so the operator can skim the
// log without clicking every event to see what happened. Reads only
// fields we know exist on the discriminated ExecutionEventPayload
// union defined in backend/src/runbook/engine/execution-event.types.ts.
// Falls back to an empty string when the type is unknown or the
// payload is missing — the row still shows type + nodeId in that case.
function summarize(type: string, payload: unknown, nodeId: string | null): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  const nodeName = asString(p.nodeName) ?? nodeId ?? '';
  const nodeType = asString(p.nodeType);
  switch (type) {
    case 'run.created':
      return asString(p.workflowName) ?? '';
    case 'run.started':
      return '';
    case 'run.completed': {
      const dur = fmtDurationMs(p.durationMs);
      const n = typeof p.nodesExecuted === 'number' ? `${p.nodesExecuted} nodes` : '';
      return [dur, n].filter(Boolean).join(' · ');
    }
    case 'run.failed': {
      const msg = asString(p.errorMessage) ?? '';
      const at = asString(p.failedAtNodeId);
      return at ? `${msg} · at ${at}` : msg;
    }
    case 'run.cancelled':
      return asString(p.cancelledByActorId) ?? '';
    case 'run.paused':
      return asString(p.pausedAtNodeId) ?? '';
    case 'run.resumed':
      return asString(p.resumedFromNodeId) ?? '';
    case 'step.queued':
    case 'step.started': {
      return [nodeName, nodeType].filter(Boolean).join(' · ');
    }
    case 'step.completed': {
      const dur = fmtDurationMs(p.durationMs);
      return [nodeName, dur].filter(Boolean).join(' · ');
    }
    case 'step.failed': {
      const msg = asString(p.errorMessage) ?? '';
      return [nodeName, msg].filter(Boolean).join(' · ');
    }
    case 'step.skipped': {
      const reason = asString(p.reason);
      return reason ? `${nodeName} · ${reason}` : nodeName;
    }
    default:
      return nodeName;
  }
}

const LABELS = {
  en: {
    title: 'Event log',
    filterAll: 'All',
    filterErrors: 'Errors',
    filterSteps: 'Steps',
    empty: 'No events yet.',
    loading: 'Loading…',
    error: 'Failed to load events',
    live: 'LIVE',
    stop: 'Stop',
    stopping: 'Stopping…',
    stopFailed: 'Could not cancel',
    stopConfirm: 'Stop this run?',
    jumpToLatest: 'Jump to latest',
    retryStep: 'Retry from this step',
    retrying: 'Starting retry…',
    retryConfirm: 'Retry the run from this step? A new run will be created.',
    retryBlockedLive: 'Wait for the run to finish before retrying.',
    retrySuccess: 'New run started',
    retryFailed: 'Retry failed',
    viewNewRun: 'View new run →',
  },
  es: {
    title: 'Registro de eventos',
    filterAll: 'Todos',
    filterErrors: 'Errores',
    filterSteps: 'Pasos',
    empty: 'Sin eventos todavía.',
    loading: 'Cargando…',
    error: 'Fallo al cargar eventos',
    live: 'EN VIVO',
    stop: 'Detener',
    stopping: 'Deteniendo…',
    stopFailed: 'No se pudo cancelar',
    stopConfirm: '¿Detener esta ejecución?',
    jumpToLatest: 'Ir al final',
    retryStep: 'Reintentar desde este paso',
    retrying: 'Iniciando reintento…',
    retryConfirm: '¿Reintentar desde este paso? Se creará una nueva ejecución.',
    retryBlockedLive: 'Esperá a que termine la ejecución para reintentar.',
    retrySuccess: 'Nueva ejecución iniciada',
    retryFailed: 'Reintento fallido',
    viewNewRun: 'Ver nueva ejecución →',
  },
} as const;

// Temporal-style durable execution log for one run. Numbered, filter-
// able, and expandable to the underlying payload. Used as a side panel
// on RunDetail so an operator can inspect what the engine actually
// emitted (vs. what the step cards summarise) — essential for
// debugging a failed or stuck run.
export default function ExecutionEventLog({ runId, lang, live = false }: ExecutionEventLogProps) {
  const t = LABELS[lang];
  const [preset, setPreset] = useState<Preset>('all');
  const [events, setEvents] = useState<ExecutionEventRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // afterSeq is NOT state: it's a mutable cursor used by the polling
  // closure. Making it state would re-fire the effect on every update.
  const afterSeqRef = useRef<string | null>(null);
  // Track which failure seqs we've already auto-expanded. Without
  // this, a later non-failure event arriving would trigger the
  // auto-expand effect and re-open a row the user just collapsed
  // — overriding their explicit action. Reset is handled by the
  // main useEffect on runId/preset/live changes.
  const autoExpandedFailuresRef = useRef<Set<string>>(new Set());
  const [cancelState, setCancelState] = useState<'idle' | 'cancelling' | 'failed'>('idle');
  // Retry flow: which failure row is mid-retry, and the new run id
  // returned by the replay endpoint so the operator can jump to it.
  // retryError is shown inline on the offending row when the POST
  // fails — keeps the error close to the action for context.
  const [retryingSeq, setRetryingSeq] = useState<string | null>(null);
  const [retriedRunId, setRetriedRunId] = useState<string | null>(null);
  const [retryErrorSeq, setRetryErrorSeq] = useState<string | null>(null);

  const retryFromStep = async (eventSeq: string, nodeId: string) => {
    // Live-run guard: replaying while the current run is still going
    // would produce two concurrent executions from the same trigger,
    // which the engine isn't meant to handle. The button UI also
    // disables in live mode; this is defense-in-depth.
    if (live) return;
    if (!window.confirm(t.retryConfirm)) return;
    setRetryingSeq(eventSeq);
    setRetryErrorSeq(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiBase}/api/executions/${runId}/replay`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { id?: string };
      if (body.id) setRetriedRunId(body.id);
    } catch {
      setRetryErrorSeq(eventSeq);
    } finally {
      setRetryingSeq(null);
    }
  };
  // Follow-tail: when live, new events auto-scroll the list to the
  // bottom. The operator can pause that by scrolling up — the onScroll
  // handler sets autoFollow=false when we're more than 48px above the
  // bottom, and flips back to true when they scroll back down.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    // 48 px threshold: small enough that clicking a row doesn't
    // register as "scrolling away", big enough to forgive the
    // fractional pixels some browsers emit on wheel events.
    setAutoFollow(distanceFromBottom < 48);
  };

  useEffect(() => {
    if (!autoFollow) return;
    const el = scrollRef.current;
    if (!el) return;
    // Jump, not smooth-scroll: a streaming run can drop 5 events per
    // second and `behavior: 'smooth'` queues animations that fight
    // each other and look jittery. Instant scroll keeps the tail
    // pinned without visual lag.
    el.scrollTop = el.scrollHeight;
  }, [events.length, autoFollow]);

  // Auto-expand failure events so the error message is visible the
  // moment it lands — no extra click required. Only fires for seqs
  // we've never auto-expanded before, so a user who explicitly
  // collapsed a failure won't see it pop back open on the next tick.
  useEffect(() => {
    const newFailureSeqs: string[] = [];
    for (const e of events) {
      if (e.type.endsWith('.failed') && !autoExpandedFailuresRef.current.has(e.seq)) {
        autoExpandedFailuresRef.current.add(e.seq);
        newFailureSeqs.push(e.seq);
      }
    }
    if (newFailureSeqs.length === 0) return;
    setExpanded(prev => {
      const next = new Set(prev);
      for (const s of newFailureSeqs) next.add(s);
      return next;
    });
  }, [events]);

  const cancelRun = async () => {
    // One-shot confirm — aborting a run is a non-trivial action
    // (partial side effects on downstream systems) so a single click
    // is the wrong default. Browser native confirm is acceptable
    // here; the component has no design system dialog dep.
    if (!window.confirm(t.stopConfirm)) return;
    setCancelState('cancelling');
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiBase}/api/executions/${runId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // The backend emits run.cancelled which flows back through the
      // SSE / polling pipe, so the status badge and the panel will
      // update naturally within a tick. We just clear the loading
      // state; the parent re-renders when the run status transitions.
      setCancelState('idle');
    } catch {
      setCancelState('failed');
      setTimeout(() => setCancelState('idle'), 5000);
    }
  };

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    let cancelled = false;
    // Reset cursor on filter/run change so we re-fetch from the start.
    afterSeqRef.current = null;
    autoExpandedFailuresRef.current = new Set();
    setEvents([]);
    setExpanded(new Set());
    setError(null);
    setLoading(true);

    const load = async () => {
      try {
        const qs = new URLSearchParams();
        const types = filterFor(preset);
        if (types) qs.set('type', types.join(','));
        if (afterSeqRef.current) qs.set('afterSeq', afterSeqRef.current);
        const res = await fetch(`${apiBase}/api/runs/${runId}/events?${qs.toString()}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          data: ExecutionEventRow[];
          nextAfterSeq: string | null;
        };
        if (cancelled) return;
        setLoading(false);
        setError(null);
        if (afterSeqRef.current) {
          if (json.data.length > 0) {
            setEvents(prev => [...prev, ...json.data]);
          }
        } else {
          setEvents(json.data);
        }
        if (json.data.length > 0) {
          afterSeqRef.current = json.data[json.data.length - 1].seq;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'unknown');
          setLoading(false);
        }
      }
    };

    // Append a single event arriving via SSE. Only honours preset
    // client-side so the "errors" filter doesn't include the stray
    // step.started rows the server pushed to every subscriber.
    const appendFromStream = (entry: ExecutionEventRow) => {
      const types = filterFor(preset);
      if (types && !types.includes(entry.type)) return;
      setEvents(prev => {
        // Drop duplicates when the backlog fetch and the SSE tail
        // overlap (the initial fetch covers a superset of what the
        // subscribe gives us after '$' + any race window).
        if (prev.some(e => e.seq === entry.seq)) return prev;
        return [...prev, entry];
      });
      afterSeqRef.current = entry.seq;
    };

    load();

    if (!live) {
      return () => {
        cancelled = true;
      };
    }

    // Live mode: prefer SSE for sub-100ms latency, poll as fallback
    // when EventSource is unavailable (jsdom in tests) or errors
    // before the connection is established. Once SSE is open we stop
    // polling; on SSE failure we hand the baton back to the poller.
    let pollId: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollId !== null) return;
      pollId = setInterval(load, 2000);
    };

    if (typeof EventSource === 'undefined') {
      startPolling();
    } else {
      const url = `${apiBase}/api/runs/${runId}/events/stream`;
      const source = new EventSource(url, { withCredentials: true });
      source.onmessage = ev => {
        if (cancelled) return;
        try {
          const entry = JSON.parse(ev.data) as ExecutionEventRow;
          appendFromStream(entry);
        } catch {
          /* malformed frame — ignore, next one lands normally */
        }
      };
      source.onerror = () => {
        // SSE errors fire on transient disconnects too; close the
        // socket and fall through to polling so the tail keeps
        // moving even when the browser parks the tab or redis
        // briefly stalls.
        source.close();
        if (!cancelled) startPolling();
      };
      return () => {
        cancelled = true;
        source.close();
        if (pollId !== null) clearInterval(pollId);
      };
    }

    return () => {
      cancelled = true;
      if (pollId !== null) clearInterval(pollId);
    };
  }, [runId, preset, live]);

  const toggle = (seq: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  };

  return (
    <div className="relative flex flex-col rounded-md border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-zinc-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t.title}
          </span>
          {live && (
            <span className="flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
              {t.live}
            </span>
          )}
          {live && (
            <button
              onClick={cancelRun}
              disabled={cancelState === 'cancelling'}
              className="flex items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              title={cancelState === 'failed' ? t.stopFailed : t.stop}
            >
              {cancelState === 'cancelling' ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Square size={10} fill="currentColor" />
              )}
              {cancelState === 'cancelling' ? t.stopping : t.stop}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {(['all', 'errors', 'steps'] as Preset[]).map(p => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded px-2 py-0.5 transition-colors ${
                preset === p
                  ? 'bg-primary text-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {p === 'all' ? t.filterAll : p === 'errors' ? t.filterErrors : t.filterSteps}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[560px] overflow-y-auto font-mono text-[12px]"
      >
        {loading && events.length === 0 && (
          <div className="px-4 py-6 text-center text-zinc-500">{t.loading}</div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 text-red-400">
            <AlertTriangle size={12} />
            <span>
              {t.error} · {error}
            </span>
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="px-4 py-6 text-center text-zinc-500">{t.empty}</div>
        )}
        {/* initial={false} suppresses entrance animation on the
            first render, so a 200-event backlog doesn't cascade
            fade in on mount. Only rows appended AFTER the initial
            load (SSE tail) animate — which is exactly what reads
            as "live" to the operator. */}
        <AnimatePresence initial={false}>
          {events.map(e => {
            const isOpen = expanded.has(e.seq);
            const rowVariants = motionFor(listRowVariants, reducedListRowVariants);
            return (
              <motion.div
                key={e.seq}
                variants={rowVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="border-b border-white/5 last:border-0"
              >
                <button
                  onClick={() => toggle(e.seq)}
                  className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-white/5"
                >
                  {isOpen ? (
                    <ChevronDown size={12} className="shrink-0 text-zinc-500" />
                  ) : (
                    <ChevronRight size={12} className="shrink-0 text-zinc-500" />
                  )}
                  <span className="w-10 shrink-0 text-zinc-600">#{e.seq}</span>
                  <span className="w-20 shrink-0 text-zinc-600">
                    {new Date(e.createdAt).toLocaleTimeString(undefined, {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className={`w-36 shrink-0 ${typeColor(e.type)}`}>{e.type}</span>
                  {(() => {
                    const summary = summarize(e.type, e.payload, e.nodeId);
                    return summary ? (
                      <span className="truncate text-zinc-400">{summary}</span>
                    ) : null;
                  })()}
                </button>
                {isOpen && (
                  <>
                    <pre className="overflow-x-auto whitespace-pre-wrap px-8 pb-2 pt-1 text-[11px] text-zinc-400">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                    {/* Inline retry action on step.failed rows. Uses the
                      existing /replay endpoint with the failed nodeId
                      so the runtime re-executes from that step forward.
                      Disabled during live runs to avoid two concurrent
                      executions from the same trigger. */}
                    {e.type === 'step.failed' && e.nodeId && (
                      <div className="flex items-center gap-3 px-8 pb-3">
                        <button
                          onClick={() => retryFromStep(e.seq, e.nodeId!)}
                          disabled={live || retryingSeq !== null}
                          title={live ? t.retryBlockedLive : t.retryStep}
                          className="flex items-center gap-1.5 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {retryingSeq === e.seq ? (
                            <>
                              <Loader2 size={11} className="animate-spin" />
                              {t.retrying}
                            </>
                          ) : (
                            <>
                              <RotateCcw size={11} />
                              {t.retryStep}
                            </>
                          )}
                        </button>
                        {retryErrorSeq === e.seq && (
                          <span className="text-[11px] text-red-400">{t.retryFailed}</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Retry-success banner: renders above the list when a retry
          lands, so the new run id is discoverable regardless of
          which failure was clicked. Dismissible; auto-clears on the
          next retry via setRetriedRunId(...) in retryFromStep.
          Slides from top so the success registers as "something new
          landed" rather than "this was always here". */}
      <AnimatePresence>
        {retriedRunId && (
          <motion.div
            key="retry-success"
            variants={bannerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute left-3 right-3 top-12 z-10 flex items-center gap-2 rounded border border-emerald-900/60 bg-emerald-950/80 px-3 py-2 text-[11px] text-emerald-200 backdrop-blur"
          >
            <CheckCircle2 size={12} className="shrink-0" />
            <span className="flex-1">{t.retrySuccess}</span>
            <Link
              href={`/${lang}/runs/${retriedRunId}`}
              className="shrink-0 font-medium underline-offset-2 hover:underline"
            >
              {t.viewNewRun}
            </Link>
            <button
              onClick={() => setRetriedRunId(null)}
              aria-label="Dismiss"
              className="text-emerald-400/60 hover:text-emerald-200"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jump-to-latest pill — surfaces only when the operator has
          scrolled up (autoFollow=false) and there's at least one
          event to scroll to. Clicking pins the view to the tail and
          flips autoFollow back on so new events keep following.
          Wrapped in AnimatePresence so the pill fades in/out instead
          of popping on every scroll edge — prevents visual flicker
          when the operator hovers the 48px threshold. */}
      <AnimatePresence>
        {!autoFollow && events.length > 0 && (
          <motion.button
            key="jump-to-latest"
            variants={motionFor(overlayPillVariants, reducedOverlayPillVariants)}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollTop = el.scrollHeight;
              setAutoFollow(true);
            }}
            className="absolute bottom-3 left-1/2 flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/20 px-3 py-1 text-[11px] font-semibold text-sky-200 shadow-lg backdrop-blur-sm transition-colors hover:bg-sky-500/30"
            style={{ x: '-50%' }}
          >
            <ArrowDown size={11} />
            {t.jumpToLatest}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
