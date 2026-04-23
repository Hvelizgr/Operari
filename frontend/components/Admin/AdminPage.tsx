'use client';

import { Building2, KeyRound, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Overview {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
    workosOrganizationId: string | null;
    stripeCustomerId: string | null;
  } | null;
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
  }>;
  customRoles: Array<{
    id: string;
    name: string;
    description: string | null;
    permissions: string[];
    createdAt: string;
  }>;
  counts: {
    runbooks: number;
    runs: number;
    apiKeys: number;
    webhooks: number;
    schedules: number;
    agents: number;
    monitors: number;
    auditEvents: number;
  };
}

const STRINGS = {
  en: {
    title: 'Admin',
    subtitle:
      'Read-only overview of your tenant. Mutations live in the dedicated pages — Utilities for keys/webhooks, Schedules for jobs, etc.',
    tenantTitle: 'Tenant',
    usersTitle: 'Users',
    rolesTitle: 'Custom roles',
    countsTitle: 'Resources',
    plan: 'Plan',
    slug: 'Slug',
    created: 'Created',
    sso: 'SSO (WorkOS)',
    billing: 'Billing (Stripe)',
    notLinked: 'not linked',
    runbooks: 'Runbooks',
    runs: 'Runs',
    apiKeys: 'API keys',
    webhooks: 'Webhooks',
    schedules: 'Schedules',
    agents: 'Event agents',
    monitors: 'Monitors',
    auditEvents: 'Audit events',
    noUsers: 'No users.',
    noRoles: 'No custom roles defined.',
    loading: 'Loading…',
    loadError: 'Failed to load admin overview.',
  },
  es: {
    title: 'Admin',
    subtitle:
      'Vista de solo lectura del tenant. Las mutaciones viven en las páginas dedicadas — Utilidades para keys/webhooks, Horarios para jobs, etc.',
    tenantTitle: 'Tenant',
    usersTitle: 'Usuarios',
    rolesTitle: 'Roles personalizados',
    countsTitle: 'Recursos',
    plan: 'Plan',
    slug: 'Slug',
    created: 'Creado',
    sso: 'SSO (WorkOS)',
    billing: 'Billing (Stripe)',
    notLinked: 'sin vincular',
    runbooks: 'Runbooks',
    runs: 'Ejecuciones',
    apiKeys: 'API keys',
    webhooks: 'Webhooks',
    schedules: 'Horarios',
    agents: 'Event agents',
    monitors: 'Monitores',
    auditEvents: 'Eventos de auditoría',
    noUsers: 'Sin usuarios.',
    noRoles: 'Sin roles personalizados.',
    loading: 'Cargando…',
    loadError: 'Error cargando el resumen.',
  },
} as const;

interface AdminPageProps {
  lang: 'en' | 'es';
}

export default function AdminPage({ lang }: AdminPageProps) {
  const t = STRINGS[lang];
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/overview`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'unknown'));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <ShieldCheck size={22} className="text-pink-400" />
            {t.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{t.subtitle}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {t.loadError} · {error}
          </div>
        )}

        {data === null ? (
          <div className="text-sm text-gray-500">{t.loading}</div>
        ) : (
          <div className="space-y-6">
            {/* Tenant card */}
            <Section title={t.tenantTitle} icon={<Building2 size={16} />}>
              {data.tenant ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <Field label="Name" value={data.tenant.name} />
                  <Field label={t.slug} value={data.tenant.slug} />
                  <Field label={t.plan} value={data.tenant.plan} />
                  <Field
                    label={t.created}
                    value={new Date(data.tenant.createdAt).toLocaleDateString()}
                  />
                  <Field label={t.sso} value={data.tenant.workosOrganizationId ?? t.notLinked} />
                  <Field label={t.billing} value={data.tenant.stripeCustomerId ?? t.notLinked} />
                </dl>
              ) : null}
            </Section>

            {/* Counts */}
            <Section title={t.countsTitle} icon={<KeyRound size={16} />}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <CountCard label={t.runbooks} value={data.counts.runbooks} />
                <CountCard label={t.runs} value={data.counts.runs} />
                <CountCard label={t.schedules} value={data.counts.schedules} />
                <CountCard label={t.agents} value={data.counts.agents} />
                <CountCard label={t.monitors} value={data.counts.monitors} />
                <CountCard label={t.webhooks} value={data.counts.webhooks} />
                <CountCard label={t.apiKeys} value={data.counts.apiKeys} />
                <CountCard label={t.auditEvents} value={data.counts.auditEvents} />
              </div>
            </Section>

            {/* Users */}
            <Section title={t.usersTitle} icon={<Users size={16} />}>
              {data.users.length === 0 ? (
                <div className="text-sm text-gray-500">{t.noUsers}</div>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {data.users.map(u => (
                    <li key={u.id} className="flex items-center gap-3 py-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-xs text-gray-400">
                        {(u.name ?? u.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-gray-200">{u.name ?? u.email}</div>
                        <div className="text-[10px] text-gray-500">{u.email}</div>
                      </div>
                      <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                        {u.role}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Custom roles */}
            <Section title={t.rolesTitle} icon={<ShieldCheck size={16} />}>
              {data.customRoles.length === 0 ? (
                <div className="text-sm text-gray-500">{t.noRoles}</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.customRoles.map(r => (
                    <li key={r.id} className="rounded border border-white/5 bg-black/20 px-3 py-2">
                      <div className="font-medium text-gray-200">{r.name}</div>
                      {r.description && (
                        <div className="mt-0.5 text-xs text-gray-500">{r.description}</div>
                      )}
                      <div className="mt-1 font-mono text-[10px] text-gray-600">
                        {r.permissions.join(' · ')}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-4 py-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-gray-600">{label}</dt>
      <dd className="truncate font-mono text-xs text-gray-300">{value}</dd>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}
