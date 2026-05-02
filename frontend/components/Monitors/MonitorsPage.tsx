'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Plus,
  Power,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { HelixSpinner } from '@/components/Brand/HelixSpinner';
import {
  motionFor,
  reducedStaggerChildVariants,
  reducedStaggerContainerVariants,
  staggerChildInitialStyle,
  staggerChildVariants,
  staggerContainerVariants,
} from '@/lib/motion';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type CheckType = 'last_success_within' | 'no_run_within' | 'failure_rate_above';
type Status = 'OK' | 'FIRING' | 'UNKNOWN';

interface Monitor {
  id: string;
  name: string;
  description: string | null;
  runbookId: string;
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
    nameRequired: 'Name is required.',
    runbookRequired: 'Pick a runbook to watch.',
    windowInvalid: 'Window must be 1–10080 minutes.',
    thresholdInvalid: 'Threshold must be between 0 and 1.',
    saving: 'Saving…',
    empty: 'No monitors yet.',
    emptyHint: 'Create one to alert when a runbook stops succeeding.',
    active: 'Active',
    paused: 'Paused',
    confirmDelete: 'Delete this monitor?',
    confirmDeleteYes: 'Yes, delete',
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
    nameRequired: 'El nombre es obligatorio.',
    runbookRequired: 'Elegí un runbook para vigilar.',
    windowInvalid: 'La ventana debe ser 1–10080 minutos.',
    thresholdInvalid: 'El umbral debe estar entre 0 y 1.',
    saving: 'Guardando…',
    empty: 'Aún no hay monitores.',
    emptyHint: 'Creá uno para alertar cuando un runbook deje de tener éxito.',
    active: 'Activo',
    paused: 'Pausado',
    confirmDelete: '¿Borrar este monitor?',
    confirmDeleteYes: 'Sí, borrar',
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

function relativeTime(
  iso: string | null,
  now: Date,
  t: (typeof STRINGS)[keyof typeof STRINGS]
): string {
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
      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
        <CheckCircle2 size={12} />
        {t.statusOk}
      </span>
    );
  if (status === 'FIRING')
    return (
      <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">
        <AlertCircle size={12} />
        {t.statusFiring}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded border border-gray-500/30 bg-gray-500/10 px-2 py-0.5 text-xs text-gray-400">
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
  // In-place delete confirm replaces the native `confirm()` dialog —
  // inline confirmation keeps the user in context, works on mobile
  // (native dialogs render awkwardly in iOS Safari), and is
  // dismissible by clicking Cancel instead of forcing a keyboard
  // dismiss. Keyed by monitor id; null when no row is confirming.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

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
    await fetch(`${API_BASE}/api/monitors/${m.id}`, { method: 'DELETE' });
    setConfirmingDeleteId(null);
    load();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <Activity size={22} className="text-amber-400" />
              {t.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{t.subtitle}</p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="bg-primary hover:bg-primary flex shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
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
            <Activity size={32} className="mx-auto mb-3 text-gray-600" />
            <div className="mb-1 text-sm text-gray-400">{t.empty}</div>
            <div className="text-xs text-gray-600">{t.emptyHint}</div>
          </div>
        ) : (
          <motion.ul
            className="space-y-3"
            variants={motionFor(staggerContainerVariants, reducedStaggerContainerVariants)}
            initial="initial"
            animate="animate"
          >
            {monitors.map(m => {
              const runbookHref = `/${lang}/runbooks/${m.workflow.slug ?? m.workflow.id}`;
              const isConfirming = confirmingDeleteId === m.id;
              return (
                <motion.li
                  key={m.id}
                  variants={motionFor(staggerChildVariants, reducedStaggerChildVariants)}
                  style={staggerChildInitialStyle}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-white/10 bg-[#1a1f2a] px-4 py-3"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      m.isEnabled ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                      <span className="min-w-0 truncate">{m.name}</span>
                      {statusBadge(m.status, t)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      <Link
                        href={runbookHref}
                        className="underline-offset-2 hover:text-gray-300 hover:underline"
                      >
                        {m.workflow.name}
                      </Link>{' '}
                      · {m.checkType.replace(/_/g, ' ')} {m.checkConfig.windowMinutes}m
                      {m.checkConfig.threshold !== undefined &&
                        ` · threshold ${m.checkConfig.threshold}`}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">
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
                  {isConfirming ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-300">{t.confirmDelete}</span>
                      <button
                        onClick={() => handleDelete(m)}
                        className="rounded bg-red-500/20 px-2 py-1 font-medium text-red-300 hover:bg-red-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-400"
                      >
                        {t.confirmDeleteYes}
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="rounded px-2 py-1 text-gray-400 hover:bg-white/5 hover:text-white"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(m)}
                        className="rounded p-1.5 text-gray-500 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/40"
                        title={m.isEnabled ? t.paused : t.active}
                        aria-label={m.isEnabled ? t.paused : t.active}
                      >
                        <Power size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditing(m);
                          setShowForm(true);
                        }}
                        className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/40"
                      >
                        {t.edit}
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(m.id)}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-400/60"
                        title={t.delete}
                        aria-label={t.delete}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </motion.ul>
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
  const [runbookId, setWorkflowId] = useState(initial?.runbookId ?? '');
  const [checkType, setCheckType] = useState<CheckType>(
    initial?.checkType ?? 'last_success_within'
  );
  const [windowMinutes, setWindowMinutes] = useState(initial?.checkConfig.windowMinutes ?? 60);
  const [threshold, setThreshold] = useState(initial?.checkConfig.threshold ?? 0.2);
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Touched tracks which fields the user has interacted with so we
  // don't flash errors the moment the form opens. Each field flips
  // to true on blur (or on submit attempt below).
  const [touched, setTouched] = useState<{
    name?: boolean;
    runbookId?: boolean;
    windowMinutes?: boolean;
    threshold?: boolean;
  }>({});

  // Live per-field validation. Null = valid, string = error message.
  const fieldErrors = {
    name: name.trim().length === 0 ? t.nameRequired : null,
    runbookId: !initial && runbookId.trim().length === 0 ? t.runbookRequired : null,
    windowMinutes:
      !Number.isFinite(windowMinutes) || windowMinutes < 1 || windowMinutes > 10080
        ? t.windowInvalid
        : null,
    threshold:
      checkType === 'failure_rate_above' &&
      (threshold < 0 || threshold > 1 || !Number.isFinite(threshold))
        ? t.thresholdInvalid
        : null,
  };
  const formInvalid = Object.values(fieldErrors).some(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // On submit, reveal every error regardless of touched so a user
    // clicking Save on an empty form gets the full punch list.
    setTouched({ name: true, runbookId: true, windowMinutes: true, threshold: true });
    if (formInvalid) return;
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
        runbookId,
        checkType,
        checkConfig,
        isEnabled,
      };
      const url = initial ? `${API_BASE}/api/monitors/${initial.id}` : `${API_BASE}/api/monitors`;
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
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">{initial ? t.edit : t.newMonitor}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="space-y-4 px-5 py-4 text-sm">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
              {t.formName}
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => setTouched(p => ({ ...p, name: true }))}
              maxLength={120}
              aria-invalid={touched.name && !!fieldErrors.name}
              className={`focus:border-primary w-full rounded border bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none ${
                touched.name && fieldErrors.name ? 'border-red-500/60' : 'border-white/10'
              }`}
            />
            {touched.name && fieldErrors.name && (
              <p className="mt-1 text-[11px] text-red-400">{fieldErrors.name}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
              {t.formDescription}
            </label>
            <input
              value={description ?? ''}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
              {t.formRunbook}
            </label>
            <select
              value={runbookId}
              onChange={e => setWorkflowId(e.target.value)}
              onBlur={() => setTouched(p => ({ ...p, runbookId: true }))}
              disabled={!!initial}
              aria-invalid={touched.runbookId && !!fieldErrors.runbookId}
              className={`focus:border-primary w-full rounded border bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none disabled:opacity-50 ${
                touched.runbookId && fieldErrors.runbookId ? 'border-red-500/60' : 'border-white/10'
              }`}
            >
              <option value="">— select —</option>
              {runbooks.map(rb => (
                <option key={rb.id} value={rb.id}>
                  {rb.name}
                </option>
              ))}
            </select>
            {touched.runbookId && fieldErrors.runbookId && (
              <p className="mt-1 text-[11px] text-red-400">{fieldErrors.runbookId}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
              {t.formCheckType}
            </label>
            <select
              value={checkType}
              onChange={e => setCheckType(e.target.value as CheckType)}
              className="focus:border-primary w-full rounded border border-white/10 bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none"
            >
              <option value="last_success_within">{t.checkLastSuccess}</option>
              <option value="no_run_within">{t.checkNoRun}</option>
              <option value="failure_rate_above">{t.checkFailureRate}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
              {t.formWindow}
            </label>
            <input
              type="number"
              min={1}
              max={10080}
              value={windowMinutes}
              onChange={e => setWindowMinutes(parseInt(e.target.value, 10))}
              onBlur={() => setTouched(p => ({ ...p, windowMinutes: true }))}
              aria-invalid={touched.windowMinutes && !!fieldErrors.windowMinutes}
              className={`focus:border-primary w-full rounded border bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none ${
                touched.windowMinutes && fieldErrors.windowMinutes
                  ? 'border-red-500/60'
                  : 'border-white/10'
              }`}
            />
            {touched.windowMinutes && fieldErrors.windowMinutes && (
              <p className="mt-1 text-[11px] text-red-400">{fieldErrors.windowMinutes}</p>
            )}
          </div>
          {checkType === 'failure_rate_above' && (
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
                {t.formThreshold}
              </label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={threshold}
                onChange={e => setThreshold(parseFloat(e.target.value))}
                onBlur={() => setTouched(p => ({ ...p, threshold: true }))}
                aria-invalid={touched.threshold && !!fieldErrors.threshold}
                className={`focus:border-primary w-full rounded border bg-[#0f1218] px-3 py-2 text-gray-200 focus:outline-none ${
                  touched.threshold && fieldErrors.threshold
                    ? 'border-red-500/60'
                    : 'border-white/10'
                }`}
              />
              {touched.threshold && fieldErrors.threshold && (
                <p className="mt-1 text-[11px] text-red-400">{fieldErrors.threshold}</p>
              )}
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={e => setIsEnabled(e.target.checked)}
            />
            <span className="text-xs text-gray-300">{t.formEnabled}</span>
          </label>
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
              disabled={submitting || formInvalid}
              className="bg-primary hover:bg-primary inline-flex items-center gap-2 rounded px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 disabled:opacity-50"
            >
              {submitting && <HelixSpinner size={14} />}
              {submitting ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
