'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Bot,
    Plus,
    Trash2,
    Power,
    Webhook as WebhookIcon,
    PlayCircle,
    AlertCircle,
    CheckCircle2,
    X,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type MatcherType = 'jsonpath' | 'llm' | 'always';

interface Agent {
    id: string;
    name: string;
    description: string | null;
    source: string;
    webhookId: string | null;
    matcherType: MatcherType;
    matcherConfig: any;
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
        emptyHint:
            'Create one to react to Sentry alerts, GitHub events, or any webhook payload.',
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
                setRunbooks(Array.isArray(json) ? json : json.data ?? []);
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
                setWebhooks(Array.isArray(json) ? json : json.data ?? []);
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
                setExecutions((prev) => ({ ...prev, [agentId]: json.data }));
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
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <Bot size={22} className="text-purple-400" />
                            {t.title}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t.subtitle}</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors"
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
                        <Bot size={32} className="mx-auto text-gray-600 mb-3" />
                        <div className="text-sm text-gray-400 mb-1">{t.empty}</div>
                        <div className="text-xs text-gray-600">{t.emptyHint}</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {agents.map((a) => (
                            <AgentCard
                                key={a.id}
                                agent={a}
                                expanded={expandedId === a.id}
                                executions={executions[a.id] ?? null}
                                t={t}
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
    onToggleExpand,
    onToggleEnabled,
    onEdit,
    onDelete,
}: {
    agent: Agent;
    expanded: boolean;
    executions: Execution[] | null;
    t: (typeof STRINGS)[keyof typeof STRINGS];
    onToggleExpand: () => void;
    onToggleEnabled: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="rounded-md border border-white/10 bg-[#1a1f2a] overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onToggleEnabled}
                    className={`flex-shrink-0 w-2 h-2 rounded-full ${
                        agent.isEnabled ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                    title={agent.isEnabled ? t.enabled : t.disabled}
                />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
                    <div className="flex items-center gap-2 text-sm font-medium text-white truncate">
                        {agent.name}
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {agent.source}
                        </span>
                    </div>
                    {agent.description && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                            {agent.description}
                        </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
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
                            {agent.lastTriggeredAt
                                ? new Date(agent.lastTriggeredAt).toLocaleString()
                                : t.never}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onToggleEnabled}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded"
                    title={agent.isEnabled ? t.disabled : t.enabled}
                >
                    <Power size={14} />
                </button>
                <button
                    onClick={onEdit}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded"
                >
                    {t.edit}
                </button>
                <button
                    onClick={onDelete}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                    title={t.delete}
                >
                    <Trash2 size={14} />
                </button>
            </div>
            {expanded && (
                <div className="px-4 py-3 border-t border-white/5 bg-black/20">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
                        {t.details}
                    </div>
                    {executions === null ? (
                        <div className="text-xs text-gray-600">{t.loading}</div>
                    ) : executions.length === 0 ? (
                        <div className="text-xs text-gray-600">{t.noExecutions}</div>
                    ) : (
                        <ul className="space-y-1 text-xs">
                            {executions.slice(0, 10).map((ex) => (
                                <li
                                    key={ex.id}
                                    className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0"
                                >
                                    {ex.matched ? (
                                        <CheckCircle2
                                            size={12}
                                            className="text-emerald-400 flex-shrink-0"
                                        />
                                    ) : (
                                        <AlertCircle
                                            size={12}
                                            className="text-gray-500 flex-shrink-0"
                                        />
                                    )}
                                    <span className="text-gray-500 flex-shrink-0">
                                        {new Date(ex.createdAt).toLocaleTimeString()}
                                    </span>
                                    <span className="text-gray-400 truncate flex-1">
                                        {ex.reason ?? '—'}
                                    </span>
                                    {ex.triggeredRunId && (
                                        <span className="text-blue-400 text-[10px]">
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
    const [matcherType, setMatcherType] = useState<MatcherType>(
        initial?.matcherType ?? 'jsonpath',
    );
    const [matcherConfigText, setMatcherConfigText] = useState(
        JSON.stringify(initial?.matcherConfig ?? { rules: [] }, null, 2),
    );
    const [targetRunbookId, setTargetRunbookId] = useState(initial?.targetRunbookId ?? '');
    const [varMappingText, setVarMappingText] = useState(
        JSON.stringify(initial?.varMapping ?? {}, null, 2),
    );
    const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true);
    const [rateLimit, setRateLimit] = useState(initial?.rateLimitPerHour ?? 10);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const compatibleWebhooks = useMemo(
        () => webhooks.filter((w) => w.source === source || source === 'custom'),
        [webhooks, source],
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
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-white/10 bg-[#1a1f2a] shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#1a1f2a]">
                    <h2 className="text-sm font-semibold text-white">
                        {initial ? `${t.edit} agent` : t.newAgent}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 text-sm">
                    <Field label={t.formName}>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            maxLength={120}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                    </Field>
                    <Field label={t.formDescription}>
                        <input
                            value={description ?? ''}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={500}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t.formSource}>
                            <select
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                                className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
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
                                onChange={(e) => setWebhookId(e.target.value)}
                                className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
                            >
                                <option value="">— none —</option>
                                {compatibleWebhooks.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.source} · {w.id.slice(0, 8)}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <Field label={t.formMatcher}>
                        <div className="flex gap-2 mb-2">
                            {(['jsonpath', 'always', 'llm'] as MatcherType[]).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMatcherType(m)}
                                    className={`px-3 py-1 rounded text-xs border transition-colors ${
                                        matcherType === m
                                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
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
                                onChange={(e) => setMatcherConfigText(e.target.value)}
                                rows={6}
                                className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 font-mono text-xs focus:border-blue-500 focus:outline-none"
                            />
                        )}
                        <div className="text-[11px] text-gray-600 mt-1">
                            {matcherType === 'llm'
                                ? t.formMatcherLlmHelp
                                : t.formMatcherRulesHelp}
                        </div>
                    </Field>
                    <Field label={t.formTarget}>
                        <select
                            value={targetRunbookId}
                            onChange={(e) => setTargetRunbookId(e.target.value)}
                            required
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">— select —</option>
                            {runbooks.map((rb) => (
                                <option key={rb.id} value={rb.id}>
                                    {rb.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label={t.formVarMapping}>
                        <textarea
                            value={varMappingText}
                            onChange={(e) => setVarMappingText(e.target.value)}
                            rows={4}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 font-mono text-xs focus:border-blue-500 focus:outline-none"
                        />
                        <div className="text-[11px] text-gray-600 mt-1">
                            {t.formVarMappingHelp}
                        </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t.formRateLimit}>
                            <input
                                type="number"
                                min={1}
                                max={1000}
                                value={rateLimit}
                                onChange={(e) => setRateLimit(parseInt(e.target.value, 10))}
                                className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
                            />
                        </Field>
                        <Field label={t.formEnabled}>
                            <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={(e) => setIsEnabled(e.target.checked)}
                                />
                                <span className="text-gray-300 text-xs">
                                    {isEnabled ? t.enabled : t.disabled}
                                </span>
                            </label>
                        </Field>
                    </div>
                    {submitError && (
                        <div className="rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                            {submitError}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white text-sm rounded"
                        >
                            {t.cancel}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded"
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
            <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                {label}
            </label>
            {children}
        </div>
    );
}
