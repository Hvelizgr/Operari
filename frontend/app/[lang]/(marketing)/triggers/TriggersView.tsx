'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Activity,
  AlertOctagon,
  Github as GithubIcon,
} from 'lucide-react';
import type { content as contentEn } from '../../content/en';

type Triggers = typeof contentEn.triggers;

type SourceKey = 'datadog' | 'sentry' | 'github' | 'webhook';

type Source = {
  key: SourceKey;
  name: string;
  description: string;
  status: string;
  hmac: string;
  payload: string;
  vars: { from: string; to: string }[];
  icon: typeof Webhook;
  accent: string;
};

const SOURCE_DETAIL: Record<SourceKey, Omit<Source, 'name' | 'description' | 'status'>> = {
  datadog: {
    key: 'datadog',
    icon: Activity,
    accent: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
    hmac: 'X-Datadog-Webhook-Signature: sha256=…',
    payload: `{
  "alert_type": "error",
  "alert_id": "5678",
  "title": "[High] api latency p95 > 1.2s",
  "body": "service:api env:prod region:us-east-1",
  "tags": ["service:api", "env:prod"],
  "snapshot_url": "https://app.datadoghq.com/…"
}`,
    vars: [
      { from: '$.title', to: 'vars.alertTitle' },
      { from: "tag('service')", to: 'vars.service' },
      { from: '$.alert_id', to: 'vars.alertId' },
    ],
  },
  sentry: {
    key: 'sentry',
    icon: AlertOctagon,
    accent: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
    hmac: 'Sentry-Hook-Signature: <hmac-sha256>',
    payload: `{
  "action": "created",
  "data": {
    "issue": {
      "id": "8123",
      "title": "TypeError in checkout.processPayment",
      "shortId": "API-3F",
      "project": { "slug": "api" },
      "level": "error"
    }
  }
}`,
    vars: [
      { from: '$.data.issue.title', to: 'vars.error' },
      { from: '$.data.issue.project.slug', to: 'vars.service' },
      { from: '$.data.issue.shortId', to: 'vars.ref' },
    ],
  },
  github: {
    key: 'github',
    icon: GithubIcon,
    accent: 'text-foreground/80 border-foreground/30 bg-foreground/5',
    hmac: 'X-Hub-Signature-256: sha256=…',
    payload: `{
  "action": "completed",
  "workflow_run": {
    "id": 7842113,
    "name": "deploy-prod",
    "conclusion": "failure",
    "head_branch": "main",
    "head_sha": "3f9c2b7"
  },
  "repository": { "full_name": "cairn/api" }
}`,
    vars: [
      { from: '$.workflow_run.name', to: 'vars.workflow' },
      { from: '$.workflow_run.head_sha', to: 'vars.sha' },
      { from: '$.repository.full_name', to: 'vars.repo' },
    ],
  },
  webhook: {
    key: 'webhook',
    icon: Webhook,
    accent: 'text-primary border-primary/40 bg-primary/10',
    hmac: 'X-Cairn-Signature: t=…,v1=<hmac-sha256>',
    payload: `{
  "service": "checkout",
  "incident_id": "INC-2026-0042",
  "severity": "sev-1",
  "summary": "5xx spike from checkout pod (us-east-1)",
  "tags": { "team": "payments" }
}`,
    vars: [
      { from: '$.service', to: 'vars.service' },
      { from: '$.incident_id', to: 'vars.incidentId' },
      { from: '$.severity', to: 'vars.severity' },
    ],
  },
};

/**
 * Triggers — interactive integrations gallery.
 *
 * Distinct shape from the landing's TriggerSources strip:
 *   - 4 source tabs that swap an example payload, HMAC header, and a
 *     "JSONPath → runbook variable" mapping table on click. Lets the
 *     reader actually see what they're going to receive, not just brand
 *     logos with one-line descriptions.
 *   - Below the tabs, the 12 first-party shell tools render as a
 *     marquee strip (CSS-only, infinite-loop) so the page closes on
 *     "and every step calls real tools".
 */
export default function TriggersView({ triggers, lang }: { triggers: Triggers; lang: string }) {
  const sources: Source[] = triggers.items.map((t, i) => {
    const key = (['datadog', 'sentry', 'github', 'webhook'] as SourceKey[])[i];
    const detail = SOURCE_DETAIL[key];
    return { ...detail, name: t.name, description: t.description, status: t.status };
  });
  const [active, setActive] = useState<SourceKey>(sources[0].key);
  const current = sources.find(s => s.key === active)!;

  return (
    <main className="bg-background relative min-h-[88vh]">
      {/* Hero — half-pipe pattern (signal lines) backdrop */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-[0.06]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(62,207,142,0.6) 0 1px, transparent 1px 16px)',
          maskImage: 'linear-gradient(180deg, black, transparent 80%)',
          WebkitMaskImage: 'linear-gradient(180deg, black, transparent 80%)',
        }}
        aria-hidden="true"
      />

      <section className="container relative mx-auto max-w-6xl px-4 pb-12 pt-32 sm:px-6 sm:pt-40">
        <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider">
          <Webhook className="h-3 w-3" />
          {triggers.eyebrow}
        </span>
        <h1 className="text-foreground mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-6xl">
          {triggers.title}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
          {triggers.subtitle}
        </p>
      </section>

      {/* Tabs + example panel */}
      <section className="container relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {/* Source tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {sources.map(s => {
            const isActive = s.key === active;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`group inline-flex items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-all ${
                  isActive
                    ? `${s.accent} shadow-md`
                    : 'border-border/60 bg-card/30 text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-semibold">{s.name}</span>
                {isActive && (
                  <span className="bg-primary/20 border-primary/40 text-primary ml-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {s.status}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid gap-5 lg:grid-cols-[1.3fr,1fr]"
          >
            {/* Payload pane */}
            <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border backdrop-blur-md">
              <div className="border-border/40 bg-background/40 flex items-center justify-between border-b px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
                    <span className="bg-primary/60 h-2.5 w-2.5 rounded-full" />
                  </div>
                  <span className="text-muted-foreground ml-2 font-mono text-[11px]">
                    POST /v1/webhooks/{current.key}
                  </span>
                </div>
                <span className="text-primary font-mono text-[10px] uppercase tracking-wider">
                  {lang === 'es' ? 'Payload' : 'Payload'}
                </span>
              </div>
              <pre className="text-foreground/90 overflow-x-auto whitespace-pre p-5 font-mono text-[12px] leading-relaxed">
                {current.payload}
              </pre>
              <div className="border-border/40 bg-background/40 text-muted-foreground flex items-center gap-2 border-t px-5 py-3 font-mono text-[11px]">
                <ShieldCheck className="text-primary h-3.5 w-3.5" />
                <span className="truncate">{current.hmac}</span>
              </div>
            </div>

            {/* Mapping pane */}
            <div className="border-border/60 bg-card/40 rounded-2xl border p-5 backdrop-blur-md sm:p-6">
              <div className="text-muted-foreground mb-4 font-mono text-[10px] uppercase tracking-[0.2em]">
                {lang === 'es' ? 'Mapping de variables' : 'Variable mapping'}
              </div>
              <ul className="space-y-3">
                {current.vars.map(v => (
                  <li key={v.to} className="flex items-center gap-3 font-mono text-xs">
                    <span className="border-border/60 bg-background/40 text-foreground/80 flex-1 truncate rounded-md border px-2 py-1">
                      {v.from}
                    </span>
                    <ArrowRight className="text-primary h-3.5 w-3.5 shrink-0" />
                    <span className="border-primary/40 bg-primary/10 text-primary flex-1 truncate rounded-md border px-2 py-1">
                      {v.to}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="border-border/40 mt-6 border-t pt-5">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {current.description}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* "Every step calls real tools" — marquee */}
      <section className="border-border/40 bg-card/20 relative overflow-hidden border-y py-12 sm:py-16">
        <div className="container mx-auto mb-10 max-w-5xl px-4 text-center sm:px-6">
          <h2 className="text-foreground mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {triggers.callsAnything.title}
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-sm sm:text-base">
            {triggers.callsAnything.subtitle}
          </p>
        </div>

        <ToolsMarquee tools={triggers.callsAnything.tools} />
      </section>

      {/* Bottom CTA */}
      <section className="container relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <p className="text-muted-foreground mb-4 text-sm">
          {lang === 'es'
            ? '¿Tu fuente no está en la lista? Generic webhook acepta cualquier POST JSON.'
            : 'Your source not in the list? Generic webhook accepts any JSON POST.'}
        </p>
        <a
          href="https://github.com/cairn-run/cairn/blob/main/docs/webhooks.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-2 text-sm font-semibold"
        >
          {lang === 'es' ? 'Ver docs de webhooks' : 'Read webhook docs'}
          <ArrowRight className="h-4 w-4" />
        </a>
      </section>
    </main>
  );
}

/**
 * Tools marquee — duplicated track + CSS keyframe scroll. Pauses on
 * hover so a curious reader can stop and read tool names. Pure CSS;
 * no JS animation library, so it survives `prefers-reduced-motion`
 * via the global stylesheet rule.
 */
function ToolsMarquee({ tools }: { tools: readonly string[] }) {
  const doubled = [...tools, ...tools];
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
        style={{ background: 'linear-gradient(90deg, hsl(var(--background)), transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
        style={{ background: 'linear-gradient(270deg, hsl(var(--background)), transparent)' }}
      />
      <div
        className="flex w-max animate-[scrollx_28s_linear_infinite] gap-3 hover:[animation-play-state:paused]"
        style={{ animationName: 'scrollx' }}
      >
        {doubled.map((tool, i) => (
          <span
            key={`${tool}-${i}`}
            className="border-border/60 bg-background/60 text-foreground/80 inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 font-mono text-sm backdrop-blur-sm"
          >
            <span className="bg-primary h-1.5 w-1.5 rounded-full" />
            {tool}
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes scrollx {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
