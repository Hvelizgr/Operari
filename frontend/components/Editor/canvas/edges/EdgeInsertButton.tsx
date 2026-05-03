'use client';

import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import { Bell, Plus, Terminal, Timer, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { iconButton } from '@/components/ui/buttonVariants';
import type { RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { defaultConfigForType } from '../catalog';

/**
 * Hover-revealed `+` affordance at the midpoint of an edge. Clicking
 * opens a tiny popover with four common step types — picking one
 * splices a fresh node into the connection (source → newNode → target)
 * via `editorStore.insertNodeMidEdge`. n8n parity for the "I forgot a
 * step in the middle" workflow.
 *
 * Why a curated 4-item menu instead of the full palette: the operator
 * editing an existing graph already has the palette in their muscle
 * memory; the mid-edge case is almost always one of {wait, shell,
 * notify, approval}. Keeping the popover terse means a single click
 * covers ~80% of inserts. For the long tail, the operator drops a
 * node from the palette and reconnects.
 */

const QUICK_STEPS: Array<{
  type: string;
  label: string;
  icon: typeof Plus;
}> = [
  { type: 'shell', label: 'Shell', icon: Terminal },
  { type: 'wait', label: 'Wait', icon: Timer },
  { type: 'notify', label: 'Notify', icon: Bell },
  { type: 'approval', label: 'Approval', icon: UserCheck },
];

interface EdgeInsertButtonProps {
  edgeId: string;
  sourceId: string;
  targetId: string;
  /** World-space coordinates of the edge midpoint. */
  x: number;
  y: number;
  /** Pixel offset along the X axis to avoid overlapping the condition
   *  badge / delete button which both anchor to the same midpoint. */
  offsetX?: number;
}

export function EdgeInsertButton({
  edgeId,
  sourceId,
  targetId,
  x,
  y,
  offsetX = -14,
}: EdgeInsertButtonProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const insertNodeMidEdge = useEditorStore(s => s.insertNodeMidEdge);
  const { getNode } = useReactFlow();

  // Click-outside dismiss. Bound only while open so we never pay the
  // listener cost on idle edges (the canvas can have hundreds at once).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Midpoint position for the new node. Using each end's reactive
  // position from React Flow keeps the spawn point correct even if
  // the operator dragged a node between hover and click.
  const computeNewPosition = useMemo(
    () => () => {
      const source = getNode(sourceId);
      const target = getNode(targetId);
      if (!source || !target) return { x, y };
      return {
        x: (source.position.x + target.position.x) / 2,
        y: (source.position.y + target.position.y) / 2,
      };
    },
    [getNode, sourceId, targetId, x, y]
  );

  const insert = (type: string) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newNode: RfNode = {
      id,
      type,
      position: computeNewPosition(),
      data: {
        workflow: {
          title: type,
          enabled: true,
          config: defaultConfigForType(type),
        },
      },
    };
    insertNodeMidEdge(edgeId, newNode);
    setOpen(false);
  };

  return (
    <EdgeLabelRenderer>
      <div
        className="rb-edge-insert nodrag nopan pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: x + offsetX, top: y }}
      >
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            setOpen(o => !o);
          }}
          aria-label="Insert step"
          className="rb-edge-insert-trigger flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition-transform hover:scale-110"
        >
          <Plus size={11} />
        </button>
        {open ? (
          <div
            ref={popoverRef}
            className="absolute left-1/2 top-7 z-50 flex -translate-x-1/2 gap-1 rounded-md border border-white/10 bg-[#1a1a2e] p-1 shadow-xl"
          >
            {QUICK_STEPS.map(step => (
              <button
                key={step.type}
                type="button"
                onClick={() => insert(step.type)}
                title={step.label}
                aria-label={`Insert ${step.label}`}
                className={iconButton({ tone: 'neutral', size: 'md' })}
              >
                <step.icon size={13} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </EdgeLabelRenderer>
  );
}
