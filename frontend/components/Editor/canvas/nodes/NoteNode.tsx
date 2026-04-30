'use client';

import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';

import type { RfNode } from '@/lib/canvas/v2/adapter';

function NoteNodeComponent({ data, selected }: NodeProps<RfNode>) {
  const config = (data.workflow.config ?? {}) as { text?: string };
  const text = config.text || data.workflow.title || 'Note';

  return (
    <div
      role="note"
      aria-label={`Note: ${text}`}
      className={[
        'min-w-[200px] max-w-[320px] rounded-lg border bg-amber-100 px-3 py-2 text-sm text-amber-900 shadow-md',
        selected ? 'border-amber-500 ring-2 ring-amber-400' : 'border-amber-300',
      ].join(' ')}
    >
      <div className="whitespace-pre-wrap break-words">{text}</div>
    </div>
  );
}

export const NoteNode = memo(NoteNodeComponent);
