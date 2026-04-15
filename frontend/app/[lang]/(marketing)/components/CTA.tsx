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
    <section className="py-24 sm:py-32 relative overflow-hidden">
      <AuroraBackground
        grid
        orbs={[
          { color: 'primary', size: 1000, x: '15%', y: '15%', opacity: 0.08, duration: 16, drift: 55 },
          { color: 'orange', size: 600, x: '65%', y: '50%', opacity: 0.05, duration: 20, delay: 3, drift: 40 },
        ]}
      />

      <div className="container relative z-10 px-4 sm:px-6 mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl sm:rounded-3xl border border-border/60 bg-card/60 backdrop-blur-md p-6 sm:p-10 md:p-16 shadow-2xl shadow-primary/[0.08]"
        >
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-xs uppercase tracking-widest font-semibold text-primary/80 mb-3 sm:mb-4">
              {content.eyebrow}
            </div>
            {/* Pricing line — addresses the #1 objection up front. The
                emerald color matches the success state in the rest of
                the landing so it reads as "good news" not "marketing". */}
            <div className="inline-flex items-center gap-2 mb-4 sm:mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                {content.pricing}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4 sm:mb-5">
              {content.title}
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {content.subtitle}
            </p>
          </div>

          {/* Code block — fully copyable. overflow-x-auto so very long
              lines (or narrow viewports) can scroll horizontally. */}
          <div className="relative rounded-xl sm:rounded-2xl border border-border/60 bg-background/80 overflow-hidden mb-6 sm:mb-8 group">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/50 bg-background/40">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <button
                onClick={copyAll}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors h-8 px-2 -mr-2"
                aria-label="Copy command"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="px-4 sm:px-5 py-4 sm:py-5 font-mono text-xs sm:text-sm text-foreground/90 overflow-x-auto">
              {content.code.split('\n').map((line, i) => (
                <div key={i} className="flex gap-2 sm:gap-3 whitespace-nowrap">
                  <span className="text-emerald-400 select-none">$</span>
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          </div>

          {/* Two CTAs — primary readme, secondary "what does NOT work" */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Link
              href={repo.readme}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-5 sm:px-6 rounded-xl bg-foreground text-background font-semibold hover:bg-foreground/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
              {content.primary}
              <ExternalLink className="w-4 h-4 opacity-70" />
            </Link>
            <Link
              href={repo.notWorkingYet}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-5 sm:px-6 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-secondary text-foreground font-semibold transition-all flex items-center justify-center gap-2"
            >
              {content.secondary}
              <ExternalLink className="w-4 h-4 opacity-50" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
