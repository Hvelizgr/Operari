'use client';

import { Check, Copy, ExternalLink, Loader2, RefreshCw, Webhook } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEditorStore } from '@/state/editorStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface WebhookRecord {
  id: string;
  runbookId: string;
  source: string;
  url: string;
  secret: string | null;
  isActive: boolean;
  triggerCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

const STRINGS = {
  en: {
    title: 'Webhook URL',
    description:
      'External services trigger this runbook by POSTing to the URL below. Each registration is tenant-scoped and HMAC-verified when a secret is set.',
    none: 'No webhook is registered for this runbook yet.',
    create: 'Create webhook',
    creating: 'Creating…',
    copy: 'Copy URL',
    copied: 'Copied',
    copyCurl: 'Copy as curl',
    copiedCurl: 'curl copied',
    inactive: 'Inactive',
    secretLine: 'Sign requests with this secret (HMAC-SHA256, header X-Webhook-Signature):',
    saveRunbookFirst: 'Save the runbook before creating a webhook.',
    rotate: 'Rotate secret',
  },
  es: {
    title: 'URL del webhook',
    description:
      'Los servicios externos disparan este runbook haciendo POST a la URL de abajo. Cada registro es por-tenant y se verifica con HMAC cuando hay un secreto seteado.',
    none: 'No hay webhook registrado para este runbook todavía.',
    create: 'Crear webhook',
    creating: 'Creando…',
    copy: 'Copiar URL',
    copied: 'Copiado',
    copyCurl: 'Copiar como curl',
    copiedCurl: 'curl copiado',
    inactive: 'Inactivo',
    secretLine: 'Firmá los requests con este secreto (HMAC-SHA256, header X-Webhook-Signature):',
    saveRunbookFirst: 'Guardá el runbook antes de crear un webhook.',
    rotate: 'Rotar secreto',
  },
} as const;

type LangStrings = (typeof STRINGS)[keyof typeof STRINGS];

interface WebhookUrlPanelProps {
  lang: 'en' | 'es';
}

/**
 * Inline panel surfaced in the Inspector when the selected step is
 * an `operari.webhook` trigger. n8n parity — the operator wires the
 * webhook by-token here without leaving the canvas.
 *
 * Why this is a separate component (not part of Inspector.tsx):
 *   The panel does its own data fetch (`/api/webhooks?runbookId=…`)
 *   and tracks copy-button state. Pulling that into Inspector would
 *   force the inspector to re-render on every webhook fetch tick.
 */
export function WebhookUrlPanel({ lang }: WebhookUrlPanelProps) {
  const t: LangStrings = STRINGS[lang] ?? STRINGS.en;
  const runbookId = useEditorStore(s => s.runbookId);
  const [webhooks, setWebhooks] = useState<WebhookRecord[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'url' | 'curl' | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!runbookId) {
      setWebhooks([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/webhooks?runbookId=${encodeURIComponent(runbookId)}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        setWebhooks([]);
        setError(`HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { data?: WebhookRecord[] };
      setWebhooks(body.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  }, [runbookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const flashCopied = (which: 'url' | 'curl') => {
    setCopied(which);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(null), 1600);
  };

  const handleCopy = (text: string, which: 'url' | 'curl') => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => flashCopied(which));
  };

  const handleCreate = useCallback(async () => {
    if (!runbookId) {
      setError(t.saveRunbookFirst);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/webhooks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runbookId, source: 'generic', useSecret: true }),
      });
      if (!res.ok && res.status !== 201) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }, [runbookId, refresh, t.saveRunbookFirst]);

  const primary = useMemo(() => (webhooks && webhooks.length > 0 ? webhooks[0] : null), [webhooks]);

  return (
    <div className="space-y-3 rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <Webhook size={13} className="text-emerald-400" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
          {t.title}
        </span>
        {primary && !primary.isActive ? (
          <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-300">
            {t.inactive}
          </span>
        ) : null}
      </div>
      <p className="text-[10px] leading-snug text-gray-400">{t.description}</p>

      {webhooks === null ? (
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <Loader2 size={11} className="animate-spin" />…
        </div>
      ) : !primary ? (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-400">{t.none}</p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !runbookId}
            className="flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-300 transition-colors hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {creating ? t.creating : t.create}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <code
              className="flex-1 truncate rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-gray-300"
              title={primary.url}
            >
              {primary.url}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(primary.url, 'url')}
              aria-label={t.copy}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              {copied === 'url' ? (
                <Check size={11} className="text-emerald-400" />
              ) : (
                <Copy size={11} />
              )}
            </button>
            <a
              href={primary.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Open in new tab"
            >
              <ExternalLink size={11} />
            </a>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(buildCurl(primary), 'curl')}
            className="flex items-center gap-1 rounded text-[10px] text-gray-400 transition-colors hover:text-white"
          >
            {copied === 'curl' ? (
              <Check size={10} className="text-emerald-400" />
            ) : (
              <Copy size={10} />
            )}
            {copied === 'curl' ? t.copiedCurl : t.copyCurl}
          </button>
          {primary.secret ? (
            <div className="space-y-1 border-t border-white/5 pt-2">
              <p className="text-[9px] leading-snug text-gray-500">{t.secretLine}</p>
              <code className="block overflow-hidden truncate rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-amber-200/80">
                {primary.secret}
              </code>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="text-[10px] text-rose-400">{error}</p> : null}
    </div>
  );
}

/**
 * Build a copy-pasteable curl that exercises the webhook URL with
 * an empty JSON body. Operators tweak the body inline to test
 * specific payload shapes.
 */
function buildCurl(webhook: WebhookRecord): string {
  return [
    `curl -X POST '${webhook.url}'`,
    `  -H 'Content-Type: application/json'`,
    `  -d '{}'`,
  ].join(' \\\n');
}
