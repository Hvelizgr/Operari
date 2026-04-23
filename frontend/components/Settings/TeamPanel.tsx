'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { MfaPolicyCard } from './MfaPolicyCard';
import { AuditExportCard } from './AuditExportCard';

const STRINGS = {
  en: {
    membersTitle: 'Members',
    membersEmpty: 'Just you so far — invite someone below.',
    memberRemove: 'Remove',
    memberRemoving: 'Removing…',
    memberYou: 'you',
    roleFailed: 'Could not change the role. Try again.',
    removeFailed: 'Could not remove the member. Try again.',
    hint: 'Invite teammates to share this workspace. They get a single-use link valid for 7 days.',
    inviteEmail: 'Email',
    inviteRole: 'Role',
    roleUser: 'Member',
    roleAdmin: 'Admin',
    inviteCta: 'Send invite',
    sending: 'Sending…',
    empty: 'No invites yet. Send one above.',
    revoke: 'Revoke',
    revoking: 'Revoking…',
    pending: 'pending',
    accepted: 'accepted',
    revoked: 'revoked',
    expired: 'expired',
    failed: 'Could not send the invite. Try again.',
    dupErr: 'This user is already a member.',
  },
  es: {
    membersTitle: 'Miembros',
    membersEmpty: 'Por ahora sos vos — invitá a alguien abajo.',
    memberRemove: 'Quitar',
    memberRemoving: 'Quitando…',
    memberYou: 'vos',
    roleFailed: 'No se pudo cambiar el rol. Probá de nuevo.',
    removeFailed: 'No se pudo quitar al miembro. Probá de nuevo.',
    hint: 'Invitá a tu equipo a compartir este workspace. Reciben un link de un solo uso válido por 7 días.',
    inviteEmail: 'Email',
    inviteRole: 'Rol',
    roleUser: 'Miembro',
    roleAdmin: 'Admin',
    inviteCta: 'Enviar invitación',
    sending: 'Enviando…',
    empty: 'Sin invitaciones aún. Mandá una arriba.',
    revoke: 'Revocar',
    revoking: 'Revocando…',
    pending: 'pendiente',
    accepted: 'aceptada',
    revoked: 'revocada',
    expired: 'expirada',
    failed: 'No se pudo mandar la invitación. Reintentá.',
    dupErr: 'Ese usuario ya está en el tenant.',
  },
} as const;

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'USER';
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
}

function statusOf(invite: Invite): 'pending' | 'accepted' | 'revoked' | 'expired' {
  if (invite.acceptedAt) return 'accepted';
  if (invite.revokedAt) return 'revoked';
  if (new Date(invite.expiresAt) < new Date()) return 'expired';
  return 'pending';
}

export function TeamPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const { session } = useAuth();

  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [viewerRole, setViewerRole] = useState<'ADMIN' | 'USER' | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [sending, setSending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [invitesRes, membersRes] = await Promise.all([
      fetch('/api/invites', { credentials: 'include' }),
      fetch('/api/tenants/members', { credentials: 'include' }),
    ]);
    if (invitesRes.ok) {
      const body = await invitesRes.json();
      setInvites(body.data ?? []);
    }
    if (membersRes.ok) {
      const body = await membersRes.json();
      setMembers(body.data ?? []);
      setViewerRole(body.viewerRole ?? null);
      setViewerId(body.viewerId ?? null);
    }
  }

  async function onRoleChange(memberId: string, newRole: 'USER' | 'ADMIN') {
    setError(null);
    try {
      const res = await fetch(`/api/tenants/members/${encodeURIComponent(memberId)}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error(`role change failed: ${res.status}`);
      await refresh();
    } catch {
      setError(t.roleFailed);
    }
  }

  async function onRemoveMember(memberId: string) {
    if (removingId) return;
    setError(null);
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/tenants/members/${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok && res.status !== 204) {
        setError(t.removeFailed);
        return;
      }
      await refresh();
    } finally {
      setRemovingId(null);
    }
  }

  useEffect(() => {
    if (!session) return;
    refresh().catch(() => undefined);
  }, [session]);

  async function onSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (res.status === 409) {
        setError(t.dupErr);
        return;
      }
      if (!res.ok) throw new Error(`invite failed: ${res.status}`);
      setEmail('');
      await refresh();
    } catch {
      setError(t.failed);
    } finally {
      setSending(false);
    }
  }

  async function onRevoke(id: string) {
    if (revokingId) return;
    setRevokingId(id);
    try {
      await fetch(`/api/invites/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await refresh();
    } finally {
      setRevokingId(null);
    }
  }

  if (!session || session.user.id === 'anonymous') return null;

  const canManage = viewerRole === 'ADMIN';

  const unenrolledCount = members === null ? undefined : members.filter(m => !m.mfaEnabled).length;

  return (
    <div className="space-y-6">
      {/* Tenant MFA policy — admin-only write, everyone reads.
                Placed above the member list so the "N members still
                need MFA" warning sits next to the people it names. */}
      <MfaPolicyCard lang={lang} viewerRole={viewerRole} unenrolledCount={unenrolledCount} />

      {/* Audit export — BUSINESS+ gated, admin-only. Hidden
                entirely for non-admins (the route enforces too but
                the card has nothing to offer them). */}
      <AuditExportCard
        lang={lang}
        viewerRole={viewerRole}
        tenantPlan={
          (session?.tenant.plan ?? null) as
            | 'FREE'
            | 'TEAM'
            | 'PRO'
            | 'BUSINESS'
            | 'ENTERPRISE'
            | null
        }
      />

      {/* Members list — added after UX audit flagged that
                inviting without being able to see/remove existing
                users made the TEAM tier vaporware. */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t.membersTitle}
        </h4>
        {members === null ? null : members.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)]">
            {t.membersEmpty}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-color)] rounded-lg border border-[var(--border-color)]">
            {members.map(m => {
              const isSelf = m.id === viewerId;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[var(--text-primary)]">
                      {m.name || m.email}
                      {isSelf && (
                        <span className="ml-2 text-[11px] text-[var(--text-muted)]">
                          ({t.memberYou})
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && !isSelf ? (
                      <select
                        value={m.role}
                        onChange={e => onRoleChange(m.id, e.target.value as 'USER' | 'ADMIN')}
                        className="focus:border-primary rounded-md border border-[var(--border-color)] bg-transparent px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                      >
                        <option value="USER">{t.roleUser}</option>
                        <option value="ADMIN">{t.roleAdmin}</option>
                      </select>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {m.role.toLowerCase()}
                      </span>
                    )}
                    {canManage && !isSelf && (
                      <button
                        onClick={() => onRemoveMember(m.id)}
                        disabled={removingId === m.id}
                        className="hover:text-destructive hover:border-destructive/50 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-muted)] disabled:opacity-60"
                      >
                        {removingId === m.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        {removingId === m.id ? t.memberRemoving : t.memberRemove}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)]">{t.hint}</p>

      <form onSubmit={onSend} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[240px] flex-1">
          <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
            {t.inviteEmail}
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="placeholder-[var(--text-muted)]/60 focus:border-primary w-full rounded-md border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
          />
        </label>
        <label>
          <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
            {t.inviteRole}
          </span>
          <select
            value={role}
            onChange={e => setRole(e.target.value as 'USER' | 'ADMIN')}
            className="focus:border-primary rounded-md border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
          >
            <option value="USER">{t.roleUser}</option>
            <option value="ADMIN">{t.roleAdmin}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={sending || !email}
          className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? t.sending : t.inviteCta}
        </button>
      </form>

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {invites === null ? null : invites.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)]">
          {t.empty}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border-color)] rounded-lg border border-[var(--border-color)]">
          {invites.map(invite => {
            const status = statusOf(invite);
            return (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserPlus className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <div className="min-w-0">
                    <div className="truncate text-[var(--text-primary)]">{invite.email}</div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">
                      {invite.role.toLowerCase()} · {t[status]}
                    </div>
                  </div>
                </div>
                {status === 'pending' && (
                  <button
                    onClick={() => onRevoke(invite.id)}
                    disabled={revokingId === invite.id}
                    className="hover:text-destructive hover:border-destructive/50 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-muted)] disabled:opacity-60"
                  >
                    {revokingId === invite.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    {revokingId === invite.id ? t.revoking : t.revoke}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
