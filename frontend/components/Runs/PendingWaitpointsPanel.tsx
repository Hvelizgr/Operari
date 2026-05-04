'use client';

import { Anchor, CheckCircle2, Copy, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { formatRemaining } from '@/components/Editor/LiveCountdown';

interface WaitpointRow {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'TIMED_OUT' | 'CANCELLED';
  expiresAt: string | null;
  tags: string[];
  url?: string;
}

interface Props {
  runId: string;
  /**
   * Lang from the parent. We keep the EN/ES table inline (one of two
   * locales project-wide) instead of a context — every call site
   * passes lang explicitly already, and a separate provider just for
   * this small panel would be ceremony.
   */
  lang: 'en' | 'es';
  /**
   * Show the panel even when the list is empty. The default is to
   * hide an empty list — the panel is contextual UI, not a permanent
   * fixture, so a run with no waitpoints shouldn't claim screen space.
   */
  showEmpty?: boolean;
}

const t = {
  en: {
    title: 'Pending wait tokens',
    empty: 'No pending wait tokens for this run.',
    copy: 'Copy URL',
    copied: 'Copied',
    cancel: 'Cancel token',
    expires: 'Expires in',
    noExpiry: 'No timeout',
    tagsLabel: 'tags',
    cancelConfirm: 'Cancel this waitpoint? The run will stay paused until you resume it manually.',
  },
  es: {
    title: 'Tokens de espera pendientes',
    empty: 'No hay tokens de espera pendientes para esta ejecución.',
    copy: 'Copiar URL',
    copied: 'Copiado',
    cancel: 'Cancelar token',
    expires: 'Expira en',
    noExpiry: 'Sin timeout',
    tagsLabel: 'etiquetas',
    cancelConfirm:
      '¿Cancelar este waitpoint? La ejecución quedará pausada hasta que la reanudes manualmente.',
  },
} as const;

export default function PendingWaitpointsPanel({ runId, lang, showEmpty = false }: Props) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const labels = t[lang];
  const [rows, setRows] = useState<WaitpointRow[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${apiBase}/api/waitpoints?status=PENDING&executionId=${encodeURIComponent(runId)}`
      );
      if (!res.ok) return;
      const json = (await res.json()) as { data: WaitpointRow[] };
      setRows(json.data);
    } catch {
      // Quiet failure — the panel is auxiliary; if the API hiccups
      // we show whatever we last had instead of a scary error pill.
    }
  }, [apiBase, runId]);

  useEffect(() => {
    void load();
    // Lightweight poll. The list rarely changes — once a token is
    // completed it leaves the PENDING set, so the watchdog doesn't
    // need a tight loop. 10s is a balance between "operator sees a
    // freshly-minted token" and "don't hammer the API for a panel
    // most runs won't even have to populate".
    const interval = setInterval(() => void load(), 10_000);
    return () => clearInterval(interval);
  }, [load]);

  const copyUrl = async (id: string, url?: string) => {
    if (!url) {
      // Older API responses (pre-route-mount) didn't include `url`
      // on list. Reconstruct from the public address — same shape
      // the create endpoint returns.
      url = `${apiBase}/api/waitpoints/${id}/complete`;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500);
    } catch {
      // Same rationale as RunDetail.copyRunId — clipboard API can
      // reject; the URL is on screen so the operator can still copy
      // by hand.
    }
  };

  const cancel = async (id: string) => {
    if (!confirm(labels.cancelConfirm)) return;
    try {
      await fetch(`${apiBase}/api/waitpoints/${id}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    void load();
  };

  if (rows === null) return null;
  if (rows.length === 0 && !showEmpty) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase text-zinc-500">
        <Anchor size={14} className="text-violet-400" />
        {labels.title}
      </h2>
      {rows.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs italic text-zinc-500">
          {labels.empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map(row => {
            const url = row.url ?? `${apiBase}/api/waitpoints/${row.id}/complete`;
            const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
            const remaining = expiresAt ? formatRemaining(expiresAt.getTime() - Date.now()) : null;
            return (
              <li
                key={row.id}
                className="rounded border border-violet-900/50 bg-violet-950/20 px-4 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-violet-200">{row.id}</div>
                    {row.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.tags.map(tag => (
                          <span
                            key={tag}
                            className="rounded bg-violet-900/40 px-1.5 py-0.5 text-[10px] text-violet-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {expiresAt ? `${labels.expires} ${remaining ?? '—'}` : labels.noExpiry}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => copyUrl(row.id, row.url)}
                      className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-violet-700 hover:bg-violet-950"
                      title={url}
                    >
                      {copiedId === row.id ? (
                        <>
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          {labels.copied}
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          {labels.copy}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => cancel(row.id)}
                      className="flex items-center gap-1.5 rounded border border-red-900/50 px-2.5 py-1 text-[11px] text-red-300 hover:border-red-700 hover:bg-red-950/40"
                    >
                      <X size={12} />
                      {labels.cancel}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
