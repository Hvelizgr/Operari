import type { ExecutionEvent, PrismaClient } from '@prisma/client';
import { ExecutionEventStore } from '../../../runbook/engine/execution-event.store';

interface FakeRow extends ExecutionEvent {
  payload: never;
}

function buildPrisma(seed: ExecutionEvent[] = []) {
  const rows: ExecutionEvent[] = [...seed];
  let nextSeq = (seed.reduce((m, r) => (r.seq > m ? r.seq : m), 0n) ?? 0n) + 1n;
  let nextId = rows.length + 1;

  const prisma = {
    executionEvent: {
      create: jest.fn(async (args: { data: Omit<ExecutionEvent, 'id' | 'seq' | 'createdAt'> }) => {
        const created: ExecutionEvent = {
          id: `evt-${nextId++}`,
          seq: nextSeq++,
          createdAt: new Date(),
          ...args.data,
        } as ExecutionEvent;
        rows.push(created);
        return created;
      }),
      findMany: jest.fn(
        async (args: {
          where?: {
            executionId?: string | { in: string[] };
            tenantId?: string;
            type?: { in: string[] };
          };
          orderBy?: { seq: 'asc' };
          select?: { executionId?: boolean };
          distinct?: string[];
        }) => {
          let result = rows.slice();
          const execClause = args.where?.executionId;
          if (typeof execClause === 'string') {
            result = result.filter(r => r.executionId === execClause);
          } else if (execClause && typeof execClause === 'object' && 'in' in execClause) {
            const ids = execClause.in;
            result = result.filter(r => ids.includes(r.executionId));
          }
          if (args.where?.tenantId) {
            result = result.filter(r => r.tenantId === args.where!.tenantId);
          }
          if (args.where?.type && 'in' in args.where.type) {
            const types = (args.where.type as { in: string[] }).in;
            result = result.filter(r => types.includes(r.type));
          }
          if (args.orderBy?.seq === 'asc') {
            result = result.slice().sort((a, b) => Number(a.seq - b.seq));
          }
          if (args.distinct?.includes('executionId')) {
            const seen = new Set<string>();
            result = result.filter(r => {
              if (seen.has(r.executionId)) return false;
              seen.add(r.executionId);
              return true;
            });
          }
          return result;
        }
      ),
    },
  } as unknown as PrismaClient;

  return { prisma, rows };
}

const TENANT = 'tenant-1';

describe('ExecutionEventStore', () => {
  describe('append', () => {
    it('persists run.created with the right type and payload', async () => {
      const { prisma, rows } = buildPrisma();
      const store = new ExecutionEventStore(prisma);

      await store.append('exec-1', TENANT, {
        type: 'run.created',
        payload: {
          workflowId: 'wf-1',
          workflowName: 'Deploy',
          trigger: 'manual',
        },
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('run.created');
      expect(rows[0].executionId).toBe('exec-1');
      expect(rows[0].tenantId).toBe(TENANT);
      expect(rows[0].nodeId).toBeNull();
      expect(rows[0].payload).toMatchObject({ workflowName: 'Deploy' });
    });

    it('persists step.completed with the nodeId', async () => {
      const { prisma, rows } = buildPrisma();
      const store = new ExecutionEventStore(prisma);

      await store.append('exec-1', TENANT, {
        type: 'step.completed',
        nodeId: 'node-7',
        payload: {
          nodeName: 'fetch',
          nodeType: 'HTTP',
          durationMs: 42,
          output: { status: 200 },
        },
      });

      expect(rows[0].type).toBe('step.completed');
      expect(rows[0].nodeId).toBe('node-7');
    });

    it('seq is monotonic across appends to the same execution', async () => {
      const { prisma, rows } = buildPrisma();
      const store = new ExecutionEventStore(prisma);

      await store.append('exec-1', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' },
      });
      await store.append('exec-1', TENANT, { type: 'run.started', payload: { startedAt: '' } });
      await store.append('exec-1', TENANT, {
        type: 'run.completed',
        payload: { durationMs: 1, nodesExecuted: 0 },
      });

      expect(rows.map(r => r.seq)).toEqual([1n, 2n, 3n]);
    });
  });

  describe('listEvents', () => {
    it('returns events for a single execution in seq order', async () => {
      const { prisma } = buildPrisma();
      const store = new ExecutionEventStore(prisma);

      await store.append('exec-A', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' },
      });
      await store.append('exec-B', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' },
      });
      await store.append('exec-A', TENANT, { type: 'run.started', payload: { startedAt: '' } });

      const eventsA = await store.listEvents('exec-A');
      expect(eventsA).toHaveLength(2);
      expect(eventsA.map(e => e.type)).toEqual(['run.created', 'run.started']);
    });
  });

  describe('reduceState', () => {
    it('returns null for an unknown execution', async () => {
      const { prisma } = buildPrisma();
      const store = new ExecutionEventStore(prisma);
      await expect(store.reduceState('ghost')).resolves.toBeNull();
    });

    it('reduces a real run end-to-end via the reducer', async () => {
      const { prisma } = buildPrisma();
      const store = new ExecutionEventStore(prisma);

      await store.append('exec-1', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'Deploy', trigger: 'manual' },
      });
      await store.append('exec-1', TENANT, { type: 'run.started', payload: { startedAt: '' } });
      await store.append('exec-1', TENANT, {
        type: 'step.completed',
        nodeId: 'n-1',
        payload: { nodeName: 'a', nodeType: 'HTTP', durationMs: 5 },
      });
      await store.append('exec-1', TENANT, {
        type: 'run.completed',
        payload: { durationMs: 100, nodesExecuted: 1 },
      });

      const state = await store.reduceState('exec-1');
      expect(state).not.toBeNull();
      expect(state!.status).toBe('COMPLETED');
      expect(state!.workflowName).toBe('Deploy');
      expect(state!.completedSteps).toEqual(['n-1']);
      expect(state!.durationMs).toBe(100);
    });
  });

  describe('listInFlightExecutions', () => {
    it('returns only executions without a terminal event', async () => {
      const { prisma } = buildPrisma();
      const store = new ExecutionEventStore(prisma);

      // exec-A: completed
      await store.append('exec-A', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'A', trigger: 'manual' },
      });
      await store.append('exec-A', TENANT, {
        type: 'run.completed',
        payload: { durationMs: 1, nodesExecuted: 0 },
      });

      // exec-B: in flight (only created)
      await store.append('exec-B', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'B', trigger: 'manual' },
      });

      // exec-C: in flight (started, no terminal)
      await store.append('exec-C', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'C', trigger: 'manual' },
      });
      await store.append('exec-C', TENANT, { type: 'run.started', payload: { startedAt: '' } });

      // exec-D: failed (terminal)
      await store.append('exec-D', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'D', trigger: 'manual' },
      });
      await store.append('exec-D', TENANT, {
        type: 'run.failed',
        payload: { durationMs: 5, errorMessage: 'oops' },
      });

      // exec-E: cancelled (terminal)
      await store.append('exec-E', TENANT, {
        type: 'run.created',
        payload: { workflowId: 'wf', workflowName: 'E', trigger: 'manual' },
      });
      await store.append('exec-E', TENANT, {
        type: 'run.cancelled',
        payload: { cancelledAt: '2026-04-07T00:00:00Z' },
      });

      const inFlight = await store.listInFlightExecutions(TENANT);
      expect(inFlight.sort()).toEqual(['exec-B', 'exec-C']);
    });

    it('returns empty array when there are no events for the tenant', async () => {
      const { prisma } = buildPrisma();
      const store = new ExecutionEventStore(prisma);
      await expect(store.listInFlightExecutions('empty-tenant')).resolves.toEqual([]);
    });
  });
});
