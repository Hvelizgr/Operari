'use client';

import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

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
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/30 text-primary">
                <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
            <p className="max-w-md text-sm text-gray-400 leading-relaxed mb-5">{body}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
                {primaryLabel && primaryHref && (
                    <Link
                        href={primaryHref}
                        className="group inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-md shadow-primary/20 hover:bg-primary/90"
                    >
                        {primaryLabel}
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                )}
                {secondaryLabel && secondaryHref && (
                    <Link
                        href={secondaryHref}
                        className="inline-flex items-center rounded-lg border border-[var(--border-color,rgba(255,255,255,0.15))] px-4 py-2 text-sm text-gray-300 hover:text-white hover:border-primary/50"
                    >
                        {secondaryLabel}
                    </Link>
                )}
            </div>
        </div>
    );
}
