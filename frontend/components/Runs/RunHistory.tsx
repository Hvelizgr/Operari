'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Pause, Ban, Loader2 } from 'lucide-react';

type RunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED';

interface Run {
    id: string;
    runbook: { id: string; slug: string | null; name: string };
    status: RunStatus;
    trigger: string | null;
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
    error: string | null;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
    en: {
        title: 'Run history',
        subtitle: 'Recent runbook executions across this tenant.',
        filterAll: 'All',
        filterRunning: 'Running',
        filterSuccess: 'Success',
        filterFailed: 'Failed',
        filterPaused: 'Paused',
        filterCancelled: 'Cancelled',
        empty: 'No runs to show.',
        loading: 'Loading runs...',
        loadMore: 'Load more',
        runbook: 'Runbook',
        trigger: 'Trigger',
        started: 'Started',
        duration: 'Duration',
    },
    es: {
        title: 'Historial de ejecuciones',
        subtitle: 'Ejecuciones recientes de runbooks en este tenant.',
        filterAll: 'Todo',
        filterRunning: 'En curso',
        filterSuccess: 'Éxito',
        filterFailed: 'Fallidas',
        filterPaused: 'Pausadas',
        filterCancelled: 'Canceladas',
        empty: 'No hay ejecuciones para mostrar.',
        loading: 'Cargando ejecuciones...',
        loadMore: 'Cargar más',
        runbook: 'Runbook',
        trigger: 'Disparador',
        started: 'Inicio',
        duration: 'Duración',
    },
};

const FILTERS: Array<{ key: RunStatus | 'all'; labelKey: string }> = [
    { key: 'all', labelKey: 'filterAll' },
    { key: 'RUNNING', labelKey: 'filterRunning' },
    { key: 'SUCCESS', labelKey: 'filterSuccess' },
    { key: 'FAILED', labelKey: 'filterFailed' },
    { key: 'PAUSED', labelKey: 'filterPaused' },
    { key: 'CANCELLED', labelKey: 'filterCancelled' },
];

const STATUS_STYLES: Record<RunStatus, { icon: typeof CheckCircle2; cls: string }> = {
    RUNNING: { icon: Loader2, cls: 'text-sky-400' },
    SUCCESS: { icon: CheckCircle2, cls: 'text-emerald-400' },
    FAILED: { icon: XCircle, cls: 'text-red-400' },
    PAUSED: { icon: Pause, cls: 'text-amber-400' },
    CANCELLED: { icon: Ban, cls: 'text-zinc-500' },
};

function formatDuration(ms: number | null): string {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const rem = Math.round(s % 60);
    return `${m}m ${rem}s`;
}

export default function RunHistory({ lang }: { lang: 'en' | 'es' }) {
    const t = STRINGS[lang] ?? STRINGS.en;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const [filter, setFilter] = useState<RunStatus | 'all'>('all');
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const load = useCallback(
        async (mode: 'replace' | 'append') => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({ status: filter, limit: '50' });
                if (mode === 'append' && nextCursor) params.set('cursor', nextCursor);
                const res = await fetch(`${apiBase}/api/runs?${params}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setRuns((prev) => (mode === 'append' ? [...prev, ...json.data] : json.data));
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
        setRuns([]);
        setNextCursor(null);
        load('replace');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <header className="mb-8">
                <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
                <p className="mt-1 text-sm text-zinc-400">{t.subtitle}</p>
            </header>

            <div className="mb-6 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
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

            {loading && runs.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loading}
                </div>
            )}

            {!loading && runs.length === 0 && (
                <div className="rounded border border-zinc-800 bg-zinc-950 px-6 py-12 text-center text-sm text-zinc-500">
                    {t.empty}
                </div>
            )}

            {runs.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
                            <tr>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">{t.runbook}</th>
                                <th className="px-4 py-3">{t.trigger}</th>
                                <th className="px-4 py-3">{t.started}</th>
                                <th className="px-4 py-3">{t.duration}</th>
                                <th className="px-4 py-3">ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 bg-black">
                            {runs.map((r) => {
                                const meta = STATUS_STYLES[r.status];
                                const Icon = meta.icon;
                                return (
                                    <tr key={r.id} className="hover:bg-zinc-950">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Icon
                                                    className={`h-4 w-4 ${meta.cls} ${
                                                        r.status === 'RUNNING' ? 'animate-spin' : ''
                                                    }`}
                                                />
                                                <span className={`text-xs font-semibold ${meta.cls}`}>
                                                    {r.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-200">{r.runbook.name}</td>
                                        <td className="px-4 py-3 text-zinc-400">{r.trigger || '—'}</td>
                                        <td className="px-4 py-3 text-zinc-400">
                                            {new Date(r.startedAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400">
                                            {formatDuration(r.duration)}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                                            {r.id.slice(0, 8)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

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
