'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { memo, type ReactNode } from 'react';

import type { RfNode } from '@/lib/canvas/adapter';

import { NODE_CATALOG } from '../catalog';
import { NodeContextToolbar } from '../NodeContextToolbar';

type Status = NonNullable<RfNode['data']['status']>;

const STATUS_ICON: Record<Status, ReactNode | null> = {
  idle: null,
  running: <Loader2 size={12} className="animate-spin" />,
  success: <CheckCircle2 size={12} />,
  failed: <XCircle size={12} />,
  skipped: <MinusCircle size={12} />,
};

const STATUS_RING_VAR: Record<Status, string> = {
  idle: 'transparent',
  running: 'var(--rb-edge-running)',
  success: 'var(--rb-edge-success)',
  failed: 'var(--rb-edge-failed)',
  skipped: 'var(--rb-edge-skipped)',
};

function BaseStepNodeComponent(props: NodeProps<RfNode>) {
  const { id, type, data, selected } = props;
  const def = NODE_CATALOG.get(type);
  const workflow = data.workflow;

  const title = workflow.title?.trim() || def?.label.en || type;
  const enabled = workflow.enabled !== false;
  const inputs = def?.inputs ?? ['main'];
  const outputs = def?.outputs ?? ['main'];
  const status: Status = data.status ?? 'idle';

  const ariaSummary = `${def?.label.en ?? type} step: ${title}${enabled ? '' : ' (disabled)'}${
    status !== 'idle' ? `, status ${status}` : ''
  }`;

  const ringColor = selected ? 'var(--rb-node-selected)' : STATUS_RING_VAR[status];
  // Pulse animations live as keyframes in globals.css so the box-shadow
  // can reach 0 alpha without the inline `animate` array recomputing on
  // every node re-render. Selected pulse is gentler than running.
  const animationName =
    status === 'running'
      ? 'rb-running-pulse 1.6s ease-in-out infinite'
      : selected
        ? 'rb-selected-pulse 2.4s ease-in-out infinite'
        : 'none';

  return (
    <>
      <NodeContextToolbar id={id} kind="step" enabled={enabled} parentId={props.parentId} />
      <motion.div
        role="group"
        aria-label={ariaSummary}
        layout
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className={[
          'min-w-[220px] overflow-hidden rounded-lg border text-[color:var(--rb-node-text)] shadow-lg transition-colors',
          enabled ? '' : 'rb-disabled-stripes opacity-80',
        ].join(' ')}
        style={{
          background: 'var(--rb-node-bg)',
          borderColor: ringColor === 'transparent' ? 'var(--rb-node-border)' : ringColor,
          boxShadow: '0 0 0 0 transparent',
          animation: animationName,
        }}
        data-node-type={type}
        data-status={status}
      >
        <div
          className={[
            'flex items-center justify-between gap-2 rounded-t-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white',
            def?.color ?? 'bg-slate-700',
          ].join(' ')}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="flex h-5 w-5 items-center justify-center">{def?.icon ?? null}</span>
            <span className="truncate">{def?.label.en ?? type}</span>
          </span>
          {STATUS_ICON[status] ? (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-black/25"
              aria-label={`status ${status}`}
            >
              {STATUS_ICON[status]}
            </span>
          ) : null}
        </div>

        <div className="px-3 py-2.5">
          <div className="truncate text-sm font-medium">{title}</div>
          {!enabled ? (
            <div className="mt-1 text-[10px] uppercase tracking-wide text-[color:var(--rb-edge-failed)]">
              disabled
            </div>
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
      </motion.div>
    </>
  );
}

export const BaseStepNode = memo(BaseStepNodeComponent);
