'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { HelixSpinner } from '@/components/Brand/HelixSpinner';
import {
  motionFor,
  reducedStaggerChildVariants,
  reducedStaggerContainerVariants,
  staggerChildVariants,
  staggerContainerVariants,
} from '@/lib/motion';

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
    grantedOk: 'Approval granted',
    rejectedOk: 'Approval rejected',
    viewRun: 'View run →',
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
    grantedOk: 'Aprobación concedida',
    rejectedOk: 'Aprobación rechazada',
    viewRun: 'Ver ejecución →',
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
  // Success banner shown after a resolve lands. Includes the run id
  // so the operator can jump straight to /runs/:id and watch the run
  // resume — the action is mid-flow and the next thing they want is
  // confirmation the engine picked it up.
  const [success, setSuccess] = useState<{
    action: 'grant' | 'reject';
    executionId: string;
  } | null>(null);

  const load = useCallback(
    async (mode: 'replace' | 'append') => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: filter, limit: '50' });
        if (mode === 'append' && nextCursor) params.set('cursor', nextCursor);
        const res = await fetch(`${apiBase}/api/approvals?${params}`, { credentials: 'include' });
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
    setSuccess(null);
    try {
      const res = await fetch(`${apiBase}/api/approvals/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comments[id] || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      // The approval row shows the one we just resolved with its new
      // status, so we need its executionId to build the "view run"
      // link — we take it from the row we already have in state.
      const resolved = approvals.find(a => a.id === id);
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
      if (resolved) {
        setSuccess({ action, executionId: resolved.executionId });
      }
    } catch (err) {
      setError(`${t.actionFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h1>
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

      {success && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 size={14} className="shrink-0" />
          <span className="min-w-0 flex-1">
            {success.action === 'grant' ? t.grantedOk : t.rejectedOk}
          </span>
          <Link
            href={`/${lang}/runs/${success.executionId}`}
            className="shrink-0 text-xs font-medium text-emerald-300 underline-offset-2 hover:underline"
          >
            {t.viewRun}
          </Link>
          <button
            onClick={() => setSuccess(null)}
            aria-label="Dismiss"
            className="shrink-0 text-emerald-400/60 hover:text-emerald-200"
          >
            <XCircle size={14} />
          </button>
        </div>
      )}

      {loading && approvals.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <HelixSpinner size={16} />
          {t.loading}
        </div>
      )}

      {!loading && !error && approvals.length === 0 && (
        <div className="rounded border border-zinc-800 bg-zinc-950 px-6 py-12 text-center text-sm text-zinc-500">
          {t.empty}
        </div>
      )}

      {/* Approval cards stagger in on mount. Pending rows at the top
          sweep in first so the operator's eye lands on actionable
          items before paging back through resolved history. Variants
          re-fire when filter changes, which reads as "new result set
          arrived" — the right mental model for a filtered list. */}
      <motion.ul
        className="space-y-3"
        variants={motionFor(staggerContainerVariants, reducedStaggerContainerVariants)}
        initial="initial"
        animate="animate"
      >
        {approvals.map(a => {
          const meta = STATUS_STYLES[a.status];
          const Icon = meta.icon;
          const isPending = a.status === 'PENDING';
          return (
            <motion.li
              key={a.id}
              variants={motionFor(staggerChildVariants, reducedStaggerChildVariants)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Icon className={`h-4 w-4 shrink-0 ${meta.cls}`} />
                    <span className={`text-xs font-semibold uppercase ${meta.cls}`}>
                      {a.status}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(a.createdAt).toLocaleString(lang === 'es' ? 'es-GT' : 'en-US')}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {a.message || `${t.step}: ${a.stepId}`}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <span>
                      {t.runbook}: <span className="text-zinc-200">{a.workflow.name}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {t.run}:{' '}
                      <Link
                        href={`/${lang}/runs/${a.executionId}`}
                        className="inline-flex items-center gap-1 font-mono text-zinc-300 underline-offset-2 hover:text-white hover:underline"
                        title={lang === 'en' ? 'Open run detail' : 'Abrir detalle'}
                      >
                        {a.executionId.slice(0, 8)}
                        <ExternalLink size={10} />
                      </Link>
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
            </motion.li>
          );
        })}
      </motion.ul>

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
