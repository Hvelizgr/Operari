'use client';

import anime from 'animejs';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Globe,
  KeyRound,
  Layers,
  type LucideIcon,
  MessageSquare,
  MousePointerClick,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/motion';

/**
 * Animated horizontal trace of a runbook execution.
 *
 * The hero/landing showpiece. Communicates "Operari runs a sequence
 * of typed steps with state transitions" at a glance — without
 * forcing the visitor to read the request/response code panel.
 *
 * Per-beat lifecycle:
 *   1. Edge from previous node draws in (~280ms)
 *   2. Travelling pulse dot rides the edge during the draw
 *   3. Current node flips pending → running (CSS transitions
 *      colour + scale up subtly + the pulse-ring fades in)
 *   4. 720ms running pause (the "work happens here" beat)
 *   5. Node flips running → success — duration badge + output chip
 *      fade in
 *   6. 250ms hold before the next beat
 *
 * Layout:
 *   - md+ viewports: horizontal trace (left-to-right reading order)
 *   - <md viewports:  vertical stack — landing research is unanimous
 *     that horizontal scroll on mobile loses downstream steps.
 *
 * Reduced-motion: render the final state (every node green, every
 * output chip + duration badge visible, audit hash chip up). Don't
 * slow the loop down — disable. The end-state still tells the story.
 */

type AccentTone = 'emerald' | 'sky' | 'amber' | 'violet' | 'rose';

interface Step {
  id: string;
  /** Short label shown below the node. Keep ≤14 chars to avoid wrap
   *  on tablet widths in the horizontal layout. */
  label: string;
  /** Sub-label / type annotation in monospace. */
  type: string;
  /** Lucide icon component — already a React element factory, gives
   *  us crisp 24-stroke icons without re-implementing the path. */
  icon: LucideIcon;
  /** Plausible output preview that pops in once the step succeeds.
   *  Picks the dimension the operator cares about (status code,
   *  rows scanned, replicaset name) so the trace reads like a real
   *  run, not a cartoon. */
  output: string;
  /** Synthetic duration label — keeps the cadence believable
   *  (sub-second for HTTP, multi-second for shell-out, instant for
   *  notify). Mono so digits align across nodes. */
  duration: string;
  /** Status-bar accent for this step type. Pending stays neutral
   *  regardless; running + success use this tone. */
  tone: AccentTone;
  /** Log excerpt shown when the visitor clicks the step. */
  log: string[];
}

const TONE_CLASSES: Record<AccentTone, { running: string; success: string; chip: string }> = {
  emerald: {
    running:
      'group-data-[status=running]:border-emerald-500/50 group-data-[status=running]:bg-emerald-500/10 group-data-[status=running]:text-emerald-300',
    success:
      'group-data-[status=success]:border-emerald-500/60 group-data-[status=success]:bg-emerald-500/15 group-data-[status=success]:text-emerald-200',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
  sky: {
    running:
      'group-data-[status=running]:border-sky-500/50 group-data-[status=running]:bg-sky-500/10 group-data-[status=running]:text-sky-300',
    success:
      'group-data-[status=success]:border-sky-500/60 group-data-[status=success]:bg-sky-500/15 group-data-[status=success]:text-sky-200',
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  },
  amber: {
    running:
      'group-data-[status=running]:border-amber-500/50 group-data-[status=running]:bg-amber-500/10 group-data-[status=running]:text-amber-300',
    success:
      'group-data-[status=success]:border-amber-500/60 group-data-[status=success]:bg-amber-500/15 group-data-[status=success]:text-amber-200',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  violet: {
    running:
      'group-data-[status=running]:border-violet-500/50 group-data-[status=running]:bg-violet-500/10 group-data-[status=running]:text-violet-300',
    success:
      'group-data-[status=success]:border-violet-500/60 group-data-[status=success]:bg-violet-500/15 group-data-[status=success]:text-violet-200',
    chip: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  },
  rose: {
    running:
      'group-data-[status=running]:border-rose-500/50 group-data-[status=running]:bg-rose-500/10 group-data-[status=running]:text-rose-300',
    success:
      'group-data-[status=success]:border-rose-500/60 group-data-[status=success]:bg-rose-500/15 group-data-[status=success]:text-rose-200',
    chip: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
};

const STEPS_EN: Step[] = [
  {
    id: 'trigger',
    label: 'Alert fires',
    type: 'sentry.webhook',
    icon: AlertTriangle,
    output: 'PaymentTimeout',
    duration: '0ms',
    tone: 'rose',
    log: [
      'POST /webhook/sentry · 202 Accepted',
      'issue PAYMENTS-1F3 · PaymentTimeout',
      'vars.service = "payments-api"',
    ],
  },
  {
    id: 'shell',
    label: 'Fetch logs',
    type: 'shell',
    icon: TerminalSquare,
    output: '47 lines',
    duration: '1.2s',
    tone: 'emerald',
    log: [
      '$ kubectl logs deploy/payments-api --since=10m',
      'ERROR upstream timeout after 30000ms (x41)',
      '47 lines → outputs.logs',
    ],
  },
  {
    id: 'http',
    label: 'Helm rollback',
    type: 'http',
    icon: Globe,
    output: '200 OK',
    duration: '4.1s',
    tone: 'sky',
    log: [
      'POST /helm/rollback {"release":"payments-api"}',
      'revision 118 → 117',
      '200 OK · rollout healthy',
    ],
  },
  {
    id: 'approve',
    label: 'On-call grant',
    type: 'approval',
    icon: ShieldCheck,
    output: 'pager@ops',
    duration: '11s',
    tone: 'amber',
    log: ['waiting for @oncall in #incidents', 'approved by pager@ops', 'gate passed in 11s'],
  },
  {
    id: 'notify',
    label: '#incidents',
    type: 'notify.slack',
    icon: MessageSquare,
    output: 'ts:1714…',
    duration: '180ms',
    tone: 'violet',
    log: ['chat.postMessage → #incidents', '"Rolled back payments-api to r117"', 'ok · ts:1714…'],
  },
];

const STEPS_ES: Step[] = [
  { ...STEPS_EN[0], label: 'Alerta' },
  {
    ...STEPS_EN[1],
    label: 'Traer logs',
    log: [
      '$ kubectl logs deploy/payments-api --since=10m',
      'ERROR upstream timeout after 30000ms (x41)',
      '47 líneas → outputs.logs',
    ],
  },
  { ...STEPS_EN[2], label: 'Helm rollback' },
  {
    ...STEPS_EN[3],
    label: 'On-call OK',
    log: ['esperando a @oncall en #incidentes', 'aprobado por pager@ops', 'gate superado en 11s'],
  },
  {
    ...STEPS_EN[4],
    label: '#incidentes',
    log: ['chat.postMessage → #incidentes', '"Rollback de payments-api a r117"', 'ok · ts:1714…'],
  },
];

const ROTATE_EN: Step[] = [
  {
    id: 'cron',
    label: 'Every 30 days',
    type: 'operari.cron',
    icon: Clock,
    output: '0 3 1 * *',
    duration: '0ms',
    tone: 'violet',
    log: ['schedule fired · 03:00 UTC', 'vars.service = "billing-db"', 'run_7c21a0 started'],
  },
  {
    id: 'newkey',
    label: 'New credential',
    type: 'shell',
    icon: KeyRound,
    output: 'key v14',
    duration: '2.3s',
    tone: 'emerald',
    log: [
      '$ vault write -f db/rotate-role/billing',
      'new credential issued (v14)',
      'old credential kept for rollback',
    ],
  },
  {
    id: 'approve',
    label: 'Owner OK',
    type: 'approval',
    icon: ShieldCheck,
    output: 'db-team@',
    duration: '4m',
    tone: 'amber',
    log: ['waiting for db-team in #db-ops', 'approved by db-team@', 'gate passed in 4m'],
  },
  {
    id: 'deploy',
    label: 'Roll secret',
    type: 'http',
    icon: Globe,
    output: '200 OK',
    duration: '6.8s',
    tone: 'sky',
    log: ['PATCH /k8s/secrets/billing-db', 'pods restarted 3/3', 'health checks green'],
  },
  {
    id: 'notify',
    label: '#db-ops',
    type: 'notify.slack',
    icon: MessageSquare,
    output: 'ts:1714…',
    duration: '150ms',
    tone: 'violet',
    log: ['chat.postMessage → #db-ops', '"billing-db credential rotated to v14"', 'ok · ts:1714…'],
  },
];

const ROTATE_ES: Step[] = [
  {
    ...ROTATE_EN[0],
    label: 'Cada 30 días',
    log: ['schedule disparado · 03:00 UTC', 'vars.service = "billing-db"', 'run_7c21a0 iniciado'],
  },
  {
    ...ROTATE_EN[1],
    label: 'Nueva credencial',
    log: [
      '$ vault write -f db/rotate-role/billing',
      'credencial nueva emitida (v14)',
      'la anterior se conserva para rollback',
    ],
  },
  {
    ...ROTATE_EN[2],
    label: 'OK del dueño',
    log: ['esperando a db-team en #db-ops', 'aprobado por db-team@', 'gate superado en 4m'],
  },
  {
    ...ROTATE_EN[3],
    label: 'Rotar secreto',
    log: ['PATCH /k8s/secrets/billing-db', 'pods reiniciados 3/3', 'health checks en verde'],
  },
  {
    ...ROTATE_EN[4],
    log: ['chat.postMessage → #db-ops', '"credencial de billing-db rotada a v14"', 'ok · ts:1714…'],
  },
];

const SCALE_EN: Step[] = [
  {
    id: 'alert',
    label: 'Latency alert',
    type: 'datadog.webhook',
    icon: AlertTriangle,
    output: 'p99 1.8s',
    duration: '0ms',
    tone: 'rose',
    log: [
      'POST /webhook/datadog · 202 Accepted',
      'monitor checkout-latency · p99 1.8s',
      'vars.deployment = "checkout"',
    ],
  },
  {
    id: 'metrics',
    label: 'Read load',
    type: 'http',
    icon: Gauge,
    output: 'cpu 91%',
    duration: '640ms',
    tone: 'sky',
    log: [
      'GET /api/v1/query?avg:cpu{svc:checkout}',
      'cpu 91% · rps 4.2k',
      'threshold exceeded (> 80%)',
    ],
  },
  {
    id: 'scale',
    label: 'Scale out',
    type: 'shell',
    icon: Layers,
    output: '6 → 10',
    duration: '3.9s',
    tone: 'emerald',
    log: [
      '$ kubectl scale deploy/checkout --replicas=10',
      'replicas 6 → 10',
      'rollout status: complete',
    ],
  },
  {
    id: 'verify',
    label: 'Verify p99',
    type: 'http',
    icon: CheckCircle2,
    output: 'p99 240ms',
    duration: '30s',
    tone: 'sky',
    log: ['wait 30s for traffic to settle', 'p99 1.8s → 240ms', 'monitor recovered'],
  },
  {
    id: 'notify',
    label: '#incidents',
    type: 'notify.slack',
    icon: MessageSquare,
    output: 'ts:1714…',
    duration: '170ms',
    tone: 'violet',
    log: [
      'chat.postMessage → #incidents',
      '"checkout scaled to 10, p99 recovered"',
      'ok · ts:1714…',
    ],
  },
];

const SCALE_ES: Step[] = [
  { ...SCALE_EN[0], label: 'Alerta latencia' },
  {
    ...SCALE_EN[1],
    label: 'Leer carga',
    log: [
      'GET /api/v1/query?avg:cpu{svc:checkout}',
      'cpu 91% · rps 4.2k',
      'umbral superado (> 80%)',
    ],
  },
  {
    ...SCALE_EN[2],
    label: 'Escalar',
    log: [
      '$ kubectl scale deploy/checkout --replicas=10',
      'réplicas 6 → 10',
      'rollout status: completo',
    ],
  },
  {
    ...SCALE_EN[3],
    label: 'Verificar p99',
    log: ['esperar 30s a que se estabilice', 'p99 1.8s → 240ms', 'monitor recuperado'],
  },
  {
    ...SCALE_EN[4],
    label: '#incidentes',
    log: [
      'chat.postMessage → #incidentes',
      '"checkout escalado a 10, p99 recuperado"',
      'ok · ts:1714…',
    ],
  },
];

export type TraceScenario = 'rollback' | 'rotate' | 'scale';

const SCENARIO_STEPS: Record<TraceScenario, { en: Step[]; es: Step[] }> = {
  rollback: { en: STEPS_EN, es: STEPS_ES },
  rotate: { en: ROTATE_EN, es: ROTATE_ES },
  scale: { en: SCALE_EN, es: SCALE_ES },
};

const TRACE_TEXT = {
  en: {
    hint: 'Click any step to inspect its output',
    replay: 'Replay run',
    log: 'log',
    group: 'Runbook execution trace — click a step to inspect it',
  },
  es: {
    hint: 'Hacé click en un paso para ver su salida',
    replay: 'Repetir run',
    log: 'log',
    group: 'Traza de ejecución del runbook — hacé click en un paso para inspeccionarlo',
  },
} as const;

interface RunbookTraceProps {
  lang?: 'en' | 'es';
  scenario?: TraceScenario;
}

interface TraceLayoutProps {
  steps: Step[];
  selected: number | null;
  onSelect: (index: number) => void;
}

interface TraceNodeProps {
  step: Step;
  selected: boolean;
  onSelect: () => void;
}

export function RunbookTrace({ lang = 'en', scenario = 'rollback' }: RunbookTraceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const steps = SCENARIO_STEPS[scenario][lang];
  const t = TRACE_TEXT[lang];
  // Clicking a step freezes the loop on the finished run and opens its
  // detail; Replay bumps runKey, which restarts the effect's loop.
  const [selected, setSelected] = useState<number | null>(null);
  const [runKey, setRunKey] = useState(0);
  const freezeRef = useRef<() => void>(() => {});

  const selectStep = (i: number) => {
    freezeRef.current();
    setSelected(i);
  };
  const replay = () => {
    setSelected(null);
    setRunKey(k => k + 1);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Both layouts (horizontal + vertical) are mounted in the DOM at
    // once — Tailwind's `hidden md:block` toggles visibility, not
    // presence. Querying without scoping would grab 2× the nodes and
    // 2× the edges across layouts and the index math (edges[i-1])
    // would over-run on the second layout. Scope each query to its
    // layout wrapper so the timeline can drive both in lockstep.
    const layouts = ['h', 'v'] as const;
    const nodesByLayout = layouts.map(l =>
      Array.from(root.querySelectorAll<HTMLElement>(`[data-trace-layout="${l}"] [data-trace-node]`))
    );
    const edgesByLayout = layouts.map(l =>
      Array.from(
        root.querySelectorAll<SVGPathElement>(`[data-trace-layout="${l}"] [data-trace-edge]`)
      )
    );
    const pulsesByLayout = layouts.map(l =>
      Array.from(
        root.querySelectorAll<SVGCircleElement>(`[data-trace-layout="${l}"] [data-trace-pulse]`)
      )
    );
    const auditHashes = Array.from(root.querySelectorAll<HTMLElement>('[data-trace-audit]'));
    // Flat aggregates for state-resets that target every layout at
    // once (the per-beat animation iterates per-layout below).
    const allNodes = nodesByLayout.flat();
    const allEdges = edgesByLayout.flat();
    const allPulses = pulsesByLayout.flat();
    if (allNodes.length === 0) return;
    // The two layouts are guaranteed to render the same number of
    // nodes/edges (the parent component passes the same `steps` array
    // to both); guard anyway so a future divergence doesn't crash.
    const stepCount = nodesByLayout[0].length;

    // The loops re-schedule themselves from tl.finished, so unmounting
    // (or StrictMode's double effect) must stop them or they stack up.
    let cancelled = false;
    let current: anime.AnimeTimelineInstance | null = null;
    const stop = () => {
      cancelled = true;
      current?.pause();
    };
    freezeRef.current = () => {
      stop();
      allNodes.forEach(n => n.setAttribute('data-status', 'success'));
      allEdges.forEach(e => {
        e.style.strokeDasharray = 'none';
        e.style.strokeDashoffset = '0';
      });
      allPulses.forEach(p => (p.style.opacity = '0'));
      auditHashes.forEach(a => a.setAttribute('data-visible', 'true'));
    };

    const reduced = prefersReducedMotion();
    if (reduced) {
      // Reduced-motion fallback: still show the sequence, but with
      // opacity transitions only — no transforms, no scale, no
      // pulse rings, no traveling dots. The data-status flips drive
      // colour-only state changes via CSS. Loops at a slower cadence
      // (12s) so users with reduced-motion preferences aren't bombarded
      // with looping motion. Edges render in their final (drawn) state.
      allEdges.forEach(e => {
        e.style.strokeDasharray = 'none';
        e.style.strokeDashoffset = '0';
      });
      allPulses.forEach(p => (p.style.opacity = '0'));

      const runReducedLoop = () => {
        if (cancelled) return;
        allNodes.forEach(n => n.setAttribute('data-status', 'pending'));
        auditHashes.forEach(a => a.setAttribute('data-visible', 'false'));
        const tl = anime.timeline({ autoplay: true });
        current = tl;
        tl.add({ duration: 800 });
        for (let i = 0; i < stepCount; i++) {
          const beatNodes = nodesByLayout
            .map(layoutNodes => layoutNodes[i])
            .filter((n): n is HTMLElement => Boolean(n));
          tl.add({
            duration: 1,
            complete: () => beatNodes.forEach(n => n.setAttribute('data-status', 'success')),
          });
          tl.add({ duration: 600 });
        }
        tl.add({
          duration: 1,
          complete: () => auditHashes.forEach(a => a.setAttribute('data-visible', 'true')),
        });
        tl.add({ duration: 6000 });
        tl.finished.then(runReducedLoop);
      };
      runReducedLoop();
      return stop;
    }

    // Edge prep — strokeDashoffset to full length so each edge can
    // be drawn in via the timeline. Pulse dots start hidden.
    allEdges.forEach(e => {
      const len = e.getTotalLength();
      e.style.strokeDasharray = `${len}`;
      e.style.strokeDashoffset = `${len}`;
    });
    allPulses.forEach(p => (p.style.opacity = '0'));

    /**
     * Per-step beat. Drives both layouts (horizontal + vertical) in
     * lockstep — anime targets are arrays of [horizontal, vertical]
     * for the same conceptual step. The first node has no inbound
     * edge (it's the trigger), so we skip the edge step on i=0.
     */
    const nodeBeat = (i: number, t: anime.AnimeTimelineInstance) => {
      if (i > 0) {
        const edges = edgesByLayout
          .map(layoutEdges => layoutEdges[i - 1])
          .filter((e): e is SVGPathElement => Boolean(e));
        const pulses = pulsesByLayout
          .map(layoutPulses => layoutPulses[i - 1])
          .filter((p): p is SVGCircleElement => Boolean(p));
        if (edges.length > 0) {
          // Edges draw in across both layouts simultaneously.
          t.add(
            {
              targets: edges,
              strokeDashoffset: 0,
              duration: 320,
              easing: 'easeOutCubic',
            },
            '+=120'
          );
          // Pulses ride each edge in parallel. Anime's `path()`
          // follower needs the path element it's following, so each
          // pulse gets its own animation tied to its own edge —
          // we can't combine them into one `targets:` call.
          edges.forEach((edge, idx) => {
            const follower = anime.path(edge);
            t.add(
              {
                targets: pulses[idx],
                translateX: follower('x'),
                translateY: follower('y'),
                opacity: [
                  { value: 1, duration: 60 },
                  { value: 0, duration: 240, delay: 80 },
                ],
                duration: 320,
                easing: 'linear',
              },
              // Stack each pulse animation on top of the edge-draw
              // (same start time) — the first call uses '-=320' to
              // back up under the edge animation, subsequent ones
              // use `0` offset which means "start where the previous
              // one started", since they're already siblings of it.
              idx === 0 ? '-=320' : 0
            );
          });
        }
      }
      const beatNodes = nodesByLayout
        .map(layoutNodes => layoutNodes[i])
        .filter((n): n is HTMLElement => Boolean(n));
      // Flip to running across both layouts.
      t.add(
        {
          duration: 1,
          complete: () => beatNodes.forEach(n => n.setAttribute('data-status', 'running')),
        },
        '+=80'
      );
      t.add({ duration: 720 });
      // Flip to success.
      t.add({
        duration: 1,
        complete: () => beatNodes.forEach(n => n.setAttribute('data-status', 'success')),
      });
      t.add({ duration: 250 });
    };

    const runOnce = () => {
      if (cancelled) return;
      // Reset state for the next loop iteration.
      allNodes.forEach(n => n.setAttribute('data-status', 'pending'));
      allEdges.forEach(e => {
        const len = e.getTotalLength();
        e.style.strokeDasharray = `${len}`;
        e.style.strokeDashoffset = `${len}`;
      });
      allPulses.forEach(p => (p.style.opacity = '0'));
      auditHashes.forEach(a => a.setAttribute('data-visible', 'false'));

      const tl = anime.timeline({ autoplay: true });
      current = tl;
      // 600ms warm-up so the visitor's eye lands before the first
      // node fires — without it the trigger flip happens off-screen
      // and reads as broken on a fast first paint.
      tl.add({ duration: 600 });
      for (let i = 0; i < stepCount; i++) nodeBeat(i, tl);
      // Audit hash chip pops in across both layouts once the last
      // node lands.
      tl.add({
        duration: 1,
        complete: () => auditHashes.forEach(a => a.setAttribute('data-visible', 'true')),
      });
      // 1.6s rest beat — long enough that the visitor reads "this
      // finished" before the trace resets and starts the next loop.
      tl.add({ duration: 1600 });
      tl.finished.then(runOnce);
    };

    runOnce();
    return stop;
  }, [steps, runKey]);

  return (
    <div ref={rootRef} className="relative w-full" role="group" aria-label={t.group}>
      <div data-trace-layout="h" className="hidden md:block">
        <TraceHorizontal steps={steps} selected={selected} onSelect={selectStep} />
      </div>
      <div data-trace-layout="v" className="md:hidden">
        <TraceVertical steps={steps} selected={selected} onSelect={selectStep} />
      </div>
      <StepDetail step={selected === null ? null : steps[selected]} text={t} onReplay={replay} />
    </div>
  );
}

function TraceHorizontal({ steps, selected, onSelect }: TraceLayoutProps) {
  // Node + label width 132px, gap 40px → 5 nodes ≈ 820px.
  const nodeW = 132;
  const gap = 40;
  const totalW = steps.length * nodeW + (steps.length - 1) * gap;
  const centers = steps.map((_, i) => i * (nodeW + gap) + nodeW / 2);
  const nodeBodyHalf = 32; // half the circle width — edge starts past the body

  return (
    <div className="relative mx-auto" style={{ maxWidth: totalW }}>
      {/* Edge layer. The svg overlays the row; edges + pulses land
          at y=42 so they pass through the centre of the 64px circles. */}
      <svg
        viewBox={`0 0 ${totalW} 84`}
        className="pointer-events-none absolute left-0 top-0 h-[84px] w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Subtle filter on the pulse so it reads as light, not
              just a green dot. Stays cheap — single Gaussian blur. */}
          <filter id="trace-pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        {steps.slice(1).map((_, i) => {
          const x1 = centers[i] + nodeBodyHalf;
          const x2 = centers[i + 1] - nodeBodyHalf;
          const pulseId = `pulse-${i}`;
          const gradientId = `trace-edge-gradient-${i}`;
          return (
            <g key={i}>
              {/* Each edge fades at its endpoints so it doesn't end sharp
                  against the node. userSpaceOnUse: with the default
                  objectBoundingBox units a perfectly horizontal path has
                  a zero-height box and the gradient never paints. */}
              <linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1={x1}
                y1={42}
                x2={x2}
                y2={42}
              >
                <stop offset="0%" stopColor="rgb(63 207 142)" stopOpacity="0" />
                <stop offset="15%" stopColor="rgb(63 207 142)" stopOpacity="0.7" />
                <stop offset="85%" stopColor="rgb(63 207 142)" stopOpacity="0.7" />
                <stop offset="100%" stopColor="rgb(63 207 142)" stopOpacity="0" />
              </linearGradient>
              <path
                data-trace-edge
                d={`M ${x1} 42 L ${x2} 42`}
                stroke={`url(#${gradientId})`}
                strokeWidth={1.5}
                strokeLinecap="round"
                fill="none"
              />
              {/* Travelling pulse — one per edge, anime.path drives
                  its translation along the parent edge during the
                  edge-draw beat. */}
              <circle
                data-trace-pulse
                id={pulseId}
                cx={x1}
                cy={42}
                r={3}
                fill="rgb(63 207 142)"
                filter="url(#trace-pulse-glow)"
                style={{ opacity: 0 }}
              />
            </g>
          );
        })}
      </svg>
      {/* Node layer */}
      <div className="relative flex items-start" style={{ gap }}>
        {steps.map((step, i) => (
          <TraceNode
            key={step.id}
            step={step}
            selected={selected === i}
            onSelect={() => onSelect(i)}
          />
        ))}
      </div>
      {/* Audit hash chip */}
      <AuditHashChip />
    </div>
  );
}

function TraceVertical({ steps, selected, onSelect }: TraceLayoutProps) {
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="flex flex-col items-stretch gap-3">
        {steps.map((step, i) => (
          <div key={step.id} className="relative">
            <TraceNodeRow step={step} selected={selected === i} onSelect={() => onSelect(i)} />
            {i < steps.length - 1 && (
              <div className="ml-[31px] flex h-6 w-px items-center">
                <svg viewBox="0 0 4 24" className="h-6 w-1 overflow-visible" aria-hidden="true">
                  <path
                    data-trace-edge
                    d="M 2 0 L 2 24"
                    stroke="rgb(63 207 142)"
                    strokeOpacity={0.7}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle
                    data-trace-pulse
                    cx={2}
                    cy={0}
                    r={2.5}
                    fill="rgb(63 207 142)"
                    style={{ opacity: 0 }}
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5">
        <AuditHashChip />
      </div>
    </div>
  );
}

/** Horizontal-layout node: circle + icon on top, label + type below,
 *  with duration + output chip stacked under the type and fading in
 *  only once the step's status flips to success.
 *
 *  The `group` pattern lets the chip + check badge listen to
 *  the wrapper's `data-status` without contorted arbitrary CSS:
 *  `group-data-[status=success]:opacity-100` is the Tailwind-
 *  native way to say "show this when our group is done". */
function TraceNode({ step, selected, onSelect }: TraceNodeProps) {
  const Icon = step.icon;
  const tone = TONE_CLASSES[step.tone];
  return (
    <button
      type="button"
      data-trace-node
      data-status="pending"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex cursor-pointer flex-col items-center gap-3 rounded-xl py-1 outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${selected ? 'bg-white/[0.04]' : ''}`}
      style={{ width: 132 }}
    >
      <div
        className={[
          'relative flex h-16 w-16 items-center justify-center rounded-2xl border transition-[colors,transform,box-shadow] duration-200',
          // Pending — neutral
          'group-data-[status=pending]:border-white/10 group-data-[status=pending]:bg-white/[0.03] group-data-[status=pending]:text-zinc-600',
          // Running — type-toned, scale up, soft glow
          'group-data-[status=running]:scale-[1.06] group-data-[status=running]:shadow-[0_0_28px_-4px_rgba(63,207,142,0.35)]',
          // Type-toned running + success classes (defined as
          // group-data variants in TONE_CLASSES)
          tone.running,
          tone.success,
        ].join(' ')}
      >
        <Icon size={22} strokeWidth={2} />
        {/* Running pulse-ring */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl border border-current opacity-0 group-data-[status=running]:animate-ping group-data-[status=running]:opacity-60"
        />
        {/* Success check badge */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/20 opacity-0 transition-opacity duration-200 group-data-[status=success]:opacity-100"
        >
          <CheckCircle2 size={12} className="text-emerald-300" />
        </span>
      </div>
      <div className="text-center">
        <div className="text-[13px] font-medium text-zinc-200">{step.label}</div>
        <div className="font-mono text-[10px] text-zinc-500">{step.type}</div>
        <div className="mt-2 flex flex-col items-center gap-1 opacity-0 transition-opacity duration-300 group-data-[status=success]:opacity-100">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${tone.chip}`}
          >
            {step.output}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-zinc-500">{step.duration}</span>
        </div>
      </div>
    </button>
  );
}

/**
 * Vertical-layout node row used on <md viewports. Same status-driven
 * styling as the horizontal node, just laid out left-to-right with
 * the chip on the right rather than below. The anime timeline drives
 * both via the shared `data-trace-node` selector.
 */
function TraceNodeRow({ step, selected, onSelect }: TraceNodeProps) {
  const Icon = step.icon;
  const tone = TONE_CLASSES[step.tone];
  return (
    <button
      type="button"
      data-trace-node
      data-status="pending"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl p-1 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${selected ? 'bg-white/[0.04]' : ''}`}
    >
      <div
        className={[
          'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-colors duration-200',
          'group-data-[status=pending]:border-white/10 group-data-[status=pending]:bg-white/[0.03] group-data-[status=pending]:text-zinc-600',
          tone.running,
          tone.success,
        ].join(' ')}
      >
        <Icon size={20} strokeWidth={2} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/20 opacity-0 transition-opacity duration-200 group-data-[status=success]:opacity-100"
        >
          <CheckCircle2 size={12} className="text-emerald-300" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-200">{step.label}</div>
        <div className="font-mono text-[10px] text-zinc-500">{step.type}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] opacity-0 transition-opacity duration-300 group-data-[status=success]:opacity-100 ${tone.chip}`}
        >
          {step.output}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500 opacity-0 transition-opacity duration-300 group-data-[status=success]:opacity-100">
          {step.duration}
        </span>
      </div>
    </button>
  );
}

/**
 * Audit hash receipt that pops in at the end of the trace. The
 * receipt-style framing (mono hash + verified label) makes the
 * "every step lands in a tamper-evident chain" claim concrete
 * without needing extra body copy.
 */
function AuditHashChip() {
  return (
    <div className="mt-7 flex justify-center">
      <span
        data-trace-audit
        data-visible="false"
        className="group inline-flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] text-emerald-200 transition-all duration-300 data-[visible=false]:translate-y-1 data-[visible=true]:translate-y-0 data-[visible=false]:opacity-0 data-[visible=true]:opacity-100"
      >
        <ShieldCheck size={12} className="text-emerald-300" />
        <span className="text-zinc-400">audit_hash</span>
        <span className="text-emerald-200">3f9c…b2e1</span>
        <span className="hidden text-zinc-500 sm:inline">·</span>
        <span className="hidden text-emerald-300/80 sm:inline">verified</span>
      </span>
    </div>
  );
}

/**
 * Detail drawer under the trace. Before a selection it is a one-line
 * hint (so visitors know the steps are clickable); after one, it shows
 * the step's log excerpt line by line plus a Replay control.
 */
function StepDetail({
  step,
  text,
  onReplay,
}: {
  step: Step | null;
  text: (typeof TRACE_TEXT)[keyof typeof TRACE_TEXT];
  onReplay: () => void;
}) {
  return (
    <div className="mt-6 min-h-[132px]" aria-live="polite">
      <AnimatePresence mode="wait">
        {step ? (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-black/30 p-4 text-left"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-zinc-100">{step.label}</span>
              <span className="font-mono text-[10px] text-zinc-500">{step.type}</span>
              <span
                className={`inline-flex rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${TONE_CLASSES[step.tone].chip}`}
              >
                {step.output}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                {step.duration}
              </span>
              <button
                type="button"
                onClick={onReplay}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              >
                <RotateCcw size={12} />
                {text.replay}
              </button>
            </div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
              {text.log}
            </div>
            <ol className="space-y-1 font-mono text-[11px] text-zinc-300 sm:text-xs">
              {step.log.map((line, i) => (
                <motion.li
                  key={line}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.12, duration: 0.25 }}
                  className="break-words"
                >
                  <span className="mr-2 text-emerald-400/70">›</span>
                  {line}
                </motion.li>
              ))}
            </ol>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 pt-10 text-xs text-zinc-500"
          >
            <MousePointerClick size={14} className="text-emerald-400/70" />
            {text.hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
