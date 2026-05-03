'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Github } from 'lucide-react';

import { content } from '@/app/[lang]/content/en';
import { repo } from '@/config/repo.config';
import { useAnimeStaggerOnView } from '@/hooks/useAnimeStaggerOnView';
import { useTilt } from '@/hooks/useTilt';

import AuroraBackground from './AuroraBackground';

type TemplatesProps = {
  content: typeof content.templates;
};

/**
 * Templates — the proof section.
 *
 * Replaces the deleted EditorSimulation. Where EditorSimulation tried
 * to PROVE the editor exists by simulating it, Templates proves the
 * product exists by linking to real YAML files in the repo. Each
 * card opens the actual file on GitHub — no fake screenshots, no
 * "trust us, it works".
 *
 * Mobile-first:
 *   - Single column on small screens, two columns from sm+
 *   - Touch targets are the entire card (44×44 minimum guaranteed
 *     because cards are at least 200px tall)
 *   - Card descriptions wrap; no horizontal overflow
 */
export default function Templates({ content }: TemplatesProps) {
  const gridRef = useAnimeStaggerOnView<HTMLDivElement>({
    selector: '[data-template-card]',
    from: { opacity: 0, translateY: 16 },
    to: { opacity: [0, 1], translateY: [16, 0] },
    stagger: 90,
    duration: 520,
  });
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <AuroraBackground
        orbs={[
          { color: 'deep', size: 700, x: '-5%', y: '20%', opacity: 0.05, duration: 21, drift: 50 },
          {
            color: 'primary',
            size: 600,
            x: '70%',
            y: '60%',
            opacity: 0.05,
            duration: 17,
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

        {/* Cards — single column on mobile, 2 columns on sm, 2 on lg too
            because the descriptions are long and 4 columns squeezes them
            past readability. anime.js stagger on viewport (shared
            `useAnimeStaggerOnView` hook) so the cards enter with the
            same motion curve as the TriggerSources section. */}
        <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {content.items.map(tpl => (
            <TemplateCard key={tpl.slug} item={tpl} />
          ))}
        </div>

        {/* Footer CTA → all templates on GitHub */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex justify-center"
        >
          <a
            href={repo.templatesTree}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Github className="h-4 w-4" />
            {content.cta}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

const accentClasses: Record<string, { ring: string; bg: string; text: string }> = {
  violet: {
    ring: 'group-hover:border-primary/50',
    bg: 'bg-primary/10 border-primary/30',
    text: 'text-primary',
  },
  primary: {
    ring: 'group-hover:border-primary/50',
    bg: 'bg-primary/10 border-primary/30',
    text: 'text-primary',
  },
  amber: {
    ring: 'group-hover:border-foreground/30',
    bg: 'bg-foreground/5 border-foreground/20',
    text: 'text-foreground/80',
  },
  emerald: {
    ring: 'group-hover:border-emerald-500/50',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-300',
  },
};

function TemplateCard({ item }: { item: (typeof content.templates.items)[number] }) {
  const accent = accentClasses[item.accent] ?? accentClasses.primary;
  // 3D tilt — 5° feels luxe on a card this size; 800px perspective
  // matches Apple's product cards. Skipped on touch + reduced-motion
  // by the hook itself. We drop the previous `hover:-translate-y-0.5`
  // because the tilt's perspective transform replaces it; combining
  // both fights the same matrix and stutters.
  const tiltRef = useTilt<HTMLAnchorElement>({ maxRotate: 5, perspective: 800 });
  return (
    <a
      ref={tiltRef}
      href={repo.templateFile(item.slug)}
      target="_blank"
      rel="noopener noreferrer"
      data-template-card
      className={`border-border/60 bg-card/60 group relative block rounded-2xl border p-5 backdrop-blur-md sm:p-6 ${accent.ring}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${accent.bg} ${accent.text}`}
        >
          {item.category}
        </span>
        <ArrowUpRight className="text-muted-foreground/60 group-hover:text-foreground h-4 w-4 shrink-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <h3 className="text-foreground mb-2 text-base font-semibold leading-snug sm:text-lg">
        {item.title}
      </h3>
      <p className="text-muted-foreground mb-4 text-xs leading-relaxed sm:text-sm">
        {item.description}
      </p>
      {/* Footer row — filename anchors the "this is a real file"
          claim on the left, while an explicit "View example" CTA on
          the right gives a clearer affordance than the corner arrow
          alone (trigger.dev parity — every feature card surfaces the
          link as text, not just an icon). */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-muted-foreground/70 truncate font-mono text-[10px] sm:text-[11px]">
          templates/{item.slug}.yaml
        </div>
        <span
          className={`shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors sm:text-[11px] ${accent.text} opacity-80 group-hover:opacity-100`}
        >
          {item.viewLabel}
          <span
            aria-hidden="true"
            className="ml-1 inline-block transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </span>
      </div>
    </a>
  );
}
