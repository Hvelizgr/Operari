'use client';

import { Download, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Plan = 'FREE' | 'TEAM' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
const ALLOWED_PLANS: Plan[] = ['BUSINESS', 'ENTERPRISE', 'PRO'];

interface AuditExportCardProps {
  lang: 'en' | 'es';
  viewerRole: 'ADMIN' | 'USER' | null;
  tenantPlan: Plan | null;
}

const STRINGS = {
  en: {
    title: 'Audit log export',
    hint: 'Download the full tenant audit chain as NDJSON for SIEM ingestion or compliance review. Streaming download — large exports start immediately.',
    cta: 'Download NDJSON',
    preparing: 'Preparing…',
    adminOnly: 'Only admins can export the audit log.',
    planGated: 'Available on Business and Enterprise plans.',
    upgrade: 'Upgrade plan',
    failed: 'Could not start the export. Try again in a moment.',
  },
  es: {
    title: 'Export de audit log',
    hint: 'Descargá la cadena de auditoría completa del tenant como NDJSON para ingestión en SIEM o revisión de compliance. Descarga streaming — arranca de inmediato.',
    cta: 'Descargar NDJSON',
    preparing: 'Preparando…',
    adminOnly: 'Solo los admins pueden exportar el audit log.',
    planGated: 'Disponible en planes Business y Enterprise.',
    upgrade: 'Mejorar plan',
    failed: 'No se pudo iniciar el export. Probá en un momento.',
  },
} as const;

/**
 * Admin-only "download the audit log" button. We don't render it at
 * all for non-admins (the route gates too, but hiding the affordance
 * saves a useless click), and we render a plan-gated state for
 * tenants below BUSINESS.
 *
 * The download uses a plain anchor + `download` attribute rather
 * than fetch → Blob → URL.createObjectURL because the audit log can
 * be tens of megabytes and we don't want the browser to buffer the
 * whole response before the user sees a filename. The backend
 * streams NDJSON; the browser saves as it receives.
 */
export function AuditExportCard({ lang, viewerRole, tenantPlan }: AuditExportCardProps) {
  const t = STRINGS[lang];
  const [starting, setStarting] = useState(false);

  if (viewerRole !== 'ADMIN') return null;

  const planAllowed = tenantPlan != null && ALLOWED_PLANS.includes(tenantPlan);

  function start() {
    if (!planAllowed || starting) return;
    setStarting(true);
    // Navigate to the export URL — the server responds with
    // Content-Disposition: attachment so the browser treats it
    // as a download without leaving the current page.
    const href = `${API_BASE}/api/tenants/audit/export`;
    const a = document.createElement('a');
    a.href = href;
    // Blank download attribute forces the filename from the
    // server's Content-Disposition header.
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Tiny delay so the button state flashes — the actual
    // download is async from here.
    setTimeout(() => setStarting(false), 800);
  }

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              planAllowed
                ? 'bg-primary/15 border-primary/40 text-primary border'
                : 'bg-[var(--weathered,#262626)] text-[var(--text-muted)]'
            }`}
          >
            {planAllowed ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{t.title}</div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--text-muted)]">
              {t.hint}
            </p>
            {!planAllowed && <p className="mt-2 text-xs text-amber-300">{t.planGated}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {planAllowed ? (
            <button
              onClick={start}
              disabled={starting}
              className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-md disabled:opacity-50"
            >
              {starting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {starting ? t.preparing : t.cta}
            </button>
          ) : (
            <Link
              href={`/${lang}/pricing`}
              className="inline-flex items-center rounded-md border border-amber-400/50 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/10"
            >
              {t.upgrade}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
