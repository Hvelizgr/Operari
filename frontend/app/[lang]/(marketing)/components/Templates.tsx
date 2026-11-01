'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Github } from 'lucide-react';

import { content } from '@/app/[lang]/content/en';
import { repo } from '@/config/repo.config';
import { useAnimeStaggerOnView } from '@/hooks/useAnimeStaggerOnView';

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
          {content.items.map((tpl, i) => (
            <TemplateCard key={tpl.slug} item={tpl} index={i} />
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

function TemplateCard({
  item,
  index,
}: {
  item: (typeof content.templates.items)[number];
  index: number;
}) {
  const accent = accentClasses[item.accent] ?? accentClasses.primary;
  return (
    <a
      href={repo.templateFile(item.slug)}
      target="_blank"
      rel="noopener noreferrer"
      data-template-card
      className={`border-border/60 bg-card/60 group relative block rounded-2xl border p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 sm:p-6 ${accent.ring}`}
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
      <div className="flex items-center justify-between gap-3">
        <div className="text-muted-foreground/70 min-w-0 truncate font-mono text-[10px] sm:text-[11px]">
          templates/{item.slug}.yaml
        </div>
        <MiniPipeline offset={index * 0.7} />
      </div>
    </a>
  );
}

const PIPE_STEPS = 4;
const PIPE_STEP_S = 0.55;
const PIPE_CYCLE_S = PIPE_STEPS * PIPE_STEP_S + 1.6;

/** A tiny run of the template: each step lights up in turn, the last one settles green. */
function MiniPipeline({ offset }: { offset: number }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="relative flex shrink-0 items-center gap-1.5">
      <div className="bg-border/70 absolute inset-x-1 top-1/2 h-px -translate-y-1/2" />
      {Array.from({ length: PIPE_STEPS }, (_, i) => {
        const last = i === PIPE_STEPS - 1;
        const on = (i * PIPE_STEP_S) / PIPE_CYCLE_S;
        return (
          <span key={i} className="border-border bg-card relative h-2 w-2 rounded-full border">
            <motion.span
              className="absolute inset-0 rounded-full"
              animate={
                reduce
                  ? undefined
                  : {
                      backgroundColor: [
                        'rgba(62,207,142,0)',
                        last ? 'rgba(52,211,153,1)' : 'rgba(62,207,142,1)',
                        last ? 'rgba(52,211,153,1)' : 'rgba(62,207,142,0.35)',
                        'rgba(62,207,142,0)',
                      ],
                      scale: [1, 1.5, 1, 1],
                    }
              }
              transition={{
                duration: PIPE_CYCLE_S,
                times: [on, on + 0.06, 0.92, 1],
                repeat: Infinity,
                delay: offset,
                ease: 'easeOut',
              }}
            />
          </span>
        );
      })}
    </div>
  );
}
