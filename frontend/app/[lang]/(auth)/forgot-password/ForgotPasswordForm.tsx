'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthError, authClient } from '@/lib/auth';
import { AuthField } from '../_components/AuthField';
import { resetStrings, type AuthLang } from '../strings';

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
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8 shadow-xl shadow-black/10">
            <div className="flex items-center gap-1.5 mb-6 pb-4 border-b border-border/40">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                <span className="ml-3 font-mono text-[11px] text-muted-foreground">{t.eyebrow}</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground leading-tight">
                {t.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>

            {sent ? (
                <div className="mt-6 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
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
                            className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
                        >
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-[0.99] transition-all shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {submitting ? t.submitting : t.submit}
                    </button>
                </form>
            )}

            <div className="mt-6 pt-6 border-t border-border/40 text-sm">
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
