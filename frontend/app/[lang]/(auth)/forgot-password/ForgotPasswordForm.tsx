'use client';

import Link from 'next/link';
import { useState } from 'react';

import { authClient, AuthError } from '@/lib/auth';

import { AuthField } from '../_components/AuthField';
import { type AuthLang, resetStrings } from '../strings';

export function ForgotPasswordForm({ lang }: { lang: AuthLang }) {
  const t = resetStrings[lang].forgot;
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await authClient.forgotPassword(email);
      setSent(true);
    } catch (err) {
      if (err instanceof AuthError && err.status >= 500) {
        setError(t.networkError);
      } else {
        // Backend always 204s; any client-side error is a network failure.
        setError(t.networkError);
      }
    } finally {
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

      {sent ? (
        <div className="border-primary/30 bg-primary/10 text-foreground mt-6 rounded-lg border px-4 py-3 text-sm">
          {t.sent}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <AuthField
            label={t.email}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={setEmail}
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
      )}

      <div className="border-border/40 mt-6 border-t pt-6 text-sm">
        <Link
          href={`/${lang}/login`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {t.back}
        </Link>
      </div>
    </div>
  );
}
