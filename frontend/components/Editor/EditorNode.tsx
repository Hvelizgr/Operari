'use client';

import './WorkflowNode.css';

import { WorkflowNode } from '@operari/shared';
import { Handle, Position } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { Fragment, memo } from 'react';

import type { NodeTypeRegistry } from '../../lib/canvas/node-type-registry';
import { NODE_TYPES, NodeType } from '../Node';

interface EditorNodeProps {
  node: WorkflowNode;
  typeDefinition?: NodeType;
  /** Pluggable registry for domain-specific rendering (preview, validation, badges, colors).
   *  When omitted, falls back to the hardcoded runbook functions for backward compatibility. */
  registry?: NodeTypeRegistry;
  isDragging?: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  status?: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED' | 'PENDING';
  /** Live or final duration in milliseconds, populated from the
   * execution socket. Null when the node has never run. */
  durationMs?: number | null;
  /** True when an upstream node is currently RUNNING and this node
   * is its direct downstream target. Triggers the "next in path"
   * tenuous glow on the card. */
  isNextInPath?: boolean;
  /** Status of the direct upstream node(s) — drives the input-pole tint
   * (emerald after SUCCESS, red after FAILED, pulsing while RUNNING).
   * Null/undefined leaves the pole in its neutral primary color. */
  upstreamStatus?: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED' | null;
  isConnected?: boolean;
}

// Node-presentation helpers (category palette, HTTP verb coloring,
// duration formatting, config preview, required-field validation,
// badge detection) live in `./nodes/helpers.ts` so the future
// per-variant split (Fase C.3 continuation) can share them without
// duplication.
import {
  categoryPalette,
  configPreview,
  detectBadges,
  formatDuration,
  httpMethodColor,
  validateConfig,
} from './nodes/helpers';

function EditorNode({
  node,
  typeDefinition,
  registry,
  isDragging = false,
  isSelected,
  isHighlighted = false,
  status,
  isConnected = true,
  durationMs = null,
  isNextInPath = false,
  upstreamStatus = null,
}: EditorNodeProps) {
  const nodeType = typeDefinition || NODE_TYPES.find(t => t.type === node.type);

  const renderIcon = (icon: unknown, size = 16) => {
    if (!icon) return <Icons.Box size={size} />;
    if (typeof icon === 'object' && icon !== null) return icon as React.ReactNode;
    if (typeof icon === 'function') {
      const I = icon as React.ComponentType<{ size?: number }>;
      return <I size={size} />;
    }
    return <Icons.Box size={size} />;
  };

  // Determine Visual Type
  const type = node.type.toLowerCase();
  let visualType = 'job';
  if (type.includes('trigger') || type === 'start') visualType = 'trigger';
  else if (
    type.includes('controller') ||
    type === 'condition' ||
    type === 'switch' ||
    type === 'operari.switch' ||
    type === 'if' ||
    type === 'operari.if'
  )
    visualType = 'controller';
  else if (
    type.includes('limit') ||
    type === 'loop' ||
    type === 'iterator' ||
    type === 'operari.loop'
  )
    visualType = 'limit';
  else if (
    type.includes('action') ||
    type.includes('email') ||
    type.includes('slack') ||
    type.includes('discord')
  )
    visualType = 'action';

  // Validation. Two independent failure modes:
  //   - disconnected: the node has no edges in or out (orphan)
  //   - configIncomplete: per-type required field check
  // The badge surfaces whichever is more useful — config errors take
  // precedence because a missing command is a runtime explosion,
  // a disconnected node is just a no-op until wired.
  const configError = (registry?.validateConfig ?? validateConfig)(
    node.type,
    node.config as Record<string, unknown> | undefined
  );
  const showDisconnected = !isConnected && !configError;
  const ValidationBadge = () => {
    if (configError) {
      return (
        <div
          className="pointer-events-none absolute -right-2 -top-2 z-50 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-amber-500 shadow-sm"
          title={`Config incomplete: ${configError}`}
        >
          <Icons.AlertTriangle size={12} className="text-white" />
        </div>
      );
    }
    if (showDisconnected) {
      return (
        <div
          className="pointer-events-none absolute -right-2 -top-2 z-50 flex h-5 w-5 animate-pulse items-center justify-center rounded-full border border-white bg-red-500 shadow-sm"
          title="Disconnected node — wire it to the rest of the runbook"
        >
          <Icons.AlertCircle size={12} className="text-white" />
        </div>
      );
    }
    return null;
  };

  // Status icon for the title strip. Returned as a small JSX block
  // so we can color it inline without burning CSS classes for each
  // status. The 7 Operari statuses map to 5 distinct visual cues —
  // PENDING uses a faint dot, CANCELLED an X.
  const renderStatusIcon = (): React.ReactNode => {
    if (!status) return null;
    switch (status) {
      case 'RUNNING':
        return <Icons.Play size={12} className="text-primary/70 animate-pulse" />;
      case 'SUCCESS':
        return <Icons.CheckCircle2 size={12} className="text-emerald-400" />;
      case 'FAILED':
        return <Icons.XCircle size={12} className="text-red-400" />;
      case 'PAUSED':
        return <Icons.PauseCircle size={12} className="text-amber-400" />;
      case 'SKIPPED':
        return <Icons.SkipForward size={12} className="text-gray-400" />;
      case 'CANCELLED':
        return <Icons.Ban size={12} className="text-gray-500" />;
      case 'PENDING':
        return <Icons.Circle size={12} className="text-gray-500" />;
    }
  };

  const preview = (registry?.configPreview ?? configPreview)(
    node.type,
    node.config as Record<string, unknown> | undefined
  );
  const badges = (registry?.detectBadges ?? detectBadges)(
    node.config as Record<string, unknown> | undefined
  );
  const palette = (registry?.categoryPalette ?? categoryPalette)(nodeType?.category);

  // Smart preview decoration. If the registry supplies a render hint
  // (e.g. colored HTTP verb chip), use it; otherwise plain mono text.
  const renderPreview = (): React.ReactNode => {
    if (!preview) return null;
    const hint = registry?.previewRenderHint?.(
      node.type,
      node.config as Record<string, unknown> | undefined
    );
    if (!hint && node.type === 'operari.httpRequest') {
      // Backward compat: inline HTTP chip when no registry
      const cfg = (node.config ?? {}) as Record<string, unknown>;
      const method = String(cfg.method ?? 'GET').toUpperCase();
      const url = typeof cfg.url === 'string' ? cfg.url : '';
      return (
        <div className="wf_preview" title={preview}>
          <span className="wf_http_method" style={{ color: httpMethodColor(method) }}>
            {method}
          </span>
          <span className="wf_http_url">{url || preview}</span>
        </div>
      );
    }
    if (hint?.type === 'method-chip') {
      return (
        <div className="wf_preview" title={preview}>
          <span className="wf_http_method" style={{ color: hint.methodColor }}>
            {hint.method}
          </span>
          <span className="wf_http_url">{hint.url || preview}</span>
        </div>
      );
    }
    return (
      <div className="wf_preview" title={preview}>
        {preview}
      </div>
    );
  };

  // Hover tooltip — combines title, type, description and (when set)
  // the validation hint. Uses native title attribute so we don't
  // pull in a tooltip library; multi-line via \n which most browsers
  // honor in tooltips.
  const titleTooltip = [
    node.title,
    `type: ${node.type}`,
    nodeType?.description?.en && `— ${nodeType.description.en}`,
    configError && `⚠ ${configError}`,
    !isConnected && !configError && '⚠ disconnected',
    `id: ${node.id}`,
  ]
    .filter(Boolean)
    .join('\n');

  const commonProps = {
    id: `d_wfn_${node.id}`,
    style: { zIndex: isSelected || isDragging ? 10 : 3 },
  } as const;
  const stateClass = `${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`;

  // --- CONTROLLER (Pill) ---
  if (visualType === 'controller') {
    const hasMultiOutput = Array.isArray(node.outputs) && node.outputs.length > 1;
    return (
      <div className={`wf_node wf_entity ${stateClass}`} {...commonProps}>
        <ValidationBadge />
        <div
          className="wf_ent_controller"
          style={
            hasMultiOutput ? { height: Math.max(64, 30 + node.outputs!.length * 26) } : undefined
          }
        >
          {/* Input Pole — squared shape with arrow icon */}
          <Handle
            type="target"
            position={Position.Left}
            id="in-0"
            aria-label="Input"
            className="wf_pole_button wf_input_pole"
            data-pole-label="in"
            data-upstream-status={upstreamStatus ?? undefined}
          >
            <Icons.ArrowRight size={12} />
          </Handle>

          <span className="relative flex h-full w-full items-center justify-center">
            {renderIcon(nodeType?.icon, 32)}
          </span>

          {/* Output Poles — multi-port for Condition (true/false) and Switch (cases) */}
          {hasMultiOutput ? (
            <div className="wf_multi_output_poles">
              {node.outputs!.map((out, i) => (
                <Fragment key={out.id ?? `out-${i}`}>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`out-${i}`}
                    aria-label={`Output: ${out.label ?? `out-${i}`}`}
                    className="wf_pole_button wf_output_pole"
                    style={{ top: `${14 + i * 26}px` }}
                    title={out.label ?? `out-${i}`}
                  >
                    <Icons.ChevronRight size={12} />
                  </Handle>
                  {/* Outside the Handle: the pole is rotated 45° and would tilt its text. */}
                  <span className="wf_pole_label" style={{ top: `${14 + i * 26}px` }}>
                    {out.label ?? `out-${i}`}
                  </span>
                </Fragment>
              ))}
            </div>
          ) : (
            <Handle
              type="source"
              position={Position.Right}
              id="out-0"
              aria-label="Output"
              className="wf_pole_button wf_output_pole"
              data-pole-label="out"
            >
              <Icons.ChevronRight size={12} />
            </Handle>
          )}
        </div>
        <span className="wf_ent_title">{nodeType?.category || 'Controller'}</span>
        <span className="wf_ent_label">{node.title}</span>
      </div>
    );
  }

  // --- LIMIT (Diamond) ---
  if (visualType === 'limit') {
    return (
      <div className={`wf_node wf_entity ${stateClass}`} {...commonProps}>
        <ValidationBadge />
        <div className="wf_ent_limit">
          {/* Up Pole (Input) - Handled by CSS rotation magic but we need structure */}
          <Handle
            type="target"
            position={Position.Top}
            id="in-0"
            aria-label="Input"
            className="wf_pole_button wf_up_pole"
            data-pole-label="in"
            data-upstream-status={upstreamStatus ?? undefined}
            title="Input (Limit)"
          >
            <Icons.ChevronDown size={12} style={{ transform: 'rotate(225deg)' }} />{' '}
            {/* Counter rotate? CSS handles some */}
          </Handle>

          <span
            className="relative flex h-full w-full items-center justify-center"
            style={{ transform: 'rotate(-45deg)' }}
          >
            {renderIcon(nodeType?.icon, 32)}
          </span>

          {/* Down Pole (Output) - Implicitly handled or we add it? CSS says .wf_down_pole */}
          {/* For Limit, typically Output is NOT on the diamond tip in xyOps CSS, it's usually handled by .wf_down_pole relative to container? 
                        Let's check CSS... Ah, wf_ent_limit > .wf_up_pole is styled. 
                        Usually limits sit in the flow. Let's add standard poles but styled. 
                        Actually, looking at CSS, .wf_ent_limit transforms rotate(45deg). 
                        Inside it, content needs -45deg.
                    */}
        </div>
        {/* For Limit, output is often just flow through or specific logic. We'll add a Down pole at bottom center of containing div if needed, 
                    but sticking to strict CSS interpretation: Limit usually has UP pole (input). 
                    Let's assume standard Output pole (Down) is attached to container.
                    Wait, CSS .wf_pole_button.wf_down_pole is defined generally.
                */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="out-0"
          aria-label="Output"
          className="wf_pole_button wf_down_pole"
          data-pole-label="out"
          style={{ left: '50%', top: 'calc(100% + 5px)' }}
        >
          <Icons.ChevronDown size={12} />
        </Handle>

        <span className="wf_ent_title">{nodeType?.category || 'Limit'}</span>
        <span className="wf_ent_label">{node.title}</span>
      </div>
    );
  }

  // --- TRIGGER ---
  if (visualType === 'trigger') {
    return (
      <div className={`wf_node wf_entity ${stateClass}`} {...commonProps}>
        <ValidationBadge />
        <div className="wf_ent_trigger">
          <span
            className="relative flex h-full w-full items-center justify-center"
            style={{ left: '-6px' }}
          >
            {renderIcon(nodeType?.icon, 32)}
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id="out-0"
            aria-label="Output"
            className="wf_pole_button wf_output_pole"
            data-pole-label="out"
          >
            <Icons.ChevronRight size={12} />
          </Handle>
        </div>
        <span className="wf_ent_title">{nodeType?.category || 'Trigger'}</span>
        <span className="wf_ent_label">{node.title}</span>
      </div>
    );
  }

  // --- ACTION (Semicircle) ---
  if (visualType === 'action') {
    return (
      <div className={`wf_node wf_entity ${stateClass}`} {...commonProps}>
        <ValidationBadge />
        <div className="wf_ent_action">
          <Handle
            type="target"
            position={Position.Left}
            id="in-0"
            aria-label="Input"
            className="wf_pole_button wf_input_pole"
            data-pole-label="in"
            data-upstream-status={upstreamStatus ?? undefined}
          >
            <Icons.ArrowRight size={12} />
          </Handle>
          <span
            className="relative flex h-full w-full items-center justify-center"
            style={{ left: '6px' }}
          >
            {renderIcon(nodeType?.icon, 32)}
          </span>
        </div>
        <span className="wf_ent_title">{nodeType?.category || 'Action'}</span>
        <span className="wf_ent_label">{node.title}</span>
      </div>
    );
  }

  // Type-specific small badge to render in the corner of the icon
  // square. Adds a one-character "what type is this" hint that
  // works even at low zoom when the rest of the card is collapsed
  // by mini mode.
  const typeBadgeChar: string | null = (() => {
    switch (node.type) {
      case 'shell':
        return '$';
      case 'operari.cron':
        return '⏱';
      case 'operari.webhook':
        return '↘';
      case 'operari.httpRequest':
        return '↗';
      case 'approval':
        return '✋';
      case 'notify':
        return '!';
      case 'wait':
        return '…';
      default:
        return null;
    }
  })();

  // --- JOB (Standard) ---
  return (
    <div
      className={`wf_node wf_event ${stateClass} ${status === 'SUCCESS' ? 'wf_completed' : ''} ${status === 'FAILED' ? 'wf_error' : ''} ${status === 'PAUSED' ? 'wf_paused' : ''} ${status === 'SKIPPED' ? 'wf_skipped' : ''} ${status === 'CANCELLED' ? 'wf_cancelled' : ''} ${isNextInPath ? 'wf_next' : ''} ${node.enabled === false ? 'disabled' : ''} `}
      {...commonProps}
      // Inline accent vars so each card paints itself with the
      // category palette without needing a class explosion. The
      // cast to CSSProperties & Record<string,string> tells TS the
      // object is allowed to carry CSS custom properties (`--foo`)
      // in addition to the known React style keys.
      style={
        {
          ...commonProps.style,
          '--node-accent': palette.accent,
          '--node-tint': palette.tint,
        } as React.CSSProperties & Record<string, string | number>
      }
      title={titleTooltip}
    >
      <ValidationBadge />
      <div className="wf_event_title">
        <span className="wf_event_icon" style={{ background: palette.tint, color: palette.accent }}>
          {renderIcon(nodeType?.icon, 14)}
          {typeBadgeChar && (
            <span className="wf_event_icon_badge" style={{ background: palette.accent }}>
              {typeBadgeChar}
            </span>
          )}
        </span>
        <span className="flex-1 truncate">{node.title}</span>
        {status && (
          <span className="ml-2 inline-flex items-center" title={status}>
            {renderStatusIcon()}
          </span>
        )}
      </div>

      <div className="wf_body">
        {/* Type strip — small monospace pill that identifies the
                    node type without the ceremony of the old "Category /
                    Type / Description" 3-row grid. */}
        <div className="wf_type_strip">
          <span className="wf_type_chip">{node.type}</span>
          {nodeType?.category && <span className="wf_category_chip">{nodeType.category}</span>}
        </div>

        {/* Config preview — the field that distinguishes this
                    node from other nodes of the same type. HTTP nodes
                    get a colored verb chip; everything else is plain
                    mono. */}
        {renderPreview()}

        {/* Cross-cutting badges (retry / conditional / secrets).
                    Surfacing these in the card means an operator no
                    longer has to open every step's config panel to
                    discover that the runbook has retry policies. */}
        {(badges.retry || badges.conditional || badges.secrets) && (
          <div className="wf_badges">
            {badges.retry && (
              <span className="wf_badge wf_badge_retry" title={`Retries: ${badges.retry}`}>
                <Icons.RotateCw size={10} />
                {badges.retry}x
              </span>
            )}
            {badges.conditional && (
              <span
                className="wf_badge wf_badge_cond"
                title={
                  badges.conditional === 'both'
                    ? 'runIf and skipIf gates'
                    : badges.conditional === 'runIf'
                      ? 'runIf gate'
                      : 'skipIf gate'
                }
              >
                <Icons.GitBranch size={10} />
              </span>
            )}
            {badges.secrets && (
              <span className="wf_badge wf_badge_secret" title="Uses {{secrets.*}} reference">
                <Icons.KeyRound size={10} />
              </span>
            )}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="in-0"
        aria-label="Input"
        className="wf_pole_button wf_input_pole"
        data-pole-label="in"
        data-upstream-status={upstreamStatus ?? undefined}
      >
        <Icons.ArrowRight size={12} />
      </Handle>
      {/* Output poles. If the node declares multiple outputs (e.g.
                `approval` with approved/rejected), render one pole per
                output stacked vertically with the label visible. The
                portId encodes the index so completeConnection can persist
                the right sourcePort and the runtime engine can branch. */}
      {Array.isArray(node.outputs) && node.outputs.length > 1 ? (
        <div className="wf_multi_output_poles">
          {node.outputs.map((out, i) => (
            <Fragment key={out.id ?? `out-${i}`}>
              <Handle
                type="source"
                position={Position.Right}
                id={`out-${i}`}
                aria-label={`Output: ${out.label ?? `out-${i}`}`}
                className="wf_pole_button wf_output_pole"
                style={{ top: `${30 + i * 26}px` }}
                title={out.label ?? `out-${i}`}
              >
                <Icons.ChevronRight size={12} />
              </Handle>
              {/* Outside the Handle: the pole is rotated 45° and would tilt its text. */}
              <span className="wf_pole_label" style={{ top: `${30 + i * 26}px` }}>
                {out.label ?? `out-${i}`}
              </span>
            </Fragment>
          ))}
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="out-0"
          aria-label="Output"
          className="wf_pole_button wf_output_pole"
          data-pole-label="out"
        >
          <Icons.ChevronRight size={12} />
        </Handle>
      )}

      {/* Duration footer — only when we have a real number from
                the execution socket. Renders "running 4.2s" while the
                step is in flight (the live tick in useExecutionSocket
                ticks the durationMs every second), or "ran 1.8s" once
                the step completes. Hidden in mini mode via CSS. */}
      {durationMs != null && (
        <div className="wf_duration_footer" title={`${Math.round(durationMs)}ms`}>
          <Icons.Clock size={9} />
          <span>
            {status === 'RUNNING' ? 'running ' : 'ran '}
            {formatDuration(durationMs)}
          </span>
        </div>
      )}

      {/* Live progress bar — only rendered while the step is
                actually running. Indeterminate animation; the runtime
                does not report a percent because shell + http + notify
                are atomic. The bar is the "I'm alive" signal that
                doesn't depend on the border keyframe (which can be
                disabled via the visualization toggle). */}
      {status === 'RUNNING' && <div className="wf_progress_bar" aria-hidden />}
    </div>
  );
}

// Memoized: every pan/zoom/select tick re-renders FlowCanvas' node list
// (and with 500+ nodes that's 500+ EditorNode instances). All props are
// primitives, stable callbacks from useEditorCanvas, or reference-stable
// registry/typeDefinition objects, so the default shallow compare is
// safe — a node's props only change when that specific node actually
// changed.
export default memo(EditorNode);
