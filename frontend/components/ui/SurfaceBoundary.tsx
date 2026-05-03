'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { type ReactNode } from 'react';
import { toast } from 'sonner';

/**
 * SurfaceBoundary — `react-error-boundary` wrapper for any sub-tree
 * we want to keep alive when a sibling component throws.
 *
 * The Next.js App Router already provides route-segment error pages
 * (the `error.tsx` files), but those replace the entire route on a
 * single bad render. SurfaceBoundary is a narrower net: a crashed
 * Inspector should NOT take down the canvas, a broken ResponseViewer
 * should NOT take down the HTTP form, and one node throwing inside
 * BaseStepNode should NOT freeze the whole React Flow surface.
 *
 * Defaults to a compact dark-themed fallback that fits inside any
 * panel; pass `fallback={...}` to override per surface (e.g. the
 * canvas wants a smaller, less alarming hint).
 *
 * The reset button calls `resetErrorBoundary` so a transient throw
 * (e.g. a Prisma `findFirst` race that resolves on retry) doesn't
 * require a full reload.
 */

interface SurfaceBoundaryProps {
  children: ReactNode;
  /** Short label shown in the fallback header — usually the surface
   *  name (e.g. "Inspector", "Run console"). */
  label: string;
  /** Optional override for the entire fallback render. */
  fallback?: (props: FallbackProps) => ReactNode;
  /** Reset keys: when any of these change, the boundary auto-resets.
   *  Useful when the upstream prop (e.g. selectedNodeId) flips and
   *  we want to give the subtree a fresh shot. */
  resetKeys?: ReadonlyArray<unknown>;
}

const DefaultFallback = ({ label }: { label: string }) =>
  function Fallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
      <div
        role="alert"
        className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded border border-rose-700/40 bg-rose-500/5 p-4 text-center"
      >
        <AlertTriangle size={18} className="text-rose-400" />
        <div className="font-mono text-[11px] uppercase tracking-wider text-rose-300">
          {label} crashed
        </div>
        <div
          className="max-w-full truncate font-mono text-[10px] text-rose-200/70"
          title={error instanceof Error ? error.message : String(error)}
        >
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="mt-1 inline-flex items-center gap-1 rounded border border-rose-700/50 bg-rose-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-rose-200 transition-colors hover:bg-rose-500/20"
        >
          <RefreshCw size={11} />
          Retry
        </button>
      </div>
    );
  };

export function SurfaceBoundary({ children, label, fallback, resetKeys }: SurfaceBoundaryProps) {
  const FallbackComponent = fallback ?? DefaultFallback({ label });
  return (
    <ErrorBoundary
      FallbackComponent={FallbackComponent}
      resetKeys={resetKeys ? [...resetKeys] : undefined}
      onError={error => {
        // Best-effort surface to the toast system in dev. In prod
        // we'd also forward this to Sentry once that lands (Sprint 4).
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`${label} crashed: ${message.slice(0, 80)}`);
        // eslint-disable-next-line no-console
        console.error(`[SurfaceBoundary:${label}]`, error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
