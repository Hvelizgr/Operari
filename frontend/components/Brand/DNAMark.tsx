'use client';

/**
 * DNA-helix brand mark prototype for Operari.
 *
 * Two strands cross at top, middle, and bottom — the iconic
 * double-helix profile flattened to 2D. The narrative the user
 * picked: each strand is one of the two surfaces every Operari step
 * lives on at once — the canvas (what you author) and the audit
 * chain (what actually ran). Steps are the dots at each crossing,
 * connected to both strands by definition.
 *
 * Pure static SVG — meant for logo lockups (sidebar mark, email
 * header, favicon at small sizes). Animation lives in
 * `DNAHelixAnimation.tsx`.
 */

interface DNAMarkProps {
  /** Pixel size — default 32px keeps it readable at favicon scales. */
  size?: number;
  /** Strand A colour. Defaults to Operari's emerald accent. */
  primary?: string;
  /** Strand B colour. Defaults to a softer white-ish for contrast on
   *  dark backgrounds. */
  secondary?: string;
  /** Stroke width of each strand, in viewBox units. */
  strokeWidth?: number;
  /** When true, draws the connecting rungs (horizontal lines between
   *  strands at their widest separation). Off by default — the
   *  crossing dots already carry the "steps" semantics, rungs are
   *  visual noise at small sizes. */
  showRungs?: boolean;
  className?: string;
}

export function DNAMark({
  size = 32,
  primary = '#3ecf8e',
  secondary = 'rgba(255,255,255,0.85)',
  strokeWidth = 2,
  showRungs = false,
  className,
}: DNAMarkProps) {
  // Strand A: starts top-centre, bulges left to (6,8), back to centre
  // at (16,16), bulges right to (26,24), back to centre at bottom.
  // Strand B: mirror image — bulges right first, then left.
  const strandA = 'M 16 0 C 6 4, 6 12, 16 16 C 26 20, 26 28, 16 32';
  const strandB = 'M 16 0 C 26 4, 26 12, 16 16 C 6 20, 6 28, 16 32';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Operari"
      className={className}
    >
      {showRungs && (
        <>
          {/* Rungs at the widest separations — y=8 and y=24. The
              strand x-positions at those y values are 6 and 26 (per
              the cubic-Bezier control points above). */}
          <line
            x1="6"
            y1="8"
            x2="26"
            y2="8"
            stroke={primary}
            strokeWidth={strokeWidth * 0.5}
            strokeOpacity={0.4}
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="24"
            x2="26"
            y2="24"
            stroke={primary}
            strokeWidth={strokeWidth * 0.5}
            strokeOpacity={0.4}
            strokeLinecap="round"
          />
        </>
      )}
      <path
        d={strandA}
        stroke={primary}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={strandB}
        stroke={secondary}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      {/* Crossing nodes — the three points where the strands meet.
          Filled with primary so the eye reads them as "steps" rather
          than incidental geometry. */}
      <circle cx="16" cy="0" r="2" fill={primary} />
      <circle cx="16" cy="16" r="2.2" fill={primary} />
      <circle cx="16" cy="32" r="2" fill={primary} />
    </svg>
  );
}
