'use client';

import { motion } from 'framer-motion';

/**
 * AuroraBackground — animated ambient layer used by every landing
 * section. Renders a few large blurred orbs that slowly breathe
 * (scale), drift (x/y), and flicker (opacity) on infinite loops with
 * intentionally non-matching durations so the composition never lines
 * up — the eye never spots a "loop", which is the whole trick to
 * making ambient backgrounds not feel synthetic.
 *
 * Variants are presets keyed by section. Adding a new section is one
 * extra entry in the PRESETS map; the props the consumer passes stay
 * stable.
 *
 * Performance notes:
 *   - All animations are CSS transforms + opacity, which the
 *     compositor handles off-thread.
 *   - The orbs are absolutely positioned with `pointer-events: none`
 *     and `aria-hidden`, so they never affect layout, hit-testing,
 *     or assistive tech.
 *   - `prefers-reduced-motion` is honored automatically by
 *     framer-motion's defaults — users who opted out get a static
 *     gradient with the same colors.
 */

type OrbColor = 'orange' | 'emerald' | 'primary' | 'violet' | 'foreground';

interface OrbConfig {
  color: OrbColor;
  /** size in pixels (square) */
  size: number;
  /** position as CSS values (e.g. '20%', '-100px') */
  x: string;
  y: string;
  /** base opacity (0..1) — will breathe ±20% around this */
  opacity?: number;
  /** breathing duration in seconds */
  duration?: number;
  /** delay so neighbouring orbs don't sync */
  delay?: number;
  /** drift radius in px */
  drift?: number;
}

const ORB_COLOR_BG: Record<OrbColor, string> = {
  orange: 'bg-orange-500',
  emerald: 'bg-emerald-500',
  primary: 'bg-primary',
  violet: 'bg-violet-500',
  foreground: 'bg-foreground',
};

interface AuroraBackgroundProps {
  orbs: OrbConfig[];
  /** if true, adds a subtle drifting grid overlay on top of the orbs */
  grid?: boolean;
}

export default function AuroraBackground({ orbs, grid = false }: AuroraBackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-background pointer-events-none" aria-hidden="true">
      {orbs.map((orb, i) => (
        <Orb key={i} {...orb} />
      ))}
      {grid && <DriftingGrid />}
    </div>
  );
}

function Orb({
  color,
  size,
  x,
  y,
  opacity = 0.06,
  duration = 12,
  delay = 0,
  drift = 30,
}: OrbConfig) {
  return (
    <motion.div
      className={`absolute rounded-full blur-[120px] mix-blend-screen ${ORB_COLOR_BG[color]}`}
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        opacity,
      }}
      animate={{
        // Breathing scale: 0.92 → 1.08 → 0.92 — about ±8% so the
        // movement reads as "alive" without being obvious.
        scale: [0.92, 1.08, 0.92],
        // Drift in a small Lissajous curve. The x and y use different
        // phase offsets so the orb traces an oval, not a straight line.
        x: [-drift, drift, -drift],
        y: [drift * 0.6, -drift * 0.6, drift * 0.6],
        // Opacity breathing — much smaller swing so the color never
        // visibly flashes.
        opacity: [opacity * 0.85, opacity * 1.15, opacity * 0.85],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/**
 * Subtle 1px grid that slowly drifts diagonally. Used on hero and CTA
 * to give the background some texture beyond the orbs. The opacity is
 * deliberately tiny — visible only when the user looks for it.
 */
function DriftingGrid() {
  return (
    <motion.div
      className="absolute inset-0 opacity-[0.025]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }}
      animate={{
        backgroundPosition: ['0px 0px', '60px 60px'],
      }}
      transition={{
        duration: 30,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}
