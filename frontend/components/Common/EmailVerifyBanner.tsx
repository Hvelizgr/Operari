'use client';

import { MailCheck, X } from 'lucide-react';
import { useState } from 'react';

import { authClient, AuthError, useAuth } from '@/lib/auth';

const STRINGS = {
  en: {
    message: 'Verify your email to unlock hosted runs + incoming webhooks.',
    resend: 'Resend link',
    resending: 'Sending…',
    sent: 'Check your inbox.',
    failed: 'Could not send. Try again in a moment.',
    dismiss: 'Dismiss',
  },
  es: {
    message: 'Verificá tu email para desbloquear runs hospedados + webhooks entrantes.',
    resend: 'Reenviar link',
    resending: 'Enviando…',
    sent: 'Revisá tu inbox.',
    failed: 'No se pudo enviar. Probá en un momento.',
    dismiss: 'Ocultar',
  },
} as const;

/**
 * Thin banner that surfaces an unverified-email reminder at the top
 * of the protected app. Rendered only when:
 *   - there is an authenticated session
 *   - the session user is NOT the self-host anonymous fallback
 *   - emailVerified is explicitly false (missing = legacy, hide)
 *
 * Session state lives in the AuthContext so the banner re-renders
 * when verification flips without a full refresh.
 */
export function EmailVerifyBanner({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const { session } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [dismissed, setDismissed] = useState(false);

  if (!session) return null;
  if (session.user.id === 'anonymous') return null;
  if (session.user.emailVerified !== false) return null;
  if (dismissed) return null;

  async function resend() {
    if (state === 'sending') return;
    setState('sending');
    try {
      await authClient.resendVerification();
      setState('sent');
    } catch (err) {
      // 401 means the session expired mid-click. The auth
      // middleware will route to /login on the next protected
      // action so we just reset state quietly.
      if (err instanceof AuthError && err.status === 401) {
        setState('idle');
        return;
      }
      setState('error');
    }
  }

  return (
    <div className="relative flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-amber-200/90">
        <MailCheck className="h-4 w-4 shrink-0" />
        <span className="truncate">{t.message}</span>
      </div>
      <div className="flex items-center gap-3">
        {state === 'sent' ? (
          <span className="text-xs text-amber-200/90">{t.sent}</span>
        ) : state === 'error' ? (
          <button
            onClick={resend}
            className="text-xs text-amber-100 underline underline-offset-2 hover:text-white"
          >
            {t.failed} · {t.resend}
          </button>
        ) : (
          <button
            onClick={resend}
            disabled={state === 'sending'}
            className="text-xs font-medium text-amber-100 hover:text-white disabled:opacity-50"
          >
            {state === 'sending' ? t.resending : t.resend}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          aria-label={t.dismiss}
          className="text-amber-200/70 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
