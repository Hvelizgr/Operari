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
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <AuroraBackground
        orbs={[
          { color: 'primary', size: 1000, x: '20%', y: '-10%', opacity: 0.05, duration: 18, drift: 60 },
          { color: 'orange', size: 700, x: '70%', y: '60%', opacity: 0.04, duration: 22, delay: 3, drift: 50 },
        ]}
      />

      <div className="container relative z-10 px-4 sm:px-6 mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-16 sm:mb-20 max-w-3xl mx-auto">
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
  block: typeof content.story.blocks[number];
  index: number;
}) {
  const reverse = index % 2 === 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-20 items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
    >
      {/* Copy side. min-w-0 prevents grid children from forcing horizontal
          overflow when the mockup beside them is wider than the column. */}
      <div className="max-w-lg min-w-0">
        <div className="text-sm font-mono text-primary/70 mb-3 sm:mb-4">{block.number}</div>
        <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4 sm:mb-5 leading-tight">
          {block.title}
        </h3>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed mb-5 sm:mb-6">
          {block.description}
        </p>
        <div className="inline-flex items-start gap-2 text-xs sm:text-sm text-foreground/70 border-l-2 border-primary/40 pl-3 sm:pl-4 italic">
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
    <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-2xl shadow-black/30 p-4 sm:p-6 overflow-hidden">
      <MockHeader />
      <div className="mt-4 h-56 sm:h-64 relative">
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
          className="absolute inset-0 w-full h-full"
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
        <AnimatedNode left="6%" top="22%" label="trigger" color="amber" delay={0.1} />
        <AnimatedNode left="36%" top="22%" label="shell" color="primary" delay={0.3} />
        <AnimatedNode left="66%" top="22%" label="approve" color="violet" delay={0.5} />
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
      stroke="rgb(251 146 60 / 0.65)"
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
      className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-2 rounded-lg border backdrop-blur-sm font-mono text-[11px] ${nodeColor[color]}`}
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
      className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-2xl shadow-black/30 overflow-hidden"
    >
      <MockHeader filename="runbooks/rollback.yaml" />
      {/* overflow-x-auto so very narrow viewports (320px) can horizontally
          scroll the diff instead of breaking the layout. The diff lines
          are intentionally short enough that this rarely triggers. */}
      <div className="px-4 sm:px-5 py-4 font-mono text-[11px] sm:text-xs leading-relaxed overflow-x-auto">
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
            className={`flex gap-2 sm:gap-3 -mx-4 sm:-mx-5 px-4 sm:px-5 whitespace-nowrap ${line.sign === '+' ? 'bg-emerald-500/[0.06]' : line.sign === '-' ? 'bg-red-500/[0.06]' : ''}`}
          >
            <span className="text-foreground/40 select-none w-3">{line.sign}</span>
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
      className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-2xl shadow-black/30 overflow-hidden"
    >
      <MockHeader filename="run/3f9c-b2e1" badge="resolved" />
      <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-2.5 sm:space-y-3">
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
        className="border-t border-border/50 bg-background/40 px-5 py-3 font-mono text-[11px] text-muted-foreground flex items-center justify-between"
      >
        <span>audit-hash</span>
        <span className="text-foreground/70">3f9c…b2e1 ✓</span>
      </motion.div>
    </motion.div>
  );
}

function TimelineRow({
  step,
  index,
}: {
  step: { label: string; ms: string };
  index: number;
}) {
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
        className="h-5 w-5 rounded-full border border-emerald-500/40 flex items-center justify-center shrink-0"
      >
        <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </motion.div>
      <div className="font-mono text-[11px] sm:text-xs text-foreground/85 flex-1 truncate">{step.label}</div>
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { delay: rowDelay + 0.25, duration: 0.3 } },
        }}
        className="font-mono text-[11px] text-muted-foreground tabular-nums"
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
    <div className="flex items-center justify-between border-b border-border/50 px-5 py-3 bg-background/40">
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
      </div>
      {filename && (
        <div className="font-mono text-[11px] text-muted-foreground truncate">{filename}</div>
      )}
      {badge && (
        <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
          {badge}
        </div>
      )}
    </div>
  );
}

const nodeColor: Record<string, string> = {
  amber: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  primary: 'bg-primary/15 border-primary/40 text-primary',
  violet: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
  emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
};

function MockNode({
  left,
  top,
  label,
  color,
}: {
  left: string;
  top: string;
  label: string;
  color: keyof typeof nodeColor;
}) {
  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-2 rounded-lg border backdrop-blur-sm font-mono text-[11px] ${nodeColor[color]}`}
      style={{ left, top }}
    >
      {label}
    </div>
  );
}
