import type { Connection as WorkflowConnection, WorkflowNode } from '@operari/shared';

import { workflowConnectionToRfEdge, workflowNodeToRfNode } from '../adapter';
import { reconcileWorkflow } from '../reconcile';

const stepNode = (id: string, overrides: Partial<WorkflowNode> = {}): WorkflowNode => ({
  id,
  type: 'http',
  title: id,
  position: { x: 0, y: 0 },
  config: {},
  ...overrides,
});

const conn = (id: string, source: string, target: string): WorkflowConnection => ({
  id,
  source,
  target,
});

describe('reconcileWorkflow', () => {
  it('preserves position + selection for nodes that survive the diff', () => {
    const incoming = [stepNode('a'), stepNode('b')];
    const current = {
      nodes: incoming.map(n => {
        const rf = workflowNodeToRfNode(n);
        return {
          ...rf,
          position: { x: 500, y: 200 },
          selected: n.id === 'a',
        };
      }),
      edges: [],
    };
    // Same ids but with different positions in the workflow body
    // (simulating the old behavior where YAML overrode position).
    const next = {
      nodes: incoming.map(n => ({ ...n, position: { x: 0, y: 0 } })),
      connections: [],
    };

    const result = reconcileWorkflow(current, next);
    expect(result.changes).toMatchObject({
      nodesKept: 2,
      nodesAdded: 0,
      nodesRemoved: 0,
    });
    const a = result.nodes.find(n => n.id === 'a')!;
    expect(a.position).toEqual({ x: 500, y: 200 });
    expect(a.selected).toBe(true);
  });

  it('refreshes node `data` from the new workflow body', () => {
    const initial = stepNode('a', {
      title: 'old title',
      config: { url: 'https://old' } as never,
    });
    const current = {
      nodes: [{ ...workflowNodeToRfNode(initial), position: { x: 100, y: 100 } }],
      edges: [],
    };
    const updated = stepNode('a', {
      title: 'new title',
      config: { url: 'https://new' } as never,
    });
    const result = reconcileWorkflow(current, { nodes: [updated], connections: [] });
    const node = result.nodes[0]!;
    expect(node.position).toEqual({ x: 100, y: 100 });
    // The fresh data carries the new workflow body (the adapter
    // wraps it under data.workflow).
    expect(JSON.stringify(node.data)).toContain('https://new');
    expect(JSON.stringify(node.data)).not.toContain('https://old');
  });

  it('drops nodes that are no longer in the workflow', () => {
    const a = stepNode('a');
    const b = stepNode('b');
    const current = {
      nodes: [workflowNodeToRfNode(a), workflowNodeToRfNode(b)],
      edges: [],
    };
    const next = { nodes: [a], connections: [] };
    const result = reconcileWorkflow(current, next);
    expect(result.changes.nodesRemoved).toBe(1);
    expect(result.nodes.map(n => n.id)).toEqual(['a']);
  });

  it('adds new nodes from the workflow body', () => {
    const current = {
      nodes: [workflowNodeToRfNode(stepNode('a'))],
      edges: [],
    };
    const next = { nodes: [stepNode('a'), stepNode('b')], connections: [] };
    const result = reconcileWorkflow(current, next);
    expect(result.changes.nodesAdded).toBe(1);
    expect(result.nodes.map(n => n.id).sort()).toEqual(['a', 'b']);
  });

  it('reconciles edges by id with the same kept/added/removed semantics', () => {
    const a = stepNode('a');
    const b = stepNode('b');
    const c = stepNode('c');
    const current = {
      nodes: [workflowNodeToRfNode(a), workflowNodeToRfNode(b), workflowNodeToRfNode(c)],
      edges: [workflowConnectionToRfEdge(conn('e1', 'a', 'b'))],
    };
    // e1 stays, e2 is added, no edge removed.
    const next = {
      nodes: [a, b, c],
      connections: [conn('e1', 'a', 'b'), conn('e2', 'b', 'c')],
    };
    const result = reconcileWorkflow(current, next);
    expect(result.changes.edgesKept).toBe(1);
    expect(result.changes.edgesAdded).toBe(1);
    expect(result.changes.edgesRemoved).toBe(0);
  });
});
