'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';

import type { RfNode } from '@/lib/canvas/v2/adapter';

import { NODE_CATALOG } from '../catalog';

const STATUS_RING: Record<NonNullable<RfNode['data']['status']>, string> = {
  idle: 'ring-transparent',
  running: 'ring-amber-400 animate-pulse',
  success: 'ring-emerald-500',
  failed: 'ring-rose-500',
  skipped: 'ring-slate-500',
};

function BaseStepNodeComponent(props: NodeProps<RfNode>) {
  const { type, data, selected } = props;
  const def = NODE_CATALOG.get(type);
  const workflow = data.workflow;

  const title = workflow.title?.trim() || def?.label.en || type;
  const enabled = workflow.enabled !== false;
  const inputs = def?.inputs ?? ['main'];
  const outputs = def?.outputs ?? ['main'];
  const status = data.status ?? 'idle';

  const ariaSummary = `${def?.label.en ?? type} step: ${title}${enabled ? '' : ' (disabled)'}${
    status !== 'idle' ? `, status ${status}` : ''
  }`;

  return (
    <div
      role="group"
      aria-label={ariaSummary}
      className={[
        'min-w-[220px] rounded-lg border border-white/10 bg-[#1a1a2e] text-white shadow-lg ring-2 transition-shadow',
        selected ? 'ring-primary/70' : STATUS_RING[status],
        enabled ? '' : 'opacity-60',
      ].join(' ')}
      data-node-type={type}
    >
      <div
        className={[
          'flex items-center gap-2 rounded-t-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide',
          def?.color ?? 'bg-slate-700',
        ].join(' ')}
      >
        <span className="flex h-5 w-5 items-center justify-center">{def?.icon ?? null}</span>
        <span className="truncate">{def?.label.en ?? type}</span>
      </div>

      <div className="px-3 py-2.5">
        <div className="truncate text-sm font-medium">{title}</div>
        {!enabled ? (
          <div className="mt-1 text-[10px] uppercase tracking-wide text-rose-300">disabled</div>
        ) : null}
      </div>

      {inputs.map((label, idx) => (
        <Handle
          key={`in-${idx}`}
          id={String(idx)}
          type="target"
          position={Position.Left}
          aria-label={`input ${label}`}
          style={{ top: 32 + idx * 18 }}
        />
      ))}
      {outputs.map((label, idx) => (
        <Handle
          key={`out-${idx}`}
          id={String(idx)}
          type="source"
          position={Position.Right}
          aria-label={`output ${label}`}
          style={{ top: 32 + idx * 18 }}
        />
      ))}
    </div>
  );
}

export const BaseStepNode = memo(BaseStepNodeComponent);
