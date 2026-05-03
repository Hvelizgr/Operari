'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

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
  const sectionRef = useRef<HTMLElement>(null);
  // Scroll progress 0..1 across the whole Story section. Drives:
  //   - the rail's accent dot fill on the left side (lg+ only)
  //   - the parallax offset on each mockup
  // Mobile/tablet ignore both since the rail is hidden there and
  // the parallax range is small enough that a viewport-height
  // section barely benefits from it.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Track the current "active" block (0..2) via IntersectionObserver
  // so the rail can highlight which storybeat is in view. Used only
  // for the discrete dot fill — the continuous progress bar uses
  // scrollYProgress directly.
  const [activeBlock, setActiveBlock] = useState(0);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => {
        // Pick the most-visible block. We sort by intersectionRatio
        // descending and take the first that's actually intersecting.
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length === 0) return;
        const idx = blockRefs.current.indexOf(visible[0].target as HTMLDivElement);
        if (idx >= 0) setActiveBlock(idx);
      },
      // Threshold list — fire on each 25% bucket so the active block
      // updates smoothly as the user scrolls between two blocks.
      { threshold: [0.25, 0.5, 0.75], rootMargin: '-20% 0px -20% 0px' }
    );
    blockRefs.current.forEach(b => b && io.observe(b));
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-24 sm:py-32">
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

        {/* Three blocks, alternating mockup side. On lg+ we anchor a
            scroll-progress rail to the left edge of the column so the
            visitor can see "I'm on storybeat 02 of 03" at a glance. */}
        <div className="relative space-y-20 sm:space-y-28 lg:space-y-32">
          <ScrollProgressRail
            progress={scrollYProgress}
            activeBlock={activeBlock}
            blocks={content.blocks}
          />
          {content.blocks.map((block, idx) => (
            <StoryBlock
              key={block.number}
              block={block}
              index={idx}
              progress={scrollYProgress}
              registerRef={el => {
                blockRefs.current[idx] = el;
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Vertical rail anchored to the left edge of the Story column on lg+.
 * Three dots — the active one filled with the accent, others muted —
 * plus a continuous progress line that fills from top to bottom as
 * the section scrolls past. Hidden on mobile and tablet because the
 * column is full-width there and the rail would overlap the copy.
 *
 * `aria-hidden` because the rail is a visual cue, not a navigation
 * affordance — the section already has a heading hierarchy that
 * keyboard users follow.
 */
function ScrollProgressRail({
  progress,
  activeBlock,
  blocks,
}: {
  progress: import('framer-motion').MotionValue<number>;
  activeBlock: number;
  blocks: typeof content.story.blocks;
}) {
  // Map the section progress (0..1) to the rail's fill height. The
  // rail spans the inner blocks area, so 100% progress = full bar.
  const fillHeight = useTransform(progress, [0.05, 0.95], ['0%', '100%']);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-2 top-0 hidden h-full lg:block"
    >
      {/* Rail line — muted background + accent fill that grows with
          scroll progress. Uses a motion height so the fill animates
          in lockstep with the user's scroll. */}
      <div className="border-border/50 relative h-full w-px border-l">
        <motion.div
          className="bg-primary/70 absolute left-[-1px] top-0 w-px"
          style={{ height: fillHeight }}
        />
      </div>
      {/* Three dots — equally spaced down the rail. Active dot is
          larger and emerald; the rest are muted. */}
      <div className="absolute inset-y-0 left-[-3px] flex flex-col justify-around">
        {blocks.map((_, i) => (
          <span
            key={i}
            className={`block rounded-full border transition-all duration-300 ${
              i === activeBlock
                ? 'bg-primary border-primary/70 h-2.5 w-2.5 shadow-[0_0_12px_rgba(63,207,142,0.45)]'
                : 'border-border/70 bg-background h-1.5 w-1.5'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function StoryBlock({
  block,
  index,
  progress,
  registerRef,
}: {
  block: (typeof content.story.blocks)[number];
  index: number;
  progress: import('framer-motion').MotionValue<number>;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const reverse = index % 2 === 1;
  // Subtle parallax — each mockup translates a bit on Y as the
  // section scrolls past. Range scaled by index so the three blocks
  // don't drift in lockstep. Disabled on mobile via the wrapper's
  // `lg:` className but the transform on a non-visible parent costs
  // nothing.
  const parallaxRange = 24 + index * 6;
  const mockupY = useTransform(progress, [0, 1], [parallaxRange, -parallaxRange]);

  return (
    <motion.div
      ref={registerRef}
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

      {/* Mockup side — different per block. The motion wrapper drives
          a small parallax offset as the section scrolls past, so each
          mockup gently drifts against its copy column instead of
          sitting flat. min-w-0 so the mockup respects its column
          width on desktop. */}
      <motion.div className="relative min-w-0" style={{ y: mockupY }}>
        {index === 0 && <CanvasMockup />}
        {index === 1 && <YamlDiffMockup />}
        {index === 2 && <RunTimelineMockup />}
      </motion.div>
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

        {/* Connecting lines — drawn progressively after the nodes appear.
            We rely on viewBox 0..100 (percent-equivalent) so the line
            geometry matches the node positions one-for-one. */}
        <motion.svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          <AnimatedLine x1={20} y1={30} x2={50} y2={30} delay={0.55} />
          <AnimatedLine x1={50} y1={30} x2={80} y2={30} delay={0.85} />
          <AnimatedLine x1={50} y1={30} x2={50} y2={70} delay={1.15} />
        </motion.svg>

        {/* Nodes — pop in one by one before the lines connect them */}
        <AnimatedNode left="6%" top="22%" label="trigger" color="mono" delay={0.1} />
        <AnimatedNode left="36%" top="22%" label="shell" color="primary" delay={0.3} />
        <AnimatedNode left="66%" top="22%" label="approve" color="primary" delay={0.5} />
        <AnimatedNode left="36%" top="62%" label="notify" color="emerald" delay={1.4} />
      </div>
    </div>
  );
}

/**
 * SVG line that draws itself by animating stroke-dashoffset from the
 * full length down to zero. Cheaper than animating x2/y2 because the
 * browser only repaints stroke, not geometry.
 */
function AnimatedLine({
  x1,
  y1,
  x2,
  y2,
  delay,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="rgb(62 207 142 / 0.65)"
      strokeWidth="0.6"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      style={{ strokeDasharray: length, strokeDashoffset: length }}
      variants={{
        hidden: { strokeDashoffset: length },
        visible: {
          strokeDashoffset: 0,
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
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-3 py-2 font-mono text-[11px] backdrop-blur-sm ${nodeColor[color]}`}
      style={{ left, top }}
    >
      {label}
    </motion.div>
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
