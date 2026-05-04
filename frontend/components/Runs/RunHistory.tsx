'use client';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  Loader2,
  Pause,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { List as VirtualList } from 'react-window';

import { formatDateTime } from '@/lib/datetime';
import {
  deriveDisplayStatus,
  DISPLAY_STATUS_HINT,
  DISPLAY_STATUS_LABEL,
  type DisplayRunStatus,
  type StoredRunStatus,
} from '@/lib/runs/displayStatus';

import { AIFilterInput } from './AIFilterInput';

type RunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED';

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

const STATUS_STYLES: Record<DisplayRunStatus, { icon: typeof CheckCircle2; cls: string }> = {
  PENDING: { icon: Loader2, cls: 'text-zinc-400' },
  RUNNING: { icon: Loader2, cls: 'text-sky-400' },
  SUCCESS: { icon: CheckCircle2, cls: 'text-emerald-400' },
  FAILED: { icon: XCircle, cls: 'text-red-400' },
  PAUSED: { icon: Pause, cls: 'text-amber-400' },
  CANCELLED: { icon: Ban, cls: 'text-zinc-500' },
  // New display-only buckets derived from FAILED + error.code. The
  // amber/red tones intentionally read as "still bad but different
  // shape" — operators glance and learn which retry strategy fits.
  TIMED_OUT: { icon: XCircle, cls: 'text-amber-300' },
  CRASHED: { icon: XCircle, cls: 'text-fuchsia-400' },
  EXPIRED: { icon: Ban, cls: 'text-orange-400' },
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(
    async (mode: 'replace' | 'append') => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: filter, limit: '50' });
        if (mode === 'append' && nextCursor) params.set('cursor', nextCursor);
        const res = await fetch(`${apiBase}/api/runs?${params}`);
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

      <div className="mb-6 flex flex-wrap items-center gap-2">
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
        <div className="ml-auto">
          <AIFilterInput
            lang={lang}
            onApply={resolved => {
              if (
                resolved.status === 'RUNNING' ||
                resolved.status === 'SUCCESS' ||
                resolved.status === 'FAILED' ||
                resolved.status === 'PAUSED' ||
                resolved.status === 'CANCELLED'
              ) {
                setFilter(resolved.status);
              } else {
                setFilter('all');
              }
              // Future iteration: pipe runbook/from/to into the
              // request URL too. For now the status filter is the
              // only one the runs list reads.
            }}
          />
        </div>
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

      {!loading && runs.length === 0 && (
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
          selectedIds={selectedIds}
          onToggleSelect={(id, next) => {
            setSelectedIds(prev => {
              const out = new Set(prev);
              if (next) out.add(id);
              else out.delete(id);
              return out;
            });
          }}
        />
      )}

      {/* Bulk action bar — only visible when one or more rows are
          checked. Mounted as a fixed footer pill so the operator
          can scroll the list without losing the selection
          affordance. trigger.dev parity. */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-violet-500/40 bg-zinc-900/95 px-4 py-2 text-xs text-zinc-200 shadow-2xl backdrop-blur">
          <span className="font-mono">
            {selectedIds.size} {selectedIds.size === 1 ? 'run' : 'runs'} {t.selected ?? 'selected'}
          </span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="rounded text-zinc-400 hover:text-zinc-100"
          >
            {t.clear ?? 'Clear'}
          </button>
          <div className="h-4 w-px bg-zinc-700" />
          <button
            type="button"
            disabled={bulkBusy}
            onClick={async () => {
              setBulkBusy(true);
              try {
                const res = await fetch(`${apiBase}/api/runs/bulk/cancel`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids: Array.from(selectedIds) }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                setSelectedIds(new Set());
                await load('replace');
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBulkBusy(false);
              }
            }}
            className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
          >
            {bulkBusy ? '…' : (t.bulkCancel ?? 'Cancel selected')}
          </button>
        </div>
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
  /** Bulk-select state. Click on the checkbox toggles membership;
   *  the rest of the row navigates as before. */
  selectedIds: Set<string>;
  onToggleSelect: (id: string, next: boolean) => void;
}

function RunRow({
  index,
  style,
  runs,
  lang,
  onOpen,
  selectedIds,
  onToggleSelect,
}: { index: number; style: React.CSSProperties } & RunRowExtra) {
  const r = runs[index];
  // Derive a richer display status from the stored (status, error)
  // pair so a FAILED run with a NODE_TIMEOUT error reads as
  // "Timed out" — operators can pick a retry strategy at a glance.
  const displayStatus = deriveDisplayStatus(
    r.status as StoredRunStatus,
    r.error ? { message: r.error } : null
  );
  const meta = STATUS_STYLES[displayStatus];
  const Icon = meta.icon;
  return (
    <div
      style={style}
      className="flex cursor-pointer items-center border-b border-zinc-900 bg-black px-0 hover:bg-zinc-950"
      onClick={() => onOpen(r.id)}
    >
      <div className="flex w-10 shrink-0 items-center justify-center px-2">
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={e => onToggleSelect(r.id, e.target.checked)}
          // Stop the row click from also navigating when the
          // operator clicks the checkbox.
          onClick={e => e.stopPropagation()}
          aria-label={`Select run ${r.id}`}
          className="h-3.5 w-3.5 cursor-pointer accent-violet-500"
        />
      </div>
      <div className="flex w-44 items-center gap-2 px-4">
        <Icon className={`h-4 w-4 ${meta.cls} ${r.status === 'RUNNING' ? 'animate-spin' : ''}`} />
        <span
          className={`text-xs font-semibold ${meta.cls}`}
          title={DISPLAY_STATUS_HINT[displayStatus]}
        >
          {DISPLAY_STATUS_LABEL[displayStatus].toUpperCase()}
        </span>
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
        {formatDateTime(r.startedAt, lang)}
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
  selectedIds,
  onToggleSelect,
}: {
  runs: Run[];
  lang: 'en' | 'es';
  t: Record<string, string>;
  onOpen: (runId: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, next: boolean) => void;
}) {
  // Sort state lives in the parent so the column header click can
  // toggle asc/desc/off without losing it on data refresh. Sprint 2
  // pilot for `@tanstack/react-table` — the column model lives here,
  // react-window keeps doing the rendering (10k+ rows perform fine).
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<Run>[]>(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        size: 128,
        enableSorting: true,
      },
      {
        id: 'runbook',
        accessorFn: r => r.runbook.name,
        header: t.runbook,
        enableSorting: true,
      },
      { id: 'trigger', accessorKey: 'trigger', header: t.trigger, size: 112, enableSorting: true },
      {
        id: 'startedAt',
        accessorKey: 'startedAt',
        header: t.started,
        size: 176,
        enableSorting: true,
        sortingFn: 'datetime',
      },
      {
        id: 'duration',
        accessorKey: 'duration',
        header: t.duration,
        size: 96,
        enableSorting: true,
      },
      // ID intentionally not sortable — UUIDs are random; sorting by
      // them surfaces no useful order.
      { id: 'id', accessorKey: 'id', header: 'ID', size: 96, enableSorting: false },
    ],
    [t]
  );

  const table = useReactTable({
    data: runs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Sorted rows feed react-window. `original` is the typed Run row;
  // RunRow keeps reading from `runs[index]` so we hand it the sorted
  // array, not the unsorted prop.
  const sortedRuns = useMemo(() => table.getRowModel().rows.map(r => r.original), [table, sorting]);

  // Cap the visible viewport so the list does not push the rest of
  // the page off-screen on tall viewports. 12 rows is a comfortable
  // window — react-window handles tens of thousands behind it.
  const VIEW_ROWS = Math.min(sortedRuns.length, 12);
  const listHeight = VIEW_ROWS * ROW_HEIGHT;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      {/* Sortable header — react-table manages the toggle cycle
          (asc → desc → off). Column widths mirror the row template
          via the size accessor so the visual contract is unchanged. */}
      <div className="flex border-b border-zinc-800 bg-zinc-950 text-xs uppercase text-zinc-500">
        {table.getHeaderGroups().map(group =>
          group.headers.map(header => {
            const sortable = header.column.getCanSort();
            const dir = header.column.getIsSorted();
            const SortIcon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown;
            const widthClass =
              header.column.id === 'runbook'
                ? 'flex-1'
                : header.column.id === 'status'
                  ? 'w-32'
                  : header.column.id === 'trigger'
                    ? 'w-28'
                    : header.column.id === 'startedAt'
                      ? 'w-44'
                      : 'w-24';
            return (
              <button
                key={header.id}
                type="button"
                onClick={header.column.getToggleSortingHandler()}
                disabled={!sortable}
                className={`flex items-center gap-1 px-4 py-3 text-left ${widthClass} ${
                  sortable
                    ? 'cursor-pointer transition-colors hover:bg-zinc-900 hover:text-zinc-300'
                    : 'cursor-default'
                } ${dir ? 'text-zinc-200' : ''}`}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {sortable ? <SortIcon size={11} className="opacity-60" /> : null}
              </button>
            );
          })
        )}
      </div>
      <VirtualList<RunRowExtra>
        style={{ height: listHeight }}
        rowCount={sortedRuns.length}
        rowHeight={ROW_HEIGHT}
        rowComponent={RunRow}
        rowProps={{ runs: sortedRuns, lang, onOpen, selectedIds, onToggleSelect }}
      />
    </div>
  );
}
