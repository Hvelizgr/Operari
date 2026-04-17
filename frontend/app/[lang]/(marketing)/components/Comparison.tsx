'use client';

import { motion } from 'framer-motion';
import { Check, X, Minus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { content } from '@/app/[lang]/content/en';
import AuroraBackground from './AuroraBackground';

type ComparisonProps = {
  content: typeof content.comparison;
};

/**
 * Comparison — the "honest table" section.
 *
 * Why this exists: SREs senior have seen 50 landing pages that pretend
 * to be everything for everyone. The fastest way to earn their trust
 * is to show where you LOSE. We render a sortable-style table with
 * tilted favorability (NanoRun column highlighted) but explicit X
 * marks where we lose. The footnote spells out the loss in prose.
 *
 * The visual cues:
 *   - "yes"/"sí"     → green check
 *   - "no"           → red X
 *   - "partial"/"parcial" → amber dash
 *   - any string     → rendered as plain text (price columns, license types)
 *
 * NanoRun column has a subtle highlight column behind it so it pops
 * without being obnoxious.
 */
export default function Comparison({ content }: ComparisonProps) {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <AuroraBackground
        orbs={[
          { color: 'foreground', size: 1100, x: '15%', y: '15%', opacity: 0.03, duration: 24, drift: 70 },
          { color: 'primary', size: 600, x: '70%', y: '60%', opacity: 0.04, duration: 19, delay: 4, drift: 45 },
        ]}
      />

      <div className="container relative z-10 px-4 sm:px-6 mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.4 }}
            className="text-xs uppercase tracking-widest font-semibold text-primary/80 mb-4"
          >
            {content.eyebrow}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4 sm:mb-6"
          >
            {content.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            {content.subtitle}
          </motion.p>
        </div>

        {/* Mobile card view — visible only below md. A full table at this
            width is unreadable even with horizontal scroll, so on small
            screens we render a stack of "NanoRun vs X" cards comparing
            us to each competitor across the same features. */}
        <div className="md:hidden">
          <MobileComparison content={content} />
        </div>

        {/* Desktop table — visible from md+. Rows reveal one by one. */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
          }}
          className="hidden md:block rounded-2xl border border-border/60 bg-card/50 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/20"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <motion.tr
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { duration: 0.4, delay: 0.15 } },
                  }}
                  className="border-b border-border/60 bg-background/40"
                >
                  {content.headers.map((header, idx) => (
                    <th
                      key={idx}
                      className={`text-left px-4 md:px-5 py-4 text-xs uppercase tracking-wider font-semibold ${
                        idx === 1
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </motion.tr>
              </thead>
              <tbody>
                {content.rows.map((row, rowIdx) => (
                  <motion.tr
                    key={row.feature}
                    variants={{
                      hidden: { opacity: 0, x: -8 },
                      visible: {
                        opacity: 1,
                        x: 0,
                        transition: {
                          duration: 0.35,
                          delay: 0.3 + rowIdx * 0.06,
                          ease: 'easeOut',
                        },
                      },
                    }}
                    className={`border-b border-border/30 last:border-0 ${rowIdx % 2 === 0 ? 'bg-background/[0.015]' : ''}`}
                  >
                    <td className="px-4 md:px-5 py-4 text-sm text-foreground/90 font-medium">
                      {row.feature}
                    </td>
                    {row.cells.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={`px-4 md:px-5 py-4 text-sm ${cellIdx === 0 ? 'bg-primary/[0.05]' : ''}`}
                      >
                        <Cell value={cell} highlighted={cellIdx === 0} />
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Honest footnote + closing CTA. The CTA is the missing button
            from the previous version — without it, the section ended in
            the air and visitors had to scroll on faith. */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm text-muted-foreground text-center mt-6 sm:mt-8 max-w-3xl mx-auto leading-relaxed px-2"
        >
          {content.footnote}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex justify-center mt-6 sm:mt-8"
        >
          <Link
            href="#self-host"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/15 group"
          >
            {content.cta}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Mobile-only comparison view — one card per competitor, each card
 * lists the same features as the desktop table. This is the standard
 * "responsive table" pattern: at narrow widths, you don't make the
 * table smaller, you transpose it.
 *
 * The first card is NanoRun itself, highlighted, so the visitor sees
 * "what we do" before "how we compare to X".
 */
function MobileComparison({ content }: { content: ComparisonProps['content'] }) {
  const competitors = content.headers.slice(1); // skip the empty first header
  return (
    <div className="space-y-4">
      {competitors.map((competitor, colIdx) => {
        const isUs = colIdx === 0;
        return (
          <motion.div
            key={competitor}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, delay: colIdx * 0.05 }}
            className={`rounded-2xl border bg-card/60 backdrop-blur-md overflow-hidden shadow-lg shadow-black/20 ${isUs ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border/60'}`}
          >
            <div
              className={`px-4 py-3 border-b border-border/40 flex items-center justify-between ${isUs ? 'bg-primary/[0.08]' : 'bg-background/40'}`}
            >
              <span
                className={`font-semibold text-sm ${isUs ? 'text-primary' : 'text-foreground'}`}
              >
                {competitor}
              </span>
              {isUs && (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/80">
                  this is us
                </span>
              )}
            </div>
            <div className="divide-y divide-border/30">
              {content.rows.map((row) => (
                <div
                  key={row.feature}
                  className="px-4 py-3 flex items-start justify-between gap-3"
                >
                  <span className="text-xs text-muted-foreground flex-1 leading-snug">
                    {row.feature}
                  </span>
                  <div className="shrink-0">
                    <Cell value={row.cells[colIdx]} highlighted={isUs} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * Cell — render a comparison cell.
 *
 * Recognizes a few sentinel values ("yes", "sí", "no", "partial",
 * "parcial") and renders them as icons. Anything else (license names,
 * prices) is rendered as styled text. The highlighted variant is
 * used for the NanoRun column so the green checks read brighter.
 */
function Cell({ value, highlighted }: { value: string; highlighted: boolean }) {
  const v = value.toLowerCase();

  if (v === 'yes' || v === 'sí') {
    return (
      <div
        className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${highlighted ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-emerald-500/10 border border-emerald-500/30'}`}
      >
        <Check className={`w-3.5 h-3.5 ${highlighted ? 'text-emerald-300' : 'text-emerald-400'}`} />
      </div>
    );
  }
  if (v === 'no') {
    return (
      <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-500/10 border border-red-500/30">
        <X className="w-3.5 h-3.5 text-red-400" />
      </div>
    );
  }
  if (v === 'partial' || v === 'parcial') {
    return (
      <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/10 border border-amber-500/30">
        <Minus className="w-3.5 h-3.5 text-amber-400" />
      </div>
    );
  }
  return (
    <span
      className={`font-mono text-xs ${highlighted ? 'text-foreground/95' : 'text-muted-foreground'}`}
    >
      {value}
    </span>
  );
}
