'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthError, useAuth } from '@/lib/auth';
import { AuthField } from '../_components/AuthField';
import { SocialButtons } from '../_components/SocialButtons';
import { authStrings, type AuthLang } from '../strings';

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GOOGLE === 'true';
const GITHUB_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GITHUB === 'true';

// Only accept template slugs that look URL-safe. Same pattern as the
// backend enforces for runbook slug creation, but kept tight to
// prevent an attacker from crafting a ?template= that smuggles a
// redirect target past us.
const SAFE_TEMPLATE_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/i;

export function RegisterForm({ lang }: { lang: AuthLang }) {
    const t = authStrings[lang].register;
    const router = useRouter();
    const searchParams = useSearchParams();
    const { register } = useAuth();

    const [name, setName] = useState('');
    const [tenantName, setTenantName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;
        setError(null);
        setSubmitting(true);
        try {
            await register({ email, password, tenantName, name: name || undefined });
            // Signup handoff: if the user arrived from a template detail
            // page, send them back there so the "Use this runbook"
            // button can complete the create now that a session exists.
            // If they came from the pricing page's upgrade CTA, drop
            // them in settings so the billing panel is one click away.
            const templateSlug = searchParams.get('template');
            const plan = searchParams.get('plan');
            if (templateSlug && SAFE_TEMPLATE_SLUG.test(templateSlug)) {
                router.replace(`/${lang}/templates/${templateSlug}`);
            } else if (plan && /^[a-z]{2,20}$/.test(plan)) {
                router.replace(`/${lang}/settings?plan=${encodeURIComponent(plan)}`);
            } else {
                router.replace(`/${lang}/dashboard`);
            }
        } catch (err) {
            if (err instanceof AuthError) {
                setError(err.message);
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

            <SocialButtons
                lang={lang}
                googleEnabled={GOOGLE_ENABLED}
                githubEnabled={GITHUB_ENABLED}
                dividerLabel={t.socialDivider}
                google={t.google}
                github={t.github}
            />

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
                <AuthField
                    label={t.tenantName}
                    name="tenantName"
                    autoComplete="organization"
                    required
                    minLength={2}
                    value={tenantName}
                    onChange={setTenantName}
                />
                <AuthField
                    label={t.name}
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={setName}
                />
                <AuthField
                    label={t.email}
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={setEmail}
                />
                <AuthField
                    label={t.password}
                    hint={t.passwordHint}
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={setPassword}
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

                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    {t.terms}
                    <Link
                        href={`/${lang}/terms`}
                        className="underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
                    >
                        {t.termsLink}
                    </Link>
                    {t.and}
                    <Link
                        href={`/${lang}/privacy`}
                        className="underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
                    >
                        {t.privacy}
                    </Link>
                    .
                </p>
            </form>

            <div className="mt-6 pt-6 border-t border-border/40 text-sm">
                <p className="text-muted-foreground">
                    {t.haveAccount}{' '}
                    <Link
                        href={`/${lang}/login`}
                        className="text-primary hover:text-primary/90 font-medium transition-colors"
                    >
                        {t.login}
                    </Link>
                </p>
            </div>
        </div>
    );
}
