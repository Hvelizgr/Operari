'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Github } from 'lucide-react';
import { content } from '@/app/[lang]/content/en';
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
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <AuroraBackground
        orbs={[
          { color: 'violet', size: 700, x: '-5%', y: '20%', opacity: 0.04, duration: 21, drift: 50 },
          { color: 'primary', size: 600, x: '70%', y: '60%', opacity: 0.04, duration: 17, delay: 4, drift: 45 },
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

        {/* Cards — single column on mobile, 2 columns on sm, 2 on lg too
            because the descriptions are long and 4 columns squeezes them
            past readability */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5"
        >
          {content.items.map((tpl) => (
            <TemplateCard key={tpl.slug} item={tpl} />
          ))}
        </motion.div>

        {/* Footer CTA → all templates on GitHub */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex justify-center mt-10"
        >
          <a
            href="https://github.com/Hvelizgr/NanoFlow/tree/main/templates"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <Github className="w-4 h-4" />
            {content.cta}
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

const accentClasses: Record<string, { ring: string; bg: string; text: string }> = {
  violet: {
    ring: 'group-hover:border-violet-500/50',
    bg: 'bg-violet-500/10 border-violet-500/30',
    text: 'text-violet-300',
  },
  primary: {
    ring: 'group-hover:border-primary/50',
    bg: 'bg-primary/10 border-primary/30',
    text: 'text-primary',
  },
  amber: {
    ring: 'group-hover:border-amber-500/50',
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-300',
  },
  emerald: {
    ring: 'group-hover:border-emerald-500/50',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-300',
  },
};

function TemplateCard({ item }: { item: typeof content.templates.items[number] }) {
  const accent = accentClasses[item.accent] ?? accentClasses.primary;
  return (
    <motion.a
      href={`https://github.com/Hvelizgr/NanoFlow/blob/main/templates/${item.slug}.yaml`}
      target="_blank"
      rel="noopener noreferrer"
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
      }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`group relative block rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-5 sm:p-6 transition-colors ${accent.ring}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
        <span
          className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2.5 py-1 border ${accent.bg} ${accent.text}`}
        >
          {item.category}
        </span>
        <ArrowUpRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 leading-snug">
        {item.title}
      </h3>
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4">
        {item.description}
      </p>
      <div className="font-mono text-[10px] sm:text-[11px] text-muted-foreground/70 truncate">
        templates/{item.slug}.yaml
      </div>
    </motion.a>
  );
}
