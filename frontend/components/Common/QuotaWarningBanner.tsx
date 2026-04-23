'use client';

import { AlertTriangle, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';

const STRINGS = {
  en: {
    approaching: (resource: string, current: number, limit: number) =>
      `You've used ${current}/${limit} ${resource} — approaching your plan limit.`,
    atLimit: (resource: string, limit: number) =>
      `You've hit your plan's ${resource} cap (${limit}). Upgrade to keep building.`,
    upgrade: 'Upgrade to Team',
    dismiss: 'Dismiss',
    runbooksLabel: 'runbooks',
    runsLabel: 'runs this month',
  },
  es: {
    approaching: (resource: string, current: number, limit: number) =>
      `Usaste ${current}/${limit} ${resource} — te acercás al límite del plan.`,
    atLimit: (resource: string, limit: number) =>
      `Alcanzaste el cap de ${resource} del plan (${limit}). Upgradeá para seguir.`,
    upgrade: 'Cambiar a Team',
    dismiss: 'Ocultar',
    runbooksLabel: 'runbooks',
    runsLabel: 'runs este mes',
  },
} as const;

interface UsageResponse {
  plan: string;
  runbooks: { current: number; limit: number | null };
  runs: { current: number; limit: number | null };
}

/**
 * Dashboard banner that warns the operator when they approach OR hit
 * a plan quota. Two thresholds:
 *   - >= 80% of limit → amber "approaching" banner
 *   - >= 100% of limit → red "at limit" banner with upgrade CTA
 *
 * Dismissal is per-session (component state) — we want the warning
 * to reappear when the user returns tomorrow if they're still near
 * the cap. A persistent "never show again" would undercut the safety
 * value of the banner.
 *
 * Hidden entirely in anonymous mode and for users already on an
 * unlimited tier (limit === null).
 */
export function QuotaWarningBanner({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const { session } = useAuth();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.user.id === 'anonymous') return;
    fetch('/api/billing/usage', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (body?.data) setUsage(body.data);
      })
      .catch(() => undefined);
  }, [session]);

  if (!session || session.user.id === 'anonymous' || !usage) return null;

  const warnings: Array<{ resource: string; current: number; limit: number; pct: number }> = [];
  if (usage.runbooks.limit !== null) {
    const pct = usage.runbooks.current / usage.runbooks.limit;
    if (pct >= 0.8) {
      warnings.push({
        resource: t.runbooksLabel,
        current: usage.runbooks.current,
        limit: usage.runbooks.limit,
        pct,
      });
    }
  }
  if (usage.runs.limit !== null) {
    const pct = usage.runs.current / usage.runs.limit;
    if (pct >= 0.8) {
      warnings.push({
        resource: t.runsLabel,
        current: usage.runs.current,
        limit: usage.runs.limit,
        pct,
      });
    }
  }
  if (warnings.length === 0) return null;

  // Pick the most urgent (highest pct).
  const top = warnings.sort((a, b) => b.pct - a.pct)[0];
  const key = `${top.resource}:${top.current}:${top.limit}`;
  if (dismissedKey === key) return null;

  const atLimit = top.pct >= 1;
  const tone = atLimit
    ? 'border-red-500/40 bg-red-500/10 text-red-100'
    : 'border-amber-500/40 bg-amber-500/10 text-amber-100';
  const message = atLimit
    ? t.atLimit(top.resource, top.limit)
    : t.approaching(top.resource, top.current, top.limit);

  return (
    <div
      className={`relative flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm ${tone}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={`/${lang}/settings`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold shadow"
        >
          <Zap className="h-3 w-3" />
          {t.upgrade}
        </Link>
        <button
          onClick={() => setDismissedKey(key)}
          aria-label={t.dismiss}
          className="opacity-70 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
