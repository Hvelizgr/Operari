'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  FolderKanban,
  Plus,
  Share2,
  Terminal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface ProjectRunbook {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  isActive: boolean;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  allowedShellDirectory: string | null;
  createdAt: string;
  updatedAt: string;
  members?: Member[];
  runbooks?: ProjectRunbook[];
}

const ROLES = ['VIEWER', 'EXECUTOR', 'EDITOR', 'ADMIN'] as const;

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  VIEWER: { bg: 'bg-gray-600/20', text: 'text-gray-400' },
  EXECUTOR: { bg: 'bg-blue-600/20', text: 'text-blue-400' },
  EDITOR: { bg: 'bg-green-600/20', text: 'text-green-400' },
  ADMIN: { bg: 'bg-purple-600/20', text: 'text-purple-400' },
  OWNER: { bg: 'bg-amber-600/20', text: 'text-amber-400' },
};

const STRINGS = {
  en: {
    back: 'Back to Projects',
    members: 'Members',
    runbooks: 'Associated Runbooks',
    addMember: 'Add Member',
    noMembers: 'No members yet.',
    noRunbooks: 'No runbooks associated with this project.',
    shellDir: 'Allowed Shell Directory',
    noShellDir: 'No restriction set',
    loading: 'Loading project…',
    loadError: 'Failed to load project.',
    emailLabel: 'User Email',
    emailPlaceholder: 'user@example.com',
    roleLabel: 'Role',
    cancel: 'Cancel',
    add: 'Add',
    adding: 'Adding…',
    removeMember: 'Remove member',
    confirmRemove: 'Remove this member from the project?',
    createdAt: 'Created',
    updatedAt: 'Last updated',
    viewRunbook: 'Open in editor',
  },
  es: {
    back: 'Volver a Proyectos',
    members: 'Miembros',
    runbooks: 'Runbooks Asociados',
    addMember: 'Agregar Miembro',
    noMembers: 'Sin miembros aún.',
    noRunbooks: 'No hay runbooks asociados a este proyecto.',
    shellDir: 'Directorio de Shell Permitido',
    noShellDir: 'Sin restricción establecida',
    loading: 'Cargando proyecto…',
    loadError: 'Error al cargar el proyecto.',
    emailLabel: 'Email del usuario',
    emailPlaceholder: 'usuario@ejemplo.com',
    roleLabel: 'Rol',
    cancel: 'Cancelar',
    add: 'Agregar',
    adding: 'Agregando…',
    removeMember: 'Eliminar miembro',
    confirmRemove: '¿Eliminar a este miembro del proyecto?',
    createdAt: 'Creado',
    updatedAt: 'Última actualización',
    viewRunbook: 'Abrir en editor',
  },
} as const;

interface ProjectDetailPageProps {
  lang: 'en' | 'es';
  projectId: string;
}

export default function ProjectDetailPage({ lang, projectId }: ProjectDetailPageProps) {
  const t = STRINGS[lang];
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProject(json.project ?? json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      load();
    } catch {
      /* noop */
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm(t.confirmRemove)) return;
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      load();
    } catch {
      /* noop */
    }
  };

  const handleMemberAdded = () => {
    setShowAddMember(false);
    load();
  };

  if (error) {
    return (
      <div className="marketing-shell flex-1 overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="border-[var(--op-sunset)]/20 bg-[var(--op-sunset)]/5 rounded-xl border p-4 text-sm font-bold text-[var(--op-sunset)]">
            {t.loadError} · {error}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="marketing-shell flex-1 overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)]">
        <div className="flex h-64 items-center justify-center text-sm font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-2 w-12 animate-pulse rounded-full bg-[var(--accent-color)]" />
            {t.loading}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-shell flex-1 overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Back link */}
        <button
          onClick={() => router.push(`/${lang}/projects`)}
          className="mb-8 flex items-center gap-2 text-sm font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--accent-color)]"
        >
          <ArrowLeft size={16} />
          {t.back}
        </button>

        {/* Project header */}
        <div className="mb-10">
          <div className="mb-2 flex items-center gap-3">
            <div className="bg-[var(--accent-color)]/10 flex h-12 w-12 items-center justify-center rounded-xl text-[var(--accent-color)]">
              <FolderKanban size={24} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-[var(--text-primary)]">
              {project.name}
            </h1>
          </div>
          {project.description && (
            <p className="mt-3 max-w-2xl text-lg font-medium leading-relaxed text-[var(--text-muted)]">
              {project.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-6 text-xs font-bold text-[var(--text-muted)]">
            <span>{t.createdAt}: {new Date(project.createdAt).toLocaleDateString(lang)}</span>
            <span>{t.updatedAt}: {new Date(project.updatedAt).toLocaleDateString(lang)}</span>
          </div>
        </div>

        {/* Shell directory */}
        <div className="mb-10 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
            <Terminal size={14} />
            {t.shellDir}
          </div>
          <code className="text-sm font-bold text-[var(--text-primary)]">
            {project.allowedShellDirectory || t.noShellDir}
          </code>
        </div>

        {/* Members section */}
        <div className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-[var(--text-primary)]">
              <Users size={22} />
              {t.members}
            </h2>
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-2 rounded-xl bg-[var(--accent-color)] px-4 py-2 text-sm font-black text-black shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={16} strokeWidth={3} />
              {t.addMember}
            </button>
          </div>

          {(!project.members || project.members.length === 0) ? (
            <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[rgba(255,255,255,0.02)] p-8 text-center text-sm font-medium text-[var(--text-muted)]">
              {t.noMembers}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
              {project.members.map((member, idx) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between px-5 py-4 ${idx > 0 ? 'border-t border-[var(--panel-border)]' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-[var(--text-primary)]">
                      {member.user.name || member.user.email.split('@')[0]}
                    </div>
                    <div className="truncate text-xs font-medium text-[var(--text-muted)]">
                      {member.user.email}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value)}
                        className={`appearance-none rounded-lg border-0 px-3 py-1.5 pr-8 text-[11px] font-black uppercase tracking-widest ${ROLE_BADGE[member.role]?.bg ?? 'bg-gray-600/20'} ${ROLE_BADGE[member.role]?.text ?? 'text-gray-400'} cursor-pointer bg-none focus:outline-none`}
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")",
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.5rem center',
                          backgroundSize: '0.75rem',
                        }}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="hover:bg-[var(--op-sunset)]/10 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all hover:text-[var(--op-sunset)]"
                      aria-label={t.removeMember}
                      title={t.removeMember}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Runbooks section */}
        <div className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black tracking-tight text-[var(--text-primary)]">
            <Share2 size={22} />
            {t.runbooks}
          </h2>

          {(!project.runbooks || project.runbooks.length === 0) ? (
            <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[rgba(255,255,255,0.02)] p-8 text-center text-sm font-medium text-[var(--text-muted)]">
              {t.noRunbooks}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {project.runbooks.map(rb => (
                <div
                  key={rb.id}
                  onClick={() => router.push(`/${lang}/editor?id=${rb.id}`)}
                  className="hover:border-[var(--accent-color)]/30 group cursor-pointer rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 transition-all hover:scale-[1.01]"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${rb.isActive ? 'bg-[var(--op-moss)] shadow-[0_0_8px_var(--op-moss)]' : 'bg-gray-600'}`}
                    />
                    <h4 className="truncate text-sm font-black text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-color)]">
                      {rb.name}
                    </h4>
                  </div>
                  {rb.description && (
                    <p className="line-clamp-2 text-xs font-medium text-[var(--text-muted)]">
                      {rb.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddMember && (
          <AddMemberModal
            lang={lang}
            t={t}
            projectId={projectId}
            onClose={() => setShowAddMember(false)}
            onAdded={handleMemberAdded}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddMemberModal({
  lang,
  t,
  projectId,
  onClose,
  onAdded,
}: {
  lang: 'en' | 'es';
  t: (typeof STRINGS)[keyof typeof STRINGS];
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('VIEWER');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onAdded();
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
          className="w-full max-w-md rounded-2xl border border-[var(--panel-border)] bg-[var(--app-bg)] p-8 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              {t.addMember}
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
              {t.emailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              required
              className="focus:border-[var(--accent-color)]/50 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all focus:outline-none"
            />
          </div>

          <div className="mb-6">
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t.roleLabel}
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="focus:border-[var(--accent-color)]/50 w-full appearance-none rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] transition-all focus:outline-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                backgroundSize: '1rem',
              }}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
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
              disabled={!email.trim() || submitting}
              className="rounded-xl bg-[var(--accent-color)] px-6 py-2.5 text-sm font-black text-black shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? t.adding : t.add}
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}