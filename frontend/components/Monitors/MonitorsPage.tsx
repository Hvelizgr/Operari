'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Activity,
    Plus,
    Trash2,
    AlertCircle,
    CheckCircle2,
    HelpCircle,
    X,
    Power,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type CheckType = 'last_success_within' | 'no_run_within' | 'failure_rate_above';
type Status = 'OK' | 'FIRING' | 'UNKNOWN';

interface Monitor {
    id: string;
    name: string;
    description: string | null;
    workflowId: string;
    checkType: CheckType;
    checkConfig: { windowMinutes: number; threshold?: number };
    isEnabled: boolean;
    status: Status;
    lastCheckAt: string | null;
    lastFiredAt: string | null;
    lastReason: string | null;
    workflow: { id: string; slug: string | null; name: string };
    _count?: { events: number };
}

interface Runbook {
    id: string;
    slug: string | null;
    name: string;
}

const STRINGS = {
    en: {
        title: 'Monitors',
        subtitle:
            'Watchdogs over your runbooks. Each monitor evaluates a health check every minute and flips between OK and FIRING.',
        newMonitor: 'New monitor',
        empty: 'No monitors yet.',
        emptyHint: 'Create one to alert when a runbook stops succeeding.',
        active: 'Active',
        paused: 'Paused',
        confirmDelete: 'Delete this monitor? Its event history will be removed.',
        loading: 'Loading…',
        loadError: 'Failed to load monitors.',
        formName: 'Name',
        formDescription: 'Description',
        formRunbook: 'Runbook to watch',
        formCheckType: 'Check',
        formWindow: 'Window (minutes)',
        formThreshold: 'Failure rate threshold (0..1)',
        formEnabled: 'Enable monitor',
        save: 'Save',
        cancel: 'Cancel',
        edit: 'Edit',
        delete: 'Delete',
        statusOk: 'OK',
        statusFiring: 'FIRING',
        statusUnknown: 'UNKNOWN',
        lastChecked: 'Last checked',
        lastFired: 'Last fired',
        never: 'never',
        ago: 'ago',
        checkLastSuccess: 'Last success within',
        checkNoRun: 'No run within',
        checkFailureRate: 'Failure rate above',
    },
    es: {
        title: 'Monitores',
        subtitle:
            'Watchdogs sobre tus runbooks. Cada monitor evalúa un check cada minuto y alterna entre OK y FIRING.',
        newMonitor: 'Nuevo monitor',
        empty: 'Aún no hay monitores.',
        emptyHint: 'Creá uno para alertar cuando un runbook deje de tener éxito.',
        active: 'Activo',
        paused: 'Pausado',
        confirmDelete: '¿Borrar este monitor? Su historial se eliminará.',
        loading: 'Cargando…',
        loadError: 'Error cargando monitores.',
        formName: 'Nombre',
        formDescription: 'Descripción',
        formRunbook: 'Runbook a vigilar',
        formCheckType: 'Check',
        formWindow: 'Ventana (minutos)',
        formThreshold: 'Umbral de tasa de fallos (0..1)',
        formEnabled: 'Activar monitor',
        save: 'Guardar',
        cancel: 'Cancelar',
        edit: 'Editar',
        delete: 'Borrar',
        statusOk: 'OK',
        statusFiring: 'DISPARADO',
        statusUnknown: 'DESCONOCIDO',
        lastChecked: 'Último check',
        lastFired: 'Último disparo',
        never: 'nunca',
        ago: 'hace',
        checkLastSuccess: 'Último éxito dentro de',
        checkNoRun: 'Sin ejecuciones en',
        checkFailureRate: 'Tasa de fallos sobre',
    },
} as const;

function relativeTime(iso: string | null, now: Date, t: (typeof STRINGS)[keyof typeof STRINGS]): string {
    if (!iso) return t.never;
    const diff = now.getTime() - new Date(iso).getTime();
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ${t.ago}`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ${t.ago}`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ${t.ago}`;
    return `${Math.round(diff / 86_400_000)}d ${t.ago}`;
}

function statusBadge(status: Status, t: (typeof STRINGS)[keyof typeof STRINGS]) {
    if (status === 'OK')
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 size={12} />
                {t.statusOk}
            </span>
        );
    if (status === 'FIRING')
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-300 border border-red-500/30">
                <AlertCircle size={12} />
                {t.statusFiring}
            </span>
        );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-500/10 text-gray-400 border border-gray-500/30">
            <HelpCircle size={12} />
            {t.statusUnknown}
        </span>
    );
}

interface MonitorsPageProps {
    lang: 'en' | 'es';
}

export default function MonitorsPage({ lang }: MonitorsPageProps) {
    const t = STRINGS[lang];
    const [monitors, setMonitors] = useState<Monitor[] | null>(null);
    const [runbooks, setRunbooks] = useState<Runbook[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<Monitor | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [now, setNow] = useState(new Date());

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/monitors`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setMonitors(json.data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'unknown');
        }
    }, []);

    const fetchRunbooks = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/runbooks?limit=100`);
            if (res.ok) {
                const json = await res.json();
                setRunbooks(json.runbooks ?? json.workflows ?? []);
            }
        } catch {
            /* noop */
        }
    }, []);

    useEffect(() => {
        load();
        fetchRunbooks();
        const t = setInterval(() => setNow(new Date()), 30_000);
        const r = setInterval(load, 30_000);
        return () => {
            clearInterval(t);
            clearInterval(r);
        };
    }, [load, fetchRunbooks]);

    const handleToggle = async (m: Monitor) => {
        await fetch(`${API_BASE}/api/monitors/${m.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isEnabled: !m.isEnabled }),
        });
        load();
    };

    const handleDelete = async (m: Monitor) => {
        if (!confirm(t.confirmDelete)) return;
        await fetch(`${API_BASE}/api/monitors/${m.id}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <Activity size={22} className="text-amber-400" />
                            {t.title}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t.subtitle}</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditing(null);
                            setShowForm(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary text-white text-sm rounded-md"
                    >
                        <Plus size={16} />
                        {t.newMonitor}
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                        {t.loadError} · {error}
                    </div>
                )}

                {monitors === null ? (
                    <div className="text-sm text-gray-500">{t.loading}</div>
                ) : monitors.length === 0 ? (
                    <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-6 py-12 text-center">
                        <Activity size={32} className="mx-auto text-gray-600 mb-3" />
                        <div className="text-sm text-gray-400 mb-1">{t.empty}</div>
                        <div className="text-xs text-gray-600">{t.emptyHint}</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {monitors.map((m) => (
                            <div
                                key={m.id}
                                className="rounded-md border border-white/10 bg-[#1a1f2a] px-4 py-3 flex items-center gap-3"
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        m.isEnabled ? 'bg-emerald-500' : 'bg-gray-600'
                                    }`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                                        {m.name}
                                        {statusBadge(m.status, t)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {m.workflow.name} · {m.checkType.replace(/_/g, ' ')}{' '}
                                        {m.checkConfig.windowMinutes}m
                                        {m.checkConfig.threshold !== undefined &&
                                            ` · threshold ${m.checkConfig.threshold}`}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-0.5">
                                        {t.lastChecked}: {relativeTime(m.lastCheckAt, now, t)}
                                        {m.lastFiredAt && (
                                            <>
                                                {' '}
                                                · {t.lastFired}: {relativeTime(m.lastFiredAt, now, t)}
                                            </>
                                        )}
                                        {m.lastReason && <> · {m.lastReason}</>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggle(m)}
                                    className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded"
                                    title={m.isEnabled ? t.paused : t.active}
                                >
                                    <Power size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        setEditing(m);
                                        setShowForm(true);
                                    }}
                                    className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded"
                                >
                                    {t.edit}
                                </button>
                                <button
                                    onClick={() => handleDelete(m)}
                                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                                    title={t.delete}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showForm && (
                <MonitorForm
                    initial={editing}
                    runbooks={runbooks}
                    t={t}
                    onClose={() => setShowForm(false)}
                    onSaved={() => {
                        setShowForm(false);
                        load();
                    }}
                />
            )}
        </div>
    );
}

function MonitorForm({
    initial,
    runbooks,
    t,
    onClose,
    onSaved,
}: {
    initial: Monitor | null;
    runbooks: Runbook[];
    t: (typeof STRINGS)[keyof typeof STRINGS];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [workflowId, setWorkflowId] = useState(initial?.workflowId ?? '');
    const [checkType, setCheckType] = useState<CheckType>(
        initial?.checkType ?? 'last_success_within',
    );
    const [windowMinutes, setWindowMinutes] = useState(
        initial?.checkConfig.windowMinutes ?? 60,
    );
    const [threshold, setThreshold] = useState(initial?.checkConfig.threshold ?? 0.2);
    const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError(null);
        try {
            const checkConfig: { windowMinutes: number; threshold?: number } = {
                windowMinutes,
            };
            if (checkType === 'failure_rate_above') checkConfig.threshold = threshold;
            const body = {
                name,
                description: description || undefined,
                workflowId,
                checkType,
                checkConfig,
                isEnabled,
            };
            const url = initial
                ? `${API_BASE}/api/monitors/${initial.id}`
                : `${API_BASE}/api/monitors`;
            const res = await fetch(url, {
                method: initial ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || `HTTP ${res.status}`);
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
            <div className="w-full max-w-lg rounded-lg border border-white/10 bg-[#1a1f2a] shadow-2xl">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                    <h2 className="text-sm font-semibold text-white">
                        {initial ? t.edit : t.newMonitor}
                    </h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 text-sm">
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.formName}
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            maxLength={120}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.formDescription}
                        </label>
                        <input
                            value={description ?? ''}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={500}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.formRunbook}
                        </label>
                        <select
                            value={workflowId}
                            onChange={(e) => setWorkflowId(e.target.value)}
                            disabled={!!initial}
                            required
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-primary focus:outline-none disabled:opacity-50"
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
                            {t.formCheckType}
                        </label>
                        <select
                            value={checkType}
                            onChange={(e) => setCheckType(e.target.value as CheckType)}
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-primary focus:outline-none"
                        >
                            <option value="last_success_within">{t.checkLastSuccess}</option>
                            <option value="no_run_within">{t.checkNoRun}</option>
                            <option value="failure_rate_above">{t.checkFailureRate}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.formWindow}
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={10080}
                            value={windowMinutes}
                            onChange={(e) => setWindowMinutes(parseInt(e.target.value, 10))}
                            required
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-primary focus:outline-none"
                        />
                    </div>
                    {checkType === 'failure_rate_above' && (
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                                {t.formThreshold}
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.05}
                                value={threshold}
                                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                                className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 focus:border-primary focus:outline-none"
                            />
                        </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => setIsEnabled(e.target.checked)}
                        />
                        <span className="text-gray-300 text-xs">{t.formEnabled}</span>
                    </label>
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
                            className="px-4 py-2 bg-primary hover:bg-primary disabled:opacity-50 text-white text-sm rounded"
                        >
                            {submitting ? '…' : t.save}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
