'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Github, Copy, Check, AlertOctagon, Webhook, ShieldCheck, Play } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { content } from '@/app/[lang]/content/en';
import { repo } from '@/config/repo.config';
import AuroraBackground from './AuroraBackground';

type HeroProps = {
  content: typeof content.hero;
};

/**
 * Hero — the alert→runbook→resolved scenario.
 *
 * The whole positioning is "Your alert fires. NanoRun runs the fix."
 * — vendor-neutral on purpose, because Sentry/Datadog/PagerDuty/Grafana/
 * GitHub Actions are all valid sources, and naming any one of them as
 * THE antagonist would make NanoRun look like an add-on for that tool.
 *
 * The visual on the right MUST be a concrete narrative, not a generic
 * gradient. We render four stacked cards that represent the lifecycle
 * of an alert in real time:
 *
 *   1. Alert fires (red) — vendor-agnostic
 *   2. Webhook hits NanoRun (yellow → connecting line lights up)
 *   3. Runbook executes step by step (steps flip to green)
 *   4. Resolved with audit hash (green badge)
 *
 * Framer Motion staggers the cards so the user actually sees the
 * sequence play out the first time the section enters the viewport.
 * No raster assets — every visual element is inline SVG/CSS so the
 * page stays fast and easy to translate.
 */
export default function Hero({ content }: HeroProps) {
  const params = useParams();
  const lang = (params.lang as string) || 'en';
  const [copied, setCopied] = useState(false);

  const copyDockerCmd = () => {
    void navigator.clipboard.writeText('docker compose up').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <section className="relative flex items-center overflow-hidden pt-28 sm:pt-32 pb-16 sm:pb-20 min-h-[88vh] lg:min-h-[100vh]">
      {/* Animated ambient background. The orbs are tuned so the orange
          one sits behind the headline (left side) and the emerald one
          behind the scenario card (right side), reinforcing the
          alert→resolved narrative even when nothing is moving. */}
      <AuroraBackground
        grid
        orbs={[
          { color: 'emerald', size: 900, x: '10%', y: '-25%', opacity: 0.1, duration: 14, drift: 40 },
          { color: 'primary', size: 750, x: '60%', y: '60%', opacity: 0.08, duration: 16, delay: 2, drift: 45 },
          { color: 'emerald', size: 500, x: '40%', y: '20%', opacity: 0.05, duration: 11, delay: 4, drift: 25 },
        ]}
      />

      <div className="container relative z-10 px-4 sm:px-6 mx-auto w-full">
        <div className="grid lg:grid-cols-[1.05fr,1fr] gap-10 sm:gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* LEFT — copy + CTAs */}
          <div className="flex flex-col items-start text-left min-w-0">
            <motion.a
              href={repo.status}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="inline-flex items-center gap-2.5 px-3 sm:px-4 py-1.5 rounded-full bg-secondary/50 border border-secondary text-secondary-foreground/90 text-xs sm:text-sm font-medium mb-6 sm:mb-8 backdrop-blur-sm hover:bg-secondary/70 transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              {content.badge}
            </motion.a>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.03em] mb-5 sm:mb-6 leading-[1.05] whitespace-pre-line text-foreground"
            >
              {content.title.split('\n').map((line, i) => (
                <span key={i}>
                  {i === 1 ? (
                    <span className="bg-gradient-to-r from-primary via-emerald-300 to-primary bg-clip-text text-transparent">{line}</span>
                  ) : (
                    line
                  )}
                  {i === 0 && '\n'}
                </span>
              ))}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-xl leading-relaxed"
            >
              {content.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
            >
              {/* Primary CTA: copyable command. The whole pitch is "you can run
                  this in 2 minutes" — putting the literal command in the hero
                  beats any "Get started" button. Touch target is h-14 (56px),
                  comfortably above the 44px iOS / Android minimum. */}
              <button
                onClick={copyDockerCmd}
                className="group h-14 pl-4 sm:pl-5 pr-3 rounded-xl bg-primary text-primary-foreground font-mono text-sm md:text-base font-semibold flex items-center gap-2 sm:gap-3 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all w-full sm:w-auto justify-center sm:justify-start"
                aria-label="Copy docker compose command"
              >
                <span className="opacity-70">$</span>
                <span>{content.ctaPrimary}</span>
                <span className="ml-1 sm:ml-2 h-10 w-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center group-hover:bg-primary-foreground/20 transition-colors">
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </span>
              </button>

              <Link
                href={repo.base}
                target="_blank"
                rel="noopener noreferrer"
                className="h-14 px-5 sm:px-6 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-secondary text-foreground font-semibold transition-all flex items-center justify-center gap-2 group"
              >
                <Github className="w-5 h-5" />
                {content.ctaSecondary}
                <ArrowRight className="hidden sm:block w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            </motion.div>

            {/* Try-editor link + trust line. Two short hints, kept secondary
                so the docker compose CTA stays the visual anchor. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="mt-5 sm:mt-6 flex flex-col gap-1.5 text-xs text-muted-foreground/70"
            >
              <Link
                href={`/${lang}/editor`}
                className="inline-flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors group"
              >
                <Play className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium">
                  {lang === 'es' ? 'Probar el editor en tu navegador' : 'Try the editor in your browser'}
                </span>
                <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                <span>
                  {lang === 'es' ? 'Sin sign-up. Sin telemetría. AGPL para siempre.' : 'No signup. No telemetry. AGPL forever.'}
                </span>
              </span>
            </motion.div>
          </div>

          {/* RIGHT — the alert→runbook scenario */}
          <HeroScenario content={content.scenario} />
        </div>
      </div>
    </section>
  );
}

/**
 * Four-frame scenario card.
 *
 * Each frame enters with a stagger so the user reads the story top to
 * bottom the first time the hero loads. After ~9s the whole sequence
 * REPLAYS via a key bump — visitors who linger get to see the story
 * a second time without having to scroll back. We use an explicit
 * key bump (instead of framer-motion `repeat`) because the stagger
 * relies on `delay`, not on `repeat: Infinity`, and bumping the key
 * is the cleanest way to remount the children with fresh delays.
 *
 * The replay also pauses on hover so users hovering one frame can
 * read it without it disappearing under them.
 */
function HeroScenario({ content: s }: { content: typeof content.hero.scenario }) {
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setCycle((c) => c + 1), 9000);
    return () => clearInterval(interval);
  }, [paused]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-sm sm:max-w-md mx-auto lg:mx-0 lg:ml-auto"
      aria-hidden="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Subtle frame around the whole stack — emerald halo top-to-bottom */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-primary/[0.08] via-transparent to-primary/[0.05] blur-2xl" />

      <div key={cycle} className="relative flex flex-col gap-3">
        {/* FRAME 1 — Alert fires (red) — vendor-agnostic on purpose */}
        <ScenarioCard delay={0.5} accent="red">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-4 h-4 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-red-400/80 mb-1">
                {s.step1Label}
              </div>
              <div className="font-mono text-xs text-foreground/90 truncate">
                {s.step1Body}
              </div>
            </div>
          </div>
        </ScenarioCard>

        {/* Connecting arrow between cards 1 → 2 */}
        <ConnectorArrow delay={0.8} />

        {/* FRAME 2 — Webhook hits NanoRun (yellow) */}
        <ScenarioCard delay={0.95} accent="amber">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Webhook className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-400/80 mb-1">
                {s.step2Label}
              </div>
              <div className="font-mono text-xs text-foreground/90 truncate">
                {s.step2Body}
              </div>
            </div>
          </div>
        </ScenarioCard>

        <ConnectorArrow delay={1.25} />

        {/* FRAME 3 — Runbook running step by step (the meaty card) */}
        <ScenarioCard delay={1.4} accent="primary" big>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary/80 mb-3">
            {s.step3Label}
          </div>
          <div className="space-y-2">
            {s.step3Steps.map((stepLabel, idx) => (
              <RunningStep key={stepLabel} label={stepLabel} delay={1.55 + idx * 0.18} />
            ))}
          </div>
        </ScenarioCard>

        <ConnectorArrow delay={2.4} />

        {/* FRAME 4 — Resolved + audit hash (green) */}
        <ScenarioCard delay={2.55} accent="emerald">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400/80 mb-1">
                {s.step4Label}
              </div>
              <div className="font-mono text-[11px] text-foreground/90 truncate">
                {s.step4Body}
              </div>
            </div>
          </div>
        </ScenarioCard>
      </div>
    </motion.div>
  );
}

const accentBorder: Record<string, string> = {
  red: 'border-red-500/20',
  amber: 'border-amber-500/20',
  primary: 'border-primary/30',
  emerald: 'border-emerald-500/25',
};

function ScenarioCard({
  children,
  delay,
  accent,
  big,
}: {
  children: React.ReactNode;
  delay: number;
  accent: keyof typeof accentBorder;
  big?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-2xl bg-card/70 backdrop-blur-md border ${accentBorder[accent]} ${big ? 'p-5' : 'p-4'} shadow-lg shadow-black/20`}
    >
      {children}
    </motion.div>
  );
}

function ConnectorArrow({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className="flex justify-center origin-top"
      aria-hidden="true"
    >
      <div className="h-3 w-px bg-gradient-to-b from-foreground/30 to-foreground/5" />
    </motion.div>
  );
}

function RunningStep({ label, delay }: { label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className="flex items-center gap-3 text-xs"
    >
      <motion.div
        initial={{ scale: 0.6, backgroundColor: 'rgba(148,163,184,0.2)' }}
        animate={{
          scale: [0.6, 1.15, 1],
          backgroundColor: [
            'rgba(148,163,184,0.2)',
            'rgba(16,185,129,0.4)',
            'rgba(16,185,129,0.25)',
          ],
        }}
        transition={{ duration: 0.6, delay: delay + 0.05 }}
        className="h-4 w-4 rounded-full border border-emerald-500/40 flex items-center justify-center shrink-0"
      >
        <Check className="w-2.5 h-2.5 text-emerald-400" />
      </motion.div>
      <span className="font-mono text-foreground/80 truncate">{label}</span>
    </motion.div>
  );
}
