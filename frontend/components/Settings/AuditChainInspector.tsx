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
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatDateTime } from '@/lib/datetime';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface AuditChainInspectorProps {
  lang: 'en' | 'es';
  viewerRole: 'ADMIN' | 'USER' | null;
}

interface VerifyStatus {
  tenantId: string;
  eventCount: number;
  intact: boolean;
  firstBrokenSeq: string | null;
  firstGapAfterSeq: string | null;
  verifiedAt: string;
}

interface AuditEvent {
  id: string;
  seq: string;
  type: string;
  actorId: string | null;
  actorType: string | null;
  resource: string | null;
  payload: unknown;
  hash: string;
  prevHash: string;
  createdAt: string;
}

const STRINGS = {
  en: {
    title: 'Audit chain inspector',
    hint: 'Walk the SHA-256 hash chain that records every audited action on this tenant. The verify button re-hashes every event and reports the first row whose hash diverges from its predecessor — proof, in seconds, that the log is tamper-evident.',
    verify: 'Verify chain',
    verifying: 'Verifying…',
    verifyAgain: 'Re-verify',
    intact: 'Chain intact',
    intactBody: 'every event reverifies',
    broken: 'Chain broken',
    brokenBody: 'first divergence at seq',
    gap: 'Gap detected',
    gapBody: 'sequence gap after seq',
    eventCount: 'Total events',
    eventsHeader: 'Recent events',
    eventsHint:
      'Newest first. The hash column is truncated for the table; full hashes ship in the NDJSON export.',
    eventsEmpty: 'No audit events yet for this tenant.',
    type: 'Type',
    actor: 'Actor',
    seq: 'Seq',
    when: 'When',
    hash: 'Hash',
    prev: 'Previous',
    next: 'Next',
    failed: 'Could not load audit chain.',
  },
  es: {
    title: 'Inspector de cadena de auditoría',
    hint: 'Recorre la cadena SHA-256 que registra cada acción auditada del tenant. El botón verificar rehashe cada evento y reporta la primera fila cuyo hash diverge — prueba, en segundos, de que el log es tamper-evident.',
    verify: 'Verificar cadena',
    verifying: 'Verificando…',
    verifyAgain: 'Re-verificar',
    intact: 'Cadena íntegra',
    intactBody: 'cada evento se reverifica',
    broken: 'Cadena rota',
    brokenBody: 'primera divergencia en seq',
    gap: 'Hueco detectado',
    gapBody: 'salto de secuencia luego de seq',
    eventCount: 'Eventos totales',
    eventsHeader: 'Eventos recientes',
    eventsHint:
      'Más recientes primero. La columna de hash está truncada acá; los hashes completos viajan en el export NDJSON.',
    eventsEmpty: 'No hay eventos auditados aún para este tenant.',
    type: 'Tipo',
    actor: 'Actor',
    seq: 'Seq',
    when: 'Cuándo',
    hash: 'Hash',
    prev: 'Anterior',
    next: 'Siguiente',
    failed: 'No se pudo cargar la cadena.',
  },
} as const;

const PAGE_SIZE = 25;

export function AuditChainInspector({ lang, viewerRole }: AuditChainInspectorProps) {
  const t = STRINGS[lang];

  const [verify, setVerify] = useState<VerifyStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [nextSeq, setNextSeq] = useState<string | null>(null);

  const fetchEvents = useCallback(async (fromSeq: string | null) => {
    setEventsError(null);
    const url = new URL(`${API_BASE}/api/tenants/audit/events`);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    if (fromSeq) url.searchParams.set('fromSeq', fromSeq);
    try {
      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) {
        setEventsError(`HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { data: AuditEvent[]; nextSeq: string | null };
      setEvents(body.data);
      setNextSeq(body.nextSeq);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Network error');
    }
  }, []);

  useEffect(() => {
    if (viewerRole !== 'ADMIN') return;
    void fetchEvents(null);
  }, [viewerRole, fetchEvents]);

  const runVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(`${API_BASE}/api/tenants/audit/verify`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setVerifyError(`HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as VerifyStatus;
      setVerify(body);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setVerifying(false);
    }
  }, []);

  const goNext = useCallback(() => {
    if (!nextSeq) return;
    setCursorStack(prev => [...prev, nextSeq]);
    void fetchEvents(nextSeq);
  }, [nextSeq, fetchEvents]);

  const goPrev = useCallback(() => {
    if (cursorStack.length <= 1) return;
    const newStack = cursorStack.slice(0, -1);
    setCursorStack(newStack);
    void fetchEvents(newStack[newStack.length - 1] ?? null);
  }, [cursorStack, fetchEvents]);

  // react-table column model. Sorting toggles in-page (the server-side
  // cursor pagination still owns the broader window) — operators
  // sorting the current page is enough to surface a recent suspect
  // event without having to scroll. Real cross-page sorting would
  // require a sort param on the API, which the audit endpoint doesn't
  // currently expose.
  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        accessorKey: 'seq',
        header: t.seq,
        cell: info => (
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {info.getValue<string>()}
          </span>
        ),
        sortingFn: (a, b) => Number(a.original.seq) - Number(b.original.seq),
      },
      {
        accessorKey: 'type',
        header: t.type,
        cell: info => <span className="font-mono text-[11px]">{info.getValue<string>()}</span>,
      },
      {
        id: 'actor',
        header: t.actor,
        cell: info => {
          const ev = info.row.original;
          return (
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              {ev.actorType ? `${ev.actorType}:` : ''}
              {ev.actorId ?? '—'}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'hash',
        header: t.hash,
        cell: info => {
          const hash = info.getValue<string>();
          return (
            <span className="font-mono text-[11px] text-[var(--text-muted)]" title={hash}>
              {hash.slice(0, 12)}…
            </span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'createdAt',
        header: t.when,
        cell: info => (
          <span className="text-[11px] text-[var(--text-muted)]">
            {formatDateTime(info.getValue<string>(), lang)}
          </span>
        ),
      },
    ],
    [lang, t]
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: events ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (viewerRole !== 'ADMIN') return null;

  const canGoBack = cursorStack.length > 1;
  const canGoForward = nextSeq !== null;

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">{t.title}</div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-muted)]">{t.hint}</p>
        </div>
        <button
          type="button"
          onClick={runVerify}
          disabled={verifying}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {verifying ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ShieldCheck className="h-3 w-3" />
          )}
          {verifying ? t.verifying : verify ? t.verifyAgain : t.verify}
        </button>
      </div>

      {verifyError && (
        <div className="mb-3 flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            {t.failed} ({verifyError})
          </span>
        </div>
      )}

      {verify && <VerifyBadge verify={verify} t={t} />}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t.eventsHeader}
          </h5>
          <p className="text-[11px] text-[var(--text-muted)]">{t.eventsHint}</p>
        </div>

        {eventsError ? (
          <div className="rounded border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
            {eventsError}
          </div>
        ) : events === null ? (
          <div className="text-xs text-[var(--text-muted)]">…</div>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)]">
            {t.eventsEmpty}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--weathered,#262626)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => {
                      const sortDir = header.column.getIsSorted();
                      const canSort = header.column.getCanSort();
                      return (
                        <th key={header.id} className="px-3 py-2">
                          {canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sortDir === 'asc' ? (
                                <ArrowUp size={10} />
                              ) : sortDir === 'desc' ? (
                                <ArrowDown size={10} />
                              ) : (
                                <ArrowUpDown size={10} className="opacity-50" />
                              )}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="text-[var(--text-primary)]">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {events && events.length > 0 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoBack}
              className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <ChevronLeft size={12} />
              {t.prev}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoForward}
              className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {t.next}
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type T = (typeof STRINGS)[keyof typeof STRINGS];

function VerifyBadge({ verify, t }: { verify: VerifyStatus; t: T }) {
  if (verify.intact) {
    return (
      <div className="flex items-start gap-2 rounded border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">{t.intact}</div>
          <div className="text-[11px] text-emerald-200/70">
            {t.intactBody} · {t.eventCount}: {verify.eventCount}
          </div>
        </div>
      </div>
    );
  }

  if (verify.firstBrokenSeq) {
    return (
      <div className="flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
        <ShieldX size={14} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">{t.broken}</div>
          <div className="text-[11px] text-rose-200/70">
            {t.brokenBody} {verify.firstBrokenSeq} · {t.eventCount}: {verify.eventCount}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
      <ShieldAlert size={14} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold">{t.gap}</div>
        <div className="text-[11px] text-amber-200/70">
          {t.gapBody} {verify.firstGapAfterSeq} · {t.eventCount}: {verify.eventCount}
        </div>
      </div>
    </div>
  );
}
