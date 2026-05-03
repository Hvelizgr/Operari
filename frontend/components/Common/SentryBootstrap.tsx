'use client';

import { useEffect } from 'react';

import { initSentry } from '@/lib/sentry/init';

/**
 * Mounts once at the root layout to fire the Sentry client init.
 * Lives in its own file so the layout (which is otherwise a server
 * component shell) doesn't have to flip to client. The init itself
 * is gated on `NEXT_PUBLIC_SENTRY_DSN` so installs without Sentry
 * pay zero overhead.
 */
export function SentryBootstrap() {
  useEffect(() => {
    initSentry();
  }, []);
  return null;
}
