'use client';

import { motion } from 'framer-motion';
import {
  ChevronDown,
  Copy,
  Edit3,
  FileCode,
  History,
  PlayCircle,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  motionFor,
  reducedStaggerChildVariants,
  reducedStaggerContainerVariants,
  staggerChildVariants,
  staggerContainerVariants,
} from '@/lib/motion';

import { EmptyState } from '../Common/EmptyState';
import Sparkline from '../Common/Sparkline';

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
  /** Up to 20 recent statuses, oldest first, for an inline sparkline. */
  recentStatuses?: string[];
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
      return 'bg-primary animate-pulse';
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
  // Intentional: recapture `now` on every list refresh so every row's
  // relativeTime() sees the same moment. The memo body doesn't read
  // `runbooks` but the list changing is the signal we want — lint
  // can't see that.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [runbooks]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/api/runbooks?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRunbooks(json.runbooks ?? json.workflows ?? []);
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
    return runbooks.filter(r => r.category === category);
  }, [runbooks, category]);

  const counts = useMemo(() => {
    if (!runbooks) return { total: 0, active: 0 };
    return {
      total: runbooks.length,
      active: runbooks.filter(r => r.isActive).length,
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
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <Share2 size={22} className="text-emerald-400" />
              {t.title}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {counts.total} total · {counts.active} active
              </span>
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{t.subtitle}</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="bg-primary hover:bg-primary flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white"
            >
              <Plus size={16} />
              {t.newRunbook}
              <ChevronDown size={14} />
            </button>
            {showNewMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-white/10 bg-[#1a1f2a] py-1 shadow-xl">
                <button
                  onClick={handleCreateBlank}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5"
                >
                  {t.newBlank}
                </button>
                <button
                  onClick={() => {
                    setShowNewMenu(false);
                    setShowTemplates(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5"
                >
                  {t.newFromTemplate}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="focus:border-primary w-full rounded-md border border-white/10 bg-[#1a1f2a] py-2 pl-9 pr-3 text-sm text-gray-200 focus:outline-none"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="focus:border-primary rounded-md border border-white/10 bg-[#1a1f2a] px-3 py-2 text-sm text-gray-300 focus:outline-none"
          >
            <option value="">{t.allCategories}</option>
            {categories.map(c => (
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
          <EmptyState
            icon={Share2}
            title={t.empty}
            body={t.emptyHint}
            primaryLabel={lang === 'en' ? 'Browse templates' : 'Ver templates'}
            primaryHref={`/${lang}/templates`}
            secondaryLabel={lang === 'en' ? 'Start from scratch' : 'Empezar desde cero'}
            secondaryHref={`/${lang}/editor`}
          />
        ) : (
          // Grid staggers its cards on mount. With up to ~20 cards
          // per page the 50 ms per-child stagger keeps the full
          // sweep under ~1 s; the child animation itself is a short
          // fade + 6 px slide. Container variants re-fire when
          // `filter`/`search` causes `filtered` to change length —
          // acceptable here because the list itself is rebuilt.
          <motion.div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            variants={motionFor(staggerContainerVariants, reducedStaggerContainerVariants)}
            initial="initial"
            animate="animate"
          >
            {filtered.map(rb => (
              <motion.div
                key={rb.id}
                variants={motionFor(staggerChildVariants, reducedStaggerChildVariants)}
              >
                <RunbookCard
                  rb={rb}
                  t={t}
                  lang={lang}
                  now={now}
                  onRunNow={() => handleRunNow(rb)}
                  onDuplicate={() => handleDuplicate(rb)}
                  onDelete={() => handleDelete(rb)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {showTemplates && (
        <TemplatePicker
          t={t}
          onClose={() => setShowTemplates(false)}
          onSelect={tpl => {
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
  const successRate = rb.successRate30d != null ? `${(rb.successRate30d * 100).toFixed(0)}%` : '—';
  return (
    <div className="flex flex-col rounded-md border border-white/10 bg-[#1a1f2a] p-4 transition-colors hover:border-white/20">
      <div className="mb-2 flex items-start gap-2">
        <span
          className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
            rb.isActive ? 'bg-emerald-500' : 'bg-gray-600'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{rb.name}</div>
          {rb.category && (
            <span className="mt-1 inline-block rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
              {rb.category}
            </span>
          )}
        </div>
      </div>
      {rb.description && (
        <p className="mb-3 line-clamp-2 min-h-[2.5em] text-xs text-gray-500">{rb.description}</p>
      )}
      <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-500">
        <span>
          {rb._count.executions} {t.runs}
        </span>
        <span>
          {successRate} {t.successRate}
        </span>
        <span className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(rb.lastRunStatus)}`} />
          {rb.lastRunAt ? relativeTime(rb.lastRunAt, now) : t.never}
        </span>
      </div>
      {rb.recentStatuses && rb.recentStatuses.length > 0 && (
        <div className="mb-3">
          <Sparkline statuses={rb.recentStatuses} tileHeight={12} />
        </div>
      )}
      <div className="mt-auto flex items-center gap-1">
        <button
          onClick={onRunNow}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/10"
          title={t.run_now}
        >
          <PlayCircle size={13} />
          {t.run}
        </button>
        <a
          href={`/${lang}/editor?id=${rb.id}`}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Edit3 size={13} />
          {t.edit}
        </a>
        <a
          href={`/${lang}/runs?runbook=${rb.id}`}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          title={t.history}
        >
          <History size={13} />
        </a>
        <button
          onClick={onDuplicate}
          className="ml-auto rounded p-1 text-gray-400 hover:bg-white/5 hover:text-white"
          title={t.duplicate}
        >
          <Copy size={13} />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
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
      .then(r => r.json())
      .then(j => setTemplates(j.data ?? []))
      .catch(() => setTemplates([]));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-[#1a1f2a] shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#1a1f2a] px-5 py-3">
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {templates.map(tpl => (
                <button
                  key={tpl.file}
                  onClick={() => onSelect(tpl)}
                  className="hover:border-primary hover:bg-primary/5 rounded-md border border-white/10 p-3 text-left transition-colors"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <FileCode size={14} className="text-primary/70" />
                    <span className="truncate text-sm font-medium text-white">{tpl.name}</span>
                  </div>
                  {tpl.category && (
                    <span className="mb-2 inline-block rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                      {tpl.category}
                    </span>
                  )}
                  {tpl.description && (
                    <p className="line-clamp-2 text-xs text-gray-500">{tpl.description}</p>
                  )}
                  <div className="mt-2 text-[10px] text-gray-600">{tpl.stepCount} steps</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
