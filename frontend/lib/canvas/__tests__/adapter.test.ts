import type { Connection as WorkflowConnection, WorkflowNode } from '@operari/shared';

import {
  rfEdgeToWorkflowConnection,
  rfNodeToWorkflowNode,
  rfToWorkflow,
  workflowConnectionToRfEdge,
  workflowNodeToRfNode,
  workflowToRf,
} from '../adapter';

const sampleNode: WorkflowNode = {
  id: 'node-1',
  type: 'shell',
  title: 'Run uptime',
  position: { x: 120, y: 80 },
  enabled: true,
  config: {
    command: 'uptime',
    cwd: '/srv',
    _retry: { count: 3, backoff: 'exponential' },
    _runIf: 'env.PROD === true',
    _skipIf: 'flags.maintenance',
  } as WorkflowNode['config'],
  inputs: [{ id: 'in', label: 'in' }],
  outputs: [{ id: 'ok', label: 'ok' }],
};

const childNode: WorkflowNode = {
  id: 'node-2',
  type: 'notify',
  title: 'Slack',
  position: { x: 400, y: 80 },
  parentId: 'frame-1',
  config: { _frame: { parentId: 'frame-1' } } as WorkflowNode['config'],
};

const sampleEdge: WorkflowConnection = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  sourcePort: 0,
  targetPort: 1,
  condition: 'success',
};

describe('adapter — workflow ↔ react-flow round trip', () => {
  it('preserves all WorkflowNode keys including config meta-keys', () => {
    const rf = workflowNodeToRfNode(sampleNode);
    const back = rfNodeToWorkflowNode(rf);
    expect(back).toEqual(sampleNode);
  });

  it('keeps parentId on the RF node and stamps _frame into config on round-trip', () => {
    const rf = workflowNodeToRfNode(childNode);
    expect(rf.parentId).toBe('frame-1');
    expect(rf.extent).toBe('parent');
    const back = rfNodeToWorkflowNode(rf);
    // parentId preserved at top level AND mirrored into config._frame so
    // the strict zod schema on the backend cannot strip it.
    expect(back.parentId).toBe('frame-1');
    expect((back.config as { _frame?: { parentId?: string } } | undefined)?._frame?.parentId).toBe(
      'frame-1'
    );
  });

  it('restores parentId from config._frame when the top-level field is missing', () => {
    // Simulates a node that round-tripped through the strict backend zod
    // schema, which strips top-level parentId but keeps the entire
    // `config` object intact.
    const stripped: WorkflowNode = {
      id: 'node-2',
      type: 'notify',
      title: 'Slack',
      position: { x: 400, y: 80 },
      config: { _frame: { parentId: 'frame-1' } } as WorkflowNode['config'],
    };
    const rf = workflowNodeToRfNode(stripped);
    expect(rf.parentId).toBe('frame-1');
    expect(rf.extent).toBe('parent');
  });

  it('drops _frame from config when a node is un-parented', () => {
    const wasParented: WorkflowNode = {
      id: 'node-3',
      type: 'notify',
      title: 'Slack',
      position: { x: 400, y: 80 },
      parentId: 'frame-1',
      config: { _frame: { parentId: 'frame-1' } } as WorkflowNode['config'],
    };
    const rf = workflowNodeToRfNode(wasParented);
    // simulate un-parenting on the canvas
    const detached: typeof rf = { ...rf, parentId: undefined, extent: undefined };
    const back = rfNodeToWorkflowNode(detached);
    expect(back.parentId).toBeUndefined();
    expect(back.config).toBeUndefined();
  });

  it('round-trips a connection with port indices and condition', () => {
    const rf = workflowConnectionToRfEdge(sampleEdge);
    expect(rf.sourceHandle).toBe('0');
    expect(rf.targetHandle).toBe('1');
    expect(rf.data?.condition).toBe('success');
    expect(rf.type).toBe('smart');
    const back = rfEdgeToWorkflowConnection(rf);
    expect(back).toEqual(sampleEdge);
  });

  it('round-trips a connection without port indices (omits the keys)', () => {
    const minimal: WorkflowConnection = { id: 'e2', source: 'a', target: 'b' };
    const back = rfEdgeToWorkflowConnection(workflowConnectionToRfEdge(minimal));
    expect(back).toEqual(minimal);
  });

  it('strips RF-internal fields when converting an RF node back', () => {
    const rf = workflowNodeToRfNode(sampleNode);
    const dirty = {
      ...rf,
      selected: true,
      dragging: true,
      measured: { width: 200, height: 60 },
      positionAbsolute: { x: 999, y: 999 },
    } as typeof rf & Record<string, unknown>;
    const back = rfNodeToWorkflowNode(dirty as typeof rf);
    expect(back).toEqual(sampleNode);
  });

  it('round-trips a full workflow', () => {
    const nodes = [sampleNode, childNode];
    const connections = [sampleEdge];
    const rf = workflowToRf(nodes, connections);
    const back = rfToWorkflow(rf.nodes, rf.edges);
    expect(back).toEqual({ nodes, connections });
  });
});
