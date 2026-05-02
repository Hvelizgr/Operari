'use client';

import { BaseEdge, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { memo } from 'react';

import type { SchemaEdge } from './types';

/**
 * Foreign-key edge. Uses smoothstep so the line traces a clean
 * orthogonal path between two table nodes (entity-relationship
 * diagrams are easier to read with right-angle joints than with
 * bezier curves).
 *
 * `markerEnd` is set on the edge data (not as a prop) so we can
 * carry the cardinality without extending the React Flow Edge type.
 */
function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<SchemaEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const onDelete = data?.fk.onDelete;
  const fkDiff = data?.diff;
  // Stroke color comes from the same V2 CSS vars the runbook editor
  // uses, so when the user customizes status colors in Appearance,
  // the schema diagram FK lines change to match. CSS-var lookup
  // happens at paint time via `getComputedStyle` on the document
  // root; falling back to a neutral hex when no var is resolved (SSR
  // / first paint before the bootstrap script runs).
  const cssVar = (name: string, fallback: string): string => {
    if (typeof document === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  };
  const stroke = selected
    ? cssVar('--rb-node-selected', '#34d399')
    : fkDiff === 'added'
      ? cssVar('--rb-edge-success', '#10b981')
      : fkDiff === 'removed'
        ? cssVar('--rb-edge-failed', '#f43f5e')
        : cssVar('--rb-edge', '#71717a');
  const dashArray = fkDiff === 'removed' ? '6 3' : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke, strokeWidth: selected ? 2 : 1.4, strokeDasharray: dashArray }}
        markerEnd="url(#schema-fk-marker)"
      />
      {onDelete && onDelete !== 'NO ACTION' ? (
        <foreignObject
          x={labelX - 26}
          y={labelY - 8}
          width={52}
          height={16}
          className="pointer-events-none"
        >
          <div className="rounded bg-zinc-900/90 px-1 text-center font-mono text-[9px] uppercase tracking-tight text-zinc-400">
            {onDelete}
          </div>
        </foreignObject>
      ) : null}
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
