'use client';

import {
  AlertCircle,
  Check,
  Copy,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import WebhookReceiptsPanel from './WebhookReceiptsPanel';
import WebhookSetupWizardModal from './WebhookSetupWizardModal';

interface TriggerRecord {
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

interface TriggersPanelProps {
  lang: 'en' | 'es';
  runbookId: string | undefined;
}

const SOURCES: Array<{
  key: 'sentry' | 'datadog' | 'github' | 'custom';
  label: Record<'en' | 'es', string>;
}> = [
  { key: 'github', label: { en: 'GitHub', es: 'GitHub' } },
  { key: 'sentry', label: { en: 'Sentry', es: 'Sentry' } },
  { key: 'datadog', label: { en: 'Datadog', es: 'Datadog' } },
  { key: 'custom', label: { en: 'Custom', es: 'Personalizado' } },
];

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    title: 'Triggers',
    subtitle: 'External events that start this runbook automatically.',
    save_first: 'Save the runbook before adding triggers.',
    empty: 'No triggers yet.',
    addLabel: 'Add a trigger',
    url: 'Webhook URL',
    secret: 'Secret (shown once)',
    copy: 'Copy',
    copied: 'Copied',
    delete: 'Delete',
    triggered: 'Triggered',
    never: 'never',
    loading: 'Loading triggers...',
    loadFailed: 'Failed to load triggers',
    createFailed: 'Failed to create trigger',
    deleteFailed: 'Failed to delete trigger',
    setupWizard: 'Setup wizard',
    rotate: 'Rotate secret',
    rotating: 'Rotating…',
    rotateConfirm:
      'Rotate the signing secret? Existing senders will be rejected with HTTP 401 until you update the secret in the provider UI.',
    rotateFailed: 'Failed to rotate secret',
  },
  es: {
    title: 'Disparadores',
    subtitle: 'Eventos externos que inician este runbook automáticamente.',
    save_first: 'Guarda el runbook antes de añadir disparadores.',
    empty: 'Aún no hay disparadores.',
    addLabel: 'Añadir disparador',
    url: 'URL del webhook',
    secret: 'Secreto (se muestra una sola vez)',
    copy: 'Copiar',
    copied: 'Copiado',
    delete: 'Eliminar',
    triggered: 'Disparado',
    never: 'nunca',
    loading: 'Cargando disparadores...',
    loadFailed: 'No se pudieron cargar los disparadores',
    createFailed: 'No se pudo crear el disparador',
    deleteFailed: 'No se pudo eliminar',
    setupWizard: 'Asistente de configuración',
    rotate: 'Rotar secreto',
    rotating: 'Rotando…',
    rotateConfirm:
      '¿Rotar el secreto de firma? Los emisores existentes recibirán HTTP 401 hasta que actualices el secreto en la UI del proveedor.',
    rotateFailed: 'No se pudo rotar el secreto',
  },
};

export default function TriggersPanel({ lang, runbookId }: TriggersPanelProps) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [triggers, setTriggers] = useState<TriggerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [wizardFor, setWizardFor] = useState<TriggerRecord | null>(null);

  const load = useCallback(async () => {
    if (!runbookId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/webhooks?runbookId=${encodeURIComponent(runbookId)}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTriggers(json.data || []);
    } catch (err) {
      setError(`${t.loadFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [apiBase, runbookId, t.loadFailed]);

  useEffect(() => {
    if (runbookId) load();
  }, [runbookId, load]);

  const create = async (source: string) => {
    if (!runbookId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/webhooks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runbookId, source, useSecret: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const created = (await res.json()) as TriggerRecord;
      setTriggers(prev => [created, ...prev]);
      if (created.secret) {
        setRevealedSecrets(prev => ({ ...prev, [created.id]: created.secret! }));
      }
    } catch (err) {
      setError(`${t.createFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const rotateSecret = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm(t.rotateConfirm)) return;
    setRotatingId(id);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/webhooks/${id}/rotate-secret`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { id: string; secret: string };
      setRevealedSecrets(prev => ({ ...prev, [id]: body.secret }));
    } catch (err) {
      setError(`${t.rotateFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRotatingId(null);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/api/webhooks/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTriggers(prev => prev.filter(tr => tr.id !== id));
    } catch (err) {
      setError(`${t.deleteFailed}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
        <Webhook size={12} className="mr-1 inline" />
        {t.title}
      </label>
      <p className="mb-2 text-[10px] text-slate-500">{t.subtitle}</p>

      {!runbookId && (
        <div className="rounded border border-slate-700 bg-black/20 px-3 py-2 text-[11px] text-slate-400">
          {t.save_first}
        </div>
      )}

      {runbookId && (
        <>
          {loading && (
            <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
              <Loader2 size={12} className="animate-spin" />
              {t.loading}
            </div>
          )}

          {error && (
            <div className="mb-2 flex items-start gap-2 rounded border border-red-900/60 bg-red-950/30 px-2 py-1.5 text-[11px] text-red-300">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && triggers.length === 0 && !error && (
            <div className="mb-2 rounded border border-slate-700 bg-black/20 px-3 py-2 text-[11px] text-slate-400">
              {t.empty}
            </div>
          )}

          <ul className="mb-3 space-y-2">
            {triggers.map(tr => {
              const revealedSecret = revealedSecrets[tr.id] ?? null;
              return (
                <li
                  key={tr.id}
                  className="space-y-1 rounded border border-slate-700 bg-black/30 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-primary/70 text-[11px] font-bold uppercase">
                      {tr.source}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWizardFor(tr)}
                        title={t.setupWizard}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
                      >
                        <HelpCircle size={11} />
                        {t.setupWizard}
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateSecret(tr.id)}
                        disabled={rotatingId === tr.id}
                        title={t.rotate}
                        className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-50"
                      >
                        {rotatingId === tr.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <RefreshCw size={11} />
                        )}
                        {rotatingId === tr.id ? t.rotating : t.rotate}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(tr.id)}
                        title={t.delete}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase text-slate-500">{t.url}</div>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 truncate font-mono text-[10px] text-slate-200">
                        {tr.url}
                      </code>
                      <button
                        type="button"
                        onClick={() => copy(tr.id, tr.url)}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedId === tr.id ? <Check size={10} /> : <Copy size={10} />}
                      </button>
                    </div>
                  </div>
                  {revealedSecret && (
                    <div>
                      <div className="text-[9px] uppercase text-amber-400">{t.secret}</div>
                      <div className="flex items-center gap-1">
                        <code className="flex-1 truncate font-mono text-[10px] text-amber-200">
                          {revealedSecret}
                        </code>
                        <button
                          type="button"
                          onClick={() => copy(`s-${tr.id}`, revealedSecret)}
                          className="text-slate-400 hover:text-white"
                        >
                          {copiedId === `s-${tr.id}` ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="text-[9px] text-slate-500">
                    {t.triggered}: {tr.triggerCount} (
                    {tr.lastTriggeredAt ? new Date(tr.lastTriggeredAt).toLocaleString() : t.never})
                  </div>
                  <WebhookReceiptsPanel lang={lang} webhookId={tr.id} />
                </li>
              );
            })}
          </ul>

          <div>
            <div className="mb-1 text-[10px] uppercase text-slate-500">{t.addLabel}</div>
            <div className="grid grid-cols-2 gap-1">
              {SOURCES.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => create(s.key)}
                  disabled={creating}
                  className="flex items-center justify-center gap-1 rounded border border-slate-700 bg-black/20 px-2 py-1.5 text-[11px] text-slate-200 hover:border-slate-500 disabled:opacity-50"
                >
                  <Plus size={10} />
                  {s.label[lang]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {wizardFor && (
        <WebhookSetupWizardModal
          open
          onClose={() => setWizardFor(null)}
          lang={lang}
          source={
            (['sentry', 'datadog', 'github', 'custom'] as const).includes(
              wizardFor.source as 'sentry' | 'datadog' | 'github' | 'custom'
            )
              ? (wizardFor.source as 'sentry' | 'datadog' | 'github' | 'custom')
              : 'custom'
          }
          url={wizardFor.url}
          secret={revealedSecrets[wizardFor.id] ?? wizardFor.secret}
        />
      )}
    </div>
  );
}
