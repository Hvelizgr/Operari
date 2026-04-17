'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthError, authClient, useAuth } from '@/lib/auth';
import { AuthField } from '../_components/AuthField';
import { resetStrings, type AuthLang } from '../strings';

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
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
                <h1 className="text-xl font-bold text-foreground">{t.eyebrow}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t.missingToken}</p>
                <Link
                    href={`/${lang}/forgot-password`}
                    className="mt-4 inline-block text-sm text-primary hover:text-primary/90"
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
        </div>
    );
}
