import type { Connection as WorkflowConnection, WorkflowNode } from '@operari/shared';
import type { Connection as RfConnection } from '@xyflow/react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  reconnectEdge as rfReconnectEdge,
} from '@xyflow/react';
import { temporal } from 'zundo';
import { create } from 'zustand';

import type { RunbookInputDefinition } from '@/components/Editor/RunbookInputsPanel';
import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { rfToWorkflow, workflowToRf } from '@/lib/canvas/adapter';
import { getDescendantIds, sortNodesForRf } from '@/lib/canvas/graph';
import { reconcileWorkflow } from '@/lib/canvas/reconcile';

export type SaveStatus = 'idle' | 'loading' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export interface RunbookHeader {
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  schedule?: string;
}

type State = {
  runbookId: string | null;
  runbookHeader: RunbookHeader | null;
  /** Typed input declarations consumed by RunDialog. Persisted by a
   *  separate REST endpoint (`PUT /api/runbooks/:id/inputs`); the
   *  editor route only reads + updates the in-memory copy. */
  runbookInputs: RunbookInputDefinition[];
  nodes: RfNode[];
  edges: RfEdge[];
  status: SaveStatus;
  savedAt: number | null;
  errorMessage: string | null;
  /** True only while a run is in flight. Set on the first `running`
   *  node_status event, cleared on the terminal execution_status.
   *  Drives "trace highlighting" — non-traced steps dim to 30% so the
   *  operator's eye lands on the executed path. */
  traceMode: boolean;
  /** Frame the user is currently dragging a step over. The frame
   *  component reads this to draw a hover ring telegraphing "drop
   *  here to parent". Cleared on drag stop. */
  hoveredFrameId: string | null;
  /** When true, BaseStepNode renders the run-history strip + heat
   *  tint sourced from the per-step stats endpoint. Toggled from the
   *  toolbar; not persisted (operators turn it on for diagnosis,
   *  off for authoring). */
  showStats: boolean;
  /** Per-step run statistics keyed by nodeId. Populated by
   *  `useStepStats` when `showStats` is on; cleared back to `{}`
   *  when off. Stripped from undo snapshots via `partialize`. */
  stepStats: Record<
    string,
    {
      runs: number;
      successRate: number | null;
      failureRate: number | null;
      p50DurationMs: number | null;
      p95DurationMs: number | null;
      recent: Array<{ status: string; startedAt: string; durationMs: number | null }>;
    }
  >;
};

type Actions = {
  onNodesChange: (changes: NodeChange<RfNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<RfEdge>[]) => void;
  onConnect: (connection: RfConnection) => void;
  reconnectEdge: (oldEdge: RfEdge, newConnection: RfConnection) => void;
  addNode: (node: RfNode) => void;
  /**
   * Splice `newNode` into the connection identified by `edgeId`. Removes
   * the original edge, adds the new node, and creates two replacement
   * edges (source → newNode, newNode → target). Powers the n8n-style
   * mid-edge insert affordance — the operator hovers an edge, clicks
   * `+`, picks a type, and the wiring is done atomically.
   */
  insertNodeMidEdge: (edgeId: string, newNode: RfNode) => void;
  removeNodes: (ids: string[]) => void;
  updateNodeData: (id: string, patch: Partial<RfNode['data']>) => void;
  updateEdgeData: (id: string, patch: Partial<NonNullable<RfEdge['data']>>) => void;
  reparentNode: (
    id: string,
    parentId: string | null,
    nextPosition?: { x: number; y: number }
  ) => void;
  appendForPaste: (nodes: RfNode[], edges: RfEdge[]) => void;
  hydrateFromWorkflow: (
    runbookId: string,
    header: RunbookHeader,
    inputs: RunbookInputDefinition[],
    nodes: WorkflowNode[],
    connections: WorkflowConnection[]
  ) => void;
  /** Incremental version of `hydrateFromWorkflow`: nodes that exist
   *  in both the current canvas and the incoming workflow keep their
   *  positions and selection state. New nodes appear at the position
   *  declared in the workflow body; missing ones drop. Used by the
   *  YAML editor's "Apply" button so editing a single field doesn't
   *  reset the whole layout. */
  reconcileFromWorkflow: (
    header: RunbookHeader,
    inputs: RunbookInputDefinition[],
    nodes: WorkflowNode[],
    connections: WorkflowConnection[]
  ) => void;
  setRunbookHeader: (patch: Partial<RunbookHeader>) => void;
  setRunbookInputs: (next: RunbookInputDefinition[]) => void;
  setTraceMode: (active: boolean) => void;
  setHoveredFrameId: (id: string | null) => void;
  setShowStats: (active: boolean) => void;
  setStepStats: (next: State['stepStats']) => void;
  setStatus: (status: SaveStatus, errorMessage?: string | null) => void;
  markSaved: (savedAt?: number) => void;
  getRunbookPayload: () => { nodes: WorkflowNode[]; connections: WorkflowConnection[] };
  reset: () => void;
};

export type EditorState = State & Actions;

const initialState: State = {
  runbookId: null,
  runbookHeader: null,
  runbookInputs: [],
  nodes: [],
  edges: [],
  status: 'idle',
  savedAt: null,
  errorMessage: null,
  traceMode: false,
  hoveredFrameId: null,
  showStats: false,
  stepStats: {},
};

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      ...initialState,

      onNodesChange: changes =>
        set(state => ({
          nodes: applyNodeChanges<RfNode>(changes, state.nodes),
          status: state.status === 'loading' ? state.status : 'dirty',
        })),

      onEdgesChange: changes =>
        set(state => ({
          edges: applyEdgeChanges<RfEdge>(changes, state.edges),
          status: state.status === 'loading' ? state.status : 'dirty',
        })),

      onConnect: connection =>
        set(state => ({
          edges: addEdge<RfEdge>(connection, state.edges),
          status: 'dirty',
        })),

      reconnectEdge: (oldEdge, newConnection) =>
        set(state => ({
          edges: rfReconnectEdge<RfEdge>(oldEdge, newConnection, state.edges),
          status: 'dirty',
        })),

      addNode: node =>
        set(state => ({
          nodes: [...state.nodes, node],
          status: 'dirty',
        })),

      insertNodeMidEdge: (edgeId, newNode) =>
        set(state => {
          const edge = state.edges.find(e => e.id === edgeId);
          if (!edge) return state;
          // Inherit the original edge's type / data shape so the two
          // halves keep the same condition, lineStyle override, etc.
          // Only `source`, `target`, and `id` differ. Status is reset
          // to undefined so a leftover `running`/`success` from a past
          // run does not leak onto the freshly-spawned hops.
          const baseEdgeShape = {
            type: edge.type,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            data: edge.data ? { ...edge.data, status: undefined } : undefined,
          };
          const beforeId = `${edgeId}-pre-${newNode.id}`;
          const afterId = `${edgeId}-post-${newNode.id}`;
          return {
            nodes: [...state.nodes, newNode],
            edges: [
              ...state.edges.filter(e => e.id !== edgeId),
              {
                ...baseEdgeShape,
                id: beforeId,
                source: edge.source,
                target: newNode.id,
              } as RfEdge,
              {
                ...baseEdgeShape,
                id: afterId,
                source: newNode.id,
                target: edge.target,
              } as RfEdge,
            ],
            status: 'dirty',
          };
        }),

      removeNodes: ids =>
        set(state => {
          // Cascade: deleting a frame deletes every descendant. The
          // recursive walk happens against the current state because
          // graph helpers are pure.
          const all = new Set<string>(ids);
          for (const id of ids) {
            for (const desc of getDescendantIds(id, state.nodes)) all.add(desc);
          }
          return {
            nodes: state.nodes.filter(n => !all.has(n.id)),
            edges: state.edges.filter(e => !all.has(e.source) && !all.has(e.target)),
            status: 'dirty',
          };
        }),

      updateNodeData: (id, patch) =>
        set(state => ({
          nodes: state.nodes.map(n => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
        })),

      updateEdgeData: (id, patch) =>
        set(state => ({
          edges: state.edges.map(e =>
            e.id === id ? { ...e, data: { ...(e.data ?? {}), ...patch } } : e
          ),
        })),

      appendForPaste: (incomingNodes, incomingEdges) =>
        set(state => {
          const deselected = state.nodes.map(n => (n.selected ? { ...n, selected: false } : n));
          return {
            nodes: sortNodesForRf([...deselected, ...incomingNodes]),
            edges: [...state.edges, ...incomingEdges],
            status: 'dirty',
          };
        }),

      reparentNode: (id, parentId, nextPosition) =>
        set(state => {
          const updated = state.nodes.map(n => {
            if (n.id !== id) return n;
            const next: RfNode = {
              ...n,
              ...(nextPosition ? { position: nextPosition } : {}),
            };
            if (parentId) {
              next.parentId = parentId;
              next.extent = 'parent';
            } else {
              delete next.parentId;
              delete next.extent;
            }
            return next;
          });
          return { nodes: sortNodesForRf(updated), status: 'dirty' };
        }),

      hydrateFromWorkflow: (runbookId, header, inputs, nodes, connections) => {
        const rf = workflowToRf(nodes, connections);
        set({
          runbookId,
          runbookHeader: header,
          runbookInputs: inputs,
          // Frames must precede their children in the array — RF requirement.
          nodes: sortNodesForRf(rf.nodes),
          edges: rf.edges,
          status: 'idle',
          savedAt: Date.now(),
          errorMessage: null,
        });
        // History resets when we load a different runbook so undo can't leak
        // across documents.
        useEditorStore.temporal.getState().clear();
      },

      reconcileFromWorkflow: (header, inputs, nodes, connections) => {
        const state = get();
        const reconciled = reconcileWorkflow(
          { nodes: state.nodes, edges: state.edges },
          { nodes, connections }
        );
        set({
          runbookHeader: header,
          runbookInputs: inputs,
          nodes: sortNodesForRf(reconciled.nodes),
          edges: reconciled.edges,
          status: 'dirty',
          errorMessage: null,
        });
      },

      setRunbookHeader: patch =>
        set(state => ({
          runbookHeader: state.runbookHeader
            ? { ...state.runbookHeader, ...patch }
            : ({ name: 'Untitled', ...patch } as RunbookHeader),
        })),

      setRunbookInputs: next => set({ runbookInputs: next }),

      setTraceMode: active => set({ traceMode: active }),

      setHoveredFrameId: id =>
        set(state => (state.hoveredFrameId === id ? state : { hoveredFrameId: id })),

      setShowStats: active =>
        set(state => ({
          showStats: active,
          // Drop cached stats when turning the overlay off so a re-enable
          // refetches fresh data instead of flashing stale percentiles.
          stepStats: active ? state.stepStats : {},
        })),

      setStepStats: next => set({ stepStats: next }),

      setStatus: (status, errorMessage = null) => set({ status, errorMessage }),

      markSaved: (savedAt = Date.now()) => set({ status: 'saved', savedAt, errorMessage: null }),

      getRunbookPayload: () => rfToWorkflow(get().nodes, get().edges),

      reset: () => {
        set({ ...initialState });
        useEditorStore.temporal.getState().clear();
      },
    }),
    {
      limit: 50,
      // Strip transient UI flags from history snapshots — chaiNNer's
      // pattern (HistoryProvider.tsx). Without this, undo/redo
      // restores stale `selected` / `dragging` state from minutes ago,
      // which is jarring. The graph shape is what actually matters
      // for an undo step.
      partialize: state => ({
        nodes: state.nodes.map(({ selected: _s, dragging: _d, ...rest }) => rest as RfNode),
        edges: state.edges.map(({ selected: _s, ...rest }) => rest as RfEdge),
      }),
      equality: (prev, next) => prev.nodes === next.nodes && prev.edges === next.edges,
    }
  )
);
