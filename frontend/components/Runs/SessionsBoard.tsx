'use client';

import { CheckCircle2, Clock, Hand, Loader2, RefreshCw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const POLL_MS = 5_000;
const FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000;

type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED';

export interface BoardRun {
  id: string;
  runbook: { id: string; slug: string | null; name: string };
  status: RunStatus;
  trigger: string | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  etaMs?: number | null;
  dryRun?: boolean;
}

const TEXT = {
  en: {
    title: 'Sessions',
    subtitle:
      'Everything running for you right now. Dispatch from the editor, supervise from here.',
    running: 'Running',
    waiting: 'Waiting on you',
    finished: 'Finished (24 h)',
    emptyRunning: 'Nothing running.',
    emptyWaiting: 'Nothing needs you.',
    emptyFinished: 'No finished runs in the last 24 hours.',
    review: 'Review in Inbox',
    eta: 'ETA',
    dry: 'dry run',
    updated: 'Updated',
    failed: 'failed',
    refresh: 'Refresh',
  },
  es: {
    title: 'Sesiones',
    subtitle:
      'Todo lo que está corriendo para vos ahora. Despachá desde el editor, supervisá desde acá.',
    running: 'En curso',
    waiting: 'Esperándote',
    finished: 'Terminadas (24 h)',
    emptyRunning: 'Nada en curso.',
    emptyWaiting: 'Nada te necesita.',
    emptyFinished: 'No hay corridas terminadas en las últimas 24 horas.',
    review: 'Revisar en la Bandeja',
    eta: 'ETA',
    dry: 'dry run',
    updated: 'Actualizado',
    failed: 'fallidas',
    refresh: 'Recargar',
  },
} as const;

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function groupRuns(runs: BoardRun[], now: number) {
  const running = runs.filter(r => r.status === 'RUNNING' || r.status === 'PENDING');
  const waiting = runs.filter(r => r.status === 'PAUSED');
  const finished = runs.filter(
    r =>
      (r.status === 'SUCCESS' || r.status === 'FAILED' || r.status === 'CANCELLED') &&
      now - new Date(r.completedAt ?? r.startedAt).getTime() < FINISHED_WINDOW_MS
  );
  return { running, waiting, finished };
}

export default function SessionsBoard({ lang }: { lang: 'en' | 'es' }) {
  const t = TEXT[lang] ?? TEXT.en;
  const [runs, setRuns] = useState<BoardRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/runs?status=all&limit=200`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: BoardRun[] };
      setRuns(body.data ?? []);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const { running, waiting, finished } = useMemo(() => groupRuns(runs ?? [], now), [runs, now]);
  const failedCount = finished.filter(r => r.status === 'FAILED').length;

  const card = (r: BoardRun) => {
    const elapsed = now - new Date(r.startedAt).getTime();
    const Icon =
      r.status === 'SUCCESS'
        ? CheckCircle2
        : r.status === 'FAILED'
          ? XCircle
          : r.status === 'PAUSED'
            ? Hand
            : r.status === 'CANCELLED'
              ? Clock
              : Loader2;
    const tone =
      r.status === 'SUCCESS'
        ? 'text-emerald-400'
        : r.status === 'FAILED'
          ? 'text-rose-400'
          : r.status === 'PAUSED'
            ? 'text-amber-400'
            : r.status === 'CANCELLED'
              ? 'text-[var(--text-muted)]'
              : 'text-sky-400';
    return (
      <li key={r.id}>
        <Link
          href={`/${lang}/runs/${r.id}`}
          className={`block rounded-lg border bg-[var(--panel-bg)] p-3 transition-colors hover:border-[var(--accent-color)] ${
            r.status === 'FAILED' ? 'border-rose-500/40' : 'border-[var(--panel-border)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon
              size={14}
              className={`${tone} shrink-0 ${r.status === 'RUNNING' ? 'animate-spin' : ''}`}
            />
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">
              {r.runbook.name}
            </span>
            {r.dryRun && (
              <span className="rounded bg-amber-500/10 px-1.5 text-[10px] text-amber-300">
                {t.dry}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-[var(--text-muted)]">
            <span>{r.trigger?.toLowerCase() ?? 'manual'}</span>
            <span>·</span>
            <span>
              {r.status === 'RUNNING' || r.status === 'PENDING' || r.status === 'PAUSED'
                ? formatDuration(elapsed)
                : r.duration !== null
                  ? formatDuration(r.duration)
                  : '—'}
            </span>
            {r.status === 'RUNNING' && r.etaMs ? (
              <span>
                · {t.eta} {formatDuration(Math.max(0, r.etaMs - elapsed))}
              </span>
            ) : null}
          </div>
          {r.status === 'FAILED' && r.error && (
            <p className="mt-1 line-clamp-2 text-[11px] text-rose-300/80">{r.error}</p>
          )}
        </Link>
      </li>
    );
  };

  const column = (title: string, list: BoardRun[], empty: string, extra?: React.ReactNode) => (
    <section className="bg-[var(--panel-elevated)]/40 flex min-h-0 flex-col rounded-xl border border-[var(--panel-border)] p-3">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {title}
        </h2>
        <span className="rounded-full bg-[var(--panel-bg)] px-2 text-xs text-[var(--text-primary)]">
          {list.length}
        </span>
      </header>
      {extra}
      {list.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--text-muted)]">{empty}</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto">{list.map(card)}</ul>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {failedCount > 0 && (
            <span className="text-rose-400">
              {failedCount} {t.failed}
            </span>
          )}
          {updatedAt && (
            <span>
              {t.updated} {new Date(updatedAt).toLocaleTimeString(lang)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            aria-label={t.refresh}
            className="rounded p-1 hover:bg-[var(--panel-elevated)] hover:text-[var(--text-primary)]"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
      {runs === null && !error ? (
        <div className="flex justify-center py-16 text-[var(--text-muted)]">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {column(t.running, running, t.emptyRunning)}
          {column(
            t.waiting,
            waiting,
            t.emptyWaiting,
            waiting.length > 0 ? (
              <Link href={`/${lang}/inbox`} className="mb-2 text-xs text-amber-300 hover:underline">
                {t.review} →
              </Link>
            ) : null
          )}
          {column(t.finished, finished, t.emptyFinished)}
        </div>
      )}
    </div>
  );
}
