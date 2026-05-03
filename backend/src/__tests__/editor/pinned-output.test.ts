/**
 * Pin-data short-circuit lives in the NodeExecutor dispatcher: when
 * `node.config.__pinnedOutput` is set the executor for the step type
 * must NOT be invoked, and the pinned value flows straight through
 * as the node's output.
 */

import { PrismaClient } from '@prisma/client';

import { NodeExecutor } from '../../editor/node-executor.service';
import type { WorkflowNode } from '../../types/runbook.types';

jest.mock('../../services/logger.service', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      child: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      }),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

const mockPrisma = {} as unknown as PrismaClient;

function buildNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'n1',
    type: 'shell',
    title: 'echo',
    position: { x: 0, y: 0 },
    config: {},
    ...overrides,
  } as WorkflowNode;
}

describe('NodeExecutor pinned-output short-circuit', () => {
  it('returns the pinned value without invoking any registered executor', async () => {
    const exec = new NodeExecutor(mockPrisma);
    // Capture the registry to confirm the shell executor is NOT
    // called — pin must short-circuit BEFORE the registry lookup
    // executes any side-effect.
    const registry = (exec as unknown as { registry: Map<string, { execute: jest.Mock }> })
      .registry;
    const shellExec = registry.get('shell');
    if (!shellExec) throw new Error('expected shell executor in default registry');
    const spy = jest.spyOn(shellExec, 'execute');

    const node = buildNode({
      config: {
        command: 'echo hi',
        __pinnedOutput: { stdout: 'pinned-value', exitCode: 0 },
      } as Record<string, unknown>,
    });

    const result = await exec.execute(node, {});
    expect(result).toEqual({ stdout: 'pinned-value', exitCode: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('honors pin in dry-run mode just the same', async () => {
    const exec = new NodeExecutor(mockPrisma);
    const node = buildNode({
      config: {
        command: 'rm -rf /',
        __pinnedOutput: 'safe-value',
      } as Record<string, unknown>,
    });
    const result = await exec.execute(node, {}, undefined, undefined, true);
    expect(result).toBe('safe-value');
  });

  it('falls through to the real executor when pin is undefined', async () => {
    const exec = new NodeExecutor(mockPrisma);
    const registry = (exec as unknown as { registry: Map<string, { execute: jest.Mock }> })
      .registry;
    const shellExec = registry.get('shell');
    if (!shellExec) throw new Error('expected shell executor in default registry');
    // Native runbook executors return a Result envelope. Mock a
    // success outcome so the dispatcher unwraps the output cleanly.
    const spy = jest.spyOn(shellExec, 'execute').mockResolvedValue({
      success: true,
      output: { stdout: 'real', exitCode: 0 },
    } as never);

    const node = buildNode({
      config: { command: 'echo hi' } as Record<string, unknown>,
    });
    const result = await exec.execute(node, {});
    expect(result).toEqual({ stdout: 'real', exitCode: 0 });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
