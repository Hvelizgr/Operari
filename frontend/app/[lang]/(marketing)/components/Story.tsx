'use client';

import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Check, Hand, Loader2, MousePointer2, Play, RotateCcw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';

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
 * Block 1 — Build-and-run canvas
 *
 * A scripted scene: a cursor drags an approval step from the palette
 * into a three-step runbook, presses Run, approves the paused step and
 * the run ends green. It only plays while on screen; with reduced
 * motion it shows the finished run. Nodes stay draggable throughout.
 * ------------------------------------------------------------------ */
type SceneId = 'alert' | 'approval' | 'restart' | 'slack';
type Point = { x: number; y: number };
type StepStatus = 'idle' | 'running' | 'waiting' | 'done';

type Frame = {
  ms: number;
  cursor: 'chip' | 'drop' | 'run' | 'approve';
  press?: boolean;
  ghost?: boolean;
  placed: boolean;
  running?: boolean;
  ok?: boolean;
  status?: Partial<Record<SceneId, StepStatus>>;
};

const ALL_DONE = { alert: 'done', approval: 'done', restart: 'done', slack: 'done' } as const;

const FRAMES: Frame[] = [
  { ms: 1000, cursor: 'chip', placed: false },
  { ms: 250, cursor: 'chip', press: true, placed: false },
  { ms: 1100, cursor: 'drop', press: true, ghost: true, placed: false },
  { ms: 700, cursor: 'drop', placed: true },
  { ms: 800, cursor: 'run', placed: true },
  { ms: 250, cursor: 'run', press: true, placed: true },
  { ms: 700, cursor: 'run', placed: true, running: true, status: { alert: 'running' } },
  {
    ms: 900,
    cursor: 'approve',
    placed: true,
    running: true,
    status: { alert: 'done', approval: 'waiting' },
  },
  {
    ms: 250,
    cursor: 'approve',
    press: true,
    placed: true,
    running: true,
    status: { alert: 'done', approval: 'waiting' },
  },
  {
    ms: 800,
    cursor: 'approve',
    placed: true,
    running: true,
    status: { alert: 'done', approval: 'done', restart: 'running' },
  },
  {
    ms: 700,
    cursor: 'run',
    placed: true,
    running: true,
    status: { alert: 'done', approval: 'done', restart: 'done', slack: 'running' },
  },
  { ms: 3800, cursor: 'run', placed: true, ok: true, status: ALL_DONE },
];
const FINAL_FRAME = FRAMES.length - 1;

const SCENE_START: Record<SceneId, Point> = {
  alert: { x: 37, y: 30 },
  approval: { x: 50, y: 64 },
  restart: { x: 71, y: 38 },
  slack: { x: 87, y: 66 },
};
const SCENE_KIND: Record<SceneId, keyof typeof nodeColor> = {
  alert: 'mono',
  approval: 'primary',
  restart: 'primary',
  slack: 'emerald',
};
const CHIP: Point = { x: 9, y: 30 };
const RUN_BUTTON: Point = { x: 90, y: 9 };

const statusColor: Record<Exclude<StepStatus, 'idle'>, string> = {
  running: 'bg-sky-500/15 border-sky-400/60 text-sky-300',
  waiting: 'bg-amber-500/15 border-amber-400/60 text-amber-300',
  done: 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300',
};

function CanvasMockup() {
  const params = useParams();
  const es = params?.lang === 'es';
  const t = es
    ? {
        labels: {
          alert: 'alerta datadog',
          approval: 'aprobación',
          restart: 'reiniciar pod',
          slack: 'slack',
        },
        palette: ['aprobación', 'http', 'shell'],
        run: 'Ejecutar',
        running: 'Ejecutando…',
        approve: 'Aprobar',
        ok: 'Ejecución exitosa · 4 pasos · 3,2 s',
        replay: 'Repetir',
        hint: 'Arrastrá los nodos',
      }
    : {
        labels: {
          alert: 'datadog alert',
          approval: 'approval',
          restart: 'restart pod',
          slack: 'slack',
        },
        palette: ['approval', 'http', 'shell'],
        run: 'Run',
        running: 'Running…',
        approve: 'Approve',
        ok: 'Run succeeded · 4 steps · 3.2s',
        replay: 'Replay',
        hint: 'Drag the nodes',
      };

  const canvasRef = useRef<HTMLDivElement>(null);
  const inView = useInView(canvasRef, { margin: '-100px' });
  const reduced = useReducedMotion();
  const [frameIdx, setFrameIdx] = useState(0);
  const [pos, setPos] = useState(SCENE_START);
  const [dragging, setDragging] = useState<SceneId | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (reduced || !inView) return;
    const timer = setTimeout(() => setFrameIdx(i => (i + 1) % FRAMES.length), FRAMES[frameIdx].ms);
    return () => clearTimeout(timer);
  }, [frameIdx, inView, reduced]);

  const frame = FRAMES[reduced ? FINAL_FRAME : frameIdx];
  const statusOf = (id: SceneId): StepStatus => frame.status?.[id] ?? 'idle';
  const visible: SceneId[] = frame.placed
    ? ['alert', 'approval', 'restart', 'slack']
    : ['alert', 'restart', 'slack'];
  const edges: [SceneId, SceneId][] = visible.slice(1).map((to, i) => [visible[i], to]);
  const cursorAt: Point = {
    chip: CHIP,
    drop: pos.approval,
    run: RUN_BUTTON,
    approve: { x: pos.approval.x, y: pos.approval.y + 13 },
  }[frame.cursor];

  const moveTo = (id: SceneId, e: ReactPointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clamp = (v: number, min: number) => Math.min(90, Math.max(min, v));
    setPos(p => ({
      ...p,
      [id]: {
        x: clamp(((e.clientX - rect.left) / rect.width) * 100, 26),
        y: clamp(((e.clientY - rect.top) / rect.height) * 100, 22),
      },
    }));
  };

  return (
    <div className="border-border/60 bg-card/60 relative overflow-hidden rounded-2xl border p-4 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-6">
      <MockHeader />
      <div ref={canvasRef} className="relative mt-4 h-60 select-none sm:h-64">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="border-border/50 bg-background/50 absolute inset-y-0 left-0 flex w-[18%] min-w-[64px] flex-col gap-2 rounded-lg border p-1.5 pt-[18%] sm:p-2 sm:pt-[18%]">
          {t.palette.map((chip, i) => (
            <div
              key={chip}
              className={`truncate rounded-md border px-1.5 py-1 font-mono text-[9px] sm:text-[10px] ${i === 0 ? nodeColor.primary : nodeColor.mono}`}
            >
              {chip}
            </div>
          ))}
        </div>

        <div
          className={`absolute right-0 top-0 flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${frame.running ? 'border-sky-400/50 bg-sky-500/15 text-sky-300' : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'}`}
        >
          {frame.running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          {frame.running ? t.running : t.run}
          <kbd className="ml-1 hidden font-mono text-[9px] opacity-60 sm:inline">⌘↵</kbd>
        </div>

        <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
          {edges.map(([from, to]) => (
            <motion.line
              key={`${from}-${to}`}
              x1={`${pos[from].x}%`}
              y1={`${pos[from].y}%`}
              x2={`${pos[to].x}%`}
              y2={`${pos[to].y}%`}
              stroke={
                statusOf(from) === 'done' ? 'rgb(62 207 142 / 0.85)' : 'rgb(148 163 184 / 0.4)'
              }
              strokeWidth={2}
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </svg>

        {visible.map(id => {
          const status = statusOf(id);
          return (
            <div
              key={id}
              className="absolute -translate-x-1/2 -translate-y-1/2 touch-none"
              style={{ left: `${pos[id].x}%`, top: `${pos[id].y}%` }}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(id);
                setTouched(true);
              }}
              onPointerMove={e => dragging === id && moveTo(id, e)}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: dragging === id ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                className={`relative isolate flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 font-mono text-[10px] backdrop-blur-sm transition-colors sm:px-3 sm:py-2 sm:text-[11px] ${status === 'idle' ? nodeColor[SCENE_KIND[id]] : statusColor[status]} ${dragging === id ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {/* Opaque base under the tinted fill so connectors stop at
                      the node edge instead of showing through it. */}
                <span aria-hidden="true" className="bg-card absolute inset-0 -z-10 rounded-lg" />
                {status === 'running' && <Loader2 size={11} className="animate-spin" />}
                {status === 'done' && <Check size={11} />}
                {t.labels[id]}
              </motion.div>
              {status === 'waiting' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-400/50 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
                >
                  {t.approve}
                </motion.div>
              )}
            </div>
          );
        })}

        <AnimatePresence>
          {frame.ok && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-[20%] right-0 flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                  <Check size={12} className="shrink-0" />
                  <span className="leading-tight">{t.ok}</span>
                </div>
                <div className="text-muted-foreground truncate font-mono text-[9px]">
                  audit · step.completed ×4 · a91f…e2c7
                </div>
              </div>
              {!reduced && (
                <button
                  type="button"
                  onClick={() => setFrameIdx(0)}
                  className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-[10px]"
                >
                  <RotateCcw size={11} />
                  {t.replay}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!reduced && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute z-20"
            initial={false}
            animate={{ left: `${cursorAt.x}%`, top: `${cursorAt.y}%` }}
            transition={{ duration: frame.ghost ? 1 : 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div animate={{ scale: frame.press ? 0.82 : 1 }} transition={{ duration: 0.12 }}>
              <MousePointer2 size={18} className="fill-white text-black drop-shadow" />
            </motion.div>
            {frame.ghost && (
              <div
                className={`absolute left-3 top-4 whitespace-nowrap rounded-md border px-1.5 py-1 font-mono text-[10px] opacity-90 shadow-lg ${nodeColor.primary}`}
              >
                {t.labels.approval}
              </div>
            )}
          </motion.div>
        )}

        {!touched && !frame.ok && frameIdx !== 0 && (
          <div className="text-muted-foreground pointer-events-none absolute bottom-0 right-0 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px]">
            <Hand size={12} className="text-emerald-400/80" />
            {t.hint}
          </div>
        )}
      </div>
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
type DiffView = 'before' | 'diff' | 'after';

const YAML_LINES = [
  { sign: ' ', text: 'name: rollback-on-error-spike' },
  { sign: ' ', text: 'on:' },
  { sign: ' ', text: '  webhook: incoming' },
  { sign: ' ', text: 'steps:' },
  { sign: '-', text: '  - shell: helm rollback prod' },
  { sign: '+', text: '  - shell: helm rollback prod --wait' },
  { sign: '+', text: '  - approval:' },
  { sign: '+', text: '      message: "Rollback ok?"' },
  { sign: ' ', text: '  - notify: slack#incidents' },
] as const;

/* The diff can be flipped between the old file, the change and the new
 * file, so the "approval gate added in code review" beat is something
 * the visitor does rather than reads. */
function YamlDiffMockup() {
  const params = useParams();
  const es = params?.lang === 'es';
  const [view, setView] = useState<DiffView>('diff');
  const tabs: { id: DiffView; label: string }[] = [
    { id: 'before', label: es ? 'Antes' : 'Before' },
    { id: 'diff', label: 'Diff' },
    { id: 'after', label: es ? 'Después' : 'After' },
  ];
  const lines = YAML_LINES.filter(l =>
    view === 'before' ? l.sign !== '+' : view === 'after' ? l.sign !== '-' : true
  );

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="border-border/60 bg-card/60 relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/30 backdrop-blur-md"
    >
      <MockHeader filename="runbooks/rollback.yaml" />
      <div
        role="tablist"
        aria-label={es ? 'Vista del archivo' : 'File view'}
        className="border-border/40 flex gap-1 border-b px-4 py-2 sm:px-5"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => setView(tab.id)}
            className={`relative isolate rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${view === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {view === tab.id && (
              <motion.span
                layoutId="yaml-tab"
                className="absolute inset-0 -z-10 rounded-md bg-white/[0.06]"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            {tab.label}
          </button>
        ))}
      </div>
      {/* overflow-x-auto so very narrow viewports (320px) can horizontally
          scroll the diff instead of breaking the layout. The diff lines
          are intentionally short enough that this rarely triggers. */}
      <div className="overflow-x-auto px-4 py-4 font-mono text-[11px] leading-relaxed sm:px-5 sm:text-xs">
        <AnimatePresence initial={false} mode="popLayout">
          {lines.map((line, i) => {
            const marked = view === 'diff' && line.sign !== ' ';
            const added = view === 'after' && line.sign === '+';
            return (
              <motion.div
                key={line.text}
                layout
                variants={{
                  hidden: { opacity: 0, x: -8 },
                  visible: {
                    opacity: 1,
                    x: 0,
                    transition: { duration: 0.32, delay: 0.15 + i * 0.085, ease: 'easeOut' },
                  },
                }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.25 }}
                className={`-mx-4 flex gap-2 whitespace-nowrap px-4 sm:-mx-5 sm:gap-3 sm:px-5 ${marked && line.sign === '+' ? 'bg-emerald-500/[0.06]' : marked ? 'bg-red-500/[0.06]' : added ? 'bg-emerald-500/[0.03]' : ''}`}
              >
                <span className="text-foreground/40 w-3 select-none">
                  {marked ? line.sign : ' '}
                </span>
                <span
                  className={
                    marked
                      ? line.sign === '+'
                        ? 'text-emerald-400'
                        : 'text-red-400'
                      : added
                        ? 'text-emerald-300/90'
                        : 'text-foreground/80'
                  }
                >
                  {line.text}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
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
