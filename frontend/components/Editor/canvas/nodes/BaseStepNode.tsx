'use client';

import { Handle, type NodeProps, Position, useNodeConnections, useStore } from '@xyflow/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { KeyRound, Repeat } from 'lucide-react';
import { Fragment, memo, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useNextInPath } from '@/hooks/useNextInPath';
import type { RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { NODE_CATALOG } from '../catalog';
import { NODE_VISUAL_METADATA } from '../stepCatalog';
import { NodeContextToolbar } from '../NodeContextToolbar';
import {
  handleTone,
  isFieldConfigured,
  isOrphanOutput,
  PRIMARY_FIELDS,
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

/**
 * Step types that halt the run waiting for an external signal — operator
 * approval, scheduled wakeup, manual input. The CSS in globals.css keys
 * off `data-halt-point` to render a yellow left-edge stripe so an SRE
 * scanning a runbook at 3am can spot every "this will pause and wait"
 * without reading the YAML. Add new types here when the engine learns
 * a new pause primitive.
 */
const HALT_POINT_TYPES = new Set<string>(['approval', 'wait', 'Suspend']);

function BaseStepNodeComponent(props: NodeProps<RfNode>) {
  const { id, type, data, selected } = props;
  const def = NODE_CATALOG.get(type);
  // SRE-tailored visual metadata. Drives blast-radius outline, badges,
  // and any future per-step semantics. Falling back to an empty object
  // lets future plugin types render without explicit metadata while
  // still keeping the data-attrs unset (so CSS rules don't fire).
  const metadata = NODE_VISUAL_METADATA[type] ?? {};
  const workflow = data.workflow;

  // Card body density: collapsed (default) shows just the title +
  // status chrome + connection counts; expanded surfaces the preview
  // line and the operator-defined tags. Double-click on the card body
  // toggles. Local state on purpose — the preference is per-glance,
  // not per-runbook, so persisting it would just clutter the
  // workflow YAML round-trip.
  const [bodyExpanded, setBodyExpanded] = useState(false);

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
  // Stats overlay: when "Show stats" is on, the editor store carries
  // the latest run-history per node. We pluck this node's bucket so
  // the strip + heat tint render only for steps that have actually
  // executed in the lookback window. `useEditorStore` with a narrow
  // selector keeps re-renders scoped to changes in this node's stats.
  const showStats = useEditorStore(s => s.showStats);
  const stats = useEditorStore(s => s.stepStats[id]);

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

  // Heat tint, derived from this run's failure rate. Picks a single
  // brand colour per band so the operator's eye reads "this step
  // burns" at a glance. Only applies when the overlay is on, the
  // node is idle (a live run wins on the border), and this step has
  // actually run in the window.
  const heatColor =
    showStats && status === 'idle' && stats && stats.failureRate != null
      ? stats.failureRate >= 0.2
        ? 'var(--op-sunset)'
        : stats.failureRate >= 0.05
          ? 'var(--op-gold)'
          : null
      : null;

  const ringColor = selected ? 'var(--rb-node-selected)' : (heatColor ?? STATUS_RING_VAR[status]);
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
          enabled ? '' : 'rb-disabled-stripes opacity-60',
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
        data-category={def?.category ?? 'unknown'}
        data-halt-point={HALT_POINT_TYPES.has(type) ? '' : undefined}
        data-blast-radius={metadata.blastRadius ?? undefined}
        data-idempotent={metadata.idempotent ? '' : undefined}
        data-secret-touch={metadata.touchesSecrets ? '' : undefined}
      >
        {/* Header — colored band + per-type pattern + secondary chips.
            `rb-node-header` class lets globals.css gate it via
            `html[data-node-header-band="off"]` for the user's
            Appearance preference. */}
        <div
          className={[
            'rb-node-header relative flex items-center justify-between gap-2 rounded-t-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white',
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
            {metadata.touchesSecrets ? (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-black/30"
                title="Reads from the secrets vault"
                aria-label="touches secrets"
              >
                <KeyRound size={11} className="text-white/80" />
              </span>
            ) : null}
            {metadata.idempotent ? (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-black/30"
                title="Idempotent — safe to retry"
                aria-label="idempotent"
              >
                <Repeat size={11} className="text-white/80" />
              </span>
            ) : null}
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

        {/* Body — title + (collapsible) preview + tags + meta footer.
            Double-click anywhere on the body toggles the collapsed
            state. `nodrag` (React Flow class) is set so the dbl-click
            doesn't get intercepted as the start of a drag, and the
            handler stops propagation so it doesn't bubble up into
            the canvas pane double-click. */}
        <div
          className="nodrag px-3 py-2.5"
          onDoubleClick={event => {
            event.stopPropagation();
            setBodyExpanded(prev => !prev);
          }}
        >
          <div className="truncate text-sm font-medium">{title}</div>
          {/* Field-name chip strip — visible only when the body is
              collapsed and the type has a `PRIMARY_FIELDS` entry.
              Each chip carries the field NAME (never the value); a
              filled chip means the operator has configured that
              field, an outlined chip means it's still default.
              Answers "what does this node ask for and what's still
              empty" without leaking values. None of the surveyed
              editors do this exact pattern — they all show at least
              one value — but for the SRE pedagogical use-case it
              fits: scan the canvas, see which steps still need
              attention, click in to fill the gaps.

              Click a chip → Inspector opens (same path as a
              single-click on the card body) so the operator can
              fill the field. We don't bother trying to deep-link
              to the specific field; the inspector form already
              renders all fields top-to-bottom on a small panel. */}
          {!bodyExpanded && PRIMARY_FIELDS[type] ? (
            <div className="rb-node-fields mt-1 flex flex-wrap gap-1">
              {PRIMARY_FIELDS[type].map(field => {
                const configured = isFieldConfigured(
                  workflow.config as Record<string, unknown> | undefined,
                  field
                );
                return (
                  <span
                    key={field}
                    title={configured ? `${field} — configured` : `${field} — not set`}
                    className={
                      configured
                        ? 'rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] tracking-tight text-emerald-300'
                        : 'rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9px] tracking-tight text-[color:var(--rb-node-muted)]'
                    }
                  >
                    {field}
                  </span>
                );
              })}
            </div>
          ) : null}
          {/* Preview + tags hidden by default. Operator double-clicks
              the body to expand them. Reduces baseline card height
              from ~80-110px to ~50px so a dense graph reads as a
              connection map first, with config detail on demand —
              same pattern n8n's "compact" view uses on hover. */}
          {bodyExpanded && preview ? (
            <div
              className="rb-node-preview mt-1 truncate font-mono text-[11px] text-[color:var(--rb-node-muted)]"
              title={preview}
            >
              {preview}
            </div>
          ) : null}
          {bodyExpanded && tags.length > 0 ? (
            <div className="rb-node-tags mt-1.5 flex flex-wrap gap-1">
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
          {showStats && stats ? (
            <div
              className="rb-node-stats mt-1.5 flex items-center justify-between gap-2 font-mono text-[10px] tracking-tight text-[color:var(--rb-node-muted)]"
              title={
                stats.failureRate != null
                  ? `${stats.runs} runs · ${(stats.failureRate * 100).toFixed(0)}% fail · p50 ${stats.p50DurationMs ?? '?'}ms · p95 ${stats.p95DurationMs ?? '?'}ms`
                  : `${stats.runs} runs`
              }
            >
              <span className="flex items-end gap-0.5" aria-label="recent runs">
                {(() => {
                  const recent = stats.recent.slice(0, 5);
                  // Bars heights are proportional to durationMs vs the
                  // tallest of the visible 5. A null duration (run still
                  // in flight, or never timed) falls back to half-height
                  // so the slot is visible but doesn't lie about the
                  // actual elapsed time. Empty/idle pads stay 4px so
                  // the row keeps a flat baseline instead of jumping.
                  const maxDur = Math.max(
                    1,
                    ...recent.map(e => e.durationMs ?? 0).filter(d => d > 0)
                  );
                  return (
                    <>
                      {recent.map((entry, idx) => {
                        const dur = entry.durationMs ?? 0;
                        const h = dur > 0 ? Math.max(2, Math.round((dur / maxDur) * 12)) : 6;
                        return (
                          <span
                            key={idx}
                            className="block w-[3px] rounded-sm"
                            style={{
                              height: `${h}px`,
                              background:
                                entry.status === 'SUCCESS'
                                  ? 'var(--rb-edge-success)'
                                  : 'var(--rb-edge-failed)',
                            }}
                            title={`${entry.status}${dur ? ` · ${shortFormat(dur)}` : ''}`}
                          />
                        );
                      })}
                      {Array.from({ length: Math.max(0, 5 - recent.length) }).map((_, idx) => (
                        <span
                          key={`pad-${idx}`}
                          className="block w-[3px] rounded-sm border border-white/15"
                          style={{ height: '4px' }}
                        />
                      ))}
                    </>
                  );
                })()}
              </span>
              {stats.p95DurationMs != null ? (
                <span className="text-[color:var(--rb-node-muted)]">
                  p95 {shortFormat(stats.p95DurationMs)}
                </span>
              ) : null}
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
              {/* Expand affordance — only render when there's actually
                  something to reveal (a preview line or tags). Without
                  this gate the chevron would also show on visual-only
                  nodes (frame, note) where double-click does nothing. */}
              {preview || tags.length > 0 ? (
                <span
                  className="ml-1 cursor-pointer rounded text-[color:var(--rb-node-muted)] transition-transform hover:text-white/80"
                  style={{ transform: bodyExpanded ? 'rotate(180deg)' : 'rotate(0)' }}
                  title={
                    bodyExpanded ? 'Hide details (double-click)' : 'Show details (double-click)'
                  }
                  onDoubleClick={event => {
                    event.stopPropagation();
                    setBodyExpanded(prev => !prev);
                  }}
                >
                  <ChevronDown size={10} />
                </span>
              ) : null}
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
          // Branch label: only render on multi-output nodes (IF, Switch,
          // future: parallel/fanout). Sits inside the node bounds at the
          // right edge — the outer `overflow-hidden` would clip an
          // external label. n8n shows "true"/"false" next to the IF
          // node's two output handles; we mirror that for any node
          // whose definition lists more than one output port.
          const showLabel = outputs.length > 1;
          return (
            <Fragment key={`out-${idx}`}>
              <Handle
                id={String(idx)}
                type="source"
                position={Position.Right}
                aria-label={`output ${label}`}
                style={{ top: 32 + idx * 18, ...(tone ? { background: tone } : {}) }}
              />
              {showLabel ? (
                <span
                  className="pointer-events-none absolute right-3 z-10 max-w-[6rem] truncate rounded bg-black/55 px-1 py-0.5 font-mono text-[9px] leading-none text-white/85"
                  style={{ top: 32 + idx * 18 - 7 }}
                  title={label}
                >
                  {label}
                </span>
              ) : null}
            </Fragment>
          );
        })}
      </motion.div>

      {/* Under-node status pill (Node-RED inspiration). Renders only
          when the most-recent run failed AND the stats overlay is on,
          so it's signal-not-noise — a glance tells the operator "this
          step's last invocation was bad" without having to open the
          drawer. Sibling of motion.div on purpose: motion.div's
          overflow-hidden would clip an in-card pill, and we want it
          to live just below the node bounds. The .react-flow__node
          wrapper provides the positioning context. */}
      {showStats && stats?.recent[0]?.status === 'FAILED' ? (
        <div
          className="rb-status-pill pointer-events-none absolute z-10"
          style={{ top: 'calc(100% + 4px)', left: 0 }}
        >
          <span className="bg-[color:var(--rb-edge-failed)]/90 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white shadow-md">
            last failed
          </span>
        </div>
      ) : null}
    </>
  );
}

export const BaseStepNode = memo(BaseStepNodeComponent);
