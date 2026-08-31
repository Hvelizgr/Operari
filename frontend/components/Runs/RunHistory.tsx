'use client';

import { Ban, CheckCircle2, Clock, Loader2, Pause, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { List as VirtualList } from 'react-window';

type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED';

interface Run {
  id: string;
  runbook: { id: string; slug: string | null; name: string };
  status: RunStatus;
  trigger: string | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  /** Estimated remaining time in ms for RUNNING rows; null otherwise. */
  etaMs?: number | null;
  /** Dry-run runs are badged so they are never confused with real executions. */
  dryRun?: boolean;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    title: 'Run history',
    subtitle: 'Recent runbook executions across this tenant.',
    filterAll: 'All',
    filterRunning: 'Running',
    filterSuccess: 'Success',
    filterFailed: 'Failed',
    filterPaused: 'Paused',
    filterCancelled: 'Cancelled',
    empty: 'No runs to show.',
    loading: 'Loading runs...',
    loadMore: 'Load more',
    runbook: 'Runbook',
    trigger: 'Trigger',
    started: 'Started',
    duration: 'Duration',
  },
  es: {
    title: 'Historial de ejecuciones',
    subtitle: 'Ejecuciones recientes de runbooks en este tenant.',
    filterAll: 'Todo',
    filterRunning: 'En curso',
    filterSuccess: 'Éxito',
    filterFailed: 'Fallidas',
    filterPaused: 'Pausadas',
    filterCancelled: 'Canceladas',
    empty: 'No hay ejecuciones para mostrar.',
    loading: 'Cargando ejecuciones...',
    loadMore: 'Cargar más',
    runbook: 'Runbook',
    trigger: 'Disparador',
    started: 'Inicio',
    duration: 'Duración',
  },
};

const FILTERS: Array<{ key: RunStatus | 'all'; labelKey: string }> = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'RUNNING', labelKey: 'filterRunning' },
  { key: 'SUCCESS', labelKey: 'filterSuccess' },
  { key: 'FAILED', labelKey: 'filterFailed' },
  { key: 'PAUSED', labelKey: 'filterPaused' },
  { key: 'CANCELLED', labelKey: 'filterCancelled' },
];

const STATUS_STYLES: Record<RunStatus, { icon: typeof CheckCircle2; cls: string }> = {
  PENDING: { icon: Clock, cls: 'text-zinc-400' },
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

export default function RunHistory({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const router = useRouter();

  const [filter, setFilter] = useState<RunStatus | 'all'>('all');
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'replace' | 'append') => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: filter, limit: '50' });
        if (mode === 'append' && nextCursor) params.set('cursor', nextCursor);
        const res = await fetch(`${apiBase}/api/runs?${params}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setRuns(prev => (mode === 'append' ? [...prev, ...json.data] : json.data));
        setNextCursor(json.nextCursor ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [apiBase, filter, nextCursor]
  );

  useEffect(() => {
    setRuns([]);
    setNextCursor(null);
    load('replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-zinc-400">{t.subtitle}</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f.key
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {t[f.labelKey]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && runs.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.loading}
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="rounded border border-zinc-800 bg-zinc-950 px-6 py-12 text-center text-sm text-zinc-500">
          {t.empty}
        </div>
      )}

      {runs.length > 0 && (
        <RunsVirtualTable
          runs={runs}
          lang={lang}
          t={t}
          onOpen={id => router.push(`/${lang}/runs/${id}`)}
        />
      )}

      {nextCursor && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => load('append')}
            disabled={loading}
            className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
          >
            {loading ? t.loading : t.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Virtualized run table — only renders the rows currently in view via
 * react-window v2. Replaces the previous DOM-heavy <table> that crashed
 * the browser at ~10k rows. Each row is a flex line with the same
 * column proportions as the old header so the visual contract is
 * unchanged.
 *
 * Sticky header lives outside the virtual list so it stays pinned
 * while the rows scroll independently.
 */
const ROW_HEIGHT = 44;

// react-window v2 injects { index, style, ariaAttributes } automatically
// and the rest of the props comes from `rowProps`. The type below
// matches that contract — `index` and `style` cannot live in our
// rowProps payload, only `runs` and `lang` do.
interface RunRowExtra {
  runs: Run[];
  lang: 'en' | 'es';
  /** SPA navigator — keyed off next/navigation router so the row
   *  click doesn't trigger a full-page reload (which would lose
   *  the event-log tail and re-mount the whole sidebar). */
  onOpen: (runId: string) => void;
}

function RunRow({
  index,
  style,
  runs,
  lang,
  onOpen,
}: { index: number; style: React.CSSProperties } & RunRowExtra) {
  const r = runs[index];
  const meta = STATUS_STYLES[r.status];
  const Icon = meta.icon;
  return (
    <div
      style={style}
      className="flex cursor-pointer items-center border-b border-zinc-900 bg-black px-0 hover:bg-zinc-950"
      onClick={() => onOpen(r.id)}
    >
      <div className="flex w-44 items-center gap-2 px-4">
        <Icon className={`h-4 w-4 ${meta.cls} ${r.status === 'RUNNING' ? 'animate-spin' : ''}`} />
        <span className={`text-xs font-semibold ${meta.cls}`}>{r.status}</span>
        {r.dryRun && (
          <span
            className="inline-flex items-center rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400"
            title={lang === 'en' ? 'Dry-run — no side effects' : 'Dry-run — sin side effects'}
          >
            Dry
          </span>
        )}
      </div>
      <div className="flex-1 truncate px-4 text-zinc-200">{r.runbook.name}</div>
      <div className="w-28 truncate px-4 text-xs text-zinc-400">{r.trigger || '—'}</div>
      <div className="w-44 truncate px-4 text-xs text-zinc-400">
        {new Date(r.startedAt).toLocaleString(lang === 'es' ? 'es-GT' : 'en-US')}
      </div>
      <div className="w-24 px-4 text-xs text-zinc-400">
        {r.status === 'RUNNING' && r.etaMs != null
          ? `~${formatDuration(r.etaMs)}`
          : formatDuration(r.duration)}
      </div>
      <div className="w-24 truncate px-4 font-mono text-xs text-zinc-500">{r.id.slice(0, 8)}</div>
    </div>
  );
}

function RunsVirtualTable({
  runs,
  lang,
  t,
  onOpen,
}: {
  runs: Run[];
  lang: 'en' | 'es';
  t: Record<string, string>;
  onOpen: (runId: string) => void;
}) {
  // Cap the visible viewport so the list does not push the rest of
  // the page off-screen on tall viewports. 12 rows is a comfortable
  // window — react-window handles tens of thousands behind it.
  const VIEW_ROWS = Math.min(runs.length, 12);
  const listHeight = VIEW_ROWS * ROW_HEIGHT;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      {/* Sticky header — same column widths as the rows below */}
      <div className="flex border-b border-zinc-800 bg-zinc-950 text-xs uppercase text-zinc-500">
        <div className="w-44 px-4 py-3">Status</div>
        <div className="flex-1 px-4 py-3">{t.runbook}</div>
        <div className="w-28 px-4 py-3">{t.trigger}</div>
        <div className="w-44 px-4 py-3">{t.started}</div>
        <div className="w-24 px-4 py-3">{t.duration}</div>
        <div className="w-24 px-4 py-3">ID</div>
      </div>
      <VirtualList<RunRowExtra>
        style={{ height: listHeight }}
        rowCount={runs.length}
        rowHeight={ROW_HEIGHT}
        rowComponent={RunRow}
        rowProps={{ runs, lang, onOpen }}
      />
    </div>
  );
}
