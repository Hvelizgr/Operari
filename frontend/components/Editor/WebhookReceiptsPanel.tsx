'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  PlayCircle,
  CheckCircle2,
  ShieldAlert,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';

type ReceiptStatus = 'accepted' | 'rejected_inactive' | 'rejected_signature' | 'error';

interface Receipt {
  id: string;
  webhookId: string;
  status: ReceiptStatus | string;
  statusCode: number;
  reason: string | null;
  headers: Record<string, unknown>;
  body: unknown;
  sourceIp: string | null;
  executionId: string | null;
  receivedAt: string;
}

interface WebhookReceiptsPanelProps {
  lang: 'en' | 'es';
  webhookId: string;
}

const STRINGS = {
  en: {
    toggleOpen: 'Show receipts',
    toggleClose: 'Hide receipts',
    refresh: 'Refresh',
    empty: 'No calls captured yet. Once this webhook receives a POST it shows up here.',
    loading: 'Loading receipts...',
    loadFailed: 'Could not load receipts.',
    replay: 'Replay',
    replaying: 'Replaying...',
    replayOk: 'Replay fired',
    replayFailed: 'Replay failed',
    body: 'Body',
    headers: 'Headers',
    ip: 'From',
    run: 'Run',
    replayedFrom: 'replay of',
    accepted: 'Accepted',
    rejectedSig: 'Bad signature',
    rejectedInactive: 'Inactive',
    error: 'Error',
  },
  es: {
    toggleOpen: 'Ver llamadas',
    toggleClose: 'Ocultar llamadas',
    refresh: 'Actualizar',
    empty: 'Aún no hay llamadas. Apenas este webhook reciba un POST aparece acá.',
    loading: 'Cargando llamadas...',
    loadFailed: 'No se pudieron cargar las llamadas.',
    replay: 'Reejecutar',
    replaying: 'Reejecutando...',
    replayOk: 'Reejecutado',
    replayFailed: 'Error al reejecutar',
    body: 'Body',
    headers: 'Headers',
    ip: 'Origen',
    run: 'Run',
    replayedFrom: 'replay de',
    accepted: 'Aceptado',
    rejectedSig: 'Firma inválida',
    rejectedInactive: 'Inactivo',
    error: 'Error',
  },
} as const;

/**
 * Debugger panel for a single webhook. Shows the last 50 receipts
 * (accepted + rejected), lets the operator inspect the captured
 * headers + body, and replay any payload into the bound runbook.
 *
 * Collapsed by default — the TriggersPanel is already dense; we only
 * fetch receipts when the operator asks to see them. Each receipt is
 * lazily expanded (body/headers hidden until click) so a noisy
 * webhook doesn't dump 50 JSON blobs into the DOM at once.
 */
export default function WebhookReceiptsPanel({ lang, webhookId }: WebhookReceiptsPanelProps) {
  const t = STRINGS[lang];
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [open, setOpen] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replayToast, setReplayToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/webhooks/${webhookId}/receipts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setReceipts(Array.isArray(json.data) ? json.data : []);
    } catch {
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [apiBase, webhookId, t.loadFailed]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const replay = async (receiptId: string) => {
    setReplayingId(receiptId);
    setReplayToast(null);
    try {
      const res = await fetch(`${apiBase}/api/webhooks/${webhookId}/receipts/${receiptId}/replay`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReplayToast({ kind: 'ok', msg: t.replayOk });
      // Fetch again so the new replay receipt surfaces at the top.
      void load();
    } catch {
      setReplayToast({ kind: 'err', msg: t.replayFailed });
    } finally {
      setReplayingId(null);
      setTimeout(() => setReplayToast(null), 2800);
    }
  };

  return (
    <div className="mt-2 border-t border-slate-800 pt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 text-[10px] text-slate-400 transition-colors hover:text-slate-200"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? t.toggleClose : t.toggleOpen}
        {receipts.length > 0 && open && <span className="text-slate-600">· {receipts.length}</span>}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            {replayToast ? (
              <span
                className={`text-[10px] ${
                  replayToast.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {replayToast.msg}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">
                {loading ? t.loading : (error ?? '')}
              </span>
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              {t.refresh}
            </button>
          </div>

          {!loading && receipts.length === 0 && !error && (
            <div className="rounded border border-dashed border-slate-700 bg-black/20 p-2 text-[10px] leading-snug text-slate-500">
              {t.empty}
            </div>
          )}

          <ul className="space-y-1.5">
            {receipts.map(r => (
              <ReceiptRow
                key={r.id}
                receipt={r}
                t={t}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(id => (id === r.id ? null : r.id))}
                onReplay={() => void replay(r.id)}
                replaying={replayingId === r.id}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReceiptRow({
  receipt,
  t,
  expanded,
  onToggle,
  onReplay,
  replaying,
}: {
  receipt: Receipt;
  t: (typeof STRINGS)['en'] | (typeof STRINGS)['es'];
  expanded: boolean;
  onToggle: () => void;
  onReplay: () => void;
  replaying: boolean;
}) {
  const { Icon, tone, label } = statusVisuals(receipt.status, t);
  const replayOfId = receipt.reason?.startsWith('replay_of:')
    ? receipt.reason.slice('replay_of:'.length)
    : null;

  return (
    <li className="rounded border border-slate-800 bg-black/40">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-white/5"
      >
        {expanded ? (
          <ChevronDown size={11} className="text-slate-500" />
        ) : (
          <ChevronRight size={11} className="text-slate-500" />
        )}
        <Icon size={12} className={tone} />
        <span className={`text-[10px] font-semibold ${tone}`}>{label}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
          <Clock size={9} />
          {new Date(receipt.receivedAt).toLocaleTimeString()}
        </span>
        {receipt.statusCode ? (
          <span className="font-mono text-[10px] text-slate-500">{receipt.statusCode}</span>
        ) : null}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-slate-800 px-2 py-2">
          {receipt.reason && !replayOfId && (
            <div className="text-[10px] leading-snug text-red-300/90">{receipt.reason}</div>
          )}
          {replayOfId && (
            <div className="text-[10px] leading-snug text-sky-300/80">
              {t.replayedFrom} <code className="font-mono">{replayOfId.slice(0, 8)}…</code>
            </div>
          )}
          {receipt.executionId && (
            <div className="text-[10px] text-slate-400">
              {t.run}:{' '}
              <code className="font-mono text-slate-200">{receipt.executionId.slice(0, 8)}…</code>
            </div>
          )}
          {receipt.sourceIp && (
            <div className="text-[10px] text-slate-500">
              {t.ip}: <code className="font-mono">{receipt.sourceIp}</code>
            </div>
          )}
          <KeyBlock title={t.body} value={receipt.body} />
          <KeyBlock title={t.headers} value={receipt.headers} compact />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onReplay}
              disabled={replaying}
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
            >
              {replaying ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <PlayCircle size={10} />
              )}
              {replaying ? t.replaying : t.replay}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function KeyBlock({
  title,
  value,
  compact = false,
}: {
  title: string;
  value: unknown;
  compact?: boolean;
}) {
  const pretty = (() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  })();

  return (
    <div>
      <div className="mb-0.5 text-[9px] uppercase tracking-wider text-slate-500">{title}</div>
      <pre
        className={`overflow-x-auto whitespace-pre rounded border border-slate-800 bg-black/60 p-1.5 font-mono text-[10px] text-slate-300 ${
          compact ? 'max-h-28' : 'max-h-48'
        } overflow-y-auto`}
      >
        {pretty}
      </pre>
    </div>
  );
}

function statusVisuals(
  status: string,
  t: (typeof STRINGS)['en'] | (typeof STRINGS)['es']
): {
  Icon: typeof CheckCircle2;
  tone: string;
  label: string;
} {
  switch (status) {
    case 'accepted':
      return { Icon: CheckCircle2, tone: 'text-emerald-400', label: t.accepted };
    case 'rejected_signature':
      return { Icon: ShieldAlert, tone: 'text-amber-400', label: t.rejectedSig };
    case 'rejected_inactive':
      return { Icon: XCircle, tone: 'text-slate-400', label: t.rejectedInactive };
    case 'error':
      return { Icon: XCircle, tone: 'text-red-400', label: t.error };
    default:
      return { Icon: CheckCircle2, tone: 'text-slate-400', label: status };
  }
}
