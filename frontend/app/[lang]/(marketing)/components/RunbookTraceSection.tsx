'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useParams } from 'next/navigation';

import { RunbookTrace } from '@/components/Brand/RunbookTrace';

/**
 * Landing band that wraps the animated runbook trace with eyebrow +
 * title + subtitle copy. Sits between Story (the "how it works"
 * narrative) and SafetyRails so the visitor reads:
 *   1. Conceptually how it works (Story)
 *   2. Visually what an actual run looks like (this section)
 *   3. The four primitives that make it safe (SafetyRails)
 *
 * Visual polish:
 *   - Eyebrow + status pill that read like a real run-detail header
 *     ("RUN · sentry-rollback") instead of generic landing copy
 *   - Subtle gradient + grid backdrop on the card so the trace feels
 *     like it's mounted in a real run inspector
 *   - Soft emerald glow behind the card (radial gradient) — same
 *     accent colour the trace nodes settle into on success
 *   - Scroll-in fade so the section enters as you reach it
 *
 * The whole thing is intentionally self-contained: the trace
 * animation handles its own loop; the section just frames it.
 */

const STRINGS = {
  en: {
    eyebrow: 'Run inspector · live',
    runId: 'RUN',
    runSlug: 'sentry-rollback',
    title: 'A real runbook, in five beats.',
    subtitle:
      'Sentry alerts. NanoRun fetches logs, rolls back the deploy, asks on-call to confirm, posts to #incidents — every transition lands in a SHA-256 audit chain you can verify with a single CLI command.',
    statusLabel: 'Streaming',
  },
  es: {
    eyebrow: 'Run inspector · en vivo',
    runId: 'RUN',
    runSlug: 'sentry-rollback',
    title: 'Un runbook real, en cinco beats.',
    subtitle:
      'Sentry dispara. NanoRun trae los logs, hace rollback del deploy, pide confirmación al on-call y publica en #incidentes — cada transición cae en una cadena de auditoría SHA-256 verificable con un solo comando.',
    statusLabel: 'Streaming',
  },
} as const;

export default function RunbookTraceSection() {
  const params = useParams();
  const lang = (params?.lang === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[lang];
  const reduced = useReducedMotion();

  return (
    <section className="border-border/40 relative overflow-hidden border-b py-20 sm:py-28">
      {/* Soft emerald glow that sits behind the card — same accent
          tone the trace settles into on success. Pure CSS gradient,
          no animation, so it's free at every scroll position. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[920px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.06] blur-3xl"
      />
      <div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-10 max-w-2xl text-center"
        >
          <p className="m-eyebrow mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {t.eyebrow}
          </p>
          <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {t.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base sm:text-lg">{t.subtitle}</p>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="border-border/60 bg-card/60 relative mx-auto overflow-hidden rounded-2xl border shadow-2xl shadow-emerald-500/[0.04] backdrop-blur-md"
        >
          {/* Inspector-style top bar — RUN id + status pill so the
              card reads like a screenshot of the real run-detail
              page, not a marketing widget. */}
          <div className="border-border/40 bg-card/80 flex items-center justify-between border-b px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                {t.runId}
              </span>
              <span className="text-foreground truncate font-mono text-xs font-medium">
                {t.runSlug}
              </span>
              <span className="hidden font-mono text-[10px] text-zinc-600 sm:inline">
                · run_3f9c2b7a
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                {t.statusLabel}
              </span>
            </div>
          </div>
          {/* Subtle dotted-grid backdrop so the trace feels grounded
              in a "canvas" rather than floating on a flat panel.
              Pure CSS, no JS layer. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 top-12 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative px-4 py-12 sm:px-10 sm:py-14">
            <RunbookTrace lang={lang} />
          </div>
        </motion.div>

        {/* Caption strip — three terse claims spaced under the card.
            Reinforces what the visitor just watched without needing
            to re-read the body copy above. */}
        <div className="text-muted-foreground mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 text-center text-sm sm:grid-cols-3">
          <span>
            <span className="text-foreground font-medium">5 step types</span>
            <br />
            wired today
          </span>
          <span>
            <span className="text-foreground font-medium">~10ms</span>
            <br />
            tail latency to every UI
          </span>
          <span>
            <span className="text-foreground font-medium">SHA-256 audit chain</span>
            <br />
            verifiable with one command
          </span>
        </div>
      </div>
    </section>
  );
}
