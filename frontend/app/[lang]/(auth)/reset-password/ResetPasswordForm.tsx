'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { authClient, AuthError, useAuth } from '@/lib/auth';

import { AuthField } from '../_components/AuthField';
import { type AuthLang, resetStrings } from '../strings';

export function ResetPasswordForm({ lang }: { lang: AuthLang }) {
  const t = resetStrings[lang].reset;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const token = searchParams.get('token');

  // zod schema mirrors the previous imperative validation: password >= 8
  // and confirm === password. The cross-field `refine` runs after the
  // primitive checks pass so the operator sees "min 8" before "doesn't
  // match".
  const schema = z
    .object({
      password: z.string().min(8, t.tooShort),
      confirm: z.string().min(8, t.tooShort),
    })
    .refine(d => d.password === d.confirm, {
      path: ['confirm'],
      message: t.mismatch,
    });
  type Values = z.infer<typeof schema>;

  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
    mode: 'onSubmit',
  });

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

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await authClient.resetPassword(token!, values.password);
      await refresh();
      router.replace(`/${lang}/dashboard`);
    } catch (err) {
      if (err instanceof AuthError && err.status === 400) {
        setError(t.invalid);
      } else {
        setError(t.networkError);
      }
    }
  }

  // Field-level validation errors (mismatch / too short) display
  // through the same alert region as network errors so the operator
  // doesn't need to look in two places.
  const fieldError = errors.password?.message ?? errors.confirm?.message;
  const displayError = error ?? fieldError ?? null;

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

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <AuthField
              label={t.password}
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
        <Controller
          name="confirm"
          control={control}
          render={({ field }) => (
            <AuthField
              label={t.confirm}
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
        {displayError && (
          <div
            role="alert"
            className="text-destructive bg-destructive/10 border-destructive/30 rounded-md border px-3 py-2 text-xs"
          >
            {displayError}
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
    </div>
  );
}
