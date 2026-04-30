'use client';

import { Handle, type NodeProps, Position, useNodeConnections, useStore } from '@xyflow/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { memo, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useNextInPath } from '@/hooks/useNextInPath';
import type { RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { NODE_CATALOG } from '../catalog';
import { NodeContextToolbar } from '../NodeContextToolbar';
import {
  handleTone,
  isOrphanOutput,
  resolvePreview,
  resolveSecondaryChips,
  resolveTags,
} from './nodeChrome';
import { TypePattern } from './TypePattern';

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

// Timer formatting borrowed from chaiNNer's NodeFooter/Timer.tsx —
// `splitDuration` separates ms into h/m/s, `shortFormat` produces a
// compact label for the inline footer ("2.34s", "1m 25s", "1h 23m"),
// and `longFormat` produces a humanized version for the title tooltip
// so an SRE can hover to read the precise duration during a postmortem.
interface SplitDuration {
  hours: number;
  minutes: number;
  seconds: number;
}

const splitDuration = (ms: number): SplitDuration => {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutesTotal = totalSeconds - hours * 3600;
  const minutes = Math.floor(minutesTotal / 60);
  const seconds = +(minutesTotal - minutes * 60).toFixed(2);
  return { hours, minutes, seconds };
};

const shortFormat = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const { hours, minutes, seconds } = splitDuration(ms);
  if (hours > 0) return `${hours}h ${minutes}m`;
  const totalSeconds = minutes * 60 + seconds;
  if (totalSeconds >= 100) return `${minutes}m ${Math.floor(seconds)}s`;
  // Pick the shortest among "1.2", "1.20", and "1.2" — the second
  // form keeps two decimals; the shorter ones drop trailing zeros.
  const variants = [totalSeconds.toPrecision(2), totalSeconds.toFixed(2), String(totalSeconds)]
    .filter(s => !s.includes('e+'))
    .sort((a, b) => a.length - b.length);
  return `${variants[0]}s`;
};

const longFormat = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)} milliseconds`;
  const { hours, minutes, seconds } = splitDuration(ms);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (hours === 0 && (parts.length === 0 || seconds > 0)) {
    parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  }
  return parts.join(', ');
};

// One-shot animations for the run-completion moments. We trigger them
// with a `transitionKey` that bumps each time status flips into a
// terminal state, so framer-motion treats them as a single mount
// rather than a loop. The base mount animation animates `opacity` +
// `scale`; the celebrations only override the keys they care about.
const SUCCESS_BUMP = {
  opacity: 1,
  scale: [1, 1.04, 1],
  boxShadow: [
    '0 0 0 0 rgba(62,207,142,0)',
    '0 0 0 8px rgba(62,207,142,0.35)',
    '0 0 0 0 rgba(62,207,142,0)',
  ],
};
const FAIL_SHAKE = { opacity: 1, scale: 1, x: [0, -3, 3, -2, 2, 0] };
const REST = { opacity: 1, scale: 1 };

function BaseStepNodeComponent(props: NodeProps<RfNode>) {
  const { id, type, data, selected } = props;
  const def = NODE_CATALOG.get(type);
  const workflow = data.workflow;

  const title = workflow.title?.trim() || def?.label.en || type;
  const enabled = workflow.enabled !== false;
  const inputs = def?.inputs ?? ['main'];
  const outputs = def?.outputs ?? ['main'];
  const expectedOutputs = outputs.length;
  const status: Status = data.status ?? 'idle';
  const isNextInPath = useNextInPath(id);
  // Trace dim: when a run is live, steps that never ran (still idle)
  // fade to the background so the operator's eye lands on the path
  // that actually executed. The single store-level `traceMode` flag
  // is cheaper than recomputing "is any node running" inside every
  // node component.
  const traceMode = useEditorStore(s => s.traceMode);
  const traceDim = traceMode && status === 'idle';

  // Per-node connection counts. `useNodeConnections` is reactive — adds
  // / removes update without re-rendering the whole canvas.
  const incoming = useNodeConnections({ id, handleType: 'target' });
  const outgoing = useNodeConnections({ id, handleType: 'source' });
  const orphanOutputs = isOrphanOutput(type, expectedOutputs, outgoing.length, status);

  // Drop-target breathing: while a connection is being drawn anywhere
  // on the canvas, this node's input handle becomes a candidate. We
  // light up the border to telegraph it's a valid drop target. RF
  // exposes the connection state via the store; we subscribe with a
  // stable selector so non-connection drags don't trigger re-renders.
  const connectionInProgress = useStore(s => s.connection.inProgress);

  // Live elapsed counter while running. Subscribes to a 1s tick only
  // when this specific node is running, so the canvas pays nothing for
  // idle nodes. Once the run terminates, the socket sets `durationMs`
  // and the footer renders a static value.
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  useEffect(() => {
    if (status !== 'running' || !data.startedAt) {
      setElapsedMs(null);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - (data.startedAt ?? Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, data.startedAt]);

  // Track the previous status so we can fire one-shot success / fail
  // animations exactly on the terminal-state transition (and not, for
  // example, on every re-render while the node sits in `success`).
  const prevStatusRef = useRef<Status>(status);
  const [transitionKey, setTransitionKey] = useState(0);
  const [transitionKind, setTransitionKind] = useState<'success' | 'failed' | null>(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === 'running' && (status === 'success' || status === 'failed')) {
      setTransitionKind(status);
      setTransitionKey(k => k + 1);
    }
  }, [status]);

  const config = (workflow.config ?? {}) as Record<string, unknown>;
  const preview = useMemo(() => resolvePreview(type, config), [type, config]);
  const tags = useMemo(() => resolveTags(config), [config]);
  const secondaryChips = useMemo(() => resolveSecondaryChips(type, config), [type, config]);

  const footerDuration =
    status === 'running'
      ? elapsedMs != null
        ? `running ${shortFormat(elapsedMs)}…`
        : 'running…'
      : data.durationMs != null
        ? `ran ${shortFormat(data.durationMs)}`
        : null;
  // Long-form humanized duration for the title tooltip; lets the
  // operator hover during a postmortem to read the precise number.
  const footerTooltip =
    status === 'running' && elapsedMs != null
      ? `Running for ${longFormat(elapsedMs)}`
      : data.durationMs != null
        ? `Took ${longFormat(data.durationMs)}`
        : undefined;

  const ariaSummary = `${def?.label.en ?? type} step: ${title}${enabled ? '' : ' (disabled)'}${
    status !== 'idle' ? `, status ${status}` : ''
  }`;

  const ringColor = selected ? 'var(--rb-node-selected)' : STATUS_RING_VAR[status];
  const animationName =
    status === 'running'
      ? 'rb-running-pulse 1.6s ease-in-out infinite'
      : connectionInProgress
        ? 'rb-target-pulse 1.6s ease-in-out infinite'
        : selected
          ? 'rb-selected-pulse 2.4s ease-in-out infinite'
          : isNextInPath
            ? 'rb-selected-pulse 3.2s ease-in-out infinite'
            : 'none';

  return (
    <>
      <NodeContextToolbar id={id} kind="step" enabled={enabled} parentId={props.parentId} />
      <motion.div
        role="group"
        aria-label={ariaSummary}
        layout
        initial={{ opacity: 0, scale: 0.94 }}
        animate={
          transitionKind === 'success'
            ? SUCCESS_BUMP
            : transitionKind === 'failed'
              ? FAIL_SHAKE
              : REST
        }
        // The keyed transition isolates the celebration burst from the
        // mount spring so we don't double-animate on first paint.
        key={`base-${transitionKey}`}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={
          transitionKind != null
            ? { duration: transitionKind === 'failed' ? 0.4 : 0.6 }
            : { type: 'spring', stiffness: 320, damping: 28 }
        }
        onAnimationComplete={() => {
          if (transitionKind != null) setTransitionKind(null);
        }}
        className={[
          'rb-node group relative min-w-[240px] overflow-hidden rounded-lg border text-[color:var(--rb-node-text)] shadow-lg transition-[transform,box-shadow,border-color,opacity] duration-150',
          enabled ? '' : 'rb-disabled-stripes opacity-80',
          traceDim ? 'opacity-30' : '',
        ].join(' ')}
        style={{
          background: 'var(--rb-node-bg)',
          borderColor:
            ringColor === 'transparent'
              ? isNextInPath
                ? 'color-mix(in oklab, var(--op-moss) 45%, transparent)'
                : 'var(--rb-node-border)'
              : ringColor,
          boxShadow: '0 0 0 0 transparent',
          animation: animationName,
        }}
        data-node-type={type}
        data-status={status}
        data-next-in-path={isNextInPath || undefined}
      >
        {/* Header — colored band + per-type pattern + secondary chips */}
        <div
          className={[
            'relative flex items-center justify-between gap-2 rounded-t-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white',
            def?.color ?? 'bg-slate-700',
          ].join(' ')}
        >
          <TypePattern type={type} scopeId={id} />
          <span className="relative flex min-w-0 items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center">{def?.icon ?? null}</span>
            <span className="truncate">{def?.label.en ?? type}</span>
            {secondaryChips.map(chip => (
              <span
                key={chip}
                className="max-w-[8rem] truncate rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] tracking-tight"
                title={chip}
              >
                {chip}
              </span>
            ))}
          </span>
          <span className="relative flex items-center gap-1.5">
            {orphanOutputs ? (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-black/30"
                title="Output is not connected"
                aria-label="output not connected"
              >
                <AlertTriangle size={12} className="text-[color:var(--op-gold)]" />
              </span>
            ) : null}
            <AnimatePresence mode="wait">
              {STATUS_ICON[status] ? (
                <motion.span
                  key={status}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-black/30"
                  aria-label={`status ${status}`}
                >
                  {STATUS_ICON[status]}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
        </div>

        {/* Body — title + preview + tags + meta footer */}
        <div className="px-3 py-2.5">
          <div className="truncate text-sm font-medium">{title}</div>
          {preview ? (
            <div
              className="mt-1 truncate font-mono text-[11px] text-[color:var(--rb-node-muted)]"
              title={preview}
            >
              {preview}
            </div>
          ) : null}
          {tags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-tight text-[color:var(--rb-node-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wide text-[color:var(--rb-node-muted)]">
            <span className="flex items-center gap-1.5">
              <span title={`${incoming.length} incoming connections`}>↓ {incoming.length}</span>
              <span
                className={orphanOutputs ? 'text-[color:var(--op-gold)]' : ''}
                title={`${outgoing.length} outgoing connections`}
              >
                ↑ {outgoing.length}
              </span>
            </span>
            {footerDuration ? (
              <span
                title={footerTooltip}
                style={{
                  color:
                    status === 'running'
                      ? 'var(--rb-edge-running)'
                      : status === 'failed'
                        ? 'var(--rb-edge-failed)'
                        : 'var(--rb-node-muted)',
                }}
              >
                {footerDuration}
              </span>
            ) : !enabled ? (
              <span className="text-[color:var(--rb-edge-failed)]">disabled</span>
            ) : null}
          </div>
        </div>

        {inputs.map((label, idx) => {
          const tone = handleTone(label);
          return (
            <Handle
              key={`in-${idx}`}
              id={String(idx)}
              type="target"
              position={Position.Left}
              aria-label={`input ${label}`}
              style={{ top: 32 + idx * 18, ...(tone ? { background: tone } : {}) }}
            />
          );
        })}
        {outputs.map((label, idx) => {
          const tone = handleTone(label);
          return (
            <Handle
              key={`out-${idx}`}
              id={String(idx)}
              type="source"
              position={Position.Right}
              aria-label={`output ${label}`}
              style={{ top: 32 + idx * 18, ...(tone ? { background: tone } : {}) }}
            />
          );
        })}
      </motion.div>
    </>
  );
}

export const BaseStepNode = memo(BaseStepNodeComponent);
