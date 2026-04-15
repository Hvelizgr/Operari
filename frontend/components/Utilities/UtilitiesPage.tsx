'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wrench, Key, Webhook as WebhookIcon, Link2, Trash2, Plus, Copy, X } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Tab = 'keys' | 'webhooks' | 'accounts';

interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    lastUsedAt: string | null;
    createdAt: string;
}

interface Webhook {
    id: string;
    source: string;
    url?: string;
    secret?: string | null;
    isActive: boolean;
    triggerCount: number;
    lastTriggeredAt: string | null;
    workflowId?: string;
}

interface ConnectedAccount {
    id: string;
    provider: string;
    displayName: string | null;
    scopes: string[];
    createdAt: string;
}

interface Runbook {
    id: string;
    slug: string | null;
    name: string;
}

const STRINGS = {
    en: {
        title: 'Utilities',
        subtitle:
            'API keys, webhooks, and connected accounts. The plumbing that lets the rest of your stack call NanoRun and lets NanoRun reach out to your services.',
        tabKeys: 'API keys',
        tabWebhooks: 'Webhooks',
        tabAccounts: 'Connected accounts',
        new: 'New',
        empty: 'Nothing here yet.',
        loading: 'Loading…',
        delete: 'Delete',
        copy: 'Copy',
        copied: 'Copied!',
        confirmDelete: 'Delete this entry?',
        keyName: 'Name',
        keyScopes: 'Scopes',
        keyShownOnce: 'This key is shown once. Save it now.',
        webhookSource: 'Source',
        webhookRunbook: 'Runbook',
        webhookSecret: 'HMAC secret (optional)',
        webhookUrl: 'URL',
        save: 'Save',
        cancel: 'Cancel',
        active: 'Active',
        triggers: 'triggers',
    },
    es: {
        title: 'Utilidades',
        subtitle:
            'API keys, webhooks y cuentas conectadas. La plomería que deja al resto de tu stack llamar a NanoRun y a NanoRun llegar a tus servicios.',
        tabKeys: 'API keys',
        tabWebhooks: 'Webhooks',
        tabAccounts: 'Cuentas conectadas',
        new: 'Nuevo',
        empty: 'Aún no hay nada acá.',
        loading: 'Cargando…',
        delete: 'Borrar',
        copy: 'Copiar',
        copied: '¡Copiado!',
        confirmDelete: '¿Borrar esta entrada?',
        keyName: 'Nombre',
        keyScopes: 'Scopes',
        keyShownOnce: 'Esta key se muestra una sola vez. Guardala ahora.',
        webhookSource: 'Fuente',
        webhookRunbook: 'Runbook',
        webhookSecret: 'HMAC secret (opcional)',
        webhookUrl: 'URL',
        save: 'Guardar',
        cancel: 'Cancelar',
        active: 'Activo',
        triggers: 'disparos',
    },
} as const;

interface UtilitiesPageProps {
    lang: 'en' | 'es';
}

export default function UtilitiesPage({ lang }: UtilitiesPageProps) {
    const t = STRINGS[lang];
    const [tab, setTab] = useState<Tab>('keys');

    return (
        <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                        <Wrench size={22} className="text-cyan-400" />
                        {t.title}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t.subtitle}</p>
                </div>

                <div className="border-b border-white/10 mb-5 flex">
                    <TabButton
                        active={tab === 'keys'}
                        onClick={() => setTab('keys')}
                        icon={<Key size={14} />}
                        label={t.tabKeys}
                    />
                    <TabButton
                        active={tab === 'webhooks'}
                        onClick={() => setTab('webhooks')}
                        icon={<WebhookIcon size={14} />}
                        label={t.tabWebhooks}
                    />
                    <TabButton
                        active={tab === 'accounts'}
                        onClick={() => setTab('accounts')}
                        icon={<Link2 size={14} />}
                        label={t.tabAccounts}
                    />
                </div>

                {tab === 'keys' && <KeysTab t={t} />}
                {tab === 'webhooks' && <WebhooksTab t={t} />}
                {tab === 'accounts' && <AccountsTab t={t} />}
            </div>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                active
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

// ─── API Keys ──────────────────────────────────────────────

function KeysTab({ t }: { t: (typeof STRINGS)[keyof typeof STRINGS] }) {
    const [keys, setKeys] = useState<ApiKey[] | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch(`${API_BASE}/api/v1/keys`);
        if (res.ok) {
            const j = await res.json();
            setKeys(j.data ?? []);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async (name: string) => {
        const res = await fetch(`${API_BASE}/api/v1/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (res.ok) {
            const j = await res.json();
            setCreatedKey(j.key);
            setShowForm(false);
            load();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t.confirmDelete)) return;
        await fetch(`${API_BASE}/api/v1/keys/${id}`, { method: 'DELETE' });
        load();
    };

    return (
        <div>
            <div className="flex justify-end mb-3">
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md"
                >
                    <Plus size={14} />
                    {t.new}
                </button>
            </div>
            {createdKey && (
                <div className="mb-4 rounded-md border border-amber-900/50 bg-amber-950/30 p-4">
                    <div className="text-xs text-amber-300 mb-2">{t.keyShownOnce}</div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-black/50 rounded text-xs text-amber-100 font-mono break-all">
                            {createdKey}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(createdKey);
                            }}
                            className="p-2 text-amber-300 hover:bg-white/5 rounded"
                            title={t.copy}
                        >
                            <Copy size={14} />
                        </button>
                        <button
                            onClick={() => setCreatedKey(null)}
                            className="p-2 text-amber-300 hover:bg-white/5 rounded"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
            {keys === null ? (
                <div className="text-sm text-gray-500">{t.loading}</div>
            ) : keys.length === 0 ? (
                <EmptyBlock label={t.empty} />
            ) : (
                <div className="rounded-md border border-white/10 bg-[#1a1f2a] overflow-hidden">
                    {keys.map((k) => (
                        <div
                            key={k.id}
                            className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0"
                        >
                            <Key size={14} className="text-gray-500" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{k.name}</div>
                                <div className="text-[10px] text-gray-500 font-mono">
                                    {k.prefix}…
                                </div>
                                <div className="text-[10px] text-gray-600 mt-0.5">
                                    {k.scopes.join(' · ')}
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(k.id)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                                title={t.delete}
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {showForm && (
                <SimpleNameForm
                    title={t.tabKeys}
                    label={t.keyName}
                    onClose={() => setShowForm(false)}
                    onSubmit={handleCreate}
                    t={t}
                />
            )}
        </div>
    );
}

// ─── Webhooks ─────────────────────────────────────────────

function WebhooksTab({ t }: { t: (typeof STRINGS)[keyof typeof STRINGS] }) {
    const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
    const [runbooks, setRunbooks] = useState<Runbook[]>([]);
    const [showForm, setShowForm] = useState(false);

    const load = useCallback(async () => {
        const res = await fetch(`${API_BASE}/api/webhooks`);
        if (res.ok) {
            const j = await res.json();
            setWebhooks(Array.isArray(j) ? j : j.data ?? []);
        }
    }, []);

    useEffect(() => {
        load();
        fetch(`${API_BASE}/api/runbooks?limit=100`)
            .then((r) => r.json())
            .then((j) => setRunbooks(j.workflows ?? []))
            .catch(() => {});
    }, [load]);

    const handleCreate = async (body: any) => {
        const res = await fetch(`${API_BASE}/api/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (res.ok) {
            setShowForm(false);
            load();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t.confirmDelete)) return;
        await fetch(`${API_BASE}/api/webhooks/${id}`, { method: 'DELETE' });
        load();
    };

    return (
        <div>
            <div className="flex justify-end mb-3">
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md"
                >
                    <Plus size={14} />
                    {t.new}
                </button>
            </div>
            {webhooks === null ? (
                <div className="text-sm text-gray-500">{t.loading}</div>
            ) : webhooks.length === 0 ? (
                <EmptyBlock label={t.empty} />
            ) : (
                <div className="rounded-md border border-white/10 bg-[#1a1f2a] overflow-hidden">
                    {webhooks.map((w) => (
                        <div
                            key={w.id}
                            className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0"
                        >
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    w.isActive ? 'bg-emerald-500' : 'bg-gray-600'
                                }`}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white">
                                    {w.source}
                                    <span className="ml-2 text-[10px] text-gray-500">
                                        {w.triggerCount} {t.triggers}
                                    </span>
                                </div>
                                {w.url && (
                                    <code className="text-[10px] text-gray-500 font-mono break-all">
                                        {w.url}
                                    </code>
                                )}
                            </div>
                            <button
                                onClick={() => handleDelete(w.id)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                                title={t.delete}
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {showForm && (
                <WebhookForm
                    runbooks={runbooks}
                    onClose={() => setShowForm(false)}
                    onSubmit={handleCreate}
                    t={t}
                />
            )}
        </div>
    );
}

// ─── Connected Accounts ───────────────────────────────────

function AccountsTab({ t }: { t: (typeof STRINGS)[keyof typeof STRINGS] }) {
    const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/connected-accounts`)
            .then((r) => r.json())
            .then((j) => setAccounts(Array.isArray(j) ? j : j.data ?? []))
            .catch(() => setAccounts([]));
    }, []);

    return (
        <div>
            {accounts === null ? (
                <div className="text-sm text-gray-500">{t.loading}</div>
            ) : accounts.length === 0 ? (
                <EmptyBlock label={t.empty} />
            ) : (
                <div className="rounded-md border border-white/10 bg-[#1a1f2a] overflow-hidden">
                    {accounts.map((a) => (
                        <div
                            key={a.id}
                            className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0"
                        >
                            <Link2 size={14} className="text-gray-500" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white">
                                    {a.displayName ?? a.provider}
                                </div>
                                <div className="text-[10px] text-gray-600">
                                    {a.provider} · {a.scopes?.join(' · ') ?? ''}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function EmptyBlock({ label }: { label: string }) {
    return (
        <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-6 py-12 text-center text-sm text-gray-500">
            {label}
        </div>
    );
}

function SimpleNameForm({
    title,
    label,
    onSubmit,
    onClose,
    t,
}: {
    title: string;
    label: string;
    onSubmit: (name: string) => void;
    onClose: () => void;
    t: (typeof STRINGS)[keyof typeof STRINGS];
}) {
    const [name, setName] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#1a1f2a] p-5">
                <h2 className="text-sm font-semibold text-white mb-4">{title}</h2>
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={label}
                    className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none mb-4"
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white text-sm rounded"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={() => name.trim() && onSubmit(name.trim())}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded"
                    >
                        {t.save}
                    </button>
                </div>
            </div>
        </div>
    );
}

function WebhookForm({
    runbooks,
    onSubmit,
    onClose,
    t,
}: {
    runbooks: Runbook[];
    onSubmit: (body: any) => void;
    onClose: () => void;
    t: (typeof STRINGS)[keyof typeof STRINGS];
}) {
    const [source, setSource] = useState('sentry');
    const [workflowId, setWorkflowId] = useState('');
    const [secret, setSecret] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#1a1f2a] p-5">
                <h2 className="text-sm font-semibold text-white mb-4">{t.tabWebhooks}</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.webhookSource}
                        </label>
                        <select
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="sentry">sentry</option>
                            <option value="datadog">datadog</option>
                            <option value="github">github</option>
                            <option value="custom">custom</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.webhookRunbook}
                        </label>
                        <select
                            value={workflowId}
                            onChange={(e) => setWorkflowId(e.target.value)}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">— select —</option>
                            {runbooks.map((rb) => (
                                <option key={rb.id} value={rb.id}>
                                    {rb.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.webhookSecret}
                        </label>
                        <input
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-sm text-gray-200 font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white text-sm rounded"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={() =>
                            workflowId &&
                            onSubmit({
                                source,
                                workflowId,
                                secret: secret || undefined,
                            })
                        }
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded"
                    >
                        {t.save}
                    </button>
                </div>
            </div>
        </div>
    );
}
