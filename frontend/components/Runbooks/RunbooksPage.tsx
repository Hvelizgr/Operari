'use client';

import { motion, AnimatePresence } from 'framer-motion';
import anime from 'animejs';
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
  Activity,
  Zap,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    title: 'Runbook Library',
    subtitle:
      'The source of truth for your operational logic. Versioned, executable, and shared across your team.',
    newRunbook: 'New runbook',
    newBlank: 'Blank Canvas',
    newFromTemplate: 'From Template',
    newImport: 'Import YAML',
    searchPlaceholder: 'Filter by name or intent…',
    allCategories: 'All Categories',
    empty: 'The library is empty.',
    emptyHint: 'Start building your operational safety by creating your first runbook.',
    runs: 'executions',
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
    loading: 'Fetching library…',
    loadError: 'Failed to connect to the library.',
    templatesTitle: 'Select Blueprint',
    cancel: 'Cancel',
    run_now: 'Trigger execution',
    new_blank_name: 'Untitled runbook',
  },
  es: {
    title: 'Biblioteca de Runbooks',
    subtitle:
      'La fuente de verdad para tu lógica operativa. Versionada, ejecutable y compartida con tu equipo.',
    newRunbook: 'Nuevo runbook',
    newBlank: 'Lienzo en blanco',
    newFromTemplate: 'Desde plantilla',
    newImport: 'Importar YAML',
    searchPlaceholder: 'Filtrar por nombre o intención…',
    allCategories: 'Todas las categorías',
    empty: 'La biblioteca está vacía.',
    emptyHint: 'Empieza a construir tu seguridad operativa creando tu primer runbook.',
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
    loading: 'Cargando biblioteca…',
    loadError: 'Error al conectar con la biblioteca.',
    templatesTitle: 'Seleccionar Blueprint',
    cancel: 'Cancelar',
    run_now: 'Disparar ejecución',
    new_blank_name: 'Runbook sin título',
  },
} as const;

function statusDot(status: string | null): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-[var(--op-moss)]';
    case 'FAILED':
      return 'bg-[var(--op-sunset)]';
    case 'RUNNING':
      return 'bg-[var(--accent-color)] animate-pulse';
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
  const gridRef = useRef<HTMLDivElement>(null);

  // Staggered entrance animation for cards using anime.js
  useEffect(() => {
    if (runbooks && runbooks.length > 0 && gridRef.current) {
      const cards = gridRef.current.querySelectorAll('.rb-card');
      anime({
        targets: cards,
        opacity: [0, 1],
        translateY: [20, 0],
        scale: [0.95, 1],
        delay: anime.stagger(50),
        duration: 800,
        easing: 'cubicBezier(0.22, 1, 0.36, 1)',
      });
    }
  }, [runbooks, search, category]);

  const now = useMemo(() => new Date(), [runbooks]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/api/runbooks?${params}`, { credentials: 'include' });
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
        credentials: 'include',
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
      const created = await fetch(`${API_BASE}/api/runbooks`, {
        method: 'POST',
        credentials: 'include',
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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: tpl.yaml }),
      });
      router.push(`/${lang}/editor?id=${wf.id}`);
    } catch {
      /* noop */
    }
  };

  const handleDuplicate = async (rb: Runbook) => {
    await fetch(`${API_BASE}/api/runbooks/${rb.id}/duplicate`, { method: 'POST', credentials: 'include' });
    load();
  };

  const handleDelete = async (rb: Runbook) => {
    if (!confirm(t.confirmDelete)) return;
    await fetch(`${API_BASE}/api/runbooks/${rb.id}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  const handleRunNow = async (rb: Runbook) => {
    try {
      const res = await fetch(`${API_BASE}/api/executions/${rb.id}/run`, {
        method: 'POST',
        credentials: 'include',
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
    <div className="marketing-shell flex-1 overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header Section */}
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="m-eyebrow mb-2">Library</div>
            <h1 className="text-5xl font-black tracking-tighter text-[var(--text-primary)]">
              {t.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-medium leading-relaxed text-[var(--text-muted)]">
              {t.subtitle}
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
              <span className="flex items-center gap-1.5">
                <Activity size={12} className="text-[var(--op-moss)]" />
                {counts.total} total
              </span>
              <span className="flex items-center gap-1.5">
                <Zap size={12} className="text-[var(--accent-color)]" />
                {counts.active} active
              </span>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="flex items-center gap-2 rounded-xl bg-[var(--accent-color)] px-6 py-3 text-sm font-black text-black shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={18} strokeWidth={3} />
              {t.newRunbook}
              <ChevronDown size={16} strokeWidth={3} />
            </button>
            <AnimatePresence>
              {showNewMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full z-[60] mt-3 w-56 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1 shadow-2xl backdrop-blur-xl"
                >
                  <button
                    onClick={handleCreateBlank}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-elevated)]"
                  >
                    <Edit3 size={16} />
                    {t.newBlank}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      setShowTemplates(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-elevated)]"
                  >
                    <FileCode size={16} />
                    {t.newFromTemplate}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] opacity-50"
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="focus:border-[var(--accent-color)]/50 placeholder:text-[var(--text-muted)]/50 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] py-3 pl-12 pr-4 text-sm font-medium text-[var(--text-primary)] transition-all focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="focus:border-[var(--accent-color)]/50 relative appearance-none rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 pr-10 text-sm font-bold text-[var(--text-primary)] transition-all focus:outline-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                backgroundSize: '1rem',
              }}
            >
              <option value="">{t.allCategories}</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="border-[var(--op-sunset)]/20 bg-[var(--op-sunset)]/5 mb-6 rounded-xl border p-4 text-sm font-bold text-[var(--op-sunset)]">
            <Activity size={16} className="mb-1" />
            {t.loadError} · {error}
          </div>
        )}

        {filtered === null ? (
          <div className="flex h-64 items-center justify-center text-sm font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
            <div className="flex flex-col items-center gap-4">
              <div className="h-2 w-12 animate-pulse rounded-full bg-[var(--accent-color)]" />
              {t.loading}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Share2}
            title={t.empty}
            body={t.emptyHint}
            primaryLabel={lang === 'en' ? 'Explore Templates' : 'Explorar Plantillas'}
            primaryHref={`/${lang}/templates`}
            secondaryLabel={lang === 'en' ? 'New Blank Runbook' : 'Nuevo Runbook'}
            secondaryHref={`/${lang}/editor`}
          />
        ) : (
          <div ref={gridRef} className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(rb => (
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
    <div className="rb-card hover:border-[var(--accent-color)]/30 group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 transition-all hover:scale-[1.02] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
      {/* Visual connection to the brand */}
      <div className="bg-[var(--accent-color)]/5 group-hover:bg-[var(--accent-color)]/10 absolute right-0 top-0 h-24 w-24 translate-x-12 translate-y-[-12px] rounded-full blur-2xl transition-all" />

      <div className="relative mb-6 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full shadow-[0_0_8px] ${rb.isActive ? 'bg-[var(--op-moss)] shadow-[var(--op-moss)]' : 'bg-gray-600 shadow-transparent'}`}
            />
            {rb.category && (
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] opacity-70">
                {rb.category}
              </span>
            )}
          </div>
          <h3 className="truncate text-xl font-black tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-color)]">
            {rb.name}
          </h3>
        </div>
      </div>

      {rb.description && (
        <p className="relative mb-6 line-clamp-2 min-h-[3em] text-sm font-medium leading-relaxed text-[var(--text-muted)]">
          {rb.description}
        </p>
      )}

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-2 border-y border-[var(--panel-border)] py-4">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
            Executions
          </span>
          <span className="text-sm font-black text-[var(--text-primary)]">
            {rb._count.executions}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
            Success
          </span>
          <span className="text-sm font-black text-[var(--op-moss)]">{successRate}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
            Freshness
          </span>
          <span className="flex items-center gap-1.5 text-sm font-black text-[var(--text-primary)]">
            <div className={`h-1.5 w-1.5 rounded-full ${statusDot(rb.lastRunStatus)}`} />
            {rb.lastRunAt ? relativeTime(rb.lastRunAt, now) : '—'}
          </span>
        </div>
      </div>

      {rb.recentStatuses && rb.recentStatuses.length > 0 && (
        <div className="mb-6 opacity-60 transition-opacity group-hover:opacity-100">
          <Sparkline statuses={rb.recentStatuses} tileHeight={14} />
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onRunNow}
            className="bg-[var(--op-moss)]/10 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black text-[var(--op-moss)] transition-all hover:bg-[var(--op-moss)] hover:text-black"
            title={t.run_now}
          >
            <PlayCircle size={14} strokeWidth={3} />
            {t.run}
          </button>
          <a
            href={`/${lang}/editor?id=${rb.id}`}
            className="flex items-center gap-2 rounded-lg bg-[var(--panel-elevated)] px-3 py-1.5 text-xs font-black text-[var(--text-primary)] transition-all hover:bg-[var(--accent-color)] hover:text-black"
          >
            <Edit3 size={14} strokeWidth={3} />
            {t.edit}
          </a>
        </div>

        <div className="flex items-center gap-1">
          <a
            href={`/${lang}/runs?runbook=${rb.id}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all hover:bg-[var(--panel-elevated)] hover:text-[var(--text-primary)]"
            title={t.history}
          >
            <History size={16} />
          </a>
          <button
            onClick={onDuplicate}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all hover:bg-[var(--panel-elevated)] hover:text-[var(--text-primary)]"
            title={t.duplicate}
          >
            <Copy size={16} />
          </button>
          <button
            onClick={onDelete}
            className="hover:bg-[var(--op-sunset)]/10 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all hover:text-[var(--op-sunset)]"
            title={t.delete}
          >
            <Trash2 size={16} />
          </button>
        </div>
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
    fetch(`${API_BASE}/api/templates`, { credentials: 'include' })
      .then(r => r.json())
      .then(j => setTemplates(j.data ?? []))
      .catch(() => setTemplates([]));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="custom-scrollbar relative max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--app-bg)] shadow-2xl"
      >
        <div className="bg-[var(--app-bg)]/80 sticky top-0 z-10 flex items-center justify-between border-b border-[var(--panel-border)] px-8 py-6 backdrop-blur-xl">
          <div>
            <div className="m-eyebrow mb-1">Blueprints</div>
            <h2 className="text-3xl font-black tracking-tighter text-[var(--text-primary)]">
              {t.templatesTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-[var(--panel-elevated)] p-2 text-[var(--text-muted)] transition-all hover:text-[var(--text-primary)]"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-8">
          {templates === null ? (
            <div className="flex h-48 items-center justify-center text-sm font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
              {t.loading}
            </div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)]">
              No blueprints found in the library.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {templates.map(tpl => (
                <button
                  key={tpl.file}
                  onClick={() => onSelect(tpl)}
                  className="hover:border-[var(--accent-color)]/50 group relative flex flex-col rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-left transition-all hover:scale-[1.02]"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="bg-[var(--accent-color)]/10 flex h-10 w-10 items-center justify-center rounded-lg text-[var(--accent-color)]">
                      <FileCode size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
                      {tpl.stepCount} steps
                    </span>
                  </div>
                  <h4 className="mb-2 text-lg font-black text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-color)]">
                    {tpl.name}
                  </h4>
                  {tpl.description && (
                    <p className="line-clamp-2 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                      {tpl.description}
                    </p>
                  )}
                  {tpl.category && (
                    <div className="mt-4">
                      <span className="rounded-lg bg-[var(--panel-elevated)] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                        {tpl.category}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
