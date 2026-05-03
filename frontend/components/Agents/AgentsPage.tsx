'use client';

import { AlertCircle, Bot, CheckCircle2, PlayCircle, Plus, Power, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatDateTime } from '@/lib/datetime';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type MatcherType = 'jsonpath' | 'llm' | 'always';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  source: string;
  webhookId: string | null;
  matcherType: MatcherType;
  matcherConfig: Record<string, unknown>;
  targetRunbookId: string;
  varMapping: Record<string, string>;
  isEnabled: boolean;
  rateLimitPerHour: number;
  triggerCount: number;
  matchCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  targetRunbook: { id: string; slug: string | null; name: string };
  webhook: { id: string; source: string; token: string } | null;
  _count?: { executions: number };
}

interface Runbook {
  id: string;
  slug: string | null;
  name: string;
}

interface Webhook {
  id: string;
  source: string;
  url?: string;
}

interface Execution {
  id: string;
  matched: boolean;
  reason: string | null;
  triggeredRunId: string | null;
  payload: unknown;
  createdAt: string;
}

const STRINGS = {
  en: {
    title: 'Agents',
    subtitle:
      'Declarative listeners that turn webhook events into runbook triggers. Each agent watches one webhook source, evaluates a matcher, and fires a runbook on hit.',
    newAgent: 'New agent',
    empty: 'No agents yet.',
    emptyHint: 'Create one to react to Sentry alerts, GitHub events, or any webhook payload.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    runs: 'triggers',
    lastFired: 'Last fired',
    never: 'never',
    edit: 'Edit',
    delete: 'Delete',
    details: 'Recent executions',
    noExecutions: 'No executions yet.',
    confirmDelete: 'Delete this agent? Its execution history will also be removed.',
    formName: 'Name',
    formDescription: 'Description',
    formSource: 'Source',
    formWebhook: 'Webhook',
    formMatcher: 'Matcher',
    formMatcherJsonPath: 'JSONPath rules',
    formMatcherAlways: 'Always match',
    formMatcherLlm: 'LLM rule (test only)',
    formMatcherRulesHelp:
      'JSON of { rules: [{ path, equals?, contains? }] }. Empty rules → always match.',
    formMatcherLlmHelp: 'Free-form description of when to match.',
    formTarget: 'Target runbook',
    formVarMapping: 'Variable mapping',
    formVarMappingHelp:
      'JSON map { variableName: "$.json.path" }. Resolved against the payload at trigger time.',
    formRateLimit: 'Rate limit (per hour)',
    formEnabled: 'Enable agent',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading…',
    loadError: 'Failed to load agents.',
  },
  es: {
    title: 'Agentes',
    subtitle:
      'Listeners declarativos que convierten eventos de webhooks en disparos de runbooks. Cada agente vigila una fuente, evalúa un matcher y dispara un runbook si coincide.',
    newAgent: 'Nuevo agente',
    empty: 'Aún no hay agentes.',
    emptyHint:
      'Creá uno para reaccionar a alertas de Sentry, eventos de GitHub o cualquier payload de webhook.',
    enabled: 'Activo',
    disabled: 'Inactivo',
    runs: 'disparos',
    lastFired: 'Último disparo',
    never: 'nunca',
    edit: 'Editar',
    delete: 'Borrar',
    details: 'Ejecuciones recientes',
    noExecutions: 'Aún no hay ejecuciones.',
    confirmDelete: '¿Borrar este agente? Su historial también se eliminará.',
    formName: 'Nombre',
    formDescription: 'Descripción',
    formSource: 'Fuente',
    formWebhook: 'Webhook',
    formMatcher: 'Matcher',
    formMatcherJsonPath: 'Reglas JSONPath',
    formMatcherAlways: 'Siempre coincide',
    formMatcherLlm: 'Regla LLM (solo test)',
    formMatcherRulesHelp:
      'JSON con { rules: [{ path, equals?, contains? }] }. Reglas vacías → siempre.',
    formMatcherLlmHelp: 'Descripción libre de cuándo debe coincidir.',
    formTarget: 'Runbook destino',
    formVarMapping: 'Mapeo de variables',
    formVarMappingHelp:
      'Mapa JSON { variable: "$.json.path" }. Se resuelve sobre el payload al disparar.',
    formRateLimit: 'Rate limit (por hora)',
    formEnabled: 'Activar agente',
    save: 'Guardar',
    cancel: 'Cancelar',
    loading: 'Cargando…',
    loadError: 'Error cargando agentes.',
  },
} as const;

interface AgentsPageProps {
  lang: 'en' | 'es';
}

export default function AgentsPage({ lang }: AgentsPageProps) {
  const t = STRINGS[lang];
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Record<string, Execution[]>>({});

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/event-agents`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAgents(json.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    }
  }, []);

  const fetchRunbooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/runbooks`);
      if (res.ok) {
        const json = await res.json();
        // The legacy /api/runbooks shape returns an array directly
        // in some setups and { data: [...] } in others. Be defensive.
        setRunbooks(Array.isArray(json) ? json : (json.data ?? []));
      }
    } catch {
      // Non-fatal — the form will just show an empty dropdown.
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/webhooks`);
      if (res.ok) {
        const json = await res.json();
        setWebhooks(Array.isArray(json) ? json : (json.data ?? []));
      }
    } catch {
      // Non-fatal.
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchRunbooks();
    fetchWebhooks();
  }, [fetchAgents, fetchRunbooks, fetchWebhooks]);

  const loadExecutions = async (agentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/event-agents/${agentId}/executions`);
      if (res.ok) {
        const json = await res.json();
        setExecutions(prev => ({ ...prev, [agentId]: json.data }));
      }
    } catch {
      /* noop */
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!executions[id]) loadExecutions(id);
    }
  };

  const handleToggleEnabled = async (agent: Agent) => {
    await fetch(`${API_BASE}/api/event-agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !agent.isEnabled }),
    });
    fetchAgents();
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(t.confirmDelete)) return;
    await fetch(`${API_BASE}/api/event-agents/${agent.id}`, { method: 'DELETE' });
    fetchAgents();
  };

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (agent: Agent) => {
    setEditing(agent);
    setShowForm(true);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <Bot size={22} className="text-primary/70" />
              {t.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{t.subtitle}</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-primary hover:bg-primary flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white transition-colors"
          >
            <Plus size={16} />
            {t.newAgent}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {t.loadError} · {error}
          </div>
        )}

        {agents === null ? (
          <div className="text-sm text-gray-500">{t.loading}</div>
        ) : agents.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-6 py-12 text-center">
            <Bot size={32} className="mx-auto mb-3 text-gray-600" />
            <div className="mb-1 text-sm text-gray-400">{t.empty}</div>
            <div className="text-xs text-gray-600">{t.emptyHint}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map(a => (
              <AgentCard
                key={a.id}
                agent={a}
                expanded={expandedId === a.id}
                executions={executions[a.id] ?? null}
                t={t}
                lang={lang}
                onToggleExpand={() => toggleExpand(a.id)}
                onToggleEnabled={() => handleToggleEnabled(a)}
                onEdit={() => openEdit(a)}
                onDelete={() => handleDelete(a)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AgentForm
          initial={editing}
          runbooks={runbooks}
          webhooks={webhooks}
          t={t}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchAgents();
          }}
        />
      )}
    </div>
  );
}

function AgentCard({
  agent,
  expanded,
  executions,
  t,
  lang,
  onToggleExpand,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  agent: Agent;
  expanded: boolean;
  executions: Execution[] | null;
  t: (typeof STRINGS)[keyof typeof STRINGS];
  lang: 'en' | 'es';
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-[#1a1f2a]">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggleEnabled}
          className={`h-2 w-2 flex-shrink-0 rounded-full ${
            agent.isEnabled ? 'bg-emerald-500' : 'bg-gray-600'
          }`}
          title={agent.isEnabled ? t.enabled : t.disabled}
        />
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2 truncate text-sm font-medium text-white">
            {agent.name}
            <span className="bg-primary/10 text-primary/40 border-primary/20 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
              {agent.source}
            </span>
          </div>
          {agent.description && (
            <div className="mt-0.5 truncate text-xs text-gray-500">{agent.description}</div>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <PlayCircle size={11} />
              {agent.targetRunbook.name}
            </span>
            <span>·</span>
            <span>
              {agent.triggerCount} {t.runs}
            </span>
            <span>·</span>
            <span>
              {t.lastFired}:{' '}
              {agent.lastTriggeredAt ? formatDateTime(agent.lastTriggeredAt, lang) : t.never}
            </span>
          </div>
        </div>
        <button
          onClick={onToggleEnabled}
          className="rounded p-1.5 text-gray-500 hover:bg-white/5 hover:text-white"
          title={agent.isEnabled ? t.disabled : t.enabled}
        >
          <Power size={14} />
        </button>
        <button
          onClick={onEdit}
          className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
        >
          {t.edit}
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
          title={t.delete}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-white/5 bg-black/20 px-4 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">{t.details}</div>
          {executions === null ? (
            <div className="text-xs text-gray-600">{t.loading}</div>
          ) : executions.length === 0 ? (
            <div className="text-xs text-gray-600">{t.noExecutions}</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {executions.slice(0, 10).map(ex => (
                <li
                  key={ex.id}
                  className="flex items-center gap-2 border-b border-white/5 py-1 last:border-0"
                >
                  {ex.matched ? (
                    <CheckCircle2 size={12} className="flex-shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle size={12} className="flex-shrink-0 text-gray-500" />
                  )}
                  <span className="flex-shrink-0 text-gray-500">
                    {new Date(ex.createdAt).toLocaleTimeString()}
                  </span>
                  <span className="flex-1 truncate text-gray-400">{ex.reason ?? '—'}</span>
                  {ex.triggeredRunId && (
                    <span className="text-primary/70 text-[10px]">
                      run {ex.triggeredRunId.slice(0, 8)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AgentForm({
  initial,
  runbooks,
  webhooks,
  t,
  onClose,
  onSaved,
}: {
  initial: Agent | null;
  runbooks: Runbook[];
  webhooks: Webhook[];
  t: (typeof STRINGS)[keyof typeof STRINGS];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [source, setSource] = useState(initial?.source ?? 'sentry');
  const [webhookId, setWebhookId] = useState<string>(initial?.webhookId ?? '');
  const [matcherType, setMatcherType] = useState<MatcherType>(initial?.matcherType ?? 'jsonpath');
  const [matcherConfigText, setMatcherConfigText] = useState(
    JSON.stringify(initial?.matcherConfig ?? { rules: [] }, null, 2)
  );
  const [targetRunbookId, setTargetRunbookId] = useState(initial?.targetRunbookId ?? '');
  const [varMappingText, setVarMappingText] = useState(
    JSON.stringify(initial?.varMapping ?? {}, null, 2)
  );
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true);
  const [rateLimit, setRateLimit] = useState(initial?.rateLimitPerHour ?? 10);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const compatibleWebhooks = useMemo(
    () => webhooks.filter(w => w.source === source || source === 'custom'),
    [webhooks, source]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const matcherConfig = JSON.parse(matcherConfigText || '{}');
      const varMapping = JSON.parse(varMappingText || '{}');
      const body = {
        name,
        description: description || undefined,
        source,
        webhookId: webhookId || null,
        matcherType,
        matcherConfig,
        targetRunbookId,
        varMapping,
        isEnabled,
        rateLimitPerHour: rateLimit,
      };
      const url = initial
        ? `${API_BASE}/api/event-agents/${initial.id}`
        : `${API_BASE}/api/event-agents`;
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-[#1a1f2a] shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#1a1f2a] px-5 py-3">
          <h2 className="text-sm font-semibold text-white">
            {initial ? `${t.edit} agent` : t.newAgent}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4 text-sm">
          <Field label={t.formName}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              maxLength={120}
              className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none"
            />
          </Field>
          <Field label={t.formDescription}>
            <input
              value={description ?? ''}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.formSource}>
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none"
              >
                <option value="sentry">sentry</option>
                <option value="datadog">datadog</option>
                <option value="github">github</option>
                <option value="custom">custom</option>
              </select>
            </Field>
            <Field label={t.formWebhook}>
              <select
                value={webhookId}
                onChange={e => setWebhookId(e.target.value)}
                className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none"
              >
                <option value="">— none —</option>
                {compatibleWebhooks.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.source} · {w.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t.formMatcher}>
            <div className="mb-2 flex gap-2">
              {(['jsonpath', 'always', 'llm'] as MatcherType[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMatcherType(m)}
                  className={`rounded border px-3 py-1 text-xs transition-colors ${
                    matcherType === m
                      ? 'border-primary bg-primary/20 text-primary/40'
                      : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {m === 'jsonpath'
                    ? t.formMatcherJsonPath
                    : m === 'always'
                      ? t.formMatcherAlways
                      : t.formMatcherLlm}
                </button>
              ))}
            </div>
            {matcherType !== 'always' && (
              <textarea
                value={matcherConfigText}
                onChange={e => setMatcherConfigText(e.target.value)}
                rows={6}
                className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 font-mono text-xs text-gray-200 focus:outline-none"
              />
            )}
            <div className="mt-1 text-[11px] text-gray-600">
              {matcherType === 'llm' ? t.formMatcherLlmHelp : t.formMatcherRulesHelp}
            </div>
          </Field>
          <Field label={t.formTarget}>
            <select
              value={targetRunbookId}
              onChange={e => setTargetRunbookId(e.target.value)}
              required
              className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none"
            >
              <option value="">— select —</option>
              {runbooks.map(rb => (
                <option key={rb.id} value={rb.id}>
                  {rb.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.formVarMapping}>
            <textarea
              value={varMappingText}
              onChange={e => setVarMappingText(e.target.value)}
              rows={4}
              className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 font-mono text-xs text-gray-200 focus:outline-none"
            />
            <div className="mt-1 text-[11px] text-gray-600">{t.formVarMappingHelp}</div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.formRateLimit}>
              <input
                type="number"
                min={1}
                max={1000}
                value={rateLimit}
                onChange={e => setRateLimit(parseInt(e.target.value, 10))}
                className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none"
              />
            </Field>
            <Field label={t.formEnabled}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={e => setIsEnabled(e.target.checked)}
                />
                <span className="text-xs text-gray-300">{isEnabled ? t.enabled : t.disabled}</span>
              </label>
            </Field>
          </div>
          {submitError && (
            <div className="rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {submitError}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary rounded px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? '…' : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
