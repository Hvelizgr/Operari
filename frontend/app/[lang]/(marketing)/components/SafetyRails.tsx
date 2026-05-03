'use client';

import { motion } from 'framer-motion';
import { GitBranch, Puzzle, RotateCw, Shield, Zap } from 'lucide-react';

type SafetyContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  rails: Array<{ title: string; description: string; example?: string }>;
};

const ICONS = [Shield, GitBranch, Zap, Puzzle];

// trigger.dev parity — their "Reliable by default" panel pulls retry +
// timeout config out of the feature grid into a featured callout. We
// do the same with the YAML retry block: shows the actual product
// surface in 8 lines so a buyer can judge "is this verbose? subtle?"
// at a glance. YAML is identical across locales; only the prose
// switches via the `lang` prop threaded from page.tsx.
const RELIABILITY_YAML = `- id: rollback_api
  type: shell
  config:
    command: kubectl rollout undo deploy/api -n prod
  timeout: 30000
  retry:
    count: 3
    backoff: exponential
    delayMs: 500
    maxDelayMs: 8000`;

/**
 * Safety Rails — the "why NOT another n8n" section.
 *
 * These four features are the actual differentiation vs generic
 * workflow engines (n8n, Zapier clones) once a buyer gets past the
 * "visual canvas" surface: dry-run, error-workflow meta-automation,
 * sub-workflow composition, and a first-class SDK for custom steps.
 * Each is a line on the comparison table, but the table is dense —
 * this section slows the reader down and makes the case for each.
 */
export default function SafetyRails({
  content,
  lang,
}: {
  content: SafetyContent;
  lang: 'en' | 'es';
}) {
  const reliabilityCopy =
    lang === 'es'
      ? {
          eyebrow: 'Reliable by default',
          title: 'Cada step trae retry + timeout sin código extra.',
          description:
            'Política de reintentos por step en YAML: count, backoff exponencial, delays acotados. Sin SDK, sin handlers. Lo declarás una vez y el motor lo respeta tanto en runs reales como en dry-runs.',
          callout: 'YAML que parsea el motor — copiable tal cual a un .yaml.',
        }
      : {
          eyebrow: 'Reliable by default',
          title: 'Every step gets retry + timeout without writing code.',
          description:
            'Per-step retry policy in YAML: count, exponential backoff, bounded delays. No SDK, no handler. Declare it once and the engine honors it on real runs and dry-runs alike.',
          callout: 'YAML the engine parses — copy this straight into a .yaml.',
        };

  return (
    <section className="bg-background relative py-24 sm:py-32">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-14 max-w-2xl sm:mb-20">
          <span className="border-primary/30 bg-primary/10 text-primary mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <Shield className="h-3.5 w-3.5" />
            {content.eyebrow}
          </span>
          <h2 className="text-foreground text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            {content.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            {content.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {content.rails.map((rail, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <motion.div
                key={rail.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="border-border/60 bg-card/40 hover:bg-card/60 hover:border-primary/30 rounded-2xl border p-6 transition-all"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="bg-primary/10 border-primary/30 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-foreground text-lg font-bold leading-snug">{rail.title}</h3>
                </div>
                <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                  {rail.description}
                </p>
                {rail.example && (
                  <pre className="border-border/60 bg-background/40 text-foreground/80 overflow-x-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed">
                    <code>{rail.example}</code>
                  </pre>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Featured "Reliable by default" callout — trigger.dev parity.
            Two-column layout: prose on the left, YAML retry/timeout
            block on the right. Sits below the rails grid as the
            section's closer so the reader's last impression of the
            section is "look how little code this needs". */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="border-border/60 from-primary/5 mt-10 grid grid-cols-1 gap-8 rounded-2xl border bg-gradient-to-br via-transparent to-transparent p-6 sm:mt-14 sm:p-10 md:grid-cols-2"
        >
          <div className="flex flex-col justify-center">
            <span className="border-primary/30 bg-primary/10 text-primary mb-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <RotateCw className="h-3.5 w-3.5" />
              {reliabilityCopy.eyebrow}
            </span>
            <h3 className="text-foreground text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {reliabilityCopy.title}
            </h3>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed sm:text-base">
              {reliabilityCopy.description}
            </p>
            <p className="text-muted-foreground/70 mt-4 font-mono text-[11px]">
              {reliabilityCopy.callout}
            </p>
          </div>
          <div className="border-border/60 bg-background/60 overflow-hidden rounded-xl border shadow-xl">
            <div className="border-border/60 flex items-center gap-2 border-b px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              <span className="text-muted-foreground/70 ml-2 font-mono text-[10px]">
                runbook.yaml
              </span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-emerald-200/90">
              <code>{RELIABILITY_YAML}</code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
