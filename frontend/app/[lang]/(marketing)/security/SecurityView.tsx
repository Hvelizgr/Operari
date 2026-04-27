'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Box,
  Clock,
  FileKey,
  Globe2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import type { content as contentEn } from '../../content/en';

type Security = typeof contentEn.security;

const SECTION_ICONS = [Mail, Box, FileKey, ShieldCheck, Globe2, BadgeCheck];

const COMPLIANCE = [
  { label: 'AGPL-3.0', status: 'active' as const },
  { label: 'SOC 2', status: 'progress' as const, note: 'Type I · Q4 2026' },
  { label: 'GDPR', status: 'active' as const },
  { label: 'HIPAA', status: 'plan' as const, note: 'Business + BAA' },
  { label: 'FedRAMP', status: 'plan' as const, note: 'Moderate · 2027' },
];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-primary/15 text-primary border-primary/40',
  progress: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  plan: 'bg-foreground/5 text-foreground/60 border-foreground/20',
};

/**
 * Security — trust-report shape (Stripe Trust / Vanta-style).
 *
 * Differs from a marketing page: opens with an animated padlock that
 * locks on mount (the shackle drops into the body) plus a four-metric
 * status dashboard. The body sections render as icon-on-left rows
 * instead of a flat card grid, so the page reads as a *report* rather
 * than as another emerald-pill landing variant.
 */
export default function SecurityView({ content, lang }: { content: Security; lang: string }) {
  return (
    <main className="bg-background relative overflow-hidden">
      {/* Subtle parallel-line texture — feels like watermark on a security PDF */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.6), rgba(255,255,255,0.6) 1px, transparent 1px, transparent 6px)',
        }}
        aria-hidden="true"
      />

      <div className="relative">
        {/* HERO — padlock + headline */}
        <section className="container mx-auto max-w-5xl px-4 pb-12 pt-28 sm:px-6 sm:pt-36">
          <div className="grid items-center gap-10 lg:grid-cols-[auto,1fr] lg:gap-14">
            <PadlockMark />
            <div>
              <div className="bg-primary/10 border-primary/30 text-primary mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                {content.updated}
              </div>
              <h1 className="text-foreground mb-4 text-4xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl">
                {content.title}
              </h1>
              <p className="text-muted-foreground max-w-xl text-base leading-relaxed sm:text-lg">
                {content.subtitle}
              </p>
            </div>
          </div>
        </section>

        {/* Trust dashboard */}
        <section className="container mx-auto mb-12 max-w-5xl px-4 sm:px-6">
          <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border backdrop-blur-md">
            <div className="divide-border/40 grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">
              <DashboardMetric
                icon={Activity}
                value="100%"
                label={lang === 'es' ? 'Uptime · 30 días' : 'Uptime · 30 days'}
                tone="emerald"
              />
              <DashboardMetric
                icon={AlertCircle}
                value="0"
                label={lang === 'es' ? 'Incidentes abiertos' : 'Open incidents'}
                tone="emerald"
              />
              <DashboardMetric
                icon={Clock}
                value="<24h"
                label={lang === 'es' ? 'SLA acuse vuln.' : 'Vuln ack SLA'}
                tone="amber"
              />
              <DashboardMetric
                icon={KeyRound}
                value="SHA-256"
                label={lang === 'es' ? 'Audit chain' : 'Audit chain'}
                tone="emerald"
              />
            </div>
          </div>

          {/* Compliance row */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
            }}
            className="mt-6 flex flex-wrap items-center gap-2"
          >
            {COMPLIANCE.map(c => (
              <motion.div
                key={c.label}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                }}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold ${STATUS_STYLES[c.status]}`}
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                {c.label}
                {c.note && (
                  <span className="hidden text-[10px] font-normal opacity-70 sm:inline">
                    · {c.note}
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Report-a-vuln band */}
        <section className="container mx-auto mb-16 max-w-5xl px-4 sm:px-6">
          <div className="border-primary/40 from-primary/[0.10] via-background/50 to-background/20 relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 sm:p-8">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-8">
              <div className="bg-primary/20 border-primary/40 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border">
                <Lock className="text-primary h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-foreground mb-1 text-lg font-bold sm:text-xl">
                  {lang === 'es' ? 'Reportar una vulnerabilidad' : 'Report a vulnerability'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {lang === 'es'
                    ? 'PGP cifrado. Acuse en 24h, triage en 72h.'
                    : 'PGP-encrypted. 24h acknowledgement, 72h triage.'}
                </p>
              </div>
              <a
                href="mailto:security@operari.dev"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/25 inline-flex h-11 items-center gap-2 rounded-lg px-5 font-mono text-sm font-semibold shadow-md"
              >
                security@operari.dev
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Report sections — alternating icon-on-left rows */}
        <section className="container mx-auto mb-20 max-w-4xl space-y-12 px-4 sm:mb-24 sm:px-6">
          {content.sections.map((section, i) => {
            const Icon = SECTION_ICONS[i] ?? ShieldCheck;
            return (
              <motion.article
                key={section.heading}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: Math.min(i, 4) * 0.04 }}
                className="grid grid-cols-[auto,1fr] items-start gap-5 sm:gap-7"
              >
                <div className="relative">
                  <div className="bg-primary/10 border-primary/30 text-primary flex h-12 w-12 items-center justify-center rounded-xl border">
                    <Icon className="h-5 w-5" />
                  </div>
                  {i < content.sections.length - 1 && (
                    <div className="bg-border/40 absolute left-1/2 top-12 h-12 w-px -translate-x-1/2" />
                  )}
                </div>
                <div className="pt-1">
                  <div className="text-muted-foreground/70 mb-1 font-mono text-[10px] uppercase tracking-[0.2em]">
                    §{String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="text-foreground mb-2 text-lg font-bold sm:text-xl">
                    {section.heading}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
                    {section.body}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </section>

        {/* Bottom contact band */}
        <section className="container mx-auto max-w-4xl px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="text-center">
            <p className="text-muted-foreground mb-4 text-sm">
              {lang === 'es'
                ? '¿Necesitás un BAA, SOC 2 report o security questionnaire?'
                : 'Need a BAA, SOC 2 report, or security questionnaire?'}
            </p>
            <Link
              href={`/${lang}/contact`}
              className="text-primary hover:text-primary/80 inline-flex items-center gap-2 text-sm font-semibold transition-colors"
            >
              {lang === 'es' ? 'Hablar con seguridad' : 'Talk to security'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Animated padlock — the shackle starts open and above the body, then
 * drops into the closed position when the section enters view. Subtle
 * keyhole pulse keeps the eye on it for visitors who linger.
 */
function PadlockMark() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative mx-auto h-32 w-32 sm:h-40 sm:w-40 lg:mx-0"
      aria-hidden="true"
    >
      {/* Halo ring */}
      <motion.div
        className="border-primary/30 absolute inset-0 rounded-full border"
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.6, 0.2, 0.6] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="lockBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--card))" />
            <stop offset="100%" stopColor="hsl(var(--background))" />
          </linearGradient>
        </defs>

        {/* Shackle — drops in on mount */}
        <motion.path
          d="M 40 60 V 40 a 20 20 0 0 1 40 0 V 60"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="6"
          strokeLinecap="round"
          initial={reduce ? undefined : { y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        />

        {/* Body */}
        <rect
          x="28"
          y="58"
          width="64"
          height="48"
          rx="8"
          fill="url(#lockBody)"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.7"
          strokeWidth="2"
        />

        {/* Keyhole */}
        <motion.g
          initial={reduce ? undefined : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          style={{ transformOrigin: '60px 80px' }}
        >
          <circle cx="60" cy="78" r="5" fill="hsl(var(--primary))" />
          <rect x="58" y="80" width="4" height="14" fill="hsl(var(--primary))" />
        </motion.g>
      </svg>
    </motion.div>
  );
}

function DashboardMetric({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Activity;
  value: string;
  label: string;
  tone: 'emerald' | 'amber';
}) {
  const valueClass = tone === 'amber' ? 'text-amber-300' : 'text-primary';
  return (
    <div className="p-5 sm:p-6">
      <div className="text-muted-foreground mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums sm:text-3xl ${valueClass}`}>{value}</div>
    </div>
  );
}
