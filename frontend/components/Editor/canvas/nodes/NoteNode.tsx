'use client';

import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';

import type { RfNode } from '@/lib/canvas/adapter';

import { NodeContextToolbar } from '../NodeContextToolbar';

// Sticky-note look retained on purpose — operator-readable annotations
// need to stand out against the technical chrome of step nodes. The
// gold tint reads as the Operari `--op-gold` family.
function NoteNodeComponent({ id, data, selected, parentId }: NodeProps<RfNode>) {
  const config = (data.workflow.config ?? {}) as { text?: string };
  const text = config.text || data.workflow.title || 'Note';

  return (
    <>
      <NodeContextToolbar id={id} kind="note" parentId={parentId} />
      <div
        role="note"
        aria-label={`Note: ${text}`}
        className="min-w-[200px] max-w-[320px] rounded-lg border px-3 py-2 text-sm shadow-md"
        style={{
          background: 'color-mix(in oklab, var(--op-gold) 18%, var(--op-snow))',
          color: 'color-mix(in oklab, var(--op-gold) 70%, black)',
          borderColor: selected
            ? 'var(--op-gold)'
            : 'color-mix(in oklab, var(--op-gold) 35%, transparent)',
          boxShadow: selected
            ? '0 0 0 2px color-mix(in oklab, var(--op-gold) 50%, transparent)'
            : undefined,
        }}
      >
        <div className="whitespace-pre-wrap break-words">{text}</div>
      </div>
    </>
  );
}

export const NoteNode = memo(NoteNodeComponent);
