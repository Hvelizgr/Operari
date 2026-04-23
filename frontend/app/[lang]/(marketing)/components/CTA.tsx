'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { content } from '@/app/[lang]/content/en';
import { repo } from '@/config/repo.config';
import AuroraBackground from './AuroraBackground';

type CTAProps = {
  content: typeof content.cta;
};

/**
 * Final CTA — the docker compose snippet, not a "Get NanoRun" button.
 *
 * The two CTAs:
 *   1. Read the README — primary, because the README does the
 *      heavy honest selling that this landing only summarizes
 *   2. "What does NOT work yet" — counter-intuitive secondary CTA
 *      that signals confidence in the product's honesty. SREs senior
 *      open it. Junior devs ignore it. Both are correct outcomes.
 */
export default function CTA({ content }: CTAProps) {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    void navigator.clipboard.writeText(content.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <AuroraBackground
        grid
        orbs={[
          {
            color: 'primary',
            size: 1000,
            x: '15%',
            y: '15%',
            opacity: 0.1,
            duration: 16,
            drift: 55,
          },
          {
            color: 'deep',
            size: 600,
            x: '65%',
            y: '50%',
            opacity: 0.06,
            duration: 20,
            delay: 3,
            drift: 40,
          },
        ]}
      />

      <div className="container relative z-10 mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="border-border/60 bg-card/60 shadow-primary/[0.08] rounded-2xl border p-6 shadow-2xl backdrop-blur-md sm:rounded-3xl sm:p-10 md:p-16"
        >
          <div className="mb-8 text-center sm:mb-10">
            <div className="text-primary/80 mb-3 text-xs font-semibold uppercase tracking-widest sm:mb-4">
              {content.eyebrow}
            </div>
            {/* Pricing line — addresses the #1 objection up front. The
                emerald color matches the success state in the rest of
                the landing so it reads as "good news" not "marketing". */}
            <div className="mb-4 inline-flex items-center gap-2 sm:mb-5">
              <span className="bg-primary h-1.5 w-1.5 rounded-full" />
              <span className="text-primary text-sm font-semibold uppercase tracking-wider">
                {content.pricing}
              </span>
            </div>
            <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:mb-5 sm:text-4xl md:text-5xl">
              {content.title}
            </h2>
            <p className="text-muted-foreground mx-auto max-w-xl text-base leading-relaxed sm:text-lg">
              {content.subtitle}
            </p>
          </div>

          {/* Code block — fully copyable. overflow-x-auto so very long
              lines (or narrow viewports) can scroll horizontally. */}
          <div className="border-border/60 bg-background/80 group relative mb-6 overflow-hidden rounded-xl border sm:mb-8 sm:rounded-2xl">
            <div className="border-border/50 bg-background/40 flex items-center justify-between border-b px-4 py-3 sm:px-5">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <button
                onClick={copyAll}
                className="text-muted-foreground hover:text-foreground -mr-2 flex h-8 items-center gap-2 px-2 text-xs transition-colors"
                aria-label="Copy command"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-foreground/90 overflow-x-auto px-4 py-4 font-mono text-xs sm:px-5 sm:py-5 sm:text-sm">
              {content.code.split('\n').map((line, i) => (
                <div key={i} className="flex gap-2 whitespace-nowrap sm:gap-3">
                  <span className="text-primary select-none">$</span>
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          </div>

          {/* Two CTAs — primary readme, secondary "what does NOT work" */}
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={repo.readme}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 flex h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold shadow-lg transition-all active:scale-[0.98] sm:px-6"
            >
              {content.primary}
              <ExternalLink className="h-4 w-4 opacity-70" />
            </Link>
            <Link
              href={repo.notWorkingYet}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-secondary/30 hover:bg-secondary/50 hover:border-secondary text-foreground flex h-12 items-center justify-center gap-2 rounded-xl border px-5 font-semibold transition-all sm:px-6"
            >
              {content.secondary}
              <ExternalLink className="h-4 w-4 opacity-50" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
