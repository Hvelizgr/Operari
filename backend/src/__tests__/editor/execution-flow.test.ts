import type { PrismaClient } from '@prisma/client';

import { ExecutionService } from '../../editor/execution/execution.service';
import { NodeExecutor } from '../../editor/node-executor.service';
import type { WorkflowConnection, WorkflowNode } from '../../types/runbook.types';

jest.mock('../../editor/node-executor.service');
jest.mock('../../services/error-notification.service');
jest.mock('../../utils/error-persistence');
jest.mock('../../editor/execution/socket.service', () => ({
  socketService: {
    emitLog: jest.fn(),
    emitExecutionStatus: jest.fn(),
    emitNodeStatus: jest.fn(),
    initialize: jest.fn(),
  },
}));

const prisma = {
  nodeLog: { create: jest.fn(async () => ({ id: 'log' })), update: jest.fn() },
  execution: { update: jest.fn(), findUnique: jest.fn() },
  executionError: { findFirst: jest.fn() },
} as unknown as PrismaClient;

const node = (id: string, type: string, config: Record<string, unknown> = {}): WorkflowNode => ({
  id,
  type,
  title: id,
  position: { x: 0, y: 0 },
  config,
});
const wire = (source: string, target: string): WorkflowConnection =>
  ({ id: `${source}-${target}`, source, target }) as WorkflowConnection;

/** Runs the graph and returns, per executed step, the input it received. */
async function run(nodes: WorkflowNode[], connections: WorkflowConnection[]) {
  const calls: Array<{ id: string; input: Record<string, unknown> }> = [];
  (NodeExecutor as jest.Mock).mockImplementation(() => ({
    execute: jest.fn(async (n: WorkflowNode, input: Record<string, unknown>) => {
      calls.push({ id: n.id, input });
      if (n.type === 'operari.loop') return { items: (n.config as { items: unknown[] }).items };
      return { from: n.id };
    }),
  }));
  const service = new ExecutionService(prisma, {
    audit: null,
    tracer: null,
    eventStore: null,
    meter: null,
  });
  await (
    service as unknown as {
      runWorkflow: (...args: unknown[]) => Promise<void>;
    }
  ).runWorkflow('exec-1', { id: 'rb', nodes, connections }, {}, {}, 'tenant-1');
  return calls;
}

describe('editor engine start nodes', () => {
  it('starts at every root, not just the first node in the array', async () => {
    // b is listed first but is downstream of a; c is a second root.
    const calls = await run(
      [node('b', 'shell'), node('a', 'shell'), node('c', 'shell')],
      [wire('a', 'b')]
    );
    const order = calls.map(c => c.id);
    expect(order.sort()).toEqual(['a', 'b', 'c']);
    expect(calls.findIndex(c => c.id === 'a')).toBeLessThan(calls.findIndex(c => c.id === 'b'));
  });

  it('starts at the seeded trigger types', async () => {
    const calls = await run(
      [node('other', 'shell'), node('hook', 'operari.webhook'), node('next', 'shell')],
      [wire('hook', 'next')]
    );
    expect(calls[0].id).toBe('hook');
    expect(calls.map(c => c.id)).not.toContain('other');
  });
});

describe('editor engine loop', () => {
  it('runs the body once per item, each with its own item', async () => {
    const calls = await run(
      [node('loop', 'operari.loop', { items: ['x', 'y', 'z'] }), node('body', 'shell')],
      [wire('loop', 'body')]
    );
    const bodies = calls.filter(c => c.id === 'body');
    expect(bodies.map(b => b.input.currentItem)).toEqual(['x', 'y', 'z']);
    expect(bodies.map(b => b.input.currentIndex)).toEqual([0, 1, 2]);
  });

  it('skips the body when there are no items but keeps the flow going', async () => {
    const calls = await run(
      [node('loop', 'operari.loop', { items: [] }), node('body', 'shell'), node('after', 'shell')],
      [wire('loop', 'body'), wire('body', 'after')]
    );
    const ids = calls.map(c => c.id);
    expect(ids).not.toContain('body');
    expect(ids).toContain('after');
  });
});
