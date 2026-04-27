'use client';

import anime from 'animejs';
import { useEffect, useRef } from 'react';

import { prefersReducedMotion } from '@/lib/motion';

/**
 * Hero-scale animated double-helix.
 *
 * The lifecycle:
 *   1. Both strands "draw" themselves in over ~1.4s — animated via
 *      strokeDashoffset from full length to 0.
 *   2. Once drawn, two dots travel along each strand on a loop,
 *      mimicking step transitions tracing the runbook in real time.
 *   3. The crossing nodes pulse softly when a travelling dot passes
 *      near them — gives the "step fired" beat the operator sees in
 *      a real run-detail view.
 *
 * Reduced-motion: skip the draw + travel animations, render the
 * strands fully visible. The narrative still reads visually, no
 * motion-induced fatigue for users who opt out.
 */

interface DNAHelixAnimationProps {
  /** Width in CSS pixels — the SVG scales viewBox to fit. */
  width?: number;
  /** Height in CSS pixels. */
  height?: number;
  primary?: string;
  secondary?: string;
}

const VIEWBOX_W = 200;
const VIEWBOX_H = 480;

/**
 * Generate a smooth sinusoidal path between (cx, 0) and (cx, h).
 * `phase=0` bulges right first, `phase=Math.PI` bulges left first.
 * Uses cubic Beziers between waypoints rather than a polyline so the
 * line looks rendered, not pixelated, at any scale.
 */
function helixPath(phase: number, amplitude: number, periods: number): string {
  const cx = VIEWBOX_W / 2;
  const h = VIEWBOX_H;
  const segmentH = h / (periods * 2);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= periods * 2; i++) {
    const y = i * segmentH;
    // Sinusoidal x. Even i → centre, odd i → max excursion.
    // Phase shift differentiates the two strands.
    const phaseAt = phase + (i * Math.PI) / 2;
    const x = cx + Math.sin(phaseAt) * amplitude;
    points.push({ x, y });
  }
  // Build a path with cubic Beziers between consecutive waypoints.
  // Control points at 1/3 and 2/3 of each segment, biased to mirror
  // the curvature direction so the curve doesn't go straight then snap.
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dy = (b.y - a.y) * 0.5;
    const c1 = { x: a.x, y: a.y + dy };
    const c2 = { x: b.x, y: b.y - dy };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
  }
  return d;
}

export function DNAHelixAnimation({
  width = 200,
  height = 480,
  primary = '#3ecf8e',
  secondary = 'rgba(255,255,255,0.7)',
}: DNAHelixAnimationProps) {
  const strandARef = useRef<SVGPathElement>(null);
  const strandBRef = useRef<SVGPathElement>(null);
  const dotARef = useRef<SVGCircleElement>(null);
  const dotBRef = useRef<SVGCircleElement>(null);

  // Five full helix periods over the height — dense enough to read
  // as "lots of steps", sparse enough that each crossing is legible.
  const periods = 5;
  const amplitude = 60;
  const pathA = helixPath(0, amplitude, periods);
  const pathB = helixPath(Math.PI, amplitude, periods);

  useEffect(() => {
    const a = strandARef.current;
    const b = strandBRef.current;
    if (!a || !b) return;

    if (prefersReducedMotion()) {
      // Skip motion entirely — render strands fully visible.
      a.style.strokeDasharray = 'none';
      b.style.strokeDasharray = 'none';
      a.style.strokeDashoffset = '0';
      b.style.strokeDashoffset = '0';
      return;
    }

    // Step 1: draw the strands. getTotalLength on the rendered path
    // gives us the exact length to animate strokeDashoffset against,
    // independent of the curve we picked.
    const lenA = a.getTotalLength();
    const lenB = b.getTotalLength();
    a.style.strokeDasharray = `${lenA}`;
    a.style.strokeDashoffset = `${lenA}`;
    b.style.strokeDasharray = `${lenB}`;
    b.style.strokeDashoffset = `${lenB}`;

    const drawIn = anime.timeline({ easing: 'easeOutCubic' }).add({
      targets: [a, b],
      strokeDashoffset: [anime.setDashoffset, 0] as unknown as number,
      duration: 1400,
      delay: anime.stagger(200),
    });

    // Step 2: travelling dots. Use anime's path-following — wrap each
    // strand path in an `anime.path()` factory so translateX/Y/rotate
    // follow the curve. Loop forever.
    const pathFollowerA = anime.path(a);
    const pathFollowerB = anime.path(b);
    const travel = anime({
      targets: [dotARef.current, dotBRef.current],
      translateX: [
        pathFollowerA('x'),
        pathFollowerB('x'),
        // The targets array is iterated in order; anime applies the
        // matching index from this array per target. So index 0 →
        // dotA, index 1 → dotB.
      ],
      translateY: [pathFollowerA('y'), pathFollowerB('y')],
      duration: 4500,
      easing: 'linear',
      loop: true,
      autoplay: false,
    });

    drawIn.finished.then(() => travel.play());

    return () => {
      drawIn.pause();
      travel.pause();
    };
  }, []);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      role="img"
      aria-label="Operari double helix — runbook steps tracing the canvas and audit chain"
      className="block"
    >
      {/* Soft glow under the strands for depth. Not animated — would
          read as flickering if it pulsed. */}
      <defs>
        <radialGradient id="helix-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={primary} stopOpacity="0.15" />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={VIEWBOX_W} height={VIEWBOX_H} fill="url(#helix-glow)" />

      {/* The two strands. */}
      <path
        ref={strandARef}
        d={pathA}
        stroke={primary}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <path
        ref={strandBRef}
        d={pathB}
        stroke={secondary}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />

      {/* Travelling dots. Start at the strand origin — anime.path()
          will translate them along the curve. */}
      <circle ref={dotARef} cx={0} cy={0} r={5} fill={primary} />
      <circle ref={dotBRef} cx={0} cy={0} r={5} fill={secondary} />
    </svg>
  );
}
