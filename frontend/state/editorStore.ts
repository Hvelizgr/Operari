import type { Connection as RfConnection } from '@xyflow/react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  reconnectEdge as rfReconnectEdge,
} from '@xyflow/react';
import { create } from 'zustand';
import { temporal } from 'zundo';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { rfToWorkflow, workflowToRf } from '@/lib/canvas/adapter';
import { getDescendantIds, sortNodesForRf } from '@/lib/canvas/graph';
import type { RunbookInputDefinition } from '@/components/Editor/RunbookInputsPanel';
import type { Connection as WorkflowConnection, WorkflowNode } from '@operari/shared';

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
};

type Actions = {
  onNodesChange: (changes: NodeChange<RfNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<RfEdge>[]) => void;
  onConnect: (connection: RfConnection) => void;
  reconnectEdge: (oldEdge: RfEdge, newConnection: RfConnection) => void;
  addNode: (node: RfNode) => void;
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
  setRunbookHeader: (patch: Partial<RunbookHeader>) => void;
  setRunbookInputs: (next: RunbookInputDefinition[]) => void;
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

      setRunbookHeader: patch =>
        set(state => ({
          runbookHeader: state.runbookHeader
            ? { ...state.runbookHeader, ...patch }
            : ({ name: 'Untitled', ...patch } as RunbookHeader),
        })),

      setRunbookInputs: next => set({ runbookInputs: next }),

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
      partialize: state => ({ nodes: state.nodes, edges: state.edges }),
      equality: (prev, next) => prev.nodes === next.nodes && prev.edges === next.edges,
    }
  )
);
