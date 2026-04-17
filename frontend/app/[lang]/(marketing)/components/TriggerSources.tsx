'use client';

import { motion } from 'framer-motion';
import { content } from '@/app/[lang]/content/en';
import AuroraBackground from './AuroraBackground';
import { useAnimeStaggerOnView } from '@/hooks/useAnimeStaggerOnView';

type TriggerSourcesProps = {
  content: typeof content.triggers;
};

/**
 * TriggerSources — replaces the old logo-strip Integrations section.
 *
 * The point of this section is to make the wedge concrete: "we are
 * the action layer for alerts". So instead of a generic logo cloud,
 * we render four trigger-source CARDS — Sentry, Datadog, GitHub,
 * generic webhook — each with its own one-line elevator pitch and a
 * "ready" status badge that mirrors what actually works in
 * webhook.routes.ts today.
 *
 * Below the cards, a second strip lists the *output* surface: every
 * shell tool a step can call. That answers the inevitable follow-up
 * question — "ok, but what does it actually run?" — without sending
 * users to the docs.
 */
export default function TriggerSources({ content }: TriggerSourcesProps) {
  // anime.js stagger for the 4 trigger cards — replaces the prior
  // framer-motion whileInView stagger so the cards enter together
  // from the same timeline (matches the Hero animation language).
  const cardsRef = useAnimeStaggerOnView<HTMLDivElement>({
    selector: '[data-trigger-card]',
    from: { opacity: 0, translateY: 20 },
    to: { opacity: [0, 1], translateY: [20, 0] },
    stagger: 90,
    duration: 580,
  });
  // Tools chips use a tighter stagger + scale pop so the grid lands
  // with a "shower" motion that reads as "many tools, one call".
  const toolsRef = useAnimeStaggerOnView<HTMLDivElement>({
    selector: '[data-tool-chip]',
    from: { opacity: 0, translateY: 8, scale: 0.9 },
    to: { opacity: [0, 1], translateY: [8, 0], scale: [0.9, 1] },
    stagger: 28,
    duration: 420,
  });
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <AuroraBackground
        orbs={[
          { color: 'primary', size: 700, x: '-5%', y: '20%', opacity: 0.06, duration: 17, drift: 50 },
          { color: 'emerald', size: 700, x: '70%', y: '50%', opacity: 0.05, duration: 19, delay: 3, drift: 55 },
          { color: 'deep', size: 500, x: '40%', y: '-10%', opacity: 0.04, duration: 14, delay: 6, drift: 35 },
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

        {/* Trigger source cards. Single column on mobile, 2 on small,
            4 on large. The 2-col breakpoint avoids the awkward middle
            state where 4 cards squeeze into a tablet width. */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-14 sm:mb-20"
        >
          {content.items.map((item) => (
            <TriggerCard key={item.name} item={item} />
          ))}
        </div>

        {/* "And every step calls real tools" strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-md p-6 sm:p-8 md:p-10"
        >
          <div className="text-center mb-5 sm:mb-6">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2">
              {content.callsAnything.title}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              {content.callsAnything.subtitle}
            </p>
          </div>
          <div
            ref={toolsRef}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {content.callsAnything.tools.map((tool) => (
              <span
                key={tool}
                data-tool-chip
                className="px-3 py-1.5 rounded-lg bg-background/60 border border-border/60 font-mono text-sm text-foreground/80 hover:border-primary/40 hover:text-foreground hover:-translate-y-0.5 transition-all cursor-default"
              >
                {tool}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TriggerCard({
  item,
}: {
  item: typeof content.triggers.items[number];
}) {
  return (
    <div
      data-trigger-card
      className="group relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-6 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <ProviderIcon name={item.name} />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
          {item.status}
        </span>
      </div>
      <h3 className="font-semibold text-foreground mb-2">{item.name}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
    </div>
  );
}

/**
 * ProviderIcon — inline SVG marks for the four built-in trigger sources.
 *
 * No raster logos because (a) we do not own those trademarks and
 * (b) PNG logos make landings flaky on dark mode. The marks are
 * stylized representations, not the official logos, which is the
 * standard pattern for "supported integrations" sections in OSS
 * tools (Cal.com, Inngest, Trigger.dev all do this).
 */
function ProviderIcon({ name }: { name: string }) {
  switch (name.toLowerCase()) {
    case 'sentry':
      return (
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2L2 22h6l4-7 4 7h6L12 2z" />
          </svg>
        </div>
      );
    case 'datadog':
      return (
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
      );
    case 'github':
      return (
        <div className="h-10 w-10 rounded-lg bg-foreground/10 border border-foreground/20 flex items-center justify-center text-foreground/80">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.2-.3-.6-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.9 5.7-5.6 6 .5.4.8 1.2.8 2.4v3.6c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 16.98h-5.99c-1.66 0-3.01-1.34-3.01-3s1.34-3 3.01-3H18M6 8.05V11M6 13v3M14 12.99h.01" />
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="12" r="3" />
          </svg>
        </div>
      );
  }
}
