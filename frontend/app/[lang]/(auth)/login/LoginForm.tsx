'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { AuthError, useAuth } from '@/lib/auth';

import { AuthField } from '../_components/AuthField';
import { SocialButtons } from '../_components/SocialButtons';
import { type AuthLang, authStrings } from '../strings';

const SAFE_REDIRECT = /^\/[a-z]{2}(\/[\w\-/]*)?$/i;

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GOOGLE === 'true';
const GITHUB_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GITHUB === 'true';

export function LoginForm({ lang }: { lang: AuthLang }) {
  const t = authStrings[lang].login;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const qerr = searchParams.get('error');
    if (qerr && qerr.startsWith('oauth_')) return t.oauthError;
    return null;
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await login({
        email,
        password,
        totpCode: mfaStep && totpCode ? totpCode : undefined,
      });
      // Tenant-wide MFA policy: when the admin requires MFA and
      // this user has not enrolled, skip the normal redirect
      // and route them to the security page so they enroll
      // before anything else renders. The session cookie is
      // already set so the enrollment page can read /auth/me.
      if (result.mfaEnrollmentRequired) {
        router.replace(`/${lang}/settings?mfa=enroll`);
        return;
      }
      const redirect = searchParams.get('redirect');
      const target = redirect && SAFE_REDIRECT.test(redirect) ? redirect : `/${lang}/dashboard`;
      router.replace(target);
    } catch (err) {
      if (err instanceof AuthError) {
        // MFA-required is a distinct UX path: reveal the TOTP
        // field instead of bouncing back to "invalid creds".
        if (err.mfaRequired) {
          setMfaStep(true);
          // Clear error only if the caller already entered
          // a code (i.e. wrong code) — otherwise no error yet.
          setError(totpCode ? t.genericError : null);
        } else {
          setError(err.status >= 500 ? t.networkError : t.genericError);
        }
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
          type="password"
          name="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
        />

        {mfaStep && (
          <AuthField
            label={lang === 'es' ? 'Código de autenticación' : 'Authentication code'}
            hint={
              lang === 'es'
                ? 'Abre tu app de autenticador y pegá el código de 6 dígitos.'
                : 'Open your authenticator app and enter the 6-digit code.'
            }
            type="text"
            name="totpCode"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            required
            value={totpCode}
            onChange={setTotpCode}
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
          disabled={submitting}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 h-11 w-full rounded-lg text-sm font-semibold shadow-md transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t.submitting : t.submit}
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
