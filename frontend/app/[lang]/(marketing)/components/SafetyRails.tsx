'use client';

import { motion } from 'framer-motion';
import { GitBranch, Puzzle, Shield, Zap } from 'lucide-react';

type SafetyContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  rails: Array<{ title: string; description: string; example?: string }>;
};

const ICONS = [Shield, GitBranch, Zap, Puzzle];
// public/illustrations/safety/, one per rail in content order, each with a -light twin.
const ART = ['dry-run', 'error-rollback', 'compose', 'sdk'];

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
export default function SafetyRails({ content }: { content: SafetyContent }) {
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
            const art = ART[i];
            return (
              <motion.div
                key={rail.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="border-border/60 bg-card/40 hover:bg-card/60 hover:border-primary/30 rounded-2xl border p-6 transition-all"
              >
                {art && (
                  <div className="-mt-2 mb-2 flex justify-center" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element -- animated SVG, CSS motion runs only as a plain img */}
                    <img
                      src={`/illustrations/safety/${art}-light.svg`}
                      alt=""
                      width={192}
                      height={192}
                      loading="lazy"
                      className="h-48 w-48 dark:hidden"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                    <img
                      src={`/illustrations/safety/${art}.svg`}
                      alt=""
                      width={192}
                      height={192}
                      loading="lazy"
                      className="hidden h-48 w-48 dark:block"
                    />
                  </div>
                )}
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
      </div>
    </section>
  );
}
