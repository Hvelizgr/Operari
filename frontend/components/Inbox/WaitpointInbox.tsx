'use client';

import {
  Anchor,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  XCircle,
  AlertTriangle,
  X as XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { formatRemaining } from '@/components/Editor/LiveCountdown';
import { formatDateTime } from '@/lib/datetime';

type WaitpointStatus = 'PENDING' | 'COMPLETED' | 'TIMED_OUT' | 'CANCELLED';

interface WaitpointRow {
  id: string;
  status: WaitpointStatus;
  executionId: string | null;
  expiresAt: string | null;
  tags: string[];
  completedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  url?: string;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    title: 'Wait token inbox',
    subtitle: 'Tokens minted by paused runs — vendors POST the URL to resume.',
    filterPending: 'Pending',
    filterCompleted: 'Completed',
    filterTimedOut: 'Timed out',
    filterCancelled: 'Cancelled',
    filterAll: 'All',
    empty: 'No wait tokens to show.',
    loading: 'Loading wait tokens...',
    copy: 'Copy URL',
    copied: 'Copied',
    cancel: 'Cancel',
    expires: 'Expires in',
    expired: 'Expired',
    noExpiry: 'No timeout',
    viewRun: 'View run →',
    completedBy: 'Completed by',
    cancelConfirm: 'Cancel this waitpoint? The run will stay paused until you resume it manually.',
  },
  es: {
    title: 'Bandeja de tokens de espera',
    subtitle:
      'Tokens creados por ejecuciones pausadas — los vendors hacen POST a la URL para resumir.',
    filterPending: 'Pendientes',
    filterCompleted: 'Completados',
    filterTimedOut: 'Expirados',
    filterCancelled: 'Cancelados',
    filterAll: 'Todo',
    empty: 'No hay tokens de espera para mostrar.',
    loading: 'Cargando tokens de espera...',
    copy: 'Copiar URL',
    copied: 'Copiado',
    cancel: 'Cancelar',
    expires: 'Expira en',
    expired: 'Expirado',
    noExpiry: 'Sin timeout',
    viewRun: 'Ver ejecución →',
    completedBy: 'Completado por',
    cancelConfirm:
      '¿Cancelar este waitpoint? La ejecución quedará pausada hasta que la reanudes manualmente.',
  },
};

const FILTERS: Array<{ key: WaitpointStatus | 'all'; labelKey: string }> = [
  { key: 'PENDING', labelKey: 'filterPending' },
  { key: 'COMPLETED', labelKey: 'filterCompleted' },
  { key: 'TIMED_OUT', labelKey: 'filterTimedOut' },
  { key: 'CANCELLED', labelKey: 'filterCancelled' },
  { key: 'all', labelKey: 'filterAll' },
];

const STATUS_STYLES: Record<WaitpointStatus, { icon: typeof CheckCircle2; cls: string }> = {
  PENDING: { icon: Clock, cls: 'text-violet-300' },
  COMPLETED: { icon: CheckCircle2, cls: 'text-emerald-400' },
  TIMED_OUT: { icon: AlertTriangle, cls: 'text-amber-400' },
  CANCELLED: { icon: XCircle, cls: 'text-zinc-500' },
};

export default function WaitpointInbox({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [filter, setFilter] = useState<WaitpointStatus | 'all'>('PENDING');
  const [rows, setRows] = useState<WaitpointRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`${apiBase}/api/waitpoints?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: WaitpointRow[] };
      setRows(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [apiBase, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyUrl = async (id: string, url?: string) => {
    const target = url ?? `${apiBase}/api/waitpoints/${id}/complete`;
    try {
      await navigator.clipboard.writeText(target);
      setCopiedId(id);
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500);
    } catch {
      // Clipboard may be blocked in insecure contexts; URL is on screen.
    }
  };

  const cancel = async (id: string) => {
    if (!confirm(t.cancelConfirm)) return;
    try {
      await fetch(`${apiBase}/api/waitpoints/${id}`, { method: 'DELETE' });
    } catch {
      // ignore — refresh below will show whatever the truth is
    }
    void load();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Anchor className="text-violet-400" size={22} />
          {t.title}
        </h1>
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
        <div className="mb-4 rounded border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="text-sm italic text-zinc-500">{t.loading}</div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm italic text-zinc-500">
          {t.empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map(row => {
            const meta = STATUS_STYLES[row.status];
            const StatusIcon = meta.icon;
            const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
            const remaining = expiresAt ? expiresAt.getTime() - Date.now() : null;
            const expired = remaining !== null && remaining <= 0;
            return (
              <li
                key={row.id}
                className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 hover:border-violet-900/50"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusIcon size={14} className={meta.cls} />
                      <span className={`text-[10px] font-bold uppercase ${meta.cls}`}>
                        {row.status}
                      </span>
                      <span className="font-mono text-xs text-zinc-300">{row.id}</span>
                    </div>
                    {row.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.tags.map(tag => (
                          <span
                            key={tag}
                            className="rounded bg-violet-900/30 px-1.5 py-0.5 text-[10px] text-violet-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                      <span>{formatDateTime(row.createdAt, lang)}</span>
                      {row.status === 'PENDING' && expiresAt && (
                        <span className={expired ? 'text-amber-400' : ''}>
                          {expired ? t.expired : `${t.expires} ${formatRemaining(remaining ?? 0)}`}
                        </span>
                      )}
                      {row.status === 'PENDING' && !expiresAt && <span>{t.noExpiry}</span>}
                      {row.completedBy && (
                        <span>
                          {t.completedBy}: {row.completedBy}
                        </span>
                      )}
                      {row.executionId && (
                        <Link
                          href={`/${lang}/runs/${row.executionId}`}
                          className="inline-flex items-center gap-1 text-violet-400 hover:underline"
                        >
                          {t.viewRun}
                          <ExternalLink size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                  {row.status === 'PENDING' && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => copyUrl(row.id, row.url)}
                        className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-violet-700 hover:bg-violet-950"
                      >
                        {copiedId === row.id ? (
                          <>
                            <CheckCircle2 size={12} className="text-emerald-400" />
                            {t.copied}
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            {t.copy}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => cancel(row.id)}
                        className="flex items-center gap-1.5 rounded border border-red-900/50 px-2.5 py-1 text-[11px] text-red-300 hover:border-red-700 hover:bg-red-950/40"
                      >
                        <XIcon size={12} />
                        {t.cancel}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
