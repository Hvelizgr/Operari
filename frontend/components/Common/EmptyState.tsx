'use client';

import { ArrowRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { HelixSpinner } from '@/components/Brand/HelixSpinner';

/**
 * Shared empty state with an optional primary CTA.
 *
 * Used on the runbooks list, runs history, and inbox when a brand-new
 * tenant has nothing yet. The CTA routes to the public templates
 * gallery (for runbooks) or to the editor (for runs) so a new user
 * always has a next step instead of a blank screen.
 *
 * Keep the copy short + one obvious button — every extra word raises
 * the cognitive load on a user who is already confused enough to be
 * here in the first place.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  primaryLabel,
  primaryHref,
  primaryAction,
  primaryLoading,
  secondaryLabel,
  secondaryHref,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  primaryLabel?: string;
  /** Navigate to a route on click. Ignored if primaryAction is set. */
  primaryHref?: string;
  /** Callback on click. Use instead of primaryHref for actions that
   *  need to do work before navigating (e.g. POST + redirect to the
   *  returned id). */
  primaryAction?: () => void;
  /** When true, the primary button renders a spinner and disables
   *  clicks — use while primaryAction's async work is in flight. */
  primaryLoading?: boolean;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  const primaryClass =
    'bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 group inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-70 disabled:cursor-wait';
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--border-color,rgba(255,255,255,0.1))] bg-[rgba(255,255,255,0.02)] p-10 text-center">
      {/* Faint background helix — same brand shape, dropped to ~6%
          opacity so it reads as texture rather than decoration. The
          aria-hidden + pointer-events-none keeps it accessibility-
          and interaction-inert. */}
      <svg
        viewBox="0 0 200 240"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto h-full w-full opacity-[0.06]"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M 100 0 C 40 30, 40 90, 100 120 C 160 150, 160 210, 100 240"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 100 0 C 160 30, 160 90, 100 120 C 40 150, 40 210, 100 240"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div className="bg-primary/10 border-primary/30 text-primary relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="relative mb-2 text-base font-semibold text-white">{title}</h3>
      <p className="relative mb-5 max-w-md text-sm leading-relaxed text-gray-400">{body}</p>
      <div className="relative flex flex-wrap items-center justify-center gap-3">
        {primaryLabel && primaryAction && (
          <button
            type="button"
            onClick={primaryAction}
            disabled={primaryLoading}
            className={primaryClass}
          >
            {primaryLabel}
            {primaryLoading ? (
              <HelixSpinner size={16} />
            ) : (
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        )}
        {primaryLabel && !primaryAction && primaryHref && (
          <Link href={primaryHref} className={primaryClass}>
            {primaryLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
        {secondaryLabel && secondaryHref && (
          <Link
            href={secondaryHref}
            className="hover:border-primary/50 inline-flex items-center rounded-lg border border-[var(--border-color,rgba(255,255,255,0.15))] px-4 py-2 text-sm text-gray-300 hover:text-white"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
