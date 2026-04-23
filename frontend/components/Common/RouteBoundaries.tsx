'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Shared `loading.tsx` / `error.tsx` components used by every route in
 * `app/[lang]/*`. Next.js's file conventions expect one of each at the
 * route root, and these get imported by those thin files so the visual
 * language stays consistent: skeleton pulse while data fetches, red
 * panel with retry button when it throws.
 *
 * If you want a route-specific treatment (e.g. the editor's skeleton
 * should hint at the canvas), override by writing a real loading.tsx /
 * error.tsx at that route instead of importing these.
 */

interface DefaultLoadingProps {
  /** Optional label shown under the spinner. Keep short. */
  label?: string;
}

export function DefaultLoading({ label }: DefaultLoadingProps) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 bg-[var(--app-bg)] text-[var(--text-muted)]">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-color)]" />
        <div
          className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-color)]"
          style={{ animationDelay: '0.15s' }}
        />
        <div
          className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-color)]"
          style={{ animationDelay: '0.3s' }}
        />
      </div>
      {label && <p className="text-xs">{label}</p>}
    </div>
  );
}

interface DefaultErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** When provided, replaces the generic "Something went wrong" header
   *  with the caller's name — helps the user tell which panel crashed. */
  scope?: string;
}

export function DefaultError({ error, reset, scope }: DefaultErrorProps) {
  // Log to the browser console so Sentry / the user's devtools pick
  // up the stack. Without this, error.tsx swallows the exception.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center bg-[var(--app-bg)] px-4">
      <div className="w-full max-w-md rounded-md border border-red-500/30 bg-red-500/5 p-5 text-[var(--text-primary)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-red-400">
          <AlertTriangle size={16} />
          {scope ? `${scope} failed to load` : 'Something went wrong'}
        </div>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          {error.message || 'An unexpected error occurred.'}
          {error.digest && <span className="ml-1 font-mono opacity-60">({error.digest})</span>}
        </p>
        <button
          onClick={reset}
          className="bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-color)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw size={12} />
          Try again
        </button>
      </div>
    </div>
  );
}
