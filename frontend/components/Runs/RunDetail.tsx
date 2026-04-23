'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Pause,
  Ban,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

type RunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED';
type StepStatus = RunStatus | string;

interface StepLog {
  id: string;
  stepId: string;
  name: string | null;
  type: string | null;
  status: StepStatus;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  output: unknown;
  error: string | null;
}

interface RunDetailPayload {
  id: string;
  runbook: { id: string; slug: string | null; name: string };
  status: RunStatus;
  trigger: string | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  steps: StepLog[];
  /**
   * True when this run was started with `dryRun: true`. Every step
   * logged what it would do but performed no side effect. The UI
   * badges the run so operators never mistake a dry-run success
   * for an actual deploy.
   */
  dryRun?: boolean;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    back: 'Back to runs',
    loading: 'Loading run...',
    notFound: 'Run not found.',
    runbook: 'Runbook',
    trigger: 'Trigger',
    started: 'Started',
    duration: 'Duration',
    steps: 'Steps',
    replay: 'Replay from this step',
    replaying: 'Starting replay...',
    replaySuccess: 'Replay started',
    output: 'Output',
    error: 'Error',
    noOutput: 'No output recorded.',
  },
  es: {
    back: 'Volver a ejecuciones',
    loading: 'Cargando ejecución...',
    notFound: 'Ejecución no encontrada.',
    runbook: 'Runbook',
    trigger: 'Disparador',
    started: 'Inicio',
    duration: 'Duración',
    steps: 'Pasos',
    replay: 'Re-ejecutar desde aquí',
    replaying: 'Iniciando replay...',
    replaySuccess: 'Replay iniciado',
    output: 'Salida',
    error: 'Error',
    noOutput: 'Sin salida registrada.',
  },
};

const STATUS_STYLES: Record<RunStatus, { icon: typeof CheckCircle2; cls: string }> = {
  RUNNING: { icon: Loader2, cls: 'text-sky-400' },
  SUCCESS: { icon: CheckCircle2, cls: 'text-emerald-400' },
  FAILED: { icon: XCircle, cls: 'text-red-400' },
  PAUSED: { icon: Pause, cls: 'text-amber-400' },
  CANCELLED: { icon: Ban, cls: 'text-zinc-500' },
};

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export default function RunDetail({ lang, runId }: { lang: 'en' | 'es'; runId: string }) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [run, setRun] = useState<RunDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replayInfo, setReplayInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/runs/${runId}`);
      if (res.status === 404) {
        setRun(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RunDetailPayload;
      setRun(json);
      // Auto-expand any failed step so the operator does not have to click.
      const next: Record<string, boolean> = {};
      for (const step of json.steps) {
        if (String(step.status).toUpperCase() === 'FAILED') next[step.id] = true;
      }
      setExpanded(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [apiBase, runId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const replayFrom = async (step: StepLog) => {
    if (!run) return;
    setReplayingId(step.id);
    setReplayInfo(null);
    try {
      const res = await fetch(`${apiBase}/api/executions/${run.id}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: step.stepId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setReplayInfo(`${t.replaySuccess}: ${data.id ?? ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReplayingId(null);
    }
  };

  /**
   * Replay the entire run (no nodeId → backend starts from the
   * first step). Surfaces the new run id in the same banner the
   * per-step replay uses.
   */
  const replayWholeRun = async () => {
    if (!run) return;
    setReplayingId('__whole__');
    setReplayInfo(null);
    try {
      const res = await fetch(`${apiBase}/api/executions/${run.id}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setReplayInfo(`${t.replaySuccess}: ${data.id ?? ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReplayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.loading}
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href={`/${lang}/runs`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={14} /> {t.back}
        </Link>
        <div className="rounded border border-zinc-800 bg-zinc-950 px-6 py-12 text-center text-sm text-zinc-500">
          {t.notFound}
        </div>
      </div>
    );
  }

  const meta = STATUS_STYLES[run.status];
  const Icon = meta.icon;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/${lang}/runs`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={14} /> {t.back}
      </Link>

      <header className="mb-8 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Icon
            className={`h-5 w-5 ${meta.cls} ${run.status === 'RUNNING' ? 'animate-spin' : ''}`}
          />
          <span className={`text-sm font-semibold ${meta.cls}`}>{run.status}</span>
          {run.dryRun && (
            <span
              className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400"
              title={
                lang === 'en'
                  ? 'This run was a dry-run — no side effects were performed.'
                  : 'Este run fue dry-run — no se ejecutó ningún side effect.'
              }
            >
              Dry run
            </span>
          )}
          <span className="font-mono text-xs text-zinc-500">{run.id}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{run.runbook.name}</h1>
          <button
            onClick={replayWholeRun}
            disabled={replayingId !== null || run.status === 'RUNNING'}
            className="bg-primary hover:bg-primary flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title={
              lang === 'en'
                ? 'Re-run this runbook from the start with the same trigger'
                : 'Re-ejecutar este runbook desde el principio'
            }
          >
            {replayingId === '__whole__' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t.replaying}
              </>
            ) : (
              <>
                <RotateCcw size={14} />
                {lang === 'en' ? 'Replay run' : 'Re-ejecutar'}
              </>
            )}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-400 sm:grid-cols-4">
          <div>
            <div className="text-[10px] uppercase text-zinc-500">{t.runbook}</div>
            <div>{run.runbook.slug ?? run.runbook.id}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-zinc-500">{t.trigger}</div>
            <div>{run.trigger ?? '—'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-zinc-500">{t.started}</div>
            <div>{new Date(run.startedAt).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-zinc-500">{t.duration}</div>
            <div>{formatDuration(run.duration)}</div>
          </div>
        </div>
        {run.error && (
          <div className="mt-4 flex items-start gap-2 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="font-mono">{run.error}</span>
          </div>
        )}
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {replayInfo && (
        <div className="mb-4 rounded border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {replayInfo}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase text-zinc-500">{t.steps}</h2>
        <ol className="space-y-2">
          {run.steps.map((step, idx) => {
            const status = String(step.status).toUpperCase() as RunStatus;
            const stepMeta = STATUS_STYLES[status] ?? STATUS_STYLES.SUCCESS;
            const StepIcon = stepMeta.icon;
            const isOpen = expanded[step.id];
            return (
              <li key={step.id} className="rounded border border-zinc-800 bg-zinc-950">
                <button
                  onClick={() => toggle(step.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900"
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="w-6 font-mono text-xs text-zinc-500">{idx + 1}</span>
                  <StepIcon
                    className={`h-4 w-4 ${stepMeta.cls} ${
                      status === 'RUNNING' ? 'animate-spin' : ''
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{step.name ?? step.stepId}</div>
                    <div className="font-mono text-[11px] text-zinc-500">
                      {step.type ?? 'unknown'} · {formatDuration(step.duration)}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${stepMeta.cls}`}>
                    {status}
                  </span>
                </button>
                {isOpen && (
                  <div className="space-y-3 border-t border-zinc-900 px-4 py-3">
                    {step.error && (
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase text-red-400">
                          {t.error}
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-200">
                          {step.error}
                        </pre>
                      </div>
                    )}
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase text-zinc-500">
                        {t.output}
                      </div>
                      {step.output ? (
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black p-2 text-xs text-zinc-200">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-xs italic text-zinc-600">{t.noOutput}</div>
                      )}
                    </div>
                    <button
                      onClick={() => replayFrom(step)}
                      disabled={replayingId === step.id}
                      className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
                    >
                      {replayingId === step.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          {t.replaying}
                        </>
                      ) : (
                        <>
                          <RotateCcw size={12} />
                          {t.replay}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
