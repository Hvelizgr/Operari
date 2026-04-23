'use client';

import { ArrowRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

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
  secondaryLabel,
  secondaryHref,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-color,rgba(255,255,255,0.1))] bg-[rgba(255,255,255,0.02)] p-10 text-center">
      <div className="bg-primary/10 border-primary/30 text-primary mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
      <p className="mb-5 max-w-md text-sm leading-relaxed text-gray-400">{body}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryLabel && primaryHref && (
          <Link
            href={primaryHref}
            className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 group inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-md"
          >
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
