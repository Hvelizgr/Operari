'use client';

import { CreditCard, ExternalLink, Loader2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';

function UsageBar({
  label,
  current,
  limit,
  unlimitedLabel,
}: {
  label: string;
  current: number;
  limit: number | null;
  unlimitedLabel: string;
}) {
  const isUnlimited = limit === null;
  const pct = isUnlimited || !limit ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const atLimit = !isUnlimited && current >= (limit ?? 0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-primary)]">{label}</span>
        <span className="font-mono text-[var(--text-muted)]">
          {isUnlimited ? `${current} · ${unlimitedLabel}` : `${current} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-color)]">
          <div
            className={`h-full transition-all ${atLimit ? 'bg-amber-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

const STRINGS = {
  en: {
    title: 'Plan & billing',
    hint: 'Upgrade, manage your subscription, or download invoices. Self-host stays free forever.',
    currentPlan: 'Current plan',
    status: 'Status',
    renewsOn: 'Renews on',
    usage: 'Usage',
    runbooks: 'Runbooks',
    runsThisMonth: 'Runs this month',
    unlimited: 'unlimited',
    upgradeTeam: 'Upgrade to Team',
    upgradeBusiness: 'Upgrade to Business',
    manage: 'Manage subscription',
    monthly: 'Monthly',
    yearly: 'Yearly (save ~20%)',
    noBilling: 'Billing is not enabled on this server. Self-host means you pay for nothing.',
    failure: 'Could not reach the billing provider. Try again in a moment.',
    checkoutSuccess: 'Subscription activated. Welcome to the paid club.',
    checkoutCanceled: 'Checkout canceled — you are still on the same plan.',
    atLimit: 'You hit your plan limit. Upgrade to keep building.',
  },
  es: {
    title: 'Plan y facturación',
    hint: 'Suscribite, gestioná tu suscripción o descargá facturas. Self-host sigue gratis para siempre.',
    currentPlan: 'Plan actual',
    status: 'Estado',
    renewsOn: 'Renueva el',
    usage: 'Uso',
    runbooks: 'Runbooks',
    runsThisMonth: 'Runs este mes',
    unlimited: 'ilimitados',
    upgradeTeam: 'Cambiar a Team',
    upgradeBusiness: 'Cambiar a Business',
    manage: 'Gestionar suscripción',
    monthly: 'Mensual',
    yearly: 'Anual (~20% off)',
    noBilling: 'La facturación no está habilitada en este servidor. Self-host = sin costo.',
    failure: 'No se pudo contactar al proveedor de facturación. Probá en un momento.',
    checkoutSuccess: 'Suscripción activada. Bienvenido al club pago.',
    checkoutCanceled: 'Checkout cancelado — seguís en el mismo plan.',
    atLimit: 'Alcanzaste el límite del plan. Upgradeá para seguir creando.',
  },
} as const;

type Period = 'monthly' | 'yearly';

interface TenantBilling {
  plan: 'FREE' | 'TEAM' | 'BUSINESS' | 'ENTERPRISE' | 'PRO';
  planStatus: string | null;
  planCurrentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

interface TenantUsage {
  plan: 'FREE' | 'TEAM' | 'BUSINESS' | 'ENTERPRISE' | 'PRO';
  runbooks: { current: number; limit: number | null };
  runs: { current: number; limit: number | null; periodStart: string };
}

export function BillingPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const { session } = useAuth();
  const [period, setPeriod] = useState<Period>('monthly');
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [billing, setBilling] = useState<TenantBilling | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);

  useEffect(() => {
    if (!session) return;
    // Summary depends on Stripe being configured; usage does not.
    // Fetch them in parallel so the panel renders as much as it
    // can even when the billing provider is offline.
    fetch('/api/billing/summary', { credentials: 'include' })
      .then(async res => {
        if (res.status === 501) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then(body => {
        if (body?.data) setBilling(body.data);
      })
      .catch(() => undefined);

    fetch('/api/billing/usage', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (body?.data) setUsage(body.data);
      })
      .catch(() => undefined);
  }, [session]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if (status === 'success') setToast(t.checkoutSuccess);
    else if (status === 'canceled') setToast(t.checkoutCanceled);
  }, [t]);

  if (!session || session.user.id === 'anonymous') return null;

  async function startCheckout(plan: 'TEAM' | 'BUSINESS') {
    if (busy) return;
    setError(null);
    setBusy('checkout');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, period }),
      });
      if (res.status === 501) {
        setNotConfigured(true);
        setBusy(null);
        return;
      }
      if (!res.ok) throw new Error(`checkout failed: ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError(t.failure);
      setBusy(null);
    }
  }

  async function openPortal() {
    if (busy) return;
    setError(null);
    setBusy('portal');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`portal failed: ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError(t.failure);
      setBusy(null);
    }
  }

  const currentPlan = billing?.plan ?? usage?.plan ?? 'FREE';
  const hasSubscription = Boolean(billing?.stripeCustomerId);

  return (
    <div className="space-y-4">
      {toast && (
        <div className="border-primary/40 bg-primary/10 text-primary rounded-lg border px-3 py-2 text-xs">
          {toast}
        </div>
      )}

      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg,rgba(255,255,255,0.03))] p-4">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex-1">
            <div className="mb-1 text-xs text-[var(--text-muted)]">{t.currentPlan}</div>
            <div className="font-semibold text-[var(--text-primary)]">{currentPlan}</div>
          </div>
          {billing?.planStatus && (
            <div>
              <div className="mb-1 text-xs text-[var(--text-muted)]">{t.status}</div>
              <div className="font-mono text-xs text-[var(--text-primary)]">
                {billing.planStatus}
              </div>
            </div>
          )}
          {billing?.planCurrentPeriodEnd && (
            <div>
              <div className="mb-1 text-xs text-[var(--text-muted)]">{t.renewsOn}</div>
              <div className="font-mono text-xs text-[var(--text-primary)]">
                {new Date(billing.planCurrentPeriodEnd).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {usage && (
        <div className="space-y-3 rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg,rgba(255,255,255,0.03))] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t.usage}
          </div>
          <UsageBar
            label={t.runbooks}
            current={usage.runbooks.current}
            limit={usage.runbooks.limit}
            unlimitedLabel={t.unlimited}
          />
          <UsageBar
            label={t.runsThisMonth}
            current={usage.runs.current}
            limit={usage.runs.limit}
            unlimitedLabel={t.unlimited}
          />
          {((usage.runbooks.limit !== null && usage.runbooks.current >= usage.runbooks.limit) ||
            (usage.runs.limit !== null && usage.runs.current >= usage.runs.limit)) && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
              {t.atLimit}
            </div>
          )}
        </div>
      )}

      {notConfigured ? (
        <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-transparent p-4 text-xs text-[var(--text-muted)]">
          {t.noBilling}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs">
            {(['monthly', 'yearly'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md border px-3 py-1.5 font-medium transition-colors ${
                  period === p
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {p === 'monthly' ? t.monthly : t.yearly}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentPlan !== 'TEAM' &&
              currentPlan !== 'BUSINESS' &&
              currentPlan !== 'ENTERPRISE' && (
                <button
                  onClick={() => startCheckout('TEAM')}
                  disabled={busy !== null}
                  className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-60"
                >
                  {busy === 'checkout' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {t.upgradeTeam}
                </button>
              )}
            {currentPlan !== 'BUSINESS' && currentPlan !== 'ENTERPRISE' && (
              <button
                onClick={() => startCheckout('BUSINESS')}
                disabled={busy !== null}
                className="border-primary text-primary hover:bg-primary/10 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy === 'checkout' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {t.upgradeBusiness}
              </button>
            )}
            {hasSubscription && (
              <button
                onClick={openPortal}
                disabled={busy !== null}
                className="hover:border-primary inline-flex items-center gap-2 rounded-md border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
              >
                {busy === 'portal' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {t.manage}
              </button>
            )}
          </div>

          {error && (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
