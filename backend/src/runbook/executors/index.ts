import { PrismaClient } from '@prisma/client';

import { BUILTIN_CATALOG, CatalogExecutor } from '../catalog';
import type { CatalogDeps } from '../catalog/define';
import { loadPluginsSync, type PluginNodeMetadata } from '../plugins/loader';
import { upsertPluginNodeTypes } from '../plugins/upsert-node-types';
import { getRunner } from '../runners';
import { Runner } from '../runners/runner.types';
import { StepExecutor } from '../types/executor.types';
import { ApprovalExecutor } from './approval.executor';
import { DatabaseExecutor } from './database.executor';
import { DatadogEventExecutor } from './datadog-event.executor';
import { EmailExecutor } from './email.executor';
import { GitHubCommitFileExecutor } from './github-commit-file.executor';
import { GitHubIssueExecutor } from './github-issue.executor';
import { GrafanaAnnotationExecutor } from './grafana-annotation.executor';
import { HttpExecutor } from './http.executor';
import { JiraExecutor } from './jira.executor';
import { NotifyExecutor } from './notify.executor';
import { OpsgenieExecutor } from './opsgenie.executor';
import { PagerDutyExecutor } from './pagerduty.executor';
import { RedisExecutor } from './redis.executor';
import { RunbookExecutor } from './runbook.executor';
import { ShellExecutor } from './shell.executor';
import { SSHExecutor } from './ssh.executor';
import { TeamsExecutor } from './teams.executor';
import { TelegramExecutor } from './telegram.executor';
import {
  CryptoExecutor,
  DateTimeExecutor,
  SetExecutor,
  StopAndErrorExecutor,
} from './transform.executor';
import { WaitExecutor } from './wait.executor';

export { ApprovalExecutor } from './approval.executor';
export { DatabaseExecutor } from './database.executor';
export { DatadogEventExecutor } from './datadog-event.executor';
export { EmailExecutor } from './email.executor';
export { GitHubCommitFileExecutor } from './github-commit-file.executor';
export { GitHubIssueExecutor } from './github-issue.executor';
export { GrafanaAnnotationExecutor } from './grafana-annotation.executor';
export { HttpExecutor } from './http.executor';
export { JiraExecutor } from './jira.executor';
export { NotifyExecutor } from './notify.executor';
export { OpsgenieExecutor } from './opsgenie.executor';
export { PagerDutyExecutor } from './pagerduty.executor';
export { RedisExecutor } from './redis.executor';
export { RunbookExecutor } from './runbook.executor';
export { ShellExecutor } from './shell.executor';
export { SSHExecutor } from './ssh.executor';
export { TeamsExecutor } from './teams.executor';
export { TelegramExecutor } from './telegram.executor';
export {
  CryptoExecutor,
  DateTimeExecutor,
  SetExecutor,
  StopAndErrorExecutor,
} from './transform.executor';
export { WaitExecutor } from './wait.executor';

export interface ExecutorRegistryOptions {
  /**
   * Runner used by command-executing steps (shell, future http/kubectl).
   * If not provided, builds one from process.env via runnerOptionsFromEnv().
   */
  runner?: Runner;
}

/**
 * Registry of all available step executors in Operari.
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
  registry.set('operari.httpRequest', new HttpExecutor());
  registry.set('operari.database', new DatabaseExecutor());
  registry.set('github.commitFile', new GitHubCommitFileExecutor());
  registry.set('runbook', new RunbookExecutor(prisma));

  // Integrations and data steps modelled on the n8n nodes on-call
  // runbooks reach for most.
  for (const executor of [
    new PagerDutyExecutor(),
    new OpsgenieExecutor(),
    new JiraExecutor(),
    new GitHubIssueExecutor(),
    new TeamsExecutor(),
    new TelegramExecutor(),
    new EmailExecutor(),
    new DatadogEventExecutor(),
    new GrafanaAnnotationExecutor(),
    new RedisExecutor(),
    new SetExecutor(),
    new CryptoExecutor(),
    new DateTimeExecutor(),
    new StopAndErrorExecutor(),
  ]) {
    registry.set(executor.type, executor);
  }

  const catalogDeps = {
    shell: registry.get('shell') as CatalogDeps['shell'],
    findAccount: (id: string, tenantId: string) =>
      prisma.connectedAccount.findFirst({
        where: { id, tenantId },
        select: { provider: true, metadata: true },
      }),
  };
  for (const node of BUILTIN_CATALOG) {
    if (!registry.has(node.type))
      registry.set(node.type, new CatalogExecutor(node, fetch, catalogDeps));
  }

  // User-authored plugins. Loaded from OPERARI_PLUGINS_DIR (opt-in
  // per deployment). The loader catches its own errors so a broken
  // plugin never prevents the core registry from being built; we
  // only skip the offending entry and log it.
  //
  // Registry keys for plugins:
  //   - Global plugin (tenantId === undefined): key is just `${type}`
  //   - Tenant-scoped plugin: key is `${tenantId}::${type}`
  // The dispatcher tries the tenant-scoped key first, then falls back
  // to the global key. Two tenants can independently install a plugin
  // claiming the same type name without colliding (ADR 0006).
  const registeredTypes = new Set<string>(registry.keys());
  const { executors: pluginExecutors, manifests } = loadPluginsSync({ registeredTypes });
  for (const executor of pluginExecutors) {
    const key = executor.tenantId ? `${executor.tenantId}::${executor.type}` : executor.type;
    registry.set(key, executor);
  }

  // Bridge plugin metadata to the editor catalog. Async + fire-and-
  // forget on purpose: a slow / unreachable database must not stall
  // the runtime registry build, and the editor surface comes back
  // online on the next boot anyway. Per-tenant manifests get upserted
  // with their tenantId so NodeType rows reflect the same scoping.
  if (manifests.length > 0) {
    const globals = manifests.filter(m => !m.tenantId);
    const byTenant = new Map<string, PluginNodeMetadata[]>();
    for (const m of manifests) {
      if (!m.tenantId) continue;
      const list = byTenant.get(m.tenantId) ?? [];
      list.push(m);
      byTenant.set(m.tenantId, list);
    }
    if (globals.length > 0) {
      void upsertPluginNodeTypes(prisma, globals).catch(() => undefined);
    }
    for (const [tenantId, scoped] of byTenant) {
      void upsertPluginNodeTypes(prisma, scoped, tenantId).catch(() => undefined);
    }
  }
  lastLoadedPluginManifests = manifests;

  return registry;
}

/**
 * Read-only accessor for the manifests captured by the most recent
 * `createExecutorRegistry` call. Intended for diagnostics + tests
 * that want to verify the plugin discovery side-effect without
 * inspecting Postgres.
 */
let lastLoadedPluginManifests: PluginNodeMetadata[] = [];
export function getLoadedPluginManifests(): readonly PluginNodeMetadata[] {
  return lastLoadedPluginManifests;
}
