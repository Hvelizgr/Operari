'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Check, Minus, X } from 'lucide-react';
import Link from 'next/link';

import { content } from '@/app/[lang]/content/en';
import { useAnimeStaggerOnView } from '@/hooks/useAnimeStaggerOnView';

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
  // anime.js stagger over <tr> elements. Faster stagger than the card
  // grids (55ms) because the table reads top-to-bottom and a slower
  // stagger makes the reader wait for proof they already want.
  const tableRef = useAnimeStaggerOnView<HTMLDivElement>({
    selector: '[data-cmp-row]',
    from: { opacity: 0, translateX: -8 },
    to: { opacity: [0, 1], translateX: [-8, 0] },
    stagger: 55,
    duration: 400,
    delay: 180,
  });
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <AuroraBackground
        orbs={[
          {
            color: 'foreground',
            size: 1100,
            x: '15%',
            y: '15%',
            opacity: 0.03,
            duration: 24,
            drift: 70,
          },
          {
            color: 'primary',
            size: 600,
            x: '70%',
            y: '60%',
            opacity: 0.04,
            duration: 19,
            delay: 4,
            drift: 45,
          },
        ]}
      />

      <div className="container relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.4 }}
            className="text-primary/80 mb-4 text-xs font-semibold uppercase tracking-widest"
          >
            {content.eyebrow}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:mb-6 sm:text-4xl md:text-5xl"
          >
            {content.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-muted-foreground text-base leading-relaxed sm:text-lg"
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

        {/* Desktop table — visible from md+. anime.js reveals the
            header + each row with a sub-200ms stagger. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="border-border/60 bg-card/50 hidden overflow-hidden rounded-2xl border shadow-2xl shadow-black/20 backdrop-blur-md md:block"
        >
          <div ref={tableRef} className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr data-cmp-row className="border-border/60 bg-background/40 border-b">
                  {content.headers.map((header, idx) => (
                    <th
                      key={idx}
                      className={`px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider md:px-5 ${
                        idx === 1 ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.rows.map((row, rowIdx) => (
                  <tr
                    key={row.feature}
                    data-cmp-row
                    className={`border-border/30 border-b last:border-0 ${rowIdx % 2 === 0 ? 'bg-background/[0.015]' : ''}`}
                  >
                    <td className="text-foreground/90 px-4 py-4 text-sm font-medium md:px-5">
                      {row.feature}
                    </td>
                    {row.cells.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={`px-4 py-4 text-sm md:px-5 ${cellIdx === 0 ? 'bg-primary/[0.05]' : ''}`}
                      >
                        <Cell value={cell} highlighted={cellIdx === 0} />
                      </td>
                    ))}
                  </tr>
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
          className="text-muted-foreground mx-auto mt-6 max-w-3xl px-2 text-center text-sm leading-relaxed sm:mt-8"
        >
          {content.footnote}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 flex justify-center sm:mt-8"
        >
          <Link
            href="#self-host"
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/15 group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-lg transition-all active:scale-[0.98]"
          >
            {content.cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
            className={`bg-card/60 overflow-hidden rounded-2xl border shadow-lg shadow-black/20 backdrop-blur-md ${isUs ? 'border-primary/50 ring-primary/30 ring-1' : 'border-border/60'}`}
          >
            <div
              className={`border-border/40 flex items-center justify-between border-b px-4 py-3 ${isUs ? 'bg-primary/[0.08]' : 'bg-background/40'}`}
            >
              <span
                className={`text-sm font-semibold ${isUs ? 'text-primary' : 'text-foreground'}`}
              >
                {competitor}
              </span>
              {isUs && (
                <span className="text-primary/80 text-[10px] font-semibold uppercase tracking-wider">
                  this is us
                </span>
              )}
            </div>
            <div className="divide-border/30 divide-y">
              {content.rows.map(row => (
                <div key={row.feature} className="flex items-start justify-between gap-3 px-4 py-3">
                  <span className="text-muted-foreground flex-1 text-xs leading-snug">
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
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${highlighted ? 'border border-emerald-500/50 bg-emerald-500/20' : 'border border-emerald-500/30 bg-emerald-500/10'}`}
      >
        <Check className={`h-3.5 w-3.5 ${highlighted ? 'text-emerald-300' : 'text-emerald-400'}`} />
      </div>
    );
  }
  if (v === 'no') {
    return (
      <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
        <X className="h-3.5 w-3.5 text-red-400" />
      </div>
    );
  }
  if (v === 'partial' || v === 'parcial') {
    return (
      <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
        <Minus className="h-3.5 w-3.5 text-amber-400" />
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
