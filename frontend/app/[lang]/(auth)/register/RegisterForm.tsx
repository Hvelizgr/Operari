'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthError, useAuth } from '@/lib/auth';

import { AuthField } from '../_components/AuthField';
import { SocialButtons } from '../_components/SocialButtons';
import { type AuthLang, authStrings } from '../strings';

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GOOGLE === 'true';
const GITHUB_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GITHUB === 'true';
const WORKOS_ENABLED = process.env.NEXT_PUBLIC_OAUTH_WORKOS === 'true';

// Only accept template slugs that look URL-safe. Same pattern as the
// backend enforces for runbook slug creation, but kept tight to
// prevent an attacker from crafting a ?template= that smuggles a
// redirect target past us.
const SAFE_TEMPLATE_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/i;

/**
 * Sprint 2 — react-hook-form + zod migration mirrors LoginForm.
 *
 * Schema rules: tenantName + email + password are required (auth
 * server enforces real validation; client-side we just block obvious
 * empties). password >= 8 to match the input's minLength. name is
 * optional. The 4 useState fields collapse into one useForm call
 * plus one UI-only useState for the error.
 */

const registerSchema = z.object({
  tenantName: z.string().min(2, 'min 2 chars'),
  name: z.string().optional(),
  email: z.string().min(1, 'required').email('invalid'),
  password: z.string().min(8, 'min 8 chars'),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm({ lang }: { lang: AuthLang }) {
  const t = authStrings[lang].register;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register: registerUser } = useAuth();

  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { tenantName: '', name: '', email: '', password: '' },
    mode: 'onSubmit',
  });

  async function onSubmit(values: RegisterValues) {
    setError(null);
    try {
      await registerUser({
        email: values.email,
        password: values.password,
        tenantName: values.tenantName,
        name: values.name?.trim() || undefined,
      });
      // Signup handoff: if the user arrived from a template detail
      // page, send them back there. From pricing page upgrade CTA,
      // drop them in settings so billing is one click away.
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

      <SocialButtons
        lang={lang}
        googleEnabled={GOOGLE_ENABLED}
        githubEnabled={GITHUB_ENABLED}
        workosEnabled={WORKOS_ENABLED}
        dividerLabel={t.socialDivider}
        google={t.google}
        github={t.github}
        workos={t.workos}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <Controller
          name="tenantName"
          control={control}
          render={({ field }) => (
            <AuthField
              label={t.tenantName}
              autoComplete="organization"
              required
              minLength={2}
              value={field.value}
              onChange={field.onChange}
              name={field.name}
            />
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <AuthField
              label={t.name}
              autoComplete="name"
              value={field.value ?? ''}
              onChange={field.onChange}
              name={field.name}
            />
          )}
        />
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <AuthField
              label={t.email}
              type="email"
              autoComplete="email"
              required
              value={field.value}
              onChange={field.onChange}
              name={field.name}
            />
          )}
        />
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <AuthField
              label={t.password}
              hint={t.passwordHint}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={field.value}
              onChange={field.onChange}
              name={field.name}
            />
          )}
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
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 h-11 w-full rounded-lg text-sm font-semibold shadow-md transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t.submitting : t.submit}
        </button>

        <p className="text-muted-foreground/80 text-[11px] leading-relaxed">
          {t.terms}
          <Link
            href={`/${lang}/terms`}
            className="hover:text-foreground underline decoration-dotted underline-offset-2 transition-colors"
          >
            {t.termsLink}
          </Link>
          {t.and}
          <Link
            href={`/${lang}/privacy`}
            className="hover:text-foreground underline decoration-dotted underline-offset-2 transition-colors"
          >
            {t.privacy}
          </Link>
          .
        </p>
      </form>

      <div className="border-border/40 mt-6 border-t pt-6 text-sm">
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
