import { RunbookExecutor } from '../../../runbook/executors/runbook.executor';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

/**
 * Unit tests for the `runbook` step executor.
 *
 * We exercise the whole decision tree without touching the real
 * ExecutionService or runner: cycle detection, depth cap, tenant
 * isolation, template-resolved refs and inputs, sync polling
 * (success + failure + timeout), async fire-and-forget.
 *
 * The only external dependencies are a fake prisma client + a fake
 * ExecutionService, both in-memory.
 */

interface FakeRunbook {
  id: string;
  slug: string | null;
  tenantId: string;
}
interface FakeExecution {
  id: string;
  workflowId: string;
  parentExecutionId: string | null;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  error: string | null;
  userId: string;
}

function makePrisma(runbooks: FakeRunbook[], executions: FakeExecution[]) {
  return {
    execution: {
      findUnique: jest.fn(async (args: { where: { id: string }; select?: unknown }) => {
        const row = executions.find(e => e.id === args.where.id) ?? null;
        return row;
      }),
    },
    runbook: {
      findFirst: jest.fn(
        async (args: { where: { tenantId: string; OR: { id?: string; slug?: string }[] } }) => {
          const { tenantId, OR } = args.where;
          const refs = OR.map(clause => clause.id ?? clause.slug ?? '');
          return (
            runbooks.find(
              rb =>
                rb.tenantId === tenantId &&
                (refs.includes(rb.id) || (rb.slug !== null && refs.includes(rb.slug)))
            ) ?? null
          );
        }
      ),
    },
  } as unknown as ConstructorParameters<typeof RunbookExecutor>[0];
}

function makeExecutionService(onExecute: (params: unknown) => Promise<{ id: string }>) {
  const mock = jest.fn(onExecute);
  const svc = { execute: mock } as { execute: jest.Mock<Promise<{ id: string }>, [unknown]> };
  return svc;
}

function buildContext(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    runId: 'parent-run',
    stepId: 'step-1',
    variables: {},
    previousOutputs: {},
    tenantId: 'tenant-1',
    ...overrides,
  };
}

describe('RunbookExecutor', () => {
  it('rejects an empty ref', async () => {
    const executor = new RunbookExecutor(makePrisma([], []));
    const result = await executor.execute({ ref: '   ' }, buildContext());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ref/);
  });

  it('resolves templated refs before looking up the runbook', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-target', slug: 'rollback', tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [
      {
        id: 'parent-run',
        workflowId: 'rb-parent',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
      {
        id: 'child-run',
        workflowId: 'rb-target',
        parentExecutionId: 'parent-run',
        status: 'SUCCESS',
        error: null,
        userId: 'u-1',
      },
    ];
    const prisma = makePrisma(runbooks, executions);
    const execSvc = makeExecutionService(async () => ({ id: 'child-run' }));

    const executor = new RunbookExecutor(prisma, {
      executionService: execSvc as never,
      sleep: async () => undefined,
    });

    const result = await executor.execute(
      { ref: '{{vars.target}}' },
      buildContext({ variables: { target: 'rollback' } })
    );

    expect(result.success).toBe(true);
    expect(execSvc.execute).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'rb-target', parentExecutionId: 'parent-run' })
    );
  });

  it('returns 404-shaped error when target runbook is in another tenant', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-other', slug: 'rollback', tenantId: 'tenant-2' }];
    const executions: FakeExecution[] = [
      {
        id: 'parent-run',
        workflowId: 'rb-parent',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
    ];
    const executor = new RunbookExecutor(makePrisma(runbooks, executions));

    const result = await executor.execute({ ref: 'rollback' }, buildContext());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('detects a direct cycle (runbook calls itself)', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-self', slug: null, tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [
      {
        id: 'parent-run',
        workflowId: 'rb-self',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
    ];
    const executor = new RunbookExecutor(makePrisma(runbooks, executions));

    const result = await executor.execute({ ref: 'rb-self' }, buildContext());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cycle/i);
  });

  it('detects a transitive cycle across ancestors', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-a', slug: null, tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [
      {
        id: 'run-top',
        workflowId: 'rb-a',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
      {
        id: 'run-mid',
        workflowId: 'rb-b',
        parentExecutionId: 'run-top',
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
      {
        id: 'run-leaf',
        workflowId: 'rb-c',
        parentExecutionId: 'run-mid',
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
    ];
    const executor = new RunbookExecutor(makePrisma(runbooks, executions));

    const result = await executor.execute({ ref: 'rb-a' }, buildContext({ runId: 'run-leaf' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cycle/i);
  });

  it('enforces the depth cap', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-deep', slug: null, tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [];
    // 7 hops should exceed MAX_DEPTH = 5
    for (let i = 0; i <= 6; i++) {
      executions.push({
        id: `run-${i}`,
        workflowId: `rb-${i}`,
        parentExecutionId: i === 0 ? null : `run-${i - 1}`,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      });
    }
    const executor = new RunbookExecutor(makePrisma(runbooks, executions));

    const result = await executor.execute({ ref: 'rb-deep' }, buildContext({ runId: 'run-6' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/depth/i);
  });

  it('async mode returns immediately with the child id', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-child', slug: null, tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [
      {
        id: 'parent-run',
        workflowId: 'rb-parent',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
    ];
    const prisma = makePrisma(runbooks, executions);
    const execSvc = makeExecutionService(async () => ({ id: 'child-async' }));

    const executor = new RunbookExecutor(prisma, { executionService: execSvc as never });
    const result = await executor.execute({ ref: 'rb-child', waitFor: 'async' }, buildContext());

    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({ childExecutionId: 'child-async', mode: 'async' });
  });

  it('sync mode polls until SUCCESS', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-child', slug: null, tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [
      {
        id: 'parent-run',
        workflowId: 'rb-parent',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
    ];
    const prisma = makePrisma(runbooks, executions);

    // Child starts RUNNING, then flips to SUCCESS on the second poll
    const execSvc = makeExecutionService(async () => {
      executions.push({
        id: 'child-sync',
        workflowId: 'rb-child',
        parentExecutionId: 'parent-run',
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      });
      return { id: 'child-sync' };
    });
    let polls = 0;
    (
      prisma as unknown as { execution: { findUnique: jest.Mock } }
    ).execution.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      const row = executions.find(e => e.id === args.where.id) ?? null;
      if (args.where.id === 'child-sync' && row) {
        polls += 1;
        if (polls >= 2) row.status = 'SUCCESS';
      }
      return row;
    });

    const executor = new RunbookExecutor(prisma, {
      executionService: execSvc as never,
      sleep: async () => undefined,
    });
    const result = await executor.execute({ ref: 'rb-child', timeoutSeconds: 10 }, buildContext());

    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({
      childExecutionId: 'child-sync',
      status: 'SUCCESS',
      mode: 'sync',
    });
  });

  it('sync mode surfaces the child error on FAILED', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-child', slug: null, tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [
      {
        id: 'parent-run',
        workflowId: 'rb-parent',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
      {
        id: 'child-run',
        workflowId: 'rb-child',
        parentExecutionId: 'parent-run',
        status: 'FAILED',
        error: 'kubectl not found',
        userId: 'u-1',
      },
    ];
    const prisma = makePrisma(runbooks, executions);
    const execSvc = makeExecutionService(async () => ({ id: 'child-run' }));

    const executor = new RunbookExecutor(prisma, {
      executionService: execSvc as never,
      sleep: async () => undefined,
    });
    const result = await executor.execute({ ref: 'rb-child' }, buildContext());

    expect(result.success).toBe(false);
    expect(result.error).toBe('kubectl not found');
  });

  it('sync mode times out when the child never completes', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-child', slug: null, tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [
      {
        id: 'parent-run',
        workflowId: 'rb-parent',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
      {
        id: 'child-run',
        workflowId: 'rb-child',
        parentExecutionId: 'parent-run',
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
    ];
    const prisma = makePrisma(runbooks, executions);
    const execSvc = makeExecutionService(async () => ({ id: 'child-run' }));

    // Inject a clock that advances by 2 seconds per call so the 1s
    // timeout blows in one poll.
    let t = 0;
    const executor = new RunbookExecutor(prisma, {
      executionService: execSvc as never,
      sleep: async () => undefined,
      now: () => {
        t += 2_000;
        return t;
      },
    });

    const result = await executor.execute({ ref: 'rb-child', timeoutSeconds: 1 }, buildContext());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Timed out/i);
    expect(result.output).toMatchObject({ timedOut: true });
  });

  it('passes templated inputs through to the child run', async () => {
    const runbooks: FakeRunbook[] = [{ id: 'rb-child', slug: null, tenantId: 'tenant-1' }];
    const executions: FakeExecution[] = [
      {
        id: 'parent-run',
        workflowId: 'rb-parent',
        parentExecutionId: null,
        status: 'RUNNING',
        error: null,
        userId: 'u-1',
      },
    ];
    const prisma = makePrisma(runbooks, executions);
    const execSvc = makeExecutionService(async () => ({ id: 'child-inputs' }));

    const executor = new RunbookExecutor(prisma, { executionService: execSvc as never });
    await executor.execute(
      {
        ref: 'rb-child',
        waitFor: 'async',
        inputs: {
          deployment: '{{vars.svc}}',
          replicas: 3,
          flags: { canary: true },
        },
      },
      buildContext({ variables: { svc: 'payments-api' } })
    );

    expect(execSvc.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          deployment: 'payments-api',
          replicas: 3,
          flags: { canary: true },
        },
      })
    );
  });
});
