'use client';

import { AlertTriangle, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    let cancelled = false;
    // Reset cursor on filter/run change so we re-fetch from the start.
    afterSeqRef.current = null;
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
        const res = await fetch(`${apiBase}/api/runs/${runId}/events?${qs.toString()}`);
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

    load();
    if (!live) {
      return () => {
        cancelled = true;
      };
    }
    const id = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
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
    <div className="flex flex-col rounded-md border border-zinc-800 bg-zinc-950">
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

      <div className="max-h-[560px] overflow-y-auto font-mono text-[12px]">
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
        {events.map(e => {
          const isOpen = expanded.has(e.seq);
          return (
            <div key={e.seq} className="border-b border-white/5 last:border-0">
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
                {e.nodeId && <span className="truncate text-zinc-400">{e.nodeId}</span>}
              </button>
              {isOpen && (
                <pre className="overflow-x-auto whitespace-pre-wrap px-8 pb-3 pt-1 text-[11px] text-zinc-400">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
