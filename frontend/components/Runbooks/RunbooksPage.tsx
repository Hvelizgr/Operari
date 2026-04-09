'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Share2,
    Plus,
    Search,
    PlayCircle,
    Edit3,
    Copy,
    Trash2,
    FileCode,
    History,
    X,
    ChevronDown,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Runbook {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    category: string | null;
    isActive: boolean;
    updatedAt: string;
    _count: { executions: number };
    lastRunAt: string | null;
    lastRunStatus: string | null;
    successRate30d: number | null;
}

interface Template {
    file: string;
    slug: string;
    name: string;
    description: string | null;
    category: string | null;
    stepCount: number;
    yaml: string;
}

const STRINGS = {
    en: {
        title: 'Runbooks',
        subtitle:
            'Versioned graphs of steps that codify your operational procedures. Run them, edit them, schedule them.',
        newRunbook: 'New runbook',
        newBlank: 'Blank',
        newFromTemplate: 'From template',
        newImport: 'Import YAML',
        searchPlaceholder: 'Search by name or description…',
        allCategories: 'All categories',
        empty: 'No runbooks yet.',
        emptyHint: 'Create one from scratch or pick a template.',
        runs: 'runs',
        successRate: 'success',
        lastRun: 'Last run',
        never: 'never',
        run: 'Run',
        edit: 'Edit',
        duplicate: 'Duplicate',
        viewYaml: 'View YAML',
        history: 'History',
        delete: 'Delete',
        confirmDelete: 'Delete this runbook? This cannot be undone.',
        loading: 'Loading…',
        loadError: 'Failed to load runbooks.',
        templatesTitle: 'Pick a template',
        cancel: 'Cancel',
        run_now: 'Run now',
        new_blank_name: 'Untitled runbook',
    },
    es: {
        title: 'Runbooks',
        subtitle:
            'Grafos versionados de pasos que codifican tus procedimientos operativos. Ejecutalos, editalos, programalos.',
        newRunbook: 'Nuevo runbook',
        newBlank: 'Vacío',
        newFromTemplate: 'Desde plantilla',
        newImport: 'Importar YAML',
        searchPlaceholder: 'Buscar por nombre o descripción…',
        allCategories: 'Todas las categorías',
        empty: 'Aún no hay runbooks.',
        emptyHint: 'Creá uno desde cero o elegí una plantilla.',
        runs: 'ejecuciones',
        successRate: 'éxito',
        lastRun: 'Última',
        never: 'nunca',
        run: 'Ejecutar',
        edit: 'Editar',
        duplicate: 'Duplicar',
        viewYaml: 'Ver YAML',
        history: 'Historial',
        delete: 'Borrar',
        confirmDelete: '¿Borrar este runbook? No se puede deshacer.',
        loading: 'Cargando…',
        loadError: 'Error cargando runbooks.',
        templatesTitle: 'Elegí una plantilla',
        cancel: 'Cancelar',
        run_now: 'Ejecutar ahora',
        new_blank_name: 'Runbook sin título',
    },
} as const;

function statusDot(status: string | null): string {
    switch (status) {
        case 'SUCCESS':
            return 'bg-emerald-500';
        case 'FAILED':
            return 'bg-red-500';
        case 'RUNNING':
            return 'bg-blue-500 animate-pulse';
        default:
            return 'bg-gray-600';
    }
}

function relativeTime(iso: string | null, now: Date): string {
    if (!iso) return '—';
    const diff = now.getTime() - new Date(iso).getTime();
    if (diff < 60_000) return `${Math.round(diff / 1000)}s`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
    return `${Math.round(diff / 86_400_000)}d`;
}

interface RunbooksPageProps {
    lang: 'en' | 'es';
}

export default function RunbooksPage({ lang }: RunbooksPageProps) {
    const t = STRINGS[lang];
    const router = useRouter();
    const [runbooks, setRunbooks] = useState<Runbook[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string>('');
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const now = useMemo(() => new Date(), [runbooks]);

    const load = useCallback(async () => {
        try {
            const params = new URLSearchParams({ limit: '100' });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE}/api/runbooks?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setRunbooks(json.workflows ?? []);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'unknown');
        }
    }, [search]);

    useEffect(() => {
        const t = setTimeout(load, 200);
        return () => clearTimeout(t);
    }, [load]);

    const categories = useMemo(() => {
        if (!runbooks) return [];
        const set = new Set<string>();
        for (const r of runbooks) if (r.category) set.add(r.category);
        return Array.from(set).sort();
    }, [runbooks]);

    const filtered = useMemo(() => {
        if (!runbooks) return null;
        if (!category) return runbooks;
        return runbooks.filter((r) => r.category === category);
    }, [runbooks, category]);

    const counts = useMemo(() => {
        if (!runbooks) return { total: 0, active: 0 };
        return {
            total: runbooks.length,
            active: runbooks.filter((r) => r.isActive).length,
        };
    }, [runbooks]);

    const handleCreateBlank = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/runbooks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: t.new_blank_name,
                    nodes: [],
                    connections: [],
                }),
            });
            if (res.ok) {
                const wf = await res.json();
                router.push(`/${lang}/editor?id=${wf.id}`);
            }
        } catch {
            /* noop */
        }
        setShowNewMenu(false);
    };

    const handleCreateFromTemplate = async (tpl: Template) => {
        try {
            // Two-step: create empty runbook, then push the YAML body via
            // PUT /:id/yaml. Avoids re-implementing the YAML parser on
            // the frontend and reuses the same import path the editor uses.
            const created = await fetch(`${API_BASE}/api/runbooks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: tpl.name,
                    description: tpl.description,
                    nodes: [],
                    connections: [],
                }),
            });
            if (!created.ok) return;
            const wf = await created.json();
            await fetch(`${API_BASE}/api/runbooks/${wf.id}/yaml`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yaml: tpl.yaml }),
            });
            router.push(`/${lang}/editor?id=${wf.id}`);
        } catch {
            /* noop */
        }
    };

    const handleDuplicate = async (rb: Runbook) => {
        await fetch(`${API_BASE}/api/runbooks/${rb.id}/duplicate`, { method: 'POST' });
        load();
    };

    const handleDelete = async (rb: Runbook) => {
        if (!confirm(t.confirmDelete)) return;
        await fetch(`${API_BASE}/api/runbooks/${rb.id}`, { method: 'DELETE' });
        load();
    };

    const handleRunNow = async (rb: Runbook) => {
        if (!rb.slug) {
            alert('Runbook needs a slug to trigger via API. Edit it and add one.');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/v1/runbooks/${rb.slug}/trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (res.ok) {
                const json = await res.json();
                router.push(`/${lang}/runs/${json.id}`);
            }
        } catch {
            /* noop */
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <Share2 size={22} className="text-emerald-400" />
                            {t.title}
                            <span className="text-xs font-normal text-gray-500 ml-2">
                                {counts.total} total · {counts.active} active
                            </span>
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t.subtitle}</p>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowNewMenu(!showNewMenu)}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md"
                        >
                            <Plus size={16} />
                            {t.newRunbook}
                            <ChevronDown size={14} />
                        </button>
                        {showNewMenu && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1f2a] border border-white/10 rounded-md shadow-xl py-1 z-10">
                                <button
                                    onClick={handleCreateBlank}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                                >
                                    {t.newBlank}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowNewMenu(false);
                                        setShowTemplates(true);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                                >
                                    {t.newFromTemplate}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 relative">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="w-full pl-9 pr-3 py-2 bg-[#1a1f2a] border border-white/10 rounded-md text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="px-3 py-2 bg-[#1a1f2a] border border-white/10 rounded-md text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">{t.allCategories}</option>
                        {categories.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                        {t.loadError} · {error}
                    </div>
                )}

                {filtered === null ? (
                    <div className="text-sm text-gray-500">{t.loading}</div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-6 py-12 text-center">
                        <Share2 size={32} className="mx-auto text-gray-600 mb-3" />
                        <div className="text-sm text-gray-400 mb-1">{t.empty}</div>
                        <div className="text-xs text-gray-600">{t.emptyHint}</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((rb) => (
                            <RunbookCard
                                key={rb.id}
                                rb={rb}
                                t={t}
                                lang={lang}
                                now={now}
                                onRunNow={() => handleRunNow(rb)}
                                onDuplicate={() => handleDuplicate(rb)}
                                onDelete={() => handleDelete(rb)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showTemplates && (
                <TemplatePicker
                    t={t}
                    onClose={() => setShowTemplates(false)}
                    onSelect={(tpl) => {
                        setShowTemplates(false);
                        handleCreateFromTemplate(tpl);
                    }}
                />
            )}
        </div>
    );
}

function RunbookCard({
    rb,
    t,
    lang,
    now,
    onRunNow,
    onDuplicate,
    onDelete,
}: {
    rb: Runbook;
    t: (typeof STRINGS)[keyof typeof STRINGS];
    lang: 'en' | 'es';
    now: Date;
    onRunNow: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    const successRate =
        rb.successRate30d != null ? `${(rb.successRate30d * 100).toFixed(0)}%` : '—';
    return (
        <div className="rounded-md border border-white/10 bg-[#1a1f2a] p-4 hover:border-white/20 transition-colors flex flex-col">
            <div className="flex items-start gap-2 mb-2">
                <span
                    className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        rb.isActive ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{rb.name}</div>
                    {rb.category && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {rb.category}
                        </span>
                    )}
                </div>
            </div>
            {rb.description && (
                <p className="text-xs text-gray-500 line-clamp-2 mb-3 min-h-[2.5em]">
                    {rb.description}
                </p>
            )}
            <div className="flex items-center gap-4 text-[11px] text-gray-500 mb-3">
                <span>
                    {rb._count.executions} {t.runs}
                </span>
                <span>
                    {successRate} {t.successRate}
                </span>
                <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(rb.lastRunStatus)}`} />
                    {rb.lastRunAt ? relativeTime(rb.lastRunAt, now) : t.never}
                </span>
            </div>
            <div className="flex items-center gap-1 mt-auto">
                <button
                    onClick={onRunNow}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
                    title={t.run_now}
                >
                    <PlayCircle size={13} />
                    {t.run}
                </button>
                <a
                    href={`/${lang}/editor?id=${rb.id}`}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                >
                    <Edit3 size={13} />
                    {t.edit}
                </a>
                <a
                    href={`/${lang}/runs?runbook=${rb.id}`}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                    title={t.history}
                >
                    <History size={13} />
                </a>
                <button
                    onClick={onDuplicate}
                    className="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded ml-auto"
                    title={t.duplicate}
                >
                    <Copy size={13} />
                </button>
                <button
                    onClick={onDelete}
                    className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                    title={t.delete}
                >
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
}

function TemplatePicker({
    t,
    onClose,
    onSelect,
}: {
    t: (typeof STRINGS)[keyof typeof STRINGS];
    onClose: () => void;
    onSelect: (tpl: Template) => void;
}) {
    const [templates, setTemplates] = useState<Template[] | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/templates`)
            .then((r) => r.json())
            .then((j) => setTemplates(j.data ?? []))
            .catch(() => setTemplates([]));
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-lg border border-white/10 bg-[#1a1f2a] shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#1a1f2a]">
                    <h2 className="text-sm font-semibold text-white">{t.templatesTitle}</h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-5">
                    {templates === null ? (
                        <div className="text-sm text-gray-500">{t.loading}</div>
                    ) : templates.length === 0 ? (
                        <div className="text-sm text-gray-500">No templates found.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {templates.map((tpl) => (
                                <button
                                    key={tpl.file}
                                    onClick={() => onSelect(tpl)}
                                    className="text-left rounded-md border border-white/10 hover:border-blue-500 hover:bg-blue-500/5 p-3 transition-colors"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileCode size={14} className="text-blue-400" />
                                        <span className="text-sm font-medium text-white truncate">
                                            {tpl.name}
                                        </span>
                                    </div>
                                    {tpl.category && (
                                        <span className="inline-block mb-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                            {tpl.category}
                                        </span>
                                    )}
                                    {tpl.description && (
                                        <p className="text-xs text-gray-500 line-clamp-2">
                                            {tpl.description}
                                        </p>
                                    )}
                                    <div className="text-[10px] text-gray-600 mt-2">
                                        {tpl.stepCount} steps
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
