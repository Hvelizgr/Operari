'use client';

import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface MfaPolicyCardProps {
  lang: 'en' | 'es';
  viewerRole: 'ADMIN' | 'USER' | null;
  /** Count of members on this tenant who have not enrolled TOTP.
   *  Passed in from TeamPanel so the card doesn't re-fetch the
   *  member list just to render the "4 members still need MFA"
   *  warning. Undefined means "unknown yet" — we hide the warning
   *  rather than render a false zero. */
  unenrolledCount?: number;
}

const STRINGS = {
  en: {
    title: 'Require MFA for everyone',
    hint: 'Every member must have TOTP enrolled. Users without MFA will be routed to the enrollment page at next login.',
    on: 'On',
    off: 'Off',
    enable: 'Enable',
    disable: 'Disable',
    saving: 'Saving…',
    ownMfaMissing:
      'Enroll your own MFA first — otherwise you would be locked out of the policy you just set.',
    viewerReadonly: 'Only admins can change this.',
    unenrolledWarning: (n: number) =>
      `${n} member${n === 1 ? '' : 's'} ${n === 1 ? 'has' : 'have'} not enrolled yet. They will be forced to enroll at their next login.`,
    failed: 'Could not update the security policy.',
  },
  es: {
    title: 'Exigir MFA para todos',
    hint: 'Todos los miembros deben tener TOTP enrolado. Los que no lo tengan serán redirigidos a la pantalla de enrolamiento en su próximo login.',
    on: 'Activo',
    off: 'Inactivo',
    enable: 'Activar',
    disable: 'Desactivar',
    saving: 'Guardando…',
    ownMfaMissing:
      'Enrolá tu propio MFA primero — si no, te quedás afuera por la política que acabás de activar.',
    viewerReadonly: 'Solo los admins pueden cambiarlo.',
    unenrolledWarning: (n: number) =>
      `${n} miembro${n === 1 ? '' : 's'} todavía no enroló. Serán redirigidos al enrolamiento en su próximo login.`,
    failed: 'No se pudo actualizar la política de seguridad.',
  },
} as const;

/**
 * Tenant-wide MFA requirement toggle. Admin-only write; every member
 * sees the current state so the UI can explain "your admin requires
 * MFA" without a separate banner. The toggle fails fast (client-side)
 * if the viewer is not an admin.
 *
 * The self-lockout guard lives on the backend — PATCH returns 409
 * with `code: 'admin_mfa_required'` when the viewer would trap
 * themselves by enabling the policy without their own TOTP. We map
 * that response to a clear inline message so the fix is discoverable.
 */
export function MfaPolicyCard({ lang, viewerRole, unenrolledCount }: MfaPolicyCardProps) {
  const t = STRINGS[lang];
  const { session } = useAuth();
  const [mfaRequired, setMfaRequired] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tenants/security`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { mfaRequired?: boolean } };
      setMfaRequired(!!json.data?.mfaRequired);
    } catch {
      /* keep the previous state on a transient failure */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const viewerIsAdmin = viewerRole === 'ADMIN';
  const viewerOwnMfa = session?.user.mfaEnabled === true;

  async function toggle() {
    if (!viewerIsAdmin || saving || mfaRequired === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/tenants/security`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaRequired: !mfaRequired }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        if (body.code === 'admin_mfa_required') setError(t.ownMfaMissing);
        else setError(t.failed);
        return;
      }
      const json = (await res.json()) as { data?: { mfaRequired?: boolean } };
      setMfaRequired(!!json.data?.mfaRequired);
    } catch {
      setError(t.failed);
    } finally {
      setSaving(false);
    }
  }

  if (mfaRequired === null) return null;

  const blockEnable = !viewerOwnMfa && !mfaRequired;
  const showUnenrolledWarning =
    mfaRequired === true && typeof unenrolledCount === 'number' && unenrolledCount > 0;

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              mfaRequired
                ? 'bg-primary/15 border-primary/40 text-primary border'
                : 'bg-[var(--weathered,#262626)] text-[var(--text-muted)]'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{t.title}</div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--text-muted)]">
              {t.hint}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              mfaRequired ? 'text-primary' : 'text-[var(--text-muted)]'
            }`}
          >
            {mfaRequired ? t.on : t.off}
          </span>
          <button
            onClick={toggle}
            disabled={!viewerIsAdmin || saving || blockEnable}
            title={!viewerIsAdmin ? t.viewerReadonly : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mfaRequired
                ? 'border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-white/5'
                : 'bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 shadow-md'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saving ? t.saving : mfaRequired ? t.disable : t.enable}
          </button>
        </div>
      </div>

      {showUnenrolledWarning && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t.unenrolledWarning(unenrolledCount!)}</span>
        </div>
      )}
      {viewerIsAdmin && blockEnable && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-xs">
          {t.ownMfaMissing}
        </div>
      )}
      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
