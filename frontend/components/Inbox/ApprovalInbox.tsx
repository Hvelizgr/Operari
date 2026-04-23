'use client';

import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

interface Approval {
  id: string;
  status: ApprovalStatus;
  message: string | null;
  workflow: { id: string; slug: string | null; name: string };
  executionId: string;
  stepId: string;
  requestedBy: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  comment: string | null;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    title: 'Approval inbox',
    subtitle: 'Pending runbook steps waiting for a decision.',
    filterAll: 'All',
    filterPending: 'Pending',
    filterApproved: 'Approved',
    filterRejected: 'Rejected',
    filterExpired: 'Expired',
    empty: 'No approvals to show.',
    loading: 'Loading approvals...',
    loadMore: 'Load more',
    grant: 'Grant',
    reject: 'Reject',
    commentPh: 'Optional comment',
    runbook: 'Runbook',
    step: 'Step',
    run: 'Run',
    requestedBy: 'Requested by',
    when: 'Created',
    resolved: 'Resolved',
    actionFailed: 'Action failed',
  },
  es: {
    title: 'Bandeja de aprobaciones',
    subtitle: 'Pasos del runbook esperando una decisión.',
    filterAll: 'Todo',
    filterPending: 'Pendientes',
    filterApproved: 'Aprobadas',
    filterRejected: 'Rechazadas',
    filterExpired: 'Expiradas',
    empty: 'No hay aprobaciones para mostrar.',
    loading: 'Cargando aprobaciones...',
    loadMore: 'Cargar más',
    grant: 'Aprobar',
    reject: 'Rechazar',
    commentPh: 'Comentario opcional',
    runbook: 'Runbook',
    step: 'Paso',
    run: 'Ejecución',
    requestedBy: 'Solicitado por',
    when: 'Creada',
    resolved: 'Resuelta',
    actionFailed: 'Acción fallida',
  },
};

const FILTERS: Array<{
  key: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'all';
  labelKey: string;
}> = [
  { key: 'PENDING', labelKey: 'filterPending' },
  { key: 'APPROVED', labelKey: 'filterApproved' },
  { key: 'REJECTED', labelKey: 'filterRejected' },
  { key: 'EXPIRED', labelKey: 'filterExpired' },
  { key: 'all', labelKey: 'filterAll' },
];

const STATUS_STYLES: Record<ApprovalStatus, { icon: typeof CheckCircle2; cls: string }> = {
  PENDING: { icon: Clock, cls: 'text-amber-400' },
  APPROVED: { icon: CheckCircle2, cls: 'text-emerald-400' },
  REJECTED: { icon: XCircle, cls: 'text-red-400' },
  EXPIRED: { icon: AlertTriangle, cls: 'text-zinc-500' },
};

export default function ApprovalInbox({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'all'>(
    'PENDING'
  );
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = useCallback(
    async (mode: 'replace' | 'append') => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: filter, limit: '50' });
        if (mode === 'append' && nextCursor) params.set('cursor', nextCursor);
        const res = await fetch(`${apiBase}/api/approvals?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setApprovals(prev => (mode === 'append' ? [...prev, ...json.data] : json.data));
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
    setApprovals([]);
    setNextCursor(null);
    load('replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const resolve = async (id: string, action: 'grant' | 'reject') => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/approvals/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comments[id] || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setApprovals(prev =>
        prev.map(a =>
          a.id === id
            ? {
                ...a,
                status: updated.status,
                approvedBy: updated.approvedBy,
                approvedAt: updated.approvedAt,
                comment: updated.comment,
              }
            : a
        )
      );
    } catch (err) {
      setError(`${t.actionFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
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

      {loading && approvals.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.loading}
        </div>
      )}

      {!loading && approvals.length === 0 && (
        <div className="rounded border border-zinc-800 bg-zinc-950 px-6 py-12 text-center text-sm text-zinc-500">
          {t.empty}
        </div>
      )}

      <ul className="space-y-3">
        {approvals.map(a => {
          const meta = STATUS_STYLES[a.status];
          const Icon = meta.icon;
          const isPending = a.status === 'PENDING';
          return (
            <li key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${meta.cls}`} />
                    <span className={`text-xs font-semibold uppercase ${meta.cls}`}>
                      {a.status}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {a.message || `${t.step}: ${a.stepId}`}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <span>
                      {t.runbook}: <span className="text-zinc-200">{a.workflow.name}</span>
                    </span>
                    <span>
                      {t.run}:{' '}
                      <span className="font-mono text-zinc-300">{a.executionId.slice(0, 8)}</span>
                    </span>
                    {a.requestedBy && (
                      <span>
                        {t.requestedBy}: <span className="text-zinc-300">{a.requestedBy}</span>
                      </span>
                    )}
                  </div>
                  {a.comment && (
                    <div className="mt-2 rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                      {a.comment}
                    </div>
                  )}
                </div>
              </div>

              {isPending && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    placeholder={t.commentPh}
                    value={comments[a.id] || ''}
                    onChange={e => setComments(prev => ({ ...prev, [a.id]: e.target.value }))}
                    className="flex-1 rounded border border-zinc-800 bg-black px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolve(a.id, 'grant')}
                      disabled={busyId === a.id}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {t.grant}
                    </button>
                    <button
                      onClick={() => resolve(a.id, 'reject')}
                      disabled={busyId === a.id}
                      className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {t.reject}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

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
