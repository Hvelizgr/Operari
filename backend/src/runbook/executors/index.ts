import { PrismaClient } from '@prisma/client';
import { StepExecutor } from '../types/executor.types';
import { ShellExecutor } from './shell.executor';
import { ApprovalExecutor } from './approval.executor';
import { NotifyExecutor } from './notify.executor';
import { WaitExecutor } from './wait.executor';
import { SSHExecutor } from './ssh.executor';
import { HttpExecutor } from './http.executor';
import { DatabaseExecutor } from './database.executor';
import { RunbookExecutor } from './runbook.executor';
import { Runner } from '../runners/runner.types';
import { getRunner } from '../runners';
import { loadPluginsSync } from '../plugins/loader';

export { ShellExecutor } from './shell.executor';
export { ApprovalExecutor } from './approval.executor';
export { NotifyExecutor } from './notify.executor';
export { WaitExecutor } from './wait.executor';
export { SSHExecutor } from './ssh.executor';
export { HttpExecutor } from './http.executor';
export { DatabaseExecutor } from './database.executor';
export { RunbookExecutor } from './runbook.executor';

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
  options: ExecutorRegistryOptions = {}
): Map<string, StepExecutor> {
  const runner = options.runner ?? getRunner();

  const registry = new Map<string, StepExecutor>();

  registry.set('shell', new ShellExecutor(runner));
  registry.set('approval', new ApprovalExecutor(prisma));
  registry.set('notify', new NotifyExecutor());
  registry.set('wait', new WaitExecutor());
  registry.set('ssh', new SSHExecutor());
  registry.set('nanorun.httpRequest', new HttpExecutor());
  registry.set('nanorun.database', new DatabaseExecutor());
  registry.set('runbook', new RunbookExecutor(prisma));

  // User-authored plugins. Loaded from NANORUN_PLUGINS_DIR (opt-in
  // per deployment). The loader catches its own errors so a broken
  // plugin never prevents the core registry from being built; we
  // only skip the offending entry and log it.
  const registeredTypes = new Set<string>(registry.keys());
  const { executors: pluginExecutors } = loadPluginsSync({ registeredTypes });
  for (const executor of pluginExecutors) {
    registry.set(executor.type, executor);
  }

  return registry;
}
