'use client';

import { useEffect, useRef } from 'react';

/**
 * Cursor-following spotlight — a soft radial gradient that tracks the
 * pointer over a dark surface. Reads as "the page responds" without
 * the accessibility cost of a custom cursor.
 *
 * Implementation:
 *   - The gradient is rendered into a single fixed-size pseudo-layer
 *     (a div) absolutely positioned inside the parent. We move it via
 *     CSS variables (`--spot-x`, `--spot-y`) that the radial-gradient
 *     reads, so the only DOM update per frame is two custom-property
 *     writes on the host element — no React re-render, no layout
 *     thrash.
 *   - On `pointerleave` we ease the spotlight to the centre and
 *     decay its opacity so the panel goes "dark" again instead of
 *     leaving a stale glow.
 *
 * Skipped under `prefers-reduced-motion` AND on coarse pointers
 * (touch / hybrid laptop in tablet mode) — a tap that flashes a
 * spotlight reads as a glitch, not a feature.
 *
 * Mounts as `pointer-events: none` so it never blocks clicks on the
 * underlying CTAs. `aria-hidden` because it's pure decoration.
 */

interface MouseSpotlightProps {
  /** Diameter of the spotlight in px. 600 fills a typical CTA panel
   *  without bleeding past the edges. */
  size?: number;
  /** Spotlight tint. Match the section's accent — emerald for the
   *  primary CTA, can switch per surface. */
  color?: string;
  /** Inner-edge opacity (centre of the gradient). Outer is always 0. */
  intensity?: number;
  className?: string;
}

export default function MouseSpotlight({
  size = 600,
  color = 'rgba(63, 207, 142, 0.18)',
  intensity = 1,
  className,
}: MouseSpotlightProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    // Anchor the listener on the host's parent so we can reach the
    // spotlight regardless of which child the pointer is over (e.g.
    // hovering a button inside the panel still moves the spotlight).
    const host = el.parentElement;
    if (!host) return;

    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;
    let dirty = false;

    const apply = () => {
      raf = 0;
      if (!dirty) return;
      dirty = false;
      el.style.setProperty('--spot-x', `${pendingX}px`);
      el.style.setProperty('--spot-y', `${pendingY}px`);
      el.style.setProperty('--spot-opacity', '1');
    };

    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      dirty = true;
      // rAF coalesce — pointermove fires up to 1000Hz on some
      // trackpads; we only need to repaint on the next frame.
      if (raf === 0) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      // Ease back to the panel centre + fade out, so the spotlight
      // doesn't sit stale at the last cursor position.
      const rect = host.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${rect.width / 2}px`);
      el.style.setProperty('--spot-y', `${rect.height / 2}px`);
      el.style.setProperty('--spot-opacity', '0');
    };

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);

    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${className ?? ''}`}
      style={{
        // CSS variables drive the gradient centre + alpha. The default
        // values keep the spotlight off-screen and invisible until the
        // first pointermove writes real coordinates. Intensity
        // multiplies into the inner alpha so callers can tune
        // per-section without changing the colour token.
        ['--spot-x' as string]: '-9999px',
        ['--spot-y' as string]: '-9999px',
        ['--spot-opacity' as string]: '0',
        opacity: 'var(--spot-opacity, 0)',
        background: `radial-gradient(${size}px circle at var(--spot-x) var(--spot-y), ${color}, transparent 60%)`,
        mixBlendMode: 'screen',
        // Smooth the centre tracking — we only update --spot-{x,y} on
        // rAF, but a CSS transition softens the jump between frames so
        // the gradient feels like it lerps to the cursor.
        transition: 'opacity 500ms ease-out, background-position 100ms linear',
        // Honor `intensity` only when the consumer overrides it.
        filter: intensity === 1 ? undefined : `opacity(${intensity})`,
      }}
    />
  );
}
