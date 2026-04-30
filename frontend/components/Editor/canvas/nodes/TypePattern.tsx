import { memo } from 'react';

/**
 * Per-type subtle SVG pattern overlaid on the node header strip. The
 * pattern evokes what the step does (terminal cursor for shell, wave
 * for HTTP, hash for SSH) without forcing a full illustration. Pattern
 * IDs are scoped to the node id so two nodes of the same type don't
 * share a single `<defs>` and break independent rendering.
 *
 * All patterns are sized to a 12-px tile, opacity 0.18, drawn in white
 * so they tint with whatever the header's color band already is. No
 * extra brand tokens needed.
 */

interface TypePatternProps {
  type: string;
  /** The node id. Used to scope the pattern's defs id so concurrent
   * nodes of the same type don't fight over a single pattern element. */
  scopeId: string;
}

const PATTERN_SIZE = 12;

type PatternBuilder = (id: string) => React.ReactNode;

const PATTERNS: Record<string, PatternBuilder> = {
  shell: id => (
    <pattern id={id} width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
      <rect x="0" y="3" width="2" height="6" fill="white" opacity="0.16" />
    </pattern>
  ),
  ssh: id => (
    <pattern id={id} width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
      <line
        x1="0"
        y1={PATTERN_SIZE}
        x2={PATTERN_SIZE}
        y2="0"
        stroke="white"
        strokeWidth="1"
        opacity="0.14"
      />
    </pattern>
  ),
  'operari.httpRequest': id => (
    <pattern id={id} width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
      <path
        d={`M0 ${PATTERN_SIZE / 2} Q${PATTERN_SIZE / 4} 0 ${PATTERN_SIZE / 2} ${PATTERN_SIZE / 2} T${PATTERN_SIZE} ${PATTERN_SIZE / 2}`}
        fill="none"
        stroke="white"
        strokeWidth="1"
        opacity="0.16"
      />
    </pattern>
  ),
  'operari.webhook': id => (
    <pattern id={id} width={16} height={16} patternUnits="userSpaceOnUse">
      <circle cx="8" cy="8" r="2" fill="none" stroke="white" strokeWidth="1" opacity="0.14" />
      <circle cx="8" cy="8" r="5" fill="none" stroke="white" strokeWidth="1" opacity="0.08" />
    </pattern>
  ),
  'operari.cron': id => (
    <pattern id={id} width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1" fill="white" opacity="0.18" />
      <circle cx="9" cy="9" r="1" fill="white" opacity="0.18" />
    </pattern>
  ),
  approval: id => (
    <pattern id={id} width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="1" fill="white" opacity="0.16" />
    </pattern>
  ),
  notify: id => (
    <pattern id={id} width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
      <path
        d="M3 8 V5 a3 3 0 0 1 6 0 V8 M5 9 a1 1 0 0 0 2 0"
        fill="none"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.16"
      />
    </pattern>
  ),
  wait: id => (
    <pattern id={id} width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
      <line x1="6" y1="2" x2="6" y2="3" stroke="white" strokeWidth="1" opacity="0.16" />
      <line x1="6" y1="9" x2="6" y2="10" stroke="white" strokeWidth="1" opacity="0.16" />
      <line x1="2" y1="6" x2="3" y2="6" stroke="white" strokeWidth="1" opacity="0.16" />
      <line x1="9" y1="6" x2="10" y2="6" stroke="white" strokeWidth="1" opacity="0.16" />
    </pattern>
  ),
};

function TypePatternComponent({ type, scopeId }: TypePatternProps) {
  const builder = PATTERNS[type];
  if (!builder) return null;
  const patternId = `rb-pattern-${scopeId}`;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
      role="presentation"
    >
      <defs>{builder(patternId)}</defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

export const TypePattern = memo(TypePatternComponent);
