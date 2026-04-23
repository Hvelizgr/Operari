'use client';

import { motion } from 'framer-motion';
import { content } from '@/app/[lang]/content/en';

type TrustBarProps = {
  content: typeof content.trust;
};

/**
 * Trust bar — a thin strip of integration wordmarks between the Hero
 * and the Story. The point is not to fake social proof (we are
 * pre-launch) but to answer the first question every SRE asks when
 * they land on a new automation tool: "does it talk to the stuff I
 * already run?".
 *
 * Wordmarks are rendered as plain text so we never have to ship
 * trademarked vector assets, and they render crisply at any
 * Retina/non-Retina DPR. Muted by default, brighten on hover — quiet
 * enterprise aesthetic borrowed from Vercel / Linear / Stripe.
 */
export default function TrustBar({ content }: TrustBarProps) {
  return (
    <section className="border-border/40 bg-background/40 relative border-y backdrop-blur-sm">
      <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-muted-foreground mb-6 text-center text-[11px] font-medium uppercase tracking-[0.22em] sm:mb-8 sm:text-xs"
        >
          {content.eyebrow}
        </motion.p>

        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14 sm:gap-y-6">
          {LOGOS.map((logo, i) => (
            <motion.div
              key={logo.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 0.55, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.55,
                delay: 0.06 * i,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ opacity: 1 }}
              className="text-foreground/80 flex items-center gap-2 transition-opacity"
            >
              <Logo name={logo.name} />
              <span className="text-sm font-semibold tracking-tight sm:text-base">
                {logo.label}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-muted-foreground/70 mt-6 text-center text-xs sm:mt-8"
        >
          {content.line}
        </motion.p>
      </div>
    </section>
  );
}

const LOGOS = [
  { name: 'datadog', label: 'Datadog' },
  { name: 'sentry', label: 'Sentry' },
  { name: 'pagerduty', label: 'PagerDuty' },
  { name: 'slack', label: 'Slack' },
  { name: 'github', label: 'GitHub' },
  { name: 'grafana', label: 'Grafana' },
  { name: 'kubernetes', label: 'Kubernetes' },
  { name: 'linear', label: 'Linear' },
] as const;

/**
 * Lightweight monochrome icon set. We intentionally avoid the real
 * brand marks — we don't ship them, they muddy the visual weight at
 * small sizes, and the wordmark next to each glyph carries the
 * recognition anyway. Every icon is stroked with `currentColor` so
 * it inherits the hover color transition on its parent.
 */
function Logo({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'datadog':
      return (
        <svg {...common}>
          <path d="M3 12l5 5 4-7 4 5 5-8" />
          <circle cx="18" cy="6" r="1.25" fill="currentColor" />
        </svg>
      );
    case 'sentry':
      return (
        <svg {...common}>
          <path d="M4 19 L12 5 L20 19 Z" />
          <path d="M9.5 19 L12 14 L14.5 19" />
        </svg>
      );
    case 'pagerduty':
      return (
        <svg {...common}>
          <rect x="6" y="4" width="11" height="12" rx="2" />
          <path d="M11 4v16" />
        </svg>
      );
    case 'slack':
      return (
        <svg {...common}>
          <rect x="4" y="10" width="6" height="2.5" rx="1" />
          <rect x="14" y="10" width="6" height="2.5" rx="1" />
          <rect x="10" y="4" width="2.5" height="6" rx="1" />
          <rect x="10" y="14" width="2.5" height="6" rx="1" />
        </svg>
      );
    case 'github':
      return (
        <svg {...common}>
          <path d="M9 18c-4 1-4-2-6-2m12 4v-3c0-1-.1-2-.6-2.7 3-.3 6-1.4 6-6a4.8 4.8 0 0 0-1.3-3.3c.1-.3.6-1.6-.1-3.3 0 0-1-.3-3.4 1.2a11.6 11.6 0 0 0-6 0C7.2 2.4 6.2 2.7 6.2 2.7c-.7 1.7-.2 3 0 3.3A4.8 4.8 0 0 0 4.8 9.3c0 4.6 3 5.7 6 6-.5.7-.5 1.3-.4 2.2V20" />
        </svg>
      );
    case 'grafana':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6 6l1.5 1.5M16.5 16.5L18 18M6 18l1.5-1.5M16.5 7.5L18 6" />
        </svg>
      );
    case 'kubernetes':
      return (
        <svg {...common}>
          <path d="M12 3 L20 8 L18 17 L12 21 L6 17 L4 8 Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case 'linear':
      return (
        <svg {...common}>
          <path d="M4 12a8 8 0 0 1 8-8" />
          <path d="M4 16a8 8 0 0 1 12-8" />
          <path d="M4 20a8 8 0 0 1 16-12" />
        </svg>
      );
    default:
      return null;
  }
}
