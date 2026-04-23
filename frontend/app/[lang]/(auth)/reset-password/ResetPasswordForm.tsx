'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { authClient, AuthError, useAuth } from '@/lib/auth';

import { AuthField } from '../_components/AuthField';
import { type AuthLang, resetStrings } from '../strings';

export function ResetPasswordForm({ lang }: { lang: AuthLang }) {
  const t = resetStrings[lang].reset;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="border-border/60 bg-card/40 rounded-2xl border p-6 sm:p-8">
        <h1 className="text-foreground text-xl font-bold">{t.eyebrow}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t.missingToken}</p>
        <Link
          href={`/${lang}/forgot-password`}
          className="text-primary hover:text-primary/90 mt-4 inline-block text-sm"
        >
          {t.requestNew}
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (password.length < 8) {
      setError(t.tooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }
    setSubmitting(true);
    try {
      await authClient.resetPassword(token!, password);
      await refresh();
      router.replace(`/${lang}/dashboard`);
    } catch (err) {
      if (err instanceof AuthError && err.status === 400) {
        setError(t.invalid);
      } else {
        setError(t.networkError);
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="border-border/60 bg-card/40 rounded-2xl border p-6 shadow-xl shadow-black/10 sm:p-8">
      <div className="border-border/40 mb-6 flex items-center gap-1.5 border-b pb-4">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
        <div className="bg-primary/60 h-2.5 w-2.5 rounded-full" />
        <span className="text-muted-foreground ml-3 font-mono text-[11px]">{t.eyebrow}</span>
      </div>

      <h1 className="text-foreground text-3xl font-bold leading-tight tracking-tight">{t.title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t.subtitle}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <AuthField
          label={t.password}
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
        />
        <AuthField
          label={t.confirm}
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={setConfirm}
        />
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
