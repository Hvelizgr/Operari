'use client';

import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Box,
  FileKey,
  Globe2,
  BadgeCheck,
  Mail,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import type { content as contentEn } from '../../content/en';

type Security = typeof contentEn.security;

const SECTION_ICONS = [Mail, Box, FileKey, ShieldCheck, Globe2, BadgeCheck];

const COMPLIANCE = [
  { label: 'AGPL-3.0', status: 'active' as const },
  { label: 'SOC 2', status: 'progress' as const, note: 'Type I · Q4 2026' },
  { label: 'GDPR', status: 'active' as const },
  { label: 'HIPAA', status: 'plan' as const, note: 'Business tier + BAA' },
  { label: 'FedRAMP', status: 'plan' as const, note: 'Moderate · 2027' },
];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-primary/15 text-primary border-primary/40',
  progress: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  plan: 'bg-foreground/5 text-foreground/60 border-foreground/20',
};

export default function SecurityView({ content, lang }: { content: Security; lang: string }) {
  return (
    <main className="relative bg-background">
      {/* Single diagonal emerald line — a thin "security stripe" instead of
          the marketing orbs. Reads as "technical document", not landing. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(62,207,142,0.04), transparent 30%)',
        }}
        aria-hidden="true"
      />

      <div className="relative">
        {/* HERO — centered, compact, with compliance badge row */}
        <section className="pt-28 sm:pt-36 pb-16 container mx-auto px-4 sm:px-6 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono font-medium text-primary mb-6">
            <ShieldCheck className="w-3.5 h-3.5" />
            {content.updated}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-5 leading-[1.05]">
            {content.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            {content.subtitle}
          </p>

          {/* Compliance badges */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
            }}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
          >
            {COMPLIANCE.map((c) => (
              <motion.div
                key={c.label}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-mono font-semibold ${STATUS_STYLES[c.status]}`}
              >
                <BadgeCheck className="w-3.5 h-3.5" />
                {c.label}
                {c.note && <span className="text-[10px] font-normal opacity-70 hidden sm:inline">· {c.note}</span>}
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Report-a-vuln band — most prominent callout on page */}
        <section className="container mx-auto px-4 sm:px-6 max-w-5xl mb-16">
          <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/[0.12] via-background/60 to-background/30 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
              <div className="h-14 w-14 shrink-0 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">
                  {lang === 'es' ? 'Reportar una vulnerabilidad' : 'Report a vulnerability'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {lang === 'es'
                    ? 'PGP cifrado. Acuse de recibo en 24h, triage en 72h.'
                    : 'PGP-encrypted. 24h acknowledgement, 72h triage.'}
                </p>
              </div>
              <a
                href="mailto:security@nanorun.dev"
                className="h-11 px-5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 shadow-md shadow-primary/25 inline-flex items-center gap-2 font-mono"
              >
                security@nanorun.dev
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Security features grid — 2x3 cards with icons */}
        <section className="container mx-auto px-4 sm:px-6 max-w-5xl mb-20 sm:mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {content.sections.map((section, i) => {
              const Icon = SECTION_ICONS[i] ?? ShieldCheck;
              return (
                <motion.article
                  key={section.heading}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, delay: Math.min(i, 4) * 0.05 }}
                  className="group relative rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6 hover:border-primary/30 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">
                    {section.heading}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* Bottom contact band */}
        <section className="container mx-auto px-4 sm:px-6 max-w-4xl pb-24 sm:pb-32">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {lang === 'es'
                ? '¿Necesitás un BAA, SOC 2 report o security questionnaire?'
                : 'Need a BAA, SOC 2 report, or security questionnaire?'}
            </p>
            <Link
              href={`/${lang}/contact`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              {lang === 'es' ? 'Hablar con seguridad' : 'Talk to security'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
