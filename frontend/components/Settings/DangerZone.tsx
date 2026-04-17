'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const STRINGS = {
    en: {
        title: 'Delete account',
        hint: 'Permanent purge of your user, your workspace, and every runbook / execution tied to them.',
        cta: 'Delete account…',
        confirmTitle: 'This cannot be undone',
        confirmBody:
            "Your user, this workspace, and every runbook, execution, webhook, and audit tombstone attached will be deleted. Type DELETE and reconfirm your password to continue.",
        typeLabel: 'Type DELETE to confirm',
        typeValue: 'DELETE',
        passwordLabel: 'Password',
        totpLabel: 'MFA code (if enabled)',
        tenantLabel: 'Also delete my workspace (required — you are the only member)',
        cancel: 'Cancel',
        submit: 'Delete my account forever',
        deleting: 'Deleting…',
        teamMembers: "You still share a workspace with other people. Transfer your admin role first, then delete.",
        badPassword: 'Password or MFA code did not match.',
        mfaNeeded: 'MFA code required.',
        unknown: 'Could not complete the deletion. Try again in a moment.',
    },
    es: {
        title: 'Eliminar cuenta',
        hint: 'Purga permanente de tu usuario, tu workspace, y cada runbook / ejecución asociada.',
        cta: 'Eliminar cuenta…',
        confirmTitle: 'Esto no se puede deshacer',
        confirmBody:
            'Tu usuario, este workspace y cada runbook, ejecución, webhook y tombstone de auditoría asociado se eliminarán. Escribí DELETE y reconfirmá tu contraseña para continuar.',
        typeLabel: 'Escribí DELETE para confirmar',
        typeValue: 'DELETE',
        passwordLabel: 'Contraseña',
        totpLabel: 'Código MFA (si está habilitado)',
        tenantLabel: 'Eliminar también mi workspace (requerido — sos el único miembro)',
        cancel: 'Cancelar',
        submit: 'Eliminar mi cuenta para siempre',
        deleting: 'Eliminando…',
        teamMembers: 'Compartís el workspace con más personas. Transferí tu rol de admin y eliminá después.',
        badPassword: 'La contraseña o el código MFA no coinciden.',
        mfaNeeded: 'Falta el código MFA.',
        unknown: 'No se pudo completar la eliminación. Probá en un momento.',
    },
} as const;

/**
 * GDPR "delete my account" card. Red-outlined, lives at the very
 * bottom of Settings so a casual scroll never lands on it. The
 * primary button opens a double-confirm modal that requires:
 *   - typing DELETE literally
 *   - the account password
 *   - a TOTP code if the user enrolled MFA
 *   - an explicit "yes, also burn the workspace" checkbox
 *
 * On success the server has already cleared the session cookie,
 * so we just force a hard redirect to `/` and let the auth guard
 * route the (now-anonymous) visitor home.
 */
export function DangerZone({ lang }: { lang: 'en' | 'es' }) {
    const t = STRINGS[lang];
    const [open, setOpen] = useState(false);

    return (
        <>
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
                <div className="flex items-start gap-3">
                    <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-semibold text-destructive">{t.title}</div>
                        <p className="mt-1 text-xs leading-relaxed text-destructive/85">{t.hint}</p>
                    </div>
                    <button
                        onClick={() => setOpen(true)}
                        className="rounded-md border border-destructive/50 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        {t.cta}
                    </button>
                </div>
            </div>
            {open && <DeleteModal t={t} onClose={() => setOpen(false)} />}
        </>
    );
}

function DeleteModal({
    t,
    onClose,
}: {
    t: typeof STRINGS['en'] | typeof STRINGS['es'];
    onClose: () => void;
}) {
    const [typed, setTyped] = useState('');
    const [password, setPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [deleteTenant, setDeleteTenant] = useState(false);
    const [state, setState] = useState<'idle' | 'submitting'>('idle');
    const [error, setError] = useState<string | null>(null);

    const typedOk = typed === t.typeValue;
    const canSubmit = typedOk && password.length > 0 && deleteTenant && state === 'idle';

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        setState('submitting');
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/auth/account`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password,
                    totpCode: totpCode || undefined,
                    deleteTenant,
                }),
            });
            if (res.ok) {
                window.location.replace('/');
                return;
            }
            const body = (await res.json().catch(() => ({}))) as {
                code?: string;
                error?: string;
            };
            switch (body.code) {
                case 'tenant_has_other_members':
                    setError(t.teamMembers);
                    break;
                case 'mfa_required':
                    setError(t.mfaNeeded);
                    break;
                case 'mfa_invalid':
                case 'invalid_credentials':
                    setError(t.badPassword);
                    break;
                default:
                    setError(body.error ?? t.unknown);
            }
        } catch {
            setError(t.unknown);
        } finally {
            setState('idle');
        }
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
            <form
                onSubmit={submit}
                className="relative w-full max-w-md rounded-2xl border border-destructive/50 bg-[var(--panel-bg)] p-6 shadow-2xl"
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-destructive/40 bg-destructive/15 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                </div>

                <h2 className="text-lg font-bold text-[var(--text-primary)]">{t.confirmTitle}</h2>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    {t.confirmBody}
                </p>

                <div className="mt-5 space-y-3">
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {t.typeLabel}
                        </label>
                        <input
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            autoComplete="off"
                            className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-black/20 px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:border-destructive focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {t.passwordLabel}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-black/20 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-destructive focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {t.totpLabel}
                        </label>
                        <input
                            inputMode="numeric"
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value.replace(/\s+/g, ''))}
                            autoComplete="one-time-code"
                            className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-black/20 px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:border-destructive focus:outline-none"
                        />
                    </div>

                    <label className="flex items-start gap-2 text-xs text-[var(--text-primary)]">
                        <input
                            type="checkbox"
                            checked={deleteTenant}
                            onChange={(e) => setDeleteTenant(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5"
                        />
                        <span>{t.tenantLabel}</span>
                    </label>
                </div>

                {error && (
                    <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {error}
                    </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-white/5"
                    >
                        {t.cancel}
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground shadow-md shadow-destructive/20 hover:bg-destructive/90 disabled:opacity-50"
                    >
                        {state === 'submitting' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {state === 'submitting' ? t.deleting : t.submit}
                    </button>
                </div>
            </form>
        </div>
    );
}
