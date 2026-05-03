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

const SAFE_REDIRECT = /^\/[a-z]{2}(\/[\w\-/]*)?$/i;

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GOOGLE === 'true';
const GITHUB_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GITHUB === 'true';
const WORKOS_ENABLED = process.env.NEXT_PUBLIC_OAUTH_WORKOS === 'true';
const DEV_MODE_ENABLED = process.env.NEXT_PUBLIC_DEV_LOGIN_ENABLED === 'true';

/**
 * Sprint 2 pilot for `react-hook-form` + `zod` adoption.
 *
 * Why this form: the smallest meaningful auth surface (3 fields max
 * including the conditional TOTP), bounded behaviour (login + MFA
 * branch + dev shortcut), and an existing test suite that pins the
 * external surface so the refactor is visible to the reviewer
 * (`LoginForm.test.tsx`). signup / forgot-password / reset / MFA
 * enrollment follow the same recipe in subsequent commits.
 */

const loginSchema = z.object({
  // Lenient on purpose — auth servers do their own real validation.
  // We only catch obviously-empty / malformed-shape submissions
  // client-side so the operator gets an instant red flag instead of
  // round-tripping to the backend.
  email: z.string().min(1, 'required').email('invalid'),
  password: z.string().min(1, 'required'),
  totpCode: z.string().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ lang }: { lang: AuthLang }) {
  const t = authStrings[lang].login;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, continueAsDev } = useAuth();

  const [mfaStep, setMfaStep] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const qerr = searchParams.get('error');
    if (qerr && qerr.startsWith('oauth_')) return t.oauthError;
    return null;
  });

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', totpCode: '' },
    // Validate only on submit so the operator isn't yelled at while
    // typing — auth UX is forgiving by convention. Errors switch to
    // onChange after the first failed submit (RHF default).
    mode: 'onSubmit',
  });

  async function onContinueAsDev() {
    setError(null);
    const session = await continueAsDev();
    if (!session) {
      setError(t.networkError);
      return;
    }
    const redirect = searchParams.get('redirect');
    const target = redirect && SAFE_REDIRECT.test(redirect) ? redirect : `/${lang}/dashboard`;
    router.replace(target);
  }

  async function onSubmit(values: LoginValues) {
    setError(null);
    try {
      const result = await login({
        email: values.email,
        password: values.password,
        totpCode: mfaStep && values.totpCode ? values.totpCode : undefined,
      });
      // Tenant-wide MFA policy: when the admin requires MFA and
      // this user has not enrolled, route them to /settings?mfa=enroll
      // before anything else renders.
      if (result.mfaEnrollmentRequired) {
        router.replace(`/${lang}/settings?mfa=enroll`);
        return;
      }
      const redirect = searchParams.get('redirect');
      const target = redirect && SAFE_REDIRECT.test(redirect) ? redirect : `/${lang}/dashboard`;
      router.replace(target);
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.mfaRequired) {
          setMfaStep(true);
          // Only flag the existing TOTP entry as wrong when the
          // operator already typed one — first-time MFA prompt has
          // no error.
          setError(getValues('totpCode') ? t.genericError : null);
        } else {
          setError(err.status >= 500 ? t.networkError : t.genericError);
        }
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

      {DEV_MODE_ENABLED && (
        <button
          type="button"
          onClick={onContinueAsDev}
          className="mt-6 flex w-full items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-left transition-colors hover:border-amber-500/60 hover:bg-amber-500/10"
        >
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-amber-200">{t.devButton}</span>
            <span className="text-muted-foreground text-xs">{t.devHint}</span>
          </div>
          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
            {t.devBadge}
          </span>
        </button>
      )}

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
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={field.value}
              onChange={field.onChange}
              name={field.name}
            />
          )}
        />

        {mfaStep && (
          <Controller
            name="totpCode"
            control={control}
            render={({ field }) => (
              <AuthField
                label={lang === 'es' ? 'Código de autenticación' : 'Authentication code'}
                hint={
                  lang === 'es'
                    ? 'Abre tu app de autenticador y pegá el código de 6 dígitos.'
                    : 'Open your authenticator app and enter the 6-digit code.'
                }
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
                value={field.value ?? ''}
                onChange={field.onChange}
                name={field.name}
              />
            )}
          />
        )}

        <div className="-mt-2 flex justify-end">
          <Link
            href={`/${lang}/forgot-password`}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            {t.forgot}
          </Link>
        </div>

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
      </form>

      <div className="border-border/40 mt-6 space-y-3 border-t pt-6 text-sm">
        <p className="text-muted-foreground">
          {t.noAccount}{' '}
          <Link
            href={`/${lang}/register`}
            className="text-primary hover:text-primary/90 font-medium transition-colors"
          >
            {t.register}
          </Link>
        </p>
        <p className="text-muted-foreground/80 text-xs">
          {t.waitlist}{' '}
          <Link
            href={`/${lang}/signup`}
            className="hover:text-foreground underline decoration-dotted underline-offset-2 transition-colors"
          >
            {t.hosted}
          </Link>
        </p>
      </div>
    </div>
  );
}
