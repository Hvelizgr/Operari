'use client';

/**
 * Brand-aligned loading spinner.
 *
 * Replaces lucide's `Loader2` in places where a loading state is
 * load-bearing for the brand identity (run buttons, page-level
 * loading, modal saves). The visual is a tight DNA-helix loop —
 * same shape as the brand mark, just two strands rotating.
 *
 * Implemented as a CSS-driven SVG (rotate the parent) rather than
 * anime.js so it's cheap on every loading surface and works inside
 * tests/Storybook without animation runtime hooks.
 *
 * Reduced-motion: rely on the global rule in `globals.css` that
 * disables `animate-spin` for users with the OS preference set.
 */

interface HelixSpinnerProps {
  /** Pixel size — defaults to 14 to drop into icon slots. */
  size?: number;
  /** Stroke colour for the primary strand. */
  primary?: string;
  /** Stroke colour for the secondary strand. */
  secondary?: string;
  className?: string;
}

export function HelixSpinner({
  size = 14,
  primary = 'currentColor',
  secondary = 'currentColor',
  className,
}: HelixSpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="status"
      aria-label="Loading"
      className={`animate-spin ${className ?? ''}`}
    >
      {/* Two strands of the helix mark. Drawn at full opacity for the
          primary, half-opacity for the secondary so the rotation
          gives a perceptible "weave" instead of a doubled outline. */}
      <path
        d="M 16 2 C 6 6, 6 12, 16 16 C 26 20, 26 26, 16 30"
        stroke={primary}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 16 2 C 26 6, 26 12, 16 16 C 6 20, 6 26, 16 30"
        stroke={secondary}
        strokeOpacity={0.5}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
