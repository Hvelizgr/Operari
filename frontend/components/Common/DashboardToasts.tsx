'use client';

import { useEffect, useState } from 'react';

import { Toast } from './Toast';

const STRINGS = {
  en: {
    verified: 'Email verified — thanks for confirming.',
  },
  es: {
    verified: 'Email verificado — gracias por confirmar.',
  },
} as const;

/**
 * Checks the current URL for `?verified=true` and surfaces a
 * transient success toast. Once shown, strips the query param so a
 * reload doesn't re-fire the toast.
 *
 * Belongs in the dashboard shell because that's where the email
 * verify callback redirects (`/dashboard?verified=true`, set by
 * the backend's GET /auth/verify-email handler).
 */
export function DashboardToasts({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      setMessage(t.verified);
      // Strip the query param so a reload doesn't re-fire.
      params.delete('verified');
      const remaining = params.toString();
      const newUrl = window.location.pathname + (remaining ? `?${remaining}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [t.verified]);

  if (!message) return null;
  return <Toast message={message} onClose={() => setMessage(null)} />;
}
