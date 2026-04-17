'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CalendarClock,
    Play,
    Pause,
    Trash2,
    Plus,
    PlayCircle,
    CheckCircle2,
    XCircle,
    Clock,
    X,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED';

interface Schedule {
    id: string;
    workflow: { id: string; slug: string | null; name: string };
    cronExpr: string;
    humanCron: string | null;
    isActive: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastRun: {
        id: string;
        status: RunStatus;
        startedAt: string;
        completedAt: string | null;
    } | null;
    createdAt: string;
}

interface Runbook {
    id: string;
    slug: string | null;
    name: string;
}

const PRESETS: Array<{ key: string; expr: string; label_en: string; label_es: string }> = [
    { key: 'every5', expr: '*/5 * * * *', label_en: 'Every 5 minutes', label_es: 'Cada 5 minutos' },
    { key: 'every15', expr: '*/15 * * * *', label_en: 'Every 15 minutes', label_es: 'Cada 15 minutos' },
    { key: 'hourly', expr: '0 * * * *', label_en: 'Hourly', label_es: 'Cada hora' },
    { key: 'daily9', expr: '0 9 * * *', label_en: 'Daily at 09:00', label_es: 'Diario 09:00' },
    { key: 'weekly', expr: '0 9 * * 1', label_en: 'Mondays 09:00', label_es: 'Lunes 09:00' },
    { key: 'monthly', expr: '0 9 1 * *', label_en: 'Day 1 of month', label_es: 'Día 1 del mes' },
];

const STRINGS = {
    en: {
        title: 'Schedules',
        subtitle:
            'Cron-driven runbook executions. Pause one to skip the next fire, edit the cron, or trigger a run now without waiting.',
        newSchedule: 'New schedule',
        empty: 'No schedules yet.',
        emptyHint: 'Schedule a runbook to automate it on a cron.',
        upcomingTitle: 'Upcoming · next 24h',
        upcomingEmpty: 'Nothing scheduled in the next 24h.',
        runbook: 'Runbook',
        cron: 'Cron',
        lastRun: 'Last run',
        nextRun: 'Next',
        actions: '',
        runNow: 'Run now',
        edit: 'Edit',
        delete: 'Unschedule',
        active: 'Active',
        paused: 'Paused',
        confirmDelete: 'Unschedule this runbook? The runbook itself stays.',
        loading: 'Loading…',
        loadError: 'Failed to load schedules.',
        in: 'in',
        ago: 'ago',
        never: 'never',
        formRunbook: 'Runbook',
        formPreset: 'Preset',
        formCustom: 'Custom cron',
        formActive: 'Active immediately',
        save: 'Save',
        cancel: 'Cancel',
        runTriggered: 'Run triggered',
    },
    es: {
        title: 'Horarios',
        subtitle:
            'Ejecuciones de runbooks por cron. Pausá uno para saltar el próximo disparo, editá el cron, o disparalo ahora sin esperar.',
        newSchedule: 'Nuevo horario',
        empty: 'Aún no hay horarios.',
        emptyHint: 'Programá un runbook para automatizarlo con cron.',
        upcomingTitle: 'Próximos · 24h',
        upcomingEmpty: 'Nada programado en las próximas 24h.',
        runbook: 'Runbook',
        cron: 'Cron',
        lastRun: 'Última',
        nextRun: 'Próxima',
        actions: '',
        runNow: 'Ejecutar ahora',
        edit: 'Editar',
        delete: 'Quitar',
        active: 'Activo',
        paused: 'Pausado',
        confirmDelete: '¿Quitar el horario? El runbook se mantiene.',
        loading: 'Cargando…',
        loadError: 'Error cargando horarios.',
        in: 'en',
        ago: 'hace',
        never: 'nunca',
        formRunbook: 'Runbook',
        formPreset: 'Preset',
        formCustom: 'Cron personalizado',
        formActive: 'Activar al guardar',
        save: 'Guardar',
        cancel: 'Cancelar',
        runTriggered: 'Ejecución disparada',
    },
} as const;

function relativeTime(
    iso: string | null,
    now: Date,
    t: (typeof STRINGS)[keyof typeof STRINGS],
): string {
    if (!iso) return t.never;
    const ts = new Date(iso).getTime();
    const diffMs = ts - now.getTime();
    const abs = Math.abs(diffMs);
    const future = diffMs > 0;
    let value: string;
    if (abs < 60_000) value = `${Math.round(abs / 1000)}s`;
    else if (abs < 3_600_000) value = `${Math.round(abs / 60_000)}m`;
    else if (abs < 86_400_000) value = `${Math.round(abs / 3_600_000)}h`;
    else value = `${Math.round(abs / 86_400_000)}d`;
    return future ? `${t.in} ${value}` : `${value} ${t.ago}`;
}

function statusDot(status: RunStatus | undefined): string {
    if (!status) return 'bg-gray-700';
    switch (status) {
        case 'SUCCESS':
            return 'bg-emerald-500';
        case 'FAILED':
            return 'bg-red-500';
        case 'RUNNING':
            return 'bg-primary animate-pulse';
        case 'PAUSED':
            return 'bg-amber-500';
        default:
            return 'bg-gray-500';
    }
}

interface SchedulesPageProps {
    lang: 'en' | 'es';
}

export default function SchedulesPage({ lang }: SchedulesPageProps) {
    const t = STRINGS[lang];
    const [schedules, setSchedules] = useState<Schedule[] | null>(null);
    const [upcoming, setUpcoming] = useState<Schedule[]>([]);
    const [runbooks, setRunbooks] = useState<Runbook[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<Schedule | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [now, setNow] = useState(new Date());

    const load = useCallback(async () => {
        try {
            const [list, upc] = await Promise.all([
                fetch(`${API_BASE}/api/schedules`).then((r) => r.json()),
                fetch(`${API_BASE}/api/schedules/upcoming?hours=24`).then((r) => r.json()),
            ]);
            setSchedules(list.data);
            setUpcoming(upc.data);
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
                setRunbooks(Array.isArray(json) ? json : json.data ?? []);
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

    const counts = useMemo(() => {
        if (!schedules) return { active: 0, paused: 0 };
        return {
            active: schedules.filter((s) => s.isActive).length,
            paused: schedules.filter((s) => !s.isActive).length,
        };
    }, [schedules]);

    const handleToggle = async (s: Schedule) => {
        await fetch(`${API_BASE}/api/schedules/${s.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !s.isActive }),
        });
        load();
    };

    const handleDelete = async (s: Schedule) => {
        if (!confirm(t.confirmDelete)) return;
        await fetch(`${API_BASE}/api/schedules/${s.id}`, { method: 'DELETE' });
        load();
    };

    const handleRunNow = async (s: Schedule) => {
        const res = await fetch(`${API_BASE}/api/schedules/${s.id}/run`, { method: 'POST' });
        if (res.ok) {
            // light feedback — a real toast lib is overkill here
            // eslint-disable-next-line no-alert
            alert(t.runTriggered);
            load();
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <CalendarClock size={22} className="text-primary/70" />
                            {t.title}
                            <span className="text-xs font-normal text-gray-500 ml-2">
                                {counts.active} {t.active.toLowerCase()} · {counts.paused}{' '}
                                {t.paused.toLowerCase()}
                            </span>
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
                        {t.newSchedule}
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                        {t.loadError} · {error}
                    </div>
                )}

                {/* Upcoming */}
                <div className="mb-6 rounded-md border border-white/10 bg-[#1a1f2a] px-4 py-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400 mb-3">
                        <Clock size={14} />
                        {t.upcomingTitle}
                    </div>
                    {upcoming.length === 0 ? (
                        <div className="text-sm text-gray-500">{t.upcomingEmpty}</div>
                    ) : (
                        <ul className="space-y-1 text-sm">
                            {upcoming.slice(0, 8).map((s) => (
                                <li
                                    key={s.id}
                                    className="flex items-center gap-3 py-1 border-b border-white/5 last:border-0"
                                >
                                    <span className="text-gray-500 text-xs w-20">
                                        {s.nextRunAt
                                            ? new Date(s.nextRunAt).toLocaleTimeString([], {
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                              })
                                            : '—'}
                                    </span>
                                    <span className="text-gray-300 flex-1 truncate">
                                        {s.workflow.name}
                                    </span>
                                    <span className="text-xs text-primary/70">
                                        {relativeTime(s.nextRunAt, now, t)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Table */}
                {schedules === null ? (
                    <div className="text-sm text-gray-500">{t.loading}</div>
                ) : schedules.length === 0 ? (
                    <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-6 py-12 text-center">
                        <CalendarClock size={32} className="mx-auto text-gray-600 mb-3" />
                        <div className="text-sm text-gray-400 mb-1">{t.empty}</div>
                        <div className="text-xs text-gray-600">{t.emptyHint}</div>
                    </div>
                ) : (
                    <div className="rounded-md border border-white/10 bg-[#1a1f2a] overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-black/20">
                                <tr>
                                    <th className="text-left px-4 py-2 font-normal w-6"></th>
                                    <th className="text-left px-2 py-2 font-normal">{t.runbook}</th>
                                    <th className="text-left px-2 py-2 font-normal">{t.cron}</th>
                                    <th className="text-left px-2 py-2 font-normal">{t.lastRun}</th>
                                    <th className="text-left px-2 py-2 font-normal">{t.nextRun}</th>
                                    <th className="text-right px-4 py-2 font-normal">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedules.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="border-t border-white/5 hover:bg-white/[0.02]"
                                    >
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-block w-2 h-2 rounded-full ${
                                                    s.isActive
                                                        ? 'bg-emerald-500'
                                                        : 'bg-gray-600'
                                                }`}
                                                title={s.isActive ? t.active : t.paused}
                                            />
                                        </td>
                                        <td className="px-2 py-3">
                                            <div className="text-gray-200 truncate max-w-xs">
                                                {s.workflow.name}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3">
                                            <div className="font-mono text-xs text-gray-400">
                                                {s.cronExpr}
                                            </div>
                                            {s.humanCron && (
                                                <div className="text-[10px] text-gray-600 truncate max-w-xs">
                                                    {s.humanCron}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-2 py-3">
                                            <div className="flex items-center gap-1 text-xs">
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${statusDot(
                                                        s.lastRun?.status,
                                                    )}`}
                                                />
                                                <span className="text-gray-400">
                                                    {relativeTime(s.lastRunAt, now, t)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-xs text-primary/70">
                                            {s.isActive ? relativeTime(s.nextRunAt, now, t) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                <button
                                                    onClick={() => handleRunNow(s)}
                                                    className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded"
                                                    title={t.runNow}
                                                >
                                                    <PlayCircle size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggle(s)}
                                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded"
                                                    title={s.isActive ? t.paused : t.active}
                                                >
                                                    {s.isActive ? (
                                                        <Pause size={14} />
                                                    ) : (
                                                        <Play size={14} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditing(s);
                                                        setShowForm(true);
                                                    }}
                                                    className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded"
                                                >
                                                    {t.edit}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(s)}
                                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                                                    title={t.delete}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForm && (
                <ScheduleForm
                    initial={editing}
                    runbooks={runbooks}
                    existingWorkflowIds={new Set((schedules ?? []).map((s) => s.workflow.id))}
                    t={t}
                    lang={lang}
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

function ScheduleForm({
    initial,
    runbooks,
    existingWorkflowIds,
    t,
    lang,
    onClose,
    onSaved,
}: {
    initial: Schedule | null;
    runbooks: Runbook[];
    existingWorkflowIds: Set<string>;
    t: (typeof STRINGS)[keyof typeof STRINGS];
    lang: 'en' | 'es';
    onClose: () => void;
    onSaved: () => void;
}) {
    const [workflowId, setWorkflowId] = useState(initial?.workflow.id ?? '');
    const [cronExpr, setCronExpr] = useState(initial?.cronExpr ?? '*/5 * * * *');
    const [isActive, setIsActive] = useState(initial?.isActive ?? true);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const availableRunbooks = useMemo(() => {
        if (initial) return runbooks; // editing — current workflow may already be scheduled
        return runbooks.filter((r) => !existingWorkflowIds.has(r.id));
    }, [runbooks, existingWorkflowIds, initial]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError(null);
        try {
            if (initial) {
                const res = await fetch(`${API_BASE}/api/schedules/${initial.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cronExpr, isActive }),
                });
                if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error(j.error || `HTTP ${res.status}`);
                }
            } else {
                const res = await fetch(`${API_BASE}/api/schedules`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workflowId, cronExpr }),
                });
                if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error(j.error || `HTTP ${res.status}`);
                }
                if (!isActive) {
                    // The POST defaults to active. If user unticked, immediately patch.
                    const created = await res.clone().json();
                    await fetch(`${API_BASE}/api/schedules/${created.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isActive: false }),
                    });
                }
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
                        {initial ? t.edit : t.newSchedule}
                    </h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 text-sm">
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
                            {availableRunbooks.map((rb) => (
                                <option key={rb.id} value={rb.id}>
                                    {rb.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.formPreset}
                        </label>
                        <div className="flex flex-wrap gap-1">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => setCronExpr(p.expr)}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        cronExpr === p.expr
                                            ? 'border-primary bg-primary/20 text-primary/40'
                                            : 'border-white/10 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {lang === 'es' ? p.label_es : p.label_en}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                            {t.formCustom}
                        </label>
                        <input
                            value={cronExpr}
                            onChange={(e) => setCronExpr(e.target.value)}
                            required
                            className="w-full bg-[#0f1218] border border-white/10 rounded px-3 py-2 text-gray-200 font-mono focus:border-primary focus:outline-none"
                            placeholder="*/5 * * * *"
                        />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                        />
                        <span className="text-gray-300 text-xs">{t.formActive}</span>
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
