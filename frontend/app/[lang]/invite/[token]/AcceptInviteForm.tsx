'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AuthError } from '@/lib/auth';

interface InviteMeta {
  email: string;
  role: string;
  tenantName: string;
  invitedBy: string | null;
  expiresAt: string;
}

const STRINGS = {
  en: {
    titleLoading: 'Checking invite…',
    titleGone: 'This invite is no longer valid.',
    bodyGone:
      'The link may have expired, been revoked, or already been used. Ask whoever invited you to send a new one.',
    titleOk: (tenantName: string) => `Join ${tenantName}`,
    bodyOk: (inviter: string | null, email: string) =>
      inviter
        ? `${inviter} invited ${email} to join their Cairn workspace.`
        : `You were invited to join a Cairn workspace as ${email}.`,
    passwordLabel: 'Set a password',
    passwordHint: 'At least 8 characters.',
    nameLabel: 'Your name (optional)',
    submit: 'Accept & join',
    submitting: 'Joining…',
    networkError: 'Could not reach the server. Try again in a moment.',
    alreadyUser:
      'A user with this email already exists — sign in first and ask the inviter to link the account manually.',
    signIn: 'Sign in',
    goHome: 'Back to home',
  },
  es: {
    titleLoading: 'Verificando invitación…',
    titleGone: 'Esta invitación ya no es válida.',
    bodyGone:
      'Puede haber expirado, sido revocada, o ya fue usada. Pedile a quien te invitó que mande una nueva.',
    titleOk: (tenantName: string) => `Unite a ${tenantName}`,
    bodyOk: (inviter: string | null, email: string) =>
      inviter
        ? `${inviter} invitó a ${email} a su workspace de Cairn.`
        : `Te invitaron a un workspace de Cairn como ${email}.`,
    passwordLabel: 'Elegí una contraseña',
    passwordHint: 'Mínimo 8 caracteres.',
    nameLabel: 'Tu nombre (opcional)',
    submit: 'Aceptar y unirme',
    submitting: 'Uniéndome…',
    networkError: 'No se pudo contactar al servidor. Probá de nuevo.',
    alreadyUser:
      'Ya existe un usuario con ese email — iniciá sesión y pedile al admin que te linkee manualmente.',
    signIn: 'Iniciar sesión',
    goHome: 'Volver al inicio',
  },
} as const;

export function AcceptInviteForm({ token, lang }: { token: string; lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const router = useRouter();

  const [meta, setMeta] = useState<InviteMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [gone, setGone] = useState(false);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invites/lookup/${encodeURIComponent(token)}`)
      .then(async res => {
        if (res.ok) {
          const body = await res.json();
          setMeta(body.data);
          return;
        }
        if (res.status === 410 || res.status === 404) {
          setGone(true);
          return;
        }
        setError(t.networkError);
      })
      .catch(() => setError(t.networkError))
      .finally(() => setLoading(false));
  }, [token, t.networkError]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, name: name || undefined }),
      });
      if (res.status === 409) {
        setError(t.alreadyUser);
        setSubmitting(false);
        return;
      }
      if (res.status === 410 || res.status === 404) {
        setGone(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(`accept failed: ${res.status}`);
      router.replace(`/${lang}/dashboard`);
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError(t.networkError);
      }
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="border-border/60 bg-card/40 rounded-2xl border p-6 sm:p-8">
        <p className="text-muted-foreground text-sm">{t.titleLoading}</p>
      </div>
    );
  }

  if (gone || !meta) {
    return (
      <div className="border-border/60 bg-card/40 rounded-2xl border p-6 sm:p-8">
        <h1 className="text-foreground text-2xl font-bold">{t.titleGone}</h1>
        <p className="text-muted-foreground mt-3 text-sm">{t.bodyGone}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          <Link
            href={`/${lang}/login`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition-colors"
          >
            {t.signIn}
          </Link>
          <Link
            href={`/${lang}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {t.goHome}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border/60 bg-card/40 rounded-2xl border p-6 shadow-xl shadow-black/10 sm:p-8">
      <h1 className="text-foreground text-3xl font-bold leading-tight tracking-tight">
        {t.titleOk(meta.tenantName)}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm">{t.bodyOk(meta.invitedBy, meta.email)}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <label className="block">
          <span className="text-muted-foreground mb-1.5 block font-mono text-[11px] uppercase tracking-widest">
            {t.nameLabel}
          </span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-background/60 border-border/70 text-foreground focus:border-primary/60 focus:ring-primary/20 w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground mb-1.5 block font-mono text-[11px] uppercase tracking-widest">
            {t.passwordLabel}
          </span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="bg-background/60 border-border/70 text-foreground focus:border-primary/60 focus:ring-primary/20 w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
          />
          <span className="text-muted-foreground/80 mt-1.5 block text-[11px]">
            {t.passwordHint}
          </span>
        </label>

        {error && (
          <div
            role="alert"
            className="text-destructive bg-destructive/10 border-destructive/30 rounded-md border px-3 py-2 text-xs"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 h-11 w-full rounded-lg text-sm font-semibold shadow-md transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
