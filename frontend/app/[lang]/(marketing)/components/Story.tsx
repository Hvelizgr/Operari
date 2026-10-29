'use client';

import { motion } from 'framer-motion';

import { content } from '@/app/[lang]/content/en';

import AuroraBackground from './AuroraBackground';

type StoryProps = {
  content: typeof content.story;
};

/**
 * Story — three vertical blocks that replace the old Features grid AND
 * HowItWorks section. The grid was 6 vague bullets ("visual canvas",
 * "AI agent", "audit") that no SRE will read. The story is one
 * concrete narrative: author → commit → respond. Each block has its
 * own stylized mockup so the section carries visual weight without
 * needing real screenshots.
 */
export default function Story({ content }: StoryProps) {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <AuroraBackground
        orbs={[
          {
            color: 'primary',
            size: 1000,
            x: '20%',
            y: '-10%',
            opacity: 0.06,
            duration: 18,
            drift: 60,
          },
          {
            color: 'deep',
            size: 700,
            x: '70%',
            y: '60%',
            opacity: 0.05,
            duration: 22,
            delay: 3,
            drift: 50,
          },
        ]}
      />

      <div className="container relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section header */}
        <div className="mx-auto mb-16 max-w-3xl text-center sm:mb-20">
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

        {/* Three blocks, alternating mockup side */}
        <div className="space-y-20 sm:space-y-28 lg:space-y-32">
          {content.blocks.map((block, idx) => (
            <StoryBlock key={block.number} block={block} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StoryBlock({
  block,
  index,
}: {
  block: (typeof content.story.blocks)[number];
  index: number;
}) {
  const reverse = index % 2 === 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`grid items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-20 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
    >
      {/* Copy side. min-w-0 prevents grid children from forcing horizontal
          overflow when the mockup beside them is wider than the column. */}
      <div className="min-w-0 max-w-lg">
        <div className="text-primary/70 mb-3 font-mono text-sm sm:mb-4">{block.number}</div>
        <h3 className="text-foreground mb-4 text-2xl font-bold leading-tight tracking-tight sm:mb-5 sm:text-3xl md:text-4xl">
          {block.title}
        </h3>
        <p className="text-muted-foreground mb-5 text-sm leading-relaxed sm:mb-6 sm:text-base md:text-lg">
          {block.description}
        </p>
        <div className="text-foreground/70 border-primary/40 inline-flex items-start gap-2 border-l-2 pl-3 text-xs italic sm:pl-4 sm:text-sm">
          {block.caption}
        </div>
      </div>

      {/* Mockup side — different per block. min-w-0 again so the
          mockup respects its column width on desktop, and full-width
          containment on mobile. */}
      <div className="relative min-w-0">
        {index === 0 && <CanvasMockup />}
        {index === 1 && <YamlDiffMockup />}
        {index === 2 && <RunTimelineMockup />}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------
 * Block 1 — Visual canvas mockup
 *
 * Stylized representation of the editor: nodes appear one by one,
 * then the connecting lines DRAW between them with stroke-dasharray.
 * The whole sequence triggers on viewport entry via framer-motion's
 * `whileInView` so visitors who scroll fast still catch the animation.
 * ------------------------------------------------------------------ */
function CanvasMockup() {
  return (
    <div className="border-border/60 bg-card/60 relative overflow-hidden rounded-2xl border p-4 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-6">
      <MockHeader />
      <div className="relative mt-4 h-56 sm:h-64">
        {/* Background grid — static */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Connecting lines — grow from node to node after the nodes
            appear. Plain bars scaled from their origin: an SVG line with
            a non-scaling stroke measures its dash array in screen pixels,
            which left broken dashes instead of a drawn line. */}
        {/* One observer for all lines: each line starts at scale 0, i.e.
            zero area, which IntersectionObserver does not reliably report. */}
        <motion.div
          className="absolute inset-0"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          <AnimatedLine left={20} top={30} length={30} axis="x" delay={0.55} />
          <AnimatedLine left={50} top={30} length={30} axis="x" delay={0.85} />
          <AnimatedLine left={50} top={30} length={40} axis="y" delay={1.15} />
        </motion.div>

        {/* Nodes — pop in one by one before the lines connect them */}
        <AnimatedNode left="20%" top="30%" label="trigger" color="mono" delay={0.1} />
        <AnimatedNode left="50%" top="30%" label="shell" color="primary" delay={0.3} />
        <AnimatedNode left="80%" top="30%" label="approve" color="primary" delay={0.5} />
        <AnimatedNode left="50%" top="70%" label="notify" color="emerald" delay={1.4} />
      </div>
    </div>
  );
}

/** A connector that grows along one axis from (left%, top%). */
function AnimatedLine({
  left,
  top,
  length,
  axis,
  delay,
}: {
  left: number;
  top: number;
  length: number;
  axis: 'x' | 'y';
  delay: number;
}) {
  const horizontal = axis === 'x';
  return (
    <motion.div
      aria-hidden="true"
      className="absolute bg-[rgb(62_207_142/0.65)]"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: horizontal ? `${length}%` : 2,
        height: horizontal ? 2 : `${length}%`,
        transformOrigin: horizontal ? 'left center' : 'center top',
      }}
      variants={{
        hidden: horizontal ? { scaleX: 0 } : { scaleY: 0 },
        visible: {
          ...(horizontal ? { scaleX: 1 } : { scaleY: 1 }),
          transition: { duration: 0.45, delay, ease: 'easeOut' },
        },
      }}
    />
  );
}

function AnimatedNode({
  left,
  top,
  label,
  color,
  delay,
}: {
  left: string;
  top: string;
  label: string;
  color: keyof typeof nodeColor;
  delay: number;
}) {
  // Centering lives on a wrapper: motion's scale writes an inline
  // transform that would override Tailwind's translate classes.
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left, top }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
        className={`relative isolate rounded-lg border px-3 py-2 font-mono text-[11px] backdrop-blur-sm ${nodeColor[color]}`}
      >
        {/* Opaque base under the tinted fill so connectors stop at the
            node edge instead of showing through it. */}
        <span aria-hidden="true" className="bg-card absolute inset-0 -z-10 rounded-lg" />
        {label}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Block 2 — YAML round-trip mockup
 *
 * Stylized git diff. Each line slides in from the left with a stagger
 * so the eye reads top-to-bottom; the +/- lines flash their background
 * color briefly to draw attention to the actual change. Read order
 * matters here because the punchline is "approval gate added in code
 * review" — we want users to see the deletion first, then the
 * additions.
 * ------------------------------------------------------------------ */
function YamlDiffMockup() {
  const lines = [
    { sign: ' ', text: 'name: rollback-on-error-spike', cls: 'text-foreground/80' },
    { sign: ' ', text: 'on:', cls: 'text-foreground/80' },
    { sign: ' ', text: '  webhook: incoming', cls: 'text-foreground/80' },
    { sign: ' ', text: 'steps:', cls: 'text-foreground/80' },
    { sign: '-', text: '  - shell: helm rollback prod', cls: 'text-red-400' },
    { sign: '+', text: '  - shell: helm rollback prod --wait', cls: 'text-emerald-400' },
    { sign: '+', text: '  - approval:', cls: 'text-emerald-400' },
    { sign: '+', text: '      message: "Rollback ok?"', cls: 'text-emerald-400' },
    { sign: ' ', text: '  - notify: slack#incidents', cls: 'text-foreground/80' },
  ];

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="border-border/60 bg-card/60 relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/30 backdrop-blur-md"
    >
      <MockHeader filename="runbooks/rollback.yaml" />
      {/* overflow-x-auto so very narrow viewports (320px) can horizontally
          scroll the diff instead of breaking the layout. The diff lines
          are intentionally short enough that this rarely triggers. */}
      <div className="overflow-x-auto px-4 py-4 font-mono text-[11px] leading-relaxed sm:px-5 sm:text-xs">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, x: -8 },
              visible: {
                opacity: 1,
                x: 0,
                transition: { duration: 0.32, delay: 0.15 + i * 0.085, ease: 'easeOut' },
              },
            }}
            className={`-mx-4 flex gap-2 whitespace-nowrap px-4 sm:-mx-5 sm:gap-3 sm:px-5 ${line.sign === '+' ? 'bg-emerald-500/[0.06]' : line.sign === '-' ? 'bg-red-500/[0.06]' : ''}`}
          >
            <span className="text-foreground/40 w-3 select-none">{line.sign}</span>
            <span className={line.cls}>{line.text}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------
 * Block 3 — Run timeline + audit hash mockup
 *
 * The "evidence" frame: steps tick green one by one with a small
 * scale-pop on the check, the duration label fades in slightly after
 * the row appears (so the eye reads "step → done"), and the audit
 * hash strip slides up from the bottom at the very end with a
 * "verified" checkmark.
 * ------------------------------------------------------------------ */
function RunTimelineMockup() {
  const steps = [
    { label: 'webhook → received', ms: '12ms' },
    { label: 'fetch service logs', ms: '1.2s' },
    { label: 'rollback last deploy', ms: '4.8s' },
    { label: 'post status #incidents', ms: '340ms' },
    { label: 'open Linear ticket', ms: '210ms' },
  ];

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="border-border/60 bg-card/60 relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/30 backdrop-blur-md"
    >
      <MockHeader filename="run/3f9c-b2e1" badge="resolved" />
      <div className="space-y-2.5 px-4 py-4 sm:space-y-3 sm:px-5 sm:py-5">
        {steps.map((step, i) => (
          <TimelineRow key={step.label} step={step} index={i} />
        ))}
      </div>
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 8 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, delay: 0.3 + steps.length * 0.22 },
          },
        }}
        className="border-border/50 bg-background/40 text-muted-foreground flex items-center justify-between border-t px-5 py-3 font-mono text-[11px]"
      >
        <span>audit-hash</span>
        <span className="text-foreground/70">3f9c…b2e1 ✓</span>
      </motion.div>
    </motion.div>
  );
}

function TimelineRow({ step, index }: { step: { label: string; ms: string }; index: number }) {
  const rowDelay = 0.2 + index * 0.22;
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -6 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration: 0.3, delay: rowDelay, ease: 'easeOut' },
        },
      }}
      className="flex items-center gap-2.5 sm:gap-3"
    >
      <motion.div
        variants={{
          hidden: { scale: 0.4, backgroundColor: 'rgba(148,163,184,0.15)' },
          visible: {
            scale: [0.4, 1.2, 1],
            backgroundColor: [
              'rgba(148,163,184,0.15)',
              'rgba(16,185,129,0.45)',
              'rgba(16,185,129,0.18)',
            ],
            transition: { duration: 0.5, delay: rowDelay + 0.05 },
          },
        }}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/40"
      >
        <svg
          className="h-3 w-3 text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </motion.div>
      <div className="text-foreground/85 flex-1 truncate font-mono text-[11px] sm:text-xs">
        {step.label}
      </div>
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { delay: rowDelay + 0.25, duration: 0.3 } },
        }}
        className="text-muted-foreground font-mono text-[11px] tabular-nums"
      >
        {step.ms}
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------
 * Shared mockup chrome
 * ------------------------------------------------------------------ */
function MockHeader({ filename, badge }: { filename?: string; badge?: string } = {}) {
  return (
    <div className="border-border/50 bg-background/40 flex items-center justify-between border-b px-5 py-3">
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
      </div>
      {filename && (
        <div className="text-muted-foreground truncate font-mono text-[11px]">{filename}</div>
      )}
      {badge && (
        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          {badge}
        </div>
      )}
    </div>
  );
}

const nodeColor: Record<string, string> = {
  mono: 'bg-foreground/5 border-foreground/20 text-foreground/80',
  primary: 'bg-primary/15 border-primary/40 text-primary',
  emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
};
