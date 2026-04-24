'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox as InboxIcon,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { EmptyState } from '../Common/EmptyState';

type RunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED';

interface DashboardOverview {
  pulse: {
    runs24h: number;
    successRate24h: number | null;
    avgDurationMs24h: number | null;
    pendingApprovals: number;
  };
  attention: {
    pendingApprovals: Array<{
      id: string;
      runbookName: string;
      requestedBy: string | null;
      createdAt: string;
    }>;
    stuckRuns: Array<{
      id: string;
      runbookName: string;
      startedAt: string;
    }>;
    recentFailures: Array<{
      id: string;
      runbookName: string;
      error: string | null;
      completedAt: string | null;
    }>;
  };
  liveRuns: Array<{
    id: string;
    runbookName: string;
    trigger: string | null;
    startedAt: string;
  }>;
  recentRuns: Array<{
    id: string;
    runbookName: string;
    status: RunStatus;
    startedAt: string;
    duration: number | null;
  }>;
  trend7d: Array<{ date: string; success: number; failed: number; cancelled: number }>;
  topRunbooks: Array<{
    slug: string | null;
    name: string;
    runs: number;
    successRate: number | null;
    avgDurationMs: number | null;
    /** Up to 20 statuses, oldest first, for an inline sparkline. */
    recentStatuses: string[];
  }>;
  health: {
    auditChainIntact: boolean | null;
    webhooksActive: number;
    webhooksLastFiredAt: string | null;
  };
}

const STRINGS = {
  en: {
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    today: 'Operational pulse · last 24h',
    bannerFailures: 'failing',
    bannerStuck: 'stuck',
    bannerApprovals: 'pending approvals',
    bannerJump: 'Review →',
    lastUpdatePrefix: 'Last update',
    lastUpdateJustNow: 'just now',
    lastUpdateAgo: 'ago',
    pulseRuns24h: 'Runs · 24h',
    pulseSuccess: 'Success rate',
    pulseAvg: 'Avg duration',
    pulsePending: 'Pending approvals',
    attentionTitle: 'Needs your attention',
    attentionAllClear: 'All clear · 0 pending approvals · 0 stuck runs · 0 recent failures',
    liveTitle: 'Live runs',
    liveEmpty: 'No runs in flight.',
    recentTitle: 'Recent runs',
    recentEmpty: 'No runs to show.',
    viewAll: 'View all →',
    trendTitle: '7-day trend',
    topTitle: 'Top runbooks',
    topEmpty: 'No runbook executions yet.',
    healthTitle: 'System health',
    healthAudit: 'Audit chain',
    healthIntact: 'intact',
    healthBroken: 'broken',
    healthUnknown: 'unknown',
    healthWebhooks: 'Webhooks',
    active: 'active',
    loading: 'Loading dashboard…',
    loadError: 'Failed to load dashboard.',
    askAi: 'Ask AI',
  },
  es: {
    greetingMorning: 'Buenos días',
    greetingAfternoon: 'Buenas tardes',
    greetingEvening: 'Buenas noches',
    today: 'Pulso operativo · últimas 24h',
    bannerFailures: 'fallando',
    bannerStuck: 'atascados',
    bannerApprovals: 'aprobaciones pendientes',
    bannerJump: 'Revisar →',
    lastUpdatePrefix: 'Última señal',
    lastUpdateJustNow: 'ahora mismo',
    lastUpdateAgo: 'atrás',
    pulseRuns24h: 'Ejecuciones · 24h',
    pulseSuccess: 'Tasa de éxito',
    pulseAvg: 'Duración media',
    pulsePending: 'Aprobaciones pendientes',
    attentionTitle: 'Requiere tu atención',
    attentionAllClear: 'Todo en orden · 0 aprobaciones · 0 runs atascados · 0 fallos recientes',
    liveTitle: 'Ejecuciones en vivo',
    liveEmpty: 'Sin ejecuciones en curso.',
    recentTitle: 'Ejecuciones recientes',
    recentEmpty: 'No hay ejecuciones para mostrar.',
    viewAll: 'Ver todo →',
    trendTitle: 'Tendencia 7 días',
    topTitle: 'Runbooks principales',
    topEmpty: 'Aún no hay ejecuciones de runbooks.',
    healthTitle: 'Estado del sistema',
    healthAudit: 'Cadena de auditoría',
    healthIntact: 'íntegra',
    healthBroken: 'rota',
    healthUnknown: 'desconocida',
    healthWebhooks: 'Webhooks',
    active: 'activos',
    loading: 'Cargando dashboard…',
    loadError: 'Fallo al cargar el dashboard.',
    askAi: 'Preguntar a la IA',
  },
} as const;

function greeting(t: (typeof STRINGS)[keyof typeof STRINGS]): string {
  const h = new Date().getHours();
  if (h < 12) return t.greetingMorning;
  if (h < 19) return t.greetingAfternoon;
  return t.greetingEvening;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatPercent(rate: number | null): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function statusDot(status: RunStatus): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-500';
    case 'FAILED':
      return 'bg-red-500';
    case 'RUNNING':
      return 'bg-primary animate-pulse';
    case 'PAUSED':
      return 'bg-amber-500';
    case 'CANCELLED':
      return 'bg-gray-500';
  }
}

interface DashboardPageProps {
  lang: 'en' | 'es';
}

export default function DashboardPage({ lang }: DashboardPageProps) {
  const t = STRINGS[lang];
  const router = useRouter();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  // Re-render once per second so the "last update Xs ago" ticker stays
  // honest. Cheap because the whole page is static between polls.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const askAiAboutRun = async (runId: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      const res = await fetch(`${apiBase}/api/chat/conversations/from-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) return;
      const { id, prompt } = (await res.json()) as { id: string; prompt: string };
      router.push(`/${lang}/chat?id=${id}&prompt=${encodeURIComponent(prompt)}`);
    } catch {
      // silent — the dashboard should not crash on a quick-action failure
    }
  };

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/api/dashboard/overview`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DashboardOverview;
        if (!cancelled) {
          setData(json);
          setError(null);
          setLastUpdatedAt(Date.now());
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'unknown');
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const hasAttention =
    !!data &&
    (data.attention.pendingApprovals.length > 0 ||
      data.attention.stuckRuns.length > 0 ||
      data.attention.recentFailures.length > 0);

  // Supabase-style collapsing banner. When all is well, it does not
  // render at all (zero vertical space). When something needs
  // attention, it dominates the top of the page with tinted bg + counts
  // + a jump CTA so a 3am operator sees the situation in one glance.
  const banner = (() => {
    if (!data || !hasAttention) return null;
    const failing = data.attention.recentFailures.length;
    const stuck = data.attention.stuckRuns.length;
    const approvals = data.attention.pendingApprovals.length;
    const tone = failing > 0 ? 'err' : 'warn';
    const bg =
      tone === 'err'
        ? 'border-red-500/40 bg-red-950/40 text-red-100'
        : 'border-amber-500/40 bg-amber-950/30 text-amber-100';
    const dot = tone === 'err' ? 'bg-red-400' : 'bg-amber-400';
    const parts: string[] = [];
    if (failing > 0) parts.push(`${failing} ${t.bannerFailures}`);
    if (stuck > 0) parts.push(`${stuck} ${t.bannerStuck}`);
    if (approvals > 0) parts.push(`${approvals} ${t.bannerApprovals}`);
    return (
      <div className={`mb-6 flex items-center gap-3 rounded-md border px-4 py-3 text-sm ${bg}`}>
        <span className={`h-2 w-2 flex-shrink-0 animate-pulse rounded-full ${dot}`} />
        <span className="flex-1">{parts.join(' · ')}</span>
        <button
          onClick={() => router.push(`/${lang}/runs`)}
          className="rounded px-2 py-1 text-xs font-medium underline-offset-2 hover:underline"
        >
          {t.bannerJump}
        </button>
      </div>
    );
  })();

  // "Last update Xs ago" ticker. Reassures the operator the pipeline
  // is live even when the page shows zeros — a common concern with
  // polled dashboards (Grafana OnCall pattern).
  const lastUpdateText = (() => {
    if (lastUpdatedAt == null) return null;
    const sec = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
    if (sec < 3) return `${t.lastUpdatePrefix} · ${t.lastUpdateJustNow}`;
    if (sec < 60) return `${t.lastUpdatePrefix} · ${sec}s ${t.lastUpdateAgo}`;
    const min = Math.floor(sec / 60);
    return `${t.lastUpdatePrefix} · ${min}m ${t.lastUpdateAgo}`;
  })();

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f1218] text-gray-200">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {banner}
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{greeting(t)}</h1>
            <p className="mt-1 text-sm text-gray-500">{t.today}</p>
          </div>
          {lastUpdateText && (
            <div className="whitespace-nowrap pt-2 text-[11px] text-gray-600">{lastUpdateText}</div>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {t.loadError} · {error}
          </div>
        )}

        {/* Fresh-tenant empty state. Shows only when the
                    backend returned an overview and everything reads
                    zero — new accounts land here with nothing to
                    look at, and a blank dashboard was the biggest
                    complaint in the UX audit. */}
        {data &&
          data.pulse.runs24h === 0 &&
          data.liveRuns.length === 0 &&
          data.recentRuns.length === 0 &&
          data.topRunbooks.length === 0 &&
          !hasAttention && (
            <div className="mb-8">
              <EmptyState
                icon={Sparkles}
                title={
                  lang === 'en'
                    ? "Nothing here yet — that's expected."
                    : 'Nada acá todavía — esperable.'
                }
                body={
                  lang === 'en'
                    ? 'Start from a template to see a real runbook executing in 30 seconds. Dry-run against prod before firing anything real.'
                    : 'Arrancá desde un template para ver un runbook real ejecutándose en 30 segundos. Probá dry-run contra prod antes de disparar nada real.'
                }
                primaryLabel={lang === 'en' ? 'Browse templates' : 'Ver templates'}
                primaryHref={`/${lang}/templates`}
                secondaryLabel={lang === 'en' ? 'Open the editor' : 'Abrir editor'}
                secondaryHref={`/${lang}/editor`}
              />
            </div>
          )}

        {/* (1) Pulse strip */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PulseCard
            icon={<Activity size={16} />}
            label={t.pulseRuns24h}
            value={data ? String(data.pulse.runs24h) : '—'}
          />
          <PulseCard
            icon={<CheckCircle2 size={16} />}
            label={t.pulseSuccess}
            value={data ? formatPercent(data.pulse.successRate24h) : '—'}
            tone={
              data && data.pulse.successRate24h != null
                ? data.pulse.successRate24h < 0.75
                  ? 'danger'
                  : data.pulse.successRate24h < 0.9
                    ? 'warn'
                    : 'ok'
                : undefined
            }
          />
          <PulseCard
            icon={<Clock size={16} />}
            label={t.pulseAvg}
            value={data ? formatDuration(data.pulse.avgDurationMs24h) : '—'}
          />
          <PulseCard
            icon={<InboxIcon size={16} />}
            label={t.pulsePending}
            value={data ? String(data.pulse.pendingApprovals) : '—'}
            tone={data && data.pulse.pendingApprovals > 0 ? 'warn' : undefined}
          />
        </div>

        {/* (2) Needs attention. Each row is a button so an operator
            can jump straight to the surface that resolves it —
            approvals to /inbox, stuck runs and failures to the run
            detail where the event log + step replay live. */}
        <Section title={t.attentionTitle} icon={<AlertTriangle size={16} />}>
          {data && !hasAttention ? (
            <div className="text-sm text-emerald-400">{t.attentionAllClear}</div>
          ) : data ? (
            <ul className="space-y-1 text-sm">
              {data.attention.pendingApprovals.slice(0, 5).map(a => (
                <li key={a.id}>
                  <button
                    onClick={() => router.push(`/${lang}/inbox`)}
                    className="flex w-full items-center gap-2 rounded py-1 text-left text-amber-300 transition-colors hover:bg-white/5"
                  >
                    <InboxIcon size={14} />
                    <span className="text-gray-300">{a.runbookName}</span>
                    <span className="text-gray-500">· {a.requestedBy ?? '—'}</span>
                  </button>
                </li>
              ))}
              {data.attention.stuckRuns.slice(0, 5).map(r => (
                <li key={r.id}>
                  <button
                    onClick={() => router.push(`/${lang}/runs/${r.id}`)}
                    className="flex w-full items-center gap-2 rounded py-1 text-left text-amber-300 transition-colors hover:bg-white/5"
                  >
                    <Activity size={14} />
                    <span className="text-gray-300">{r.runbookName}</span>
                  </button>
                </li>
              ))}
              {data.attention.recentFailures.slice(0, 5).map(f => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded text-red-400 hover:bg-white/5"
                >
                  <button
                    onClick={() => router.push(`/${lang}/runs/${f.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                  >
                    <AlertTriangle size={14} />
                    <span className="text-gray-300">{f.runbookName}</span>
                    {f.error && <span className="flex-1 truncate text-gray-500">· {f.error}</span>}
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      askAiAboutRun(f.id);
                    }}
                    className="text-primary/40 hover:bg-primary/10 mr-1 flex flex-shrink-0 items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
                    title={t.askAi}
                  >
                    <Sparkles size={12} />
                    {t.askAi}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">{t.loading}</div>
          )}
        </Section>

        {/* (3) Live runs */}
        <Section title={t.liveTitle} icon={<Zap size={16} />}>
          {data && data.liveRuns.length === 0 ? (
            <div className="text-sm text-gray-500">{t.liveEmpty}</div>
          ) : data ? (
            <ul className="space-y-1 text-sm">
              {data.liveRuns.map(r => (
                <li key={r.id} className="border-b border-white/5 last:border-0">
                  <button
                    onClick={() => router.push(`/${lang}/runs/${r.id}`)}
                    className="flex w-full items-center gap-3 rounded py-1 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="bg-primary h-2 w-2 animate-pulse rounded-full" />
                    <span className="flex-1 text-gray-300">{r.runbookName}</span>
                    <span className="text-xs text-gray-500">{r.trigger ?? 'manual'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">{t.loading}</div>
          )}
        </Section>

        {/* (4) Recent runs */}
        <Section
          title={t.recentTitle}
          icon={<Clock size={16} />}
          action={
            <a href={`/${lang}/runs`} className="text-primary/70 hover:text-primary/40 text-xs">
              {t.viewAll}
            </a>
          }
        >
          {data && data.recentRuns.length === 0 ? (
            <div className="text-sm text-gray-500">{t.recentEmpty}</div>
          ) : data ? (
            <ul className="text-sm">
              {data.recentRuns.map(r => (
                <li key={r.id} className="border-b border-white/5 last:border-0">
                  <button
                    onClick={() => router.push(`/${lang}/runs/${r.id}`)}
                    className="flex w-full items-center gap-3 rounded py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <span className={`h-2 w-2 rounded-full ${statusDot(r.status)}`} />
                    <span className="flex-1 truncate text-gray-300">{r.runbookName}</span>
                    <span className="text-xs text-gray-500">{formatDuration(r.duration)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">{t.loading}</div>
          )}
        </Section>

        {/* (5) 7-day trend */}
        <Section title={t.trendTitle} icon={<Activity size={16} />}>
          {data ? (
            <Trend7d data={data.trend7d} />
          ) : (
            <div className="text-sm text-gray-500">{t.loading}</div>
          )}
        </Section>

        {/* (6) Top runbooks */}
        <Section title={t.topTitle} icon={<CheckCircle2 size={16} />}>
          {data && data.topRunbooks.length === 0 ? (
            <div className="text-sm text-gray-500">{t.topEmpty}</div>
          ) : data ? (
            <ul className="text-sm">
              {data.topRunbooks.map(rb => (
                <li
                  key={rb.slug ?? rb.name}
                  className="flex items-center gap-3 border-b border-white/5 py-2 last:border-0"
                >
                  <span className="flex-1 truncate text-gray-300">{rb.name}</span>
                  <Sparkline statuses={rb.recentStatuses} />
                  <span className="w-16 text-right text-xs text-gray-500">{rb.runs} runs</span>
                  <span className="w-16 text-right text-xs text-gray-500">
                    {formatPercent(rb.successRate)}
                  </span>
                  <span className="w-16 text-right text-xs text-gray-500">
                    {formatDuration(rb.avgDurationMs)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">{t.loading}</div>
          )}
        </Section>

        {/* (7) System health */}
        <Section title={t.healthTitle} icon={<ShieldCheck size={16} />}>
          {data ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="text-gray-400">{t.healthAudit}:</span>
                <span
                  className={
                    data.health.auditChainIntact === true
                      ? 'text-emerald-400'
                      : data.health.auditChainIntact === false
                        ? 'text-red-400'
                        : 'text-gray-500'
                  }
                >
                  {data.health.auditChainIntact === true
                    ? t.healthIntact
                    : data.health.auditChainIntact === false
                      ? t.healthBroken
                      : t.healthUnknown}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Zap size={14} className="text-primary/70" />
                <span className="text-gray-400">{t.healthWebhooks}:</span>
                <span className="text-gray-300">
                  {data.health.webhooksActive} {t.active}
                </span>
              </span>
            </div>
          ) : (
            <div className="text-sm text-gray-500">{t.loading}</div>
          )}
        </Section>
      </div>
    </div>
  );
}

function PulseCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : tone === 'ok'
          ? 'text-emerald-400'
          : 'text-white';
  return (
    <div className="rounded-md border border-white/10 bg-[#1a1f2a] px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-md border border-white/10 bg-[#1a1f2a] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
          {icon}
          <span>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// Inline health-at-a-glance strip — one tile per run, oldest first.
// 20 tiles fits the "Top Runbooks" row without pushing the numeric
// columns (runs / success rate / avg) offscreen on a laptop. Empty
// slots render as low-contrast placeholders so the row width stays
// stable regardless of history depth.
function Sparkline({ statuses }: { statuses: string[] }) {
  const SLOTS = 20;
  const padded = [...Array(Math.max(0, SLOTS - statuses.length)).fill('EMPTY'), ...statuses];
  // If history is longer than SLOTS, show the most recent SLOTS (the
  // query already caps at 20, but guard anyway).
  const visible = padded.slice(-SLOTS);
  return (
    <div className="flex h-4 items-center gap-[2px]" aria-hidden="true">
      {visible.map((s, i) => (
        <span
          key={i}
          className={`h-4 w-1 rounded-sm ${statusSparkColor(s)}`}
          title={s !== 'EMPTY' ? s : undefined}
        />
      ))}
    </div>
  );
}

function statusSparkColor(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-500/80';
    case 'FAILED':
      return 'bg-red-500/80';
    case 'RUNNING':
      return 'bg-sky-500/80';
    case 'PAUSED':
      return 'bg-amber-500/80';
    case 'CANCELLED':
      return 'bg-zinc-500/60';
    case 'EMPTY':
    default:
      return 'bg-white/5';
  }
}

function Trend7d({
  data,
}: {
  data: Array<{ date: string; success: number; failed: number; cancelled: number }>;
}) {
  const max = Math.max(1, ...data.map(d => d.success + d.failed + d.cancelled));
  return (
    <div className="flex h-24 items-end gap-2">
      {data.map(d => {
        const total = d.success + d.failed + d.cancelled;
        const heightPct = (total / max) * 100;
        const successPct = total > 0 ? (d.success / total) * 100 : 0;
        const failedPct = total > 0 ? (d.failed / total) * 100 : 0;
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full overflow-hidden rounded-t-sm bg-white/5"
              style={{ height: `${heightPct}%`, minHeight: '4px' }}
            >
              <div className="bg-emerald-500" style={{ height: `${successPct}%` }} />
              <div className="bg-red-500" style={{ height: `${failedPct}%` }} />
            </div>
            <span className="text-[10px] text-gray-500">
              {new Date(d.date).toLocaleDateString(undefined, {
                weekday: 'short',
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
