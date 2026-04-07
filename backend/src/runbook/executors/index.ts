import { PrismaClient } from '@prisma/client';
import { StepExecutor } from '../types/executor.types';
import { ShellExecutor } from './shell.executor';
import { ApprovalExecutor } from './approval.executor';
import { NotifyExecutor } from './notify.executor';
import { WaitExecutor } from './wait.executor';
import { Runner } from '../runners/runner.types';
import { getRunner } from '../runners';

export { ShellExecutor } from './shell.executor';
export { ApprovalExecutor } from './approval.executor';
export { NotifyExecutor } from './notify.executor';
export { WaitExecutor } from './wait.executor';

export interface ExecutorRegistryOptions {
    /**
     * Runner used by command-executing steps (shell, future http/kubectl).
     * If not provided, builds one from process.env via runnerOptionsFromEnv().
     */
    runner?: Runner;
}

/**
 * Registry of all available step executors in NanoRun.
 *
 * To add a new node type:
 *   1. Create a new file in this directory implementing StepExecutor
 *   2. Register it in createExecutorRegistry() below
 *   3. Add the corresponding node palette entry in the frontend
 */
export function createExecutorRegistry(
    prisma: PrismaClient,
    options: ExecutorRegistryOptions = {},
): Map<string, StepExecutor> {
    const runner = options.runner ?? getRunner();

    const registry = new Map<string, StepExecutor>();

    registry.set('shell', new ShellExecutor(runner));
    registry.set('approval', new ApprovalExecutor(prisma));
    registry.set('notify', new NotifyExecutor());
    registry.set('wait', new WaitExecutor());

    return registry;
}
