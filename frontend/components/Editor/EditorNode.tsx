'use client';

import { MouseEvent, useRef, useLayoutEffect } from 'react';
import { NodeType, NODE_TYPES } from '../Node';
import { WorkflowNode } from '@cairn/shared';
import './WorkflowNode.css';
import * as Icons from 'lucide-react';
import type { NodeTypeRegistry } from '../../lib/canvas/node-type-registry';
// Import shared port utilities
export { getNodeInputPort, getNodeOutputPort, getNodePortInfo } from '../../utils/nodePortUtils';

interface EditorNodeProps {
  node: WorkflowNode;
  typeDefinition?: NodeType;
  /** Pluggable registry for domain-specific rendering (preview, validation, badges, colors).
   *  When omitted, falls back to the hardcoded runbook functions for backward compatibility. */
  registry?: NodeTypeRegistry;
  onDragStart: (nodeId: string, e: MouseEvent) => void;
  onDrag: (e: MouseEvent) => void;
  onDragEnd: (nodeId: string) => void;
  isDragging: boolean;
  onPortDragStart: (
    nodeId: string,
    portId: string,
    type: 'source' | 'target',
    pos: { x: number; y: number }
  ) => void;
  onPortDragEnd?: () => void;
  isConnectionTarget?: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: (nodeId: string) => void;
  onContextMenu?: (e: MouseEvent, nodeId: string) => void;
  onMove: (nodeId: string, direction: 'up' | 'down' | 'left' | 'right') => void;
  editorMode?: 'move' | 'connect';
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
  onNodeDoubleClick?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  isConnected?: boolean;
}

/**
 * Category color palette. Each category gets a left-border accent
 * + an icon background tint so an operator scanning the canvas can
 * tell trigger steps from devops steps from organizational nodes at
 * a glance — without reading any text.
 *
 * The colors are intentionally muted to keep the canvas readable on
 * both light and midnight themes; the brighter accents come from
 * status / running animations layered on top.
 */
function categoryPalette(category: string | undefined): { accent: string; tint: string } {
  switch (category) {
    case 'devops':
      // Supabase emerald — main brand accent for shell/action nodes
      return { accent: '#3ecf8e', tint: 'rgba(62, 207, 142, 0.14)' };
    case 'triggers':
      // Slightly brighter emerald so triggers pop against devops
      return { accent: '#4ade80', tint: 'rgba(74, 222, 128, 0.14)' };
    case 'core':
      // Sky cyan — flow control (condition, switch, loop). Distinct
      // from emerald so branching steps read as "meta" vs "work".
      return { accent: '#38bdf8', tint: 'rgba(56, 189, 248, 0.14)' };
    case 'organization':
      // Neutral graphite — frames & notes are structural, not actionable
      return { accent: '#71717a', tint: 'rgba(113, 113, 122, 0.12)' };
    default:
      return { accent: '#3ecf8e', tint: 'rgba(62, 207, 142, 0.10)' };
  }
}

/**
 * HTTP method coloring for the smart preview. Mirrors REST client
 * conventions (Postman / Insomnia / Bruno) so a long-time SRE reads
 * the verb instantly.
 */
function httpMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#10b981'; // emerald
    case 'POST':
      return '#3b82f6'; // blue
    case 'PUT':
      return '#f59e0b'; // amber
    case 'PATCH':
      return '#a855f7'; // purple
    case 'DELETE':
      return '#ef4444'; // red
    default:
      return '#94a3b8';
  }
}

/**
 * Format an execution duration in ms into a tight human string.
 * Used by the duration footer at the bottom of the card.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

/**
 * Per-node-type config preview. Keep this dumb (string-only) so the
 * canvas card can render it without React component composition.
 *
 * The previous render showed every node as "Type: shell, Description:
 * Run a bash command" — same row for every step. Operators couldn't
 * tell two `shell` nodes apart without opening the config panel.
 * This helper plucks the most distinctive field per type and returns
 * a short, truncated summary.
 */
function configPreview(
  type: string,
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config || typeof config !== 'object') return null;
  const trunc = (s: unknown, n = 60): string => {
    const str = typeof s === 'string' ? s : JSON.stringify(s);
    if (!str) return '';
    if (str.length <= n) return str;
    // Try to break at a word boundary instead of mid-word
    const cut = str.lastIndexOf(' ', n - 1);
    return (cut > n * 0.4 ? str.slice(0, cut) : str.slice(0, n - 1)) + '…';
  };
  switch (type) {
    case 'shell':
      return (config.command as string) ? `$ ${trunc(config.command)}` : null;
    case 'notify': {
      const channel = (config.channel as string) ?? 'webhook';
      const msg = trunc(config.message ?? '', 50);
      return `${channel}${msg ? ` · ${msg}` : ''}`;
    }
    case 'wait': {
      const ms = Number(config.durationMs ?? 0);
      if (!ms) return null;
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
      if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
      return `${(ms / 3_600_000).toFixed(1)}h`;
    }
    case 'approval':
      return (config.message as string) ? trunc(config.message) : null;
    case 'nanorun.httpRequest': {
      const method = ((config.method as string) || 'GET').toUpperCase();
      const url = trunc(config.url ?? '', 50);
      return url ? `${method} ${url}` : method;
    }
    case 'ssh': {
      const host = trunc(config.host ?? '', 30);
      const cmd = trunc(config.command ?? '', 30);
      return host
        ? `${config.username ?? 'root'}@${host}${cmd ? ` · ${cmd}` : ''}`
        : cmd
          ? `$ ${cmd}`
          : null;
    }
    case 'nanorun.database': {
      const op = (config.operation as string) ?? 'health';
      const q = trunc(config.query ?? '', 40);
      const tunnel = config.useSshTunnel ? ' 🔒' : '';
      return op === 'query' && q ? `${op}${tunnel} · ${q}` : `${op}${tunnel}`;
    }
    case 'nanorun.cron':
      return (config.expression as string) ?? null;
    case 'nanorun.webhook':
      return (config.path as string) ? `/${config.path}` : null;
    default:
      return null;
  }
}

/**
 * Per-node-type required-field validation. Returns null if the
 * config is sufficient to attempt running the step, or a short reason
 * string otherwise. Used to paint a visible "incomplete" badge so the
 * operator finds out at edit time, not at run time.
 */
function validateConfig(
  type: string,
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config || typeof config !== 'object') {
    // The drag-from-palette path now applies defaults, so a node
    // without ANY config is suspicious — but we don't fail here
    // because frame/note legitimately have no config.
    if (type === 'custom.frame' || type === 'custom.note') return null;
    return 'No config';
  }
  switch (type) {
    case 'shell':
      return config.command ? null : 'Missing command';
    case 'notify':
      return config.webhookUrl ? null : 'Missing webhook URL';
    case 'wait':
      return Number(config.durationMs) > 0 ? null : 'Missing duration';
    case 'approval':
      return null; // approver list is optional
    case 'ssh':
      if (!config.host) return 'Missing host';
      if (!config.credentialId) return 'Missing SSH key';
      return config.command ? null : 'Missing command';
    case 'nanorun.database':
      if (!config.credentialId) return 'Missing credential';
      if (config.operation === 'query' && !config.query) return 'Missing SQL query';
      return null;
    case 'nanorun.httpRequest':
      return config.url ? null : 'Missing URL';
    case 'nanorun.cron':
      return config.expression ? null : 'Missing cron expression';
    case 'nanorun.webhook':
      return null; // path defaults at runtime
    default:
      return null;
  }
}

/**
 * Detect cross-cutting metadata stored in the meta-keys (set by the
 * config panel: _retry, _runIf, _skipIf) plus secret references in
 * any config string. Returns the set of badges to render.
 */
function detectBadges(config: Record<string, unknown> | undefined | null): {
  retry: number | null;
  conditional: 'runIf' | 'skipIf' | 'both' | null;
  secrets: boolean;
} {
  if (!config || typeof config !== 'object') {
    return { retry: null, conditional: null, secrets: false };
  }
  const retryRaw = config._retry as { count?: number } | undefined;
  const retry =
    retryRaw && typeof retryRaw.count === 'number' && retryRaw.count > 0 ? retryRaw.count : null;
  const hasRunIf = !!config._runIf;
  const hasSkipIf = !!config._skipIf;
  const conditional: 'runIf' | 'skipIf' | 'both' | null =
    hasRunIf && hasSkipIf ? 'both' : hasRunIf ? 'runIf' : hasSkipIf ? 'skipIf' : null;
  // Look for {{secrets.X}} in any string field. Cheap regex over
  // the JSON dump — false positives unlikely on a 1KB config blob.
  const secrets = /\{\{\s*secrets\./i.test(JSON.stringify(config));
  return { retry, conditional, secrets };
}

export default function EditorNode({
  node,
  typeDefinition,
  registry,
  onDragStart,
  isDragging,
  isSelected,
  isHighlighted,
  onClick,
  onContextMenu,
  editorMode = 'move',
  status,
  onNodeDoubleClick,
  onUpdate,
  isConnected = true,
  onPortDragStart,
  durationMs = null,
  isNextInPath = false,
  upstreamStatus = null,
}: EditorNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const nodeType = typeDefinition || NODE_TYPES.find(t => t.type === node.type);

  // Measure Height — two paths:
  //   1) Synchronous measurement on mount (useLayoutEffect runs AFTER
  //      DOM commit but BEFORE the browser paints). This fixes the
  //      "first-frame miswire" where the canvas used to pick up the
  //      120px fallback height and draw the connection at y+60 before
  //      ResizeObserver's microtask got a chance to fire, causing the
  //      cable to land below the actual pole on tall nodes.
  //   2) Ongoing updates via ResizeObserver so title edits / badge
  //      toggles that change the card height keep the connections
  //      glued to the poles.
  useLayoutEffect(() => {
    if (!nodeRef.current || !onUpdate) return;
    const element = nodeRef.current;
    const currentH = (node as Partial<{ dimensions: { height: number } }>).dimensions?.height;
    const measuredH = element.offsetHeight;
    const measuredW = element.offsetWidth;
    if (!currentH || Math.abs(currentH - measuredH) > 1) {
      onUpdate(node.id, {
        dimensions: { height: measuredH, width: measuredW },
      } as Partial<WorkflowNode>);
    }

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const h = el.offsetHeight;
        const currH = (node as Partial<{ dimensions: { height: number } }>).dimensions?.height;
        // Tight threshold so subpixel jitter from border changes
        // doesn't ping-pong the state, but any real height delta
        // (>1px) syncs the line anchor.
        if (!currH || Math.abs(currH - h) > 1) {
          onUpdate(node.id, {
            dimensions: { height: h, width: el.offsetWidth },
          } as Partial<WorkflowNode>);
        }
      }
    });

    resizeObserver.observe(nodeRef.current);
    return () => resizeObserver.disconnect();
  }, [node.id, onUpdate, (node as any).dimensions?.height]);

  const renderIcon = (icon: any, size = 16) => {
    if (!icon) return <Icons.Box size={size} />;
    if (typeof icon === 'object' && icon !== null) return icon;
    if (typeof icon === 'function') {
      const I = icon;
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
    type === 'nanorun.switch' ||
    type === 'if' ||
    type === 'nanorun.if'
  )
    visualType = 'controller';
  else if (
    type.includes('limit') ||
    type === 'loop' ||
    type === 'iterator' ||
    type === 'nanorun.loop'
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
  // status. The 7 NanoRun statuses map to 5 distinct visual cues —
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
    if (!hint && node.type === 'nanorun.httpRequest') {
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
    // ref: nodeRef,  <-- We will add ref to specific divs below
    style: {
      left: node.position.x,
      top: node.position.y,
      zIndex: isSelected || isDragging ? 10 : 3,
    },
    onMouseDown: (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.wf_pole_button')) return;
      if (editorMode !== 'connect') onDragStart(node.id, e);
    },
    onClick: (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.wf_pole_button')) return;
      e.stopPropagation();
      onClick(node.id);
    },
    onDoubleClick: (e: MouseEvent) => {
      e.stopPropagation();
      onNodeDoubleClick && onNodeDoubleClick(node.id);
    },
    onContextMenu: (e: MouseEvent) => onContextMenu && onContextMenu(e, node.id),
  } as const;

  // --- CONTROLLER (Pill) ---
  if (visualType === 'controller') {
    const hasMultiOutput = Array.isArray(node.outputs) && node.outputs.length > 1;
    return (
      <div
        ref={nodeRef}
        className={`wf_node wf_entity ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`}
        {...commonProps}
      >
        <ValidationBadge />
        <div
          className="wf_ent_controller"
          style={
            hasMultiOutput ? { height: Math.max(64, 30 + node.outputs!.length * 26) } : undefined
          }
        >
          {/* Input Pole */}
          <div
            className="wf_pole_button wf_input_pole"
            data-pole-label="in"
            data-upstream-status={upstreamStatus ?? undefined}
            onMouseDown={e => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              onPortDragStart(node.id, 'in-0', 'target', { x: e.clientX, y: e.clientY });
            }}
          >
            <Icons.ChevronRight size={12} />
          </div>

          <span className="relative flex h-full w-full items-center justify-center">
            {renderIcon(nodeType?.icon, 32)}
          </span>

          {/* Output Poles — multi-port for Condition (true/false) and Switch (cases) */}
          {hasMultiOutput ? (
            <div className="wf_multi_output_poles">
              {node.outputs!.map((out, i) => (
                <div
                  key={out.id ?? `out-${i}`}
                  className="wf_pole_button wf_output_pole"
                  style={{ top: `${14 + i * 26}px` }}
                  title={out.label ?? `out-${i}`}
                  onMouseDown={e => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    e.preventDefault();
                    onPortDragStart(node.id, `out-${i}`, 'source', { x: e.clientX, y: e.clientY });
                  }}
                >
                  <Icons.ChevronRight size={12} />
                  <span className="wf_pole_label">{out.label ?? `out-${i}`}</span>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="wf_pole_button wf_output_pole"
              data-pole-label="out"
              onMouseDown={e => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault();
                onPortDragStart(node.id, 'out-0', 'source', { x: e.clientX, y: e.clientY });
              }}
            >
              <Icons.ChevronRight size={12} />
            </div>
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
      <div
        className={`wf_node wf_entity ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`}
        {...commonProps}
      >
        <ValidationBadge />
        <div className="wf_ent_limit">
          {/* Up Pole (Input) - Handled by CSS rotation magic but we need structure */}
          <div
            className="wf_pole_button wf_up_pole"
            data-pole-label="in"
            data-upstream-status={upstreamStatus ?? undefined}
            title="Input (Limit)"
            onMouseDown={e => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              onPortDragStart(node.id, 'in-0', 'target', { x: e.clientX, y: e.clientY });
            }}
          >
            <Icons.ChevronDown size={12} style={{ transform: 'rotate(225deg)' }} />{' '}
            {/* Counter rotate? CSS handles some */}
          </div>

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
        <div
          className="wf_pole_button wf_down_pole"
          data-pole-label="out"
          style={{ left: '50%', top: 'calc(100% + 5px)' }}
          onMouseDown={e => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            onPortDragStart(node.id, 'out-0', 'source', { x: e.clientX, y: e.clientY });
          }}
        >
          <Icons.ChevronDown size={12} />
        </div>

        <span className="wf_ent_title">{nodeType?.category || 'Limit'}</span>
        <span className="wf_ent_label">{node.title}</span>
      </div>
    );
  }

  // --- TRIGGER ---
  if (visualType === 'trigger') {
    return (
      <div
        className={`wf_node wf_entity ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`}
        {...commonProps}
      >
        <ValidationBadge />
        <div className="wf_ent_trigger">
          <span
            className="relative flex h-full w-full items-center justify-center"
            style={{ left: '-6px' }}
          >
            {renderIcon(nodeType?.icon, 32)}
          </span>
          <div
            className="wf_pole_button wf_output_pole"
            data-pole-label="out"
            onMouseDown={e => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              onPortDragStart(node.id, 'out-0', 'source', { x: e.clientX, y: e.clientY });
            }}
          >
            <Icons.ChevronRight size={12} />
          </div>
        </div>
        <span className="wf_ent_title">{nodeType?.category || 'Trigger'}</span>
        <span className="wf_ent_label">{node.title}</span>
      </div>
    );
  }

  // --- ACTION (Semicircle) ---
  if (visualType === 'action') {
    return (
      <div
        className={`wf_node wf_entity ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`}
        {...commonProps}
      >
        <ValidationBadge />
        <div className="wf_ent_action">
          <div
            className="wf_pole_button wf_input_pole"
            data-pole-label="in"
            data-upstream-status={upstreamStatus ?? undefined}
            onMouseDown={e => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              onPortDragStart(node.id, 'in-0', 'target', { x: e.clientX, y: e.clientY });
            }}
          >
            <Icons.ChevronRight size={12} />
          </div>
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
      case 'nanorun.cron':
        return '⏱';
      case 'nanorun.webhook':
        return '↘';
      case 'nanorun.httpRequest':
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
      className={`wf_node wf_event ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''} ${status === 'SUCCESS' ? 'wf_completed' : ''} ${status === 'FAILED' ? 'wf_error' : ''} ${status === 'PAUSED' ? 'wf_paused' : ''} ${status === 'SKIPPED' ? 'wf_skipped' : ''} ${status === 'CANCELLED' ? 'wf_cancelled' : ''} ${isNextInPath ? 'wf_next' : ''} ${(node as any).enabled === false ? 'disabled' : ''} `}
      ref={nodeRef}
      {...commonProps}
      // Inline accent vars so each card paints itself with the
      // category palette without needing a class explosion.
      style={{
        ...((commonProps as any).style ?? {}),
        ['--node-accent' as any]: palette.accent,
        ['--node-tint' as any]: palette.tint,
      }}
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

      <div
        className="wf_pole_button wf_input_pole"
        data-pole-label="in"
        data-upstream-status={upstreamStatus ?? undefined}
        onMouseDown={e => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          onPortDragStart(node.id, 'in-0', 'target', { x: e.clientX, y: e.clientY });
        }}
      >
        <Icons.ChevronRight size={12} />
      </div>
      {/* Output poles. If the node declares multiple outputs (e.g.
                `approval` with approved/rejected), render one pole per
                output stacked vertically with the label visible. The
                portId encodes the index so completeConnection can persist
                the right sourcePort and the runtime engine can branch. */}
      {Array.isArray(node.outputs) && node.outputs.length > 1 ? (
        <div className="wf_multi_output_poles">
          {node.outputs.map((out, i) => (
            <div
              key={out.id ?? `out-${i}`}
              className="wf_pole_button wf_output_pole"
              style={{ top: `${30 + i * 26}px` }}
              title={out.label ?? `out-${i}`}
              onMouseDown={e => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault();
                onPortDragStart(node.id, `out-${i}`, 'source', { x: e.clientX, y: e.clientY });
              }}
            >
              <Icons.ChevronRight size={12} />
              <span className="wf_pole_label">{out.label ?? `out-${i}`}</span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="wf_pole_button wf_output_pole"
          data-pole-label="out"
          onMouseDown={e => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            onPortDragStart(node.id, 'out-0', 'source', { x: e.clientX, y: e.clientY });
          }}
        >
          <Icons.ChevronRight size={12} />
        </div>
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
