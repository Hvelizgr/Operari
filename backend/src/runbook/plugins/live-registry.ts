import { logger } from '../../config/logger.config';
import type { StepExecutor } from '../types/executor.types';

/**
 * Live plugin registry — module-level singleton consulted by the
 * dispatcher before falling back to its own captured registry.
 *
 * Why this exists:
 *   The captured registry on each NodeExecutorService instance is
 *   built once at construction. A plugin file change at dev time
 *   needs to swap the executor everywhere without rebuilding every
 *   service instance, every cached registry, every reference held
 *   in flight. Routing plugin lookups through this singleton means
 *   one mutation and the whole system sees the new bytes.
 *
 * Production behaviour:
 *   In production we still call `installLivePlugins()` once at
 *   boot — the live map is identical to what the captured registry
 *   would have had, so the dispatcher's "live first, captured
 *   second" lookup is a no-op cost (one extra Map.get on the hot
 *   path).
 *
 * Dev hot-reload:
 *   `installLivePlugins()` is called again whenever the dev
 *   watcher fires; the new executors replace the old in place.
 *   In-flight calls finish on the OLD executor (the dispatcher
 *   captured a reference before swap); the next call gets the new
 *   one. No special in-flight handling — for a dev-only feature
 *   that's the right tradeoff.
 *
 * Key shape (mirrors the loader):
 *   - global plugin: `<type>`           (e.g. "example.slack-notify")
 *   - tenant-scoped: `<tenantId>::<type>`
 */

const liveRegistry: Map<string, StepExecutor> = new Map();

/**
 * Replace the live registry's contents with a fresh set of plugin
 * executors. Called once at boot from createExecutorRegistry; called
 * again on every dev-mode reload from the plugin watcher.
 *
 * Implemented as clear-then-set rather than diff-and-update so a
 * plugin that was deleted between loads disappears from the registry
 * — same shape any other consumer would get from a fresh load.
 */
export function installLivePlugins(executors: StepExecutor[]): void {
  liveRegistry.clear();
  for (const executor of executors) {
    const key = executor.tenantId ? `${executor.tenantId}::${executor.type}` : executor.type;
    liveRegistry.set(key, executor);
  }
  logger.debug({ count: executors.length, msg: 'live_plugin_registry: refreshed' });
}

/**
 * Look up a plugin executor by key. Returns undefined for core types
 * (the dispatcher then falls back to its captured registry).
 *
 * Two-key lookup mirrors the dispatcher's existing pattern so a
 * tenant-scoped plugin shadows a global with the same type name.
 */
export function getLivePlugin(
  type: string,
  tenantId: string | undefined
): StepExecutor | undefined {
  if (tenantId) {
    const scoped = liveRegistry.get(`${tenantId}::${type}`);
    if (scoped) return scoped;
  }
  return liveRegistry.get(type);
}

/** Diagnostics + tests. */
export function liveRegistrySize(): number {
  return liveRegistry.size;
}
