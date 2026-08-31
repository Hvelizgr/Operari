'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  Share2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EmptyState } from '../Common/EmptyState';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Project {
  id: string;
  name: string;
  description: string | null;
  allowedShellDirectory: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number; runbooks: number };
  memberCount?: number;
  runbookCount?: number;
  role?: string;
}

const STRINGS = {
  en: {
    title: 'Projects',
    subtitle: 'Organize runbooks and team members into projects with scoped permissions.',
    newProject: 'Create Project',
    searchPlaceholder: 'Filter by name…',
    empty: 'No projects yet.',
    emptyHint: 'Create your first project to organize runbooks and collaborate with your team.',
    members: 'members',
    runbooks: 'runbooks',
    role: 'Your role',
    loading: 'Fetching projects…',
    loadError: 'Failed to load projects.',
    createTitle: 'Create Project',
    nameLabel: 'Name',
    namePlaceholder: 'e.g. Production Incident Response',
    descLabel: 'Description',
    descPlaceholder: 'What is this project for?',
    shellDirLabel: 'Allowed Shell Directory',
    shellDirPlaceholder: '/opt/scripts (optional)',
    shellDirHint: 'If set, shell steps in this project can only access this directory.',
    cancel: 'Cancel',
    create: 'Create',
    creating: 'Creating…',
  },
  es: {
    title: 'Proyectos',
    subtitle: 'Organiza runbooks y miembros del equipo en proyectos con permisos definidos.',
    newProject: 'Crear Proyecto',
    searchPlaceholder: 'Filtrar por nombre…',
    empty: 'No hay proyectos aún.',
    emptyHint: 'Crea tu primer proyecto para organizar runbooks y colaborar con tu equipo.',
    members: 'miembros',
    runbooks: 'runbooks',
    role: 'Tu rol',
    loading: 'Cargando proyectos…',
    loadError: 'Error al cargar proyectos.',
    createTitle: 'Crear Proyecto',
    nameLabel: 'Nombre',
    namePlaceholder: 'ej. Respuesta a Incidentes Producción',
    descLabel: 'Descripción',
    descPlaceholder: '¿Para qué es este proyecto?',
    shellDirLabel: 'Directorio de Shell Permitido',
    shellDirPlaceholder: '/opt/scripts (opcional)',
    shellDirHint: 'Si se establece, los pasos shell en este proyecto solo podrán acceder a este directorio.',
    cancel: 'Cancelar',
    create: 'Crear',
    creating: 'Creando…',
  },
} as const;

const ROLE_BADGE: Record<string, string> = {
  VIEWER: 'bg-gray-600/20 text-gray-400',
  EXECUTOR: 'bg-blue-600/20 text-blue-400',
  EDITOR: 'bg-green-600/20 text-green-400',
  ADMIN: 'bg-purple-600/20 text-purple-400',
  OWNER: 'bg-amber-600/20 text-amber-400',
};

interface ProjectsPageProps {
  lang: 'en' | 'es';
}

export default function ProjectsPage({ lang }: ProjectsPageProps) {
  const t = STRINGS[lang];
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProjects(json.projects ?? json ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!projects) return null;
    if (!search) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const handleCreated = () => {
    setShowCreate(false);
    load();
  };

  return (
    <div className="marketing-shell flex-1 overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="m-eyebrow mb-2">Organize</div>
            <h1 className="text-5xl font-black tracking-tighter text-[var(--text-primary)]">
              {t.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-medium leading-relaxed text-[var(--text-muted)]">
              {t.subtitle}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent-color)] px-6 py-3 text-sm font-black text-black shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <Plus size={18} strokeWidth={3} />
            {t.newProject}
          </button>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
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
        </div>

        {error && (
          <div className="border-[var(--op-sunset)]/20 bg-[var(--op-sunset)]/5 mb-6 rounded-xl border p-4 text-sm font-bold text-[var(--op-sunset)]">
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
            icon={FolderKanban}
            title={t.empty}
            body={t.emptyHint}
            primaryLabel={t.newProject}
            primaryAction={() => setShowCreate(true)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(project => (
              <div
                key={project.id}
                onClick={() => router.push(`/${lang}/projects/${project.id}`)}
                className="hover:border-[var(--accent-color)]/30 group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 transition-all hover:scale-[1.02] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]"
              >
                <div className="bg-[var(--accent-color)]/5 group-hover:bg-[var(--accent-color)]/10 absolute right-0 top-0 h-24 w-24 translate-x-12 translate-y-[-12px] rounded-full blur-2xl transition-all" />

                <div className="relative mb-4 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xl font-black tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-color)]">
                      {project.name}
                    </h3>
                  </div>
                  {project.role && (
                    <span
                      className={`ml-2 shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${ROLE_BADGE[project.role] ?? ROLE_BADGE.VIEWER}`}
                    >
                      {project.role}
                    </span>
                  )}
                </div>

                {project.description && (
                  <p className="relative mb-6 line-clamp-2 min-h-[3em] text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                    {project.description}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-4 border-t border-[var(--panel-border)] pt-4 text-xs font-black text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <Users size={14} />
                    {project._count?.members ?? project.memberCount ?? 0} {t.members}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Share2 size={14} />
                    {project._count?.runbooks ?? project.runbookCount ?? 0} {t.runbooks}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateProjectModal lang={lang} t={t} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateProjectModal({
  lang,
  t,
  onClose,
  onCreated,
}: {
  lang: 'en' | 'es';
  t: (typeof STRINGS)[keyof typeof STRINGS];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shellDir, setShellDir] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = { name: name.trim() };
      if (description.trim()) body.description = description.trim();
      if (shellDir.trim()) body.allowedShellDirectory = shellDir.trim();

      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-lg rounded-2xl border border-[var(--panel-border)] bg-[var(--app-bg)] p-8 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              {t.createTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[var(--panel-elevated)] p-2 text-[var(--text-muted)] transition-all hover:text-[var(--text-primary)]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="border-[var(--op-sunset)]/20 bg-[var(--op-sunset)]/5 mb-4 rounded-xl border p-3 text-sm font-bold text-[var(--op-sunset)]">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t.nameLabel}
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              required
              className="focus:border-[var(--accent-color)]/50 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t.descLabel}
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t.descPlaceholder}
              rows={3}
              className="focus:border-[var(--accent-color)]/50 w-full resize-none rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all focus:outline-none"
            />
          </div>

          <div className="mb-6">
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t.shellDirLabel}
            </label>
            <input
              value={shellDir}
              onChange={e => setShellDir(e.target.value)}
              placeholder={t.shellDirPlaceholder}
              className="focus:border-[var(--accent-color)]/50 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all focus:outline-none"
            />
            <p className="mt-1 text-[11px] font-medium text-[var(--text-muted)] opacity-60">
              {t.shellDirHint}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-[var(--text-muted)] transition-all hover:bg-[var(--panel-elevated)] hover:text-[var(--text-primary)]"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="rounded-xl bg-[var(--accent-color)] px-6 py-2.5 text-sm font-black text-black shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? t.creating : t.create}
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}