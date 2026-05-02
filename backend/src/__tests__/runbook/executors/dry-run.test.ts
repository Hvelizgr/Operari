import type { PrismaClient } from '@prisma/client';

import type { EditorNodeExecutor } from '../../../editor/nodes/_shared';
import { ApprovalExecutor } from '../../../runbook/executors/approval.executor';
import { EditorExecutorAdapter } from '../../../runbook/executors/_editor-adapter';
import { HttpExecutor } from '../../../runbook/executors/http.executor';
import { NotifyExecutor } from '../../../runbook/executors/notify.executor';
import { ShellExecutor } from '../../../runbook/executors/shell.executor';
import { WaitExecutor } from '../../../runbook/executors/wait.executor';
import type { Runner } from '../../../runbook/runners/runner.types';
import type { ExecutorContext } from '../../../runbook/types/executor.types';
import type { ExecutionOutput } from '../../../types/runbook.types';

/**
 * Per-executor dry-run contract.
 *
 * Each test pins the invariant that gives dry-run its value: the
 * executor MUST NOT perform its side effect. Logs + output flags are
 * checked too so the timeline stays informative.
 */

function buildContext(
  overrides: Partial<ExecutorContext> = {}
): ExecutorContext & { _logs: string[] } {
  const _logs: string[] = [];
  return {
    runId: 'run-dry',
    stepId: 'step-1',
    tenantId: 't-1',
    variables: {},
    previousOutputs: {},
    secrets: {},
    emit: event => _logs.push(event.text),
    dryRun: true,
    ...overrides,
    _logs,
  };
}

describe('ShellExecutor dry-run', () => {
  it('never invokes the runner', async () => {
    const runner: Runner = {
      type: 'mock',
      run: jest.fn(async () => {
        throw new Error('runner should not be called in dry-run');
      }),
      cancel: jest.fn(async () => 0),
    };
    const executor = new ShellExecutor(runner);
    const context = buildContext();
    const result = await executor.execute({ command: 'rm -rf /' }, context);

    expect(result.success).toBe(true);
    expect((result.output as { dryRun?: boolean }).dryRun).toBe(true);
    expect(context._logs.some(l => l.startsWith('[dry-run] would execute:'))).toBe(true);
    expect(runner.run).not.toHaveBeenCalled();
  });
});

describe('HttpExecutor dry-run', () => {
  it('never fires fetch + redacts sensitive headers', async () => {
    const fetchSpy = jest.fn(async () => {
      throw new Error('fetch should not be called in dry-run');
    });
    const executor = new HttpExecutor(fetchSpy as unknown as typeof fetch);
    const context = buildContext();
    const result = await executor.execute(
      {
        method: 'POST',
        url: 'https://api.prod.example.com/pay',
        headers: {
          Authorization: 'Bearer live-key',
          'X-Request-Id': 'abc',
        },
        body: '{"amount":100}',
      },
      context
    );

    expect(result.success).toBe(true);
    expect((result.output as { dryRun?: boolean }).dryRun).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    const dryLog = context._logs.find(l => l.includes('[dry-run] would POST'));
    expect(dryLog).toBeDefined();
    // Sensitive header redacted, non-sensitive kept verbatim.
    expect(dryLog).toContain('"Authorization":"[redacted]"');
    expect(dryLog).toContain('"X-Request-Id":"abc"');
  });
});

describe('ApprovalExecutor dry-run', () => {
  it('never creates an Approval row + returns success synchronously', async () => {
    const prisma = {
      approval: { create: jest.fn() },
      execution: { findUnique: jest.fn() },
    } as unknown as PrismaClient;
    const executor = new ApprovalExecutor(prisma, { audit: null });
    const context = buildContext();
    const result = await executor.execute({ message: 'Deploy to prod?' }, context);

    expect(result.success).toBe(true);
    expect(result.paused).toBeUndefined();
    expect((result.output as { dryRun?: boolean; status?: string }).dryRun).toBe(true);
    expect((result.output as { status?: string }).status).toBe('AUTO_APPROVED');
    expect(prisma.approval.create).not.toHaveBeenCalled();
    expect(prisma.execution.findUnique).not.toHaveBeenCalled();
  });
});

describe('NotifyExecutor dry-run', () => {
  it('never opens a network connection + logs redacted target', async () => {
    const executor = new NotifyExecutor();
    const context = buildContext();
    const result = await executor.execute(
      {
        channel: 'slack',
        webhookUrl: 'https://hooks.slack.com/services/T/B/VERY-SECRET',
        message: 'Deploy complete',
      },
      context
    );
    expect(result.success).toBe(true);
    expect((result.output as { dryRun?: boolean }).dryRun).toBe(true);
    const log = context._logs.find(l => l.includes('[dry-run] would notify slack'));
    expect(log).toBeDefined();
    // Host shown, full path (secret) NOT shown.
    expect(log).toContain('hooks.slack.com');
    expect(log).not.toContain('VERY-SECRET');
  });
});

describe('WaitExecutor dry-run', () => {
  it('returns immediately without waiting', async () => {
    const executor = new WaitExecutor();
    const context = buildContext();
    const t0 = Date.now();
    const result = await executor.execute({ durationMs: 5000 }, context);
    const elapsed = Date.now() - t0;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(100); // should be ~0ms, NOT 5000
    const output = result.output as { dryRun: boolean; waitedMs: number; wouldWaitMs: number };
    expect(output.dryRun).toBe(true);
    expect(output.waitedMs).toBe(0);
    expect(output.wouldWaitMs).toBe(5000);
  });
});

describe('EditorExecutorAdapter dry-run', () => {
  // Pins the bug where every legacy editor executor (Email, Http, Store*,
  // ShellCommand, …) executed its real side effect during a "Simulación"
  // run because the EditorNodeExecutor interface predates dry-run and
  // never received the flag. The adapter now short-circuits before
  // touching the inner executor, so a single guard covers the 15-ish
  // legacy nodes at once until ADR 0004 folds them into the native
  // registry.
  it('never invokes the inner editor executor + emits a [dry-run] log', async () => {
    const innerExecute = jest.fn(async () => {
      throw new Error('inner editor executor must not run during dry-run');
    });
    const inner: EditorNodeExecutor<unknown, ExecutionOutput> = {
      type: 'Email',
      execute: innerExecute as unknown as EditorNodeExecutor<unknown, ExecutionOutput>['execute'],
    };
    const adapter = new EditorExecutorAdapter(inner);
    const context = buildContext();

    const result = await adapter.execute({ to: 'oncall@example.com' }, context);

    expect(innerExecute).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    const output = result.output as {
      dryRun?: boolean;
      type?: string;
      skipped?: string;
    };
    expect(output.dryRun).toBe(true);
    expect(output.type).toBe('Email');
    expect(output.skipped).toBe('legacy-editor-executor');
    expect(context._logs.some(l => l.startsWith('[dry-run] would execute Email'))).toBe(true);
  });

  it('still calls the inner executor when dry-run is off', async () => {
    const innerExecute = jest.fn(async () => ({ messageId: 'real-id' }));
    const inner: EditorNodeExecutor<unknown, ExecutionOutput> = {
      type: 'Email',
      execute: innerExecute as unknown as EditorNodeExecutor<unknown, ExecutionOutput>['execute'],
    };
    const adapter = new EditorExecutorAdapter(inner);
    const context = buildContext({ dryRun: false });

    const result = await adapter.execute({ to: 'oncall@example.com' }, context);

    expect(innerExecute).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect((result.output as { messageId?: string }).messageId).toBe('real-id');
  });
});
