import type { Connection as WorkflowConnection, WorkflowNode } from '@operari/shared';
import type { Edge, Node } from '@xyflow/react';

export type RfNodeData = {
  workflow: Omit<WorkflowNode, 'id' | 'type' | 'position'>;
  status?: 'idle' | 'running' | 'success' | 'failed' | 'skipped';
  /** Wall-clock ms when the latest run of this step started — set when
   *  the socket emits a `running` event, cleared when a fresh load
   *  hydrates the canvas. The duration footer reads it. */
  startedAt?: number | null;
  /** Final duration in ms once the step reaches a terminal status.
   *  Null while running so the footer renders the live elapsed value
   *  computed from `startedAt`. */
  durationMs?: number | null;
};

export type RfEdgeData = {
  condition?: WorkflowConnection['condition'];
  sourcePort?: number;
  targetPort?: number;
  /** Per-edge override of the line-style preference. When set, this
   *  edge ignores the global `operari:line-style` setting. Useful when
   *  a single edge in a curved graph really wants to be orthogonal
   *  (or vice-versa) for clarity. */
  lineStyle?: 'smart' | 'step';
  /** `yet-to-run` is the chaiNNer-style "edge is about to fire": the
   *  source node is currently running, the target hasn't started yet.
   *  Visually softer than `running` but brighter than `idle` so the
   *  operator can see what's queued next. */
  status?: 'idle' | 'running' | 'success' | 'failed' | 'skipped' | 'yet-to-run';
  cyclic?: boolean;
  /**
   * How many times this hop retried during the most recent run. The
   * edge renders a small `↻ ×N` chip when > 0, surfacing flakiness at
   * the *hop* level (vs. the per-node retry policy that lives on
   * `RetryPolicy`). Populated by the backend from execution events;
   * absent / 0 means the chip stays hidden. SRE-tailored signal —
   * neither n8n nor Make show retries on edges.
   */
  retries?: number;
  /**
   * Cross-environment marker. When the source's connected account is
   * in a different env than the target's (e.g. prod → staging,
   * us-east-1 → eu-west-1), the engine fills in both labels and the
   * edge renders chevron-styled with the labels at each end. Catches
   * accidental fanouts during runbook authoring. Optional — most
   * edges leave this unset.
   */
  crossEnv?: { source: string; target: string };
  /**
   * Bundle counter — number of items that flowed through this hop on
   * the most recent run. Useful for parallel / loop / fanout edges
   * where the count carries information; sequential single-item hops
   * leave this unset so they don't render a noisy `1`. Make-style
   * post-run signal.
   */
  items?: number;
  /**
   * Per-hop p50 latency in ms across the recent run window. Renders
   * alongside the bundle counter when both are present. Backend
   * computes this from the step-stats endpoint per edge — until the
   * endpoint exposes it, this stays undefined and the chip omits the
   * latency token.
   */
  p50DurationMs?: number;
};

export type RfNode = Node<RfNodeData>;
export type RfEdge = Edge<RfEdgeData>;

// Frame parent persistence shadow. The backend zod schema
// (workflowNodeSchema in backend/src/types/runbook.types.ts) does not
// allow `parentId` at the top level of a node, so an unmodified PUT
// would round-trip through the API and lose frame nesting. We mirror
// `parentId` into `config._frame.parentId`, which is preserved verbatim
// because zod stores the entire `config` object as opaque JSON.
const FRAME_META_KEY = '_frame';

type FrameMeta = { parentId?: string };

const portIndexToHandleId = (port: number | undefined): string | undefined =>
  typeof port === 'number' ? String(port) : undefined;

const handleIdToPortIndex = (handle: string | null | undefined): number | undefined => {
  if (handle == null || handle === '') return undefined;
  const parsed = Number(handle);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readFrameMeta = (config: WorkflowNode['config'] | undefined): FrameMeta | undefined => {
  if (!config || typeof config !== 'object') return undefined;
  const meta = (config as Record<string, unknown>)[FRAME_META_KEY];
  if (!meta || typeof meta !== 'object') return undefined;
  return meta as FrameMeta;
};

export const workflowNodeToRfNode = (node: WorkflowNode): RfNode => {
  const { id, type, position, parentId, ...rest } = node;
  const stashedParent = readFrameMeta(rest.config)?.parentId;
  const effectiveParent = parentId ?? stashedParent;
  return {
    id,
    type,
    position,
    data: { workflow: rest },
    ...(effectiveParent ? { parentId: effectiveParent, extent: 'parent' as const } : {}),
  };
};

export const rfNodeToWorkflowNode = (node: RfNode): WorkflowNode => {
  const workflow = node.data?.workflow ?? ({} as RfNodeData['workflow']);
  const parentId = node.parentId;

  const baseConfig = (workflow.config ?? undefined) as Record<string, unknown> | undefined;
  let nextConfig: Record<string, unknown> | undefined = baseConfig ? { ...baseConfig } : undefined;

  if (parentId) {
    nextConfig = { ...(nextConfig ?? {}), [FRAME_META_KEY]: { parentId } satisfies FrameMeta };
  } else if (nextConfig && FRAME_META_KEY in nextConfig) {
    delete nextConfig[FRAME_META_KEY];
    if (Object.keys(nextConfig).length === 0) nextConfig = undefined;
  }

  return {
    id: node.id,
    type: node.type ?? 'default',
    position: { x: node.position.x, y: node.position.y },
    title: workflow.title ?? '',
    ...(nextConfig !== undefined ? { config: nextConfig as WorkflowNode['config'] } : {}),
    ...(workflow.executionState !== undefined ? { executionState: workflow.executionState } : {}),
    ...(workflow.enabled !== undefined ? { enabled: workflow.enabled } : {}),
    ...(workflow.inputs !== undefined ? { inputs: workflow.inputs } : {}),
    ...(workflow.outputs !== undefined ? { outputs: workflow.outputs } : {}),
    ...(parentId ? { parentId } : {}),
  };
};

export const workflowConnectionToRfEdge = (connection: WorkflowConnection): RfEdge => ({
  id: connection.id,
  source: connection.source,
  target: connection.target,
  type: 'smart',
  ...(connection.sourcePort !== undefined
    ? { sourceHandle: portIndexToHandleId(connection.sourcePort) }
    : {}),
  ...(connection.targetPort !== undefined
    ? { targetHandle: portIndexToHandleId(connection.targetPort) }
    : {}),
  data: {
    ...(connection.condition !== undefined ? { condition: connection.condition } : {}),
    ...(connection.sourcePort !== undefined ? { sourcePort: connection.sourcePort } : {}),
    ...(connection.targetPort !== undefined ? { targetPort: connection.targetPort } : {}),
  },
});

export const rfEdgeToWorkflowConnection = (edge: RfEdge): WorkflowConnection => {
  const sourcePort = edge.data?.sourcePort ?? handleIdToPortIndex(edge.sourceHandle);
  const targetPort = edge.data?.targetPort ?? handleIdToPortIndex(edge.targetHandle);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(sourcePort !== undefined ? { sourcePort } : {}),
    ...(targetPort !== undefined ? { targetPort } : {}),
    ...(edge.data?.condition !== undefined ? { condition: edge.data.condition } : {}),
  };
};

export const workflowToRf = (
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): { nodes: RfNode[]; edges: RfEdge[] } => ({
  nodes: nodes.map(workflowNodeToRfNode),
  edges: connections.map(workflowConnectionToRfEdge),
});

export const rfToWorkflow = (
  nodes: RfNode[],
  edges: RfEdge[]
): { nodes: WorkflowNode[]; connections: WorkflowConnection[] } => ({
  nodes: nodes.map(rfNodeToWorkflowNode),
  connections: edges.map(rfEdgeToWorkflowConnection),
});
