import { realpathSync, watch, type FSWatcher } from 'node:fs';
import * as path from 'node:path';

import type { PrismaClient } from '@prisma/client';

import { logger } from '../../config/logger.config';
import { installLivePlugins } from './live-registry';
import { loadPluginsSync } from './loader';
import { upsertPluginNodeTypes } from './upsert-node-types';

/**
 * Plugin hot-reload — watches OPERARI_PLUGINS_DIR for file changes
 * and swaps the live plugin registry without restarting the backend.
 *
 * Mechanism:
 *   1. fs.watch (recursive) on the plugins dir.
 *   2. Coalesce bursts of events through a 250ms debounce — node
 *      module systems often touch several files when a build runs
 *      and we don't want to load 12 times back to back.
 *   3. Walk require.cache and delete entries whose `id` is under
 *      the plugins dir. Without this the next loadPluginsSync()
 *      gets the cached old module body.
 *   4. Re-run loadPluginsSync() with the same `registeredTypes`
 *      set the boot path used.
 *   5. installLivePlugins(executors) → dispatcher sees the new
 *      bytes on the next call.
 *   6. Re-upsert NodeType metadata so the editor catalog reflects
 *      manifest edits without a refresh.
 *
 * In-flight calls finish on the OLD executor (the dispatcher
 * captured the reference before swap). New calls get the new one.
 * No special in-flight handling — for a dev-only feature that's
 * the right tradeoff.
 *
 * Wired only when OPERARI_DEV_HOT_RELOAD_PLUGINS=true. The dev
 * orchestrator script (scripts/dev-with-plugins.mjs) sets it when
 * OPERARI_PLUGINS_DIR is configured. In production this code path
 * is dead — fs.watch is never installed.
 */

export interface InstallPluginWatcherOptions {
  prisma: PrismaClient;
  /** Override the plugins dir (defaults to OPERARI_PLUGINS_DIR). */
  pluginsDir?: string;
  /** Set of types claimed by core executors — passed to the loader
   *  so plugin overrides get rejected the same way the boot path
   *  rejects them. The boot path constructs this from the registry
   *  it just built. */
  registeredTypes: ReadonlySet<string>;
  /** Override the debounce window for tests. */
  debounceMs?: number;
}

export interface PluginWatcherHandle {
  stop(): void;
  /** Force a reload outside the watcher, e.g. from a test. */
  reloadNow(): Promise<void>;
}

export function installPluginWatcher(
  opts: InstallPluginWatcherOptions
): PluginWatcherHandle | null {
  const dir = opts.pluginsDir ?? process.env.OPERARI_PLUGINS_DIR;
  if (!dir) {
    logger.debug('plugin_hot_reload: OPERARI_PLUGINS_DIR not set — watcher not installed');
    return null;
  }

  let watcher: FSWatcher | null = null;
  let timer: NodeJS.Timeout | null = null;
  const debounceMs = opts.debounceMs ?? 250;

  const reload = async () => {
    timer = null;
    // Step 1: invalidate require.cache for files under the plugins
    // dir. require.cache keys are realpaths (symlinks resolved), so
    // we normalize the configured dir the same way to make
    // startsWith() match. Two prefixes — both the realpath and the
    // resolved path — because /tmp is sometimes a symlink to
    // /private/tmp (macOS) and we want to clear keys regardless of
    // which form the loader picked up.
    const resolved = path.resolve(dir);
    let realDir: string;
    try {
      realDir = realpathSync(resolved);
    } catch {
      realDir = resolved;
    }
    const prefixes = new Set([resolved + path.sep, realDir + path.sep]);
    let cleared = 0;
    for (const key of Object.keys(require.cache)) {
      for (const prefix of prefixes) {
        if (key.startsWith(prefix)) {
          delete require.cache[key];
          cleared++;
          break;
        }
      }
    }

    // Step 2: re-load. loadPluginsSync handles its own per-plugin
    // error catching — a broken plugin disappears from the live
    // map but doesn't tear down the watcher.
    const result = loadPluginsSync({
      pluginsDir: dir,
      registeredTypes: opts.registeredTypes,
    });

    // Step 3: swap into the live registry. Existing references in
    // flight finish on the old executor (snapshotted by closure).
    installLivePlugins(result.executors);

    // Step 4: re-upsert manifest metadata so the editor catalog
    // reflects rename / icon / description changes. Same fan-out
    // shape the boot path uses; errors logged not thrown.
    if (result.manifests.length > 0) {
      const globals = result.manifests.filter(m => !m.tenantId);
      const byTenant = new Map<string, typeof result.manifests>();
      for (const m of result.manifests) {
        if (!m.tenantId) continue;
        const list = byTenant.get(m.tenantId) ?? [];
        list.push(m);
        byTenant.set(m.tenantId, list);
      }
      if (globals.length > 0) {
        try {
          await upsertPluginNodeTypes(opts.prisma, globals);
        } catch (err) {
          logger.warn({ err, msg: 'plugin_hot_reload: globals upsert failed' });
        }
      }
      for (const [tenantId, scoped] of byTenant) {
        try {
          await upsertPluginNodeTypes(opts.prisma, scoped, tenantId);
        } catch (err) {
          logger.warn({ err, tenantId, msg: 'plugin_hot_reload: tenant upsert failed' });
        }
      }
    }

    logger.info({
      msg: 'plugin_hot_reload: reload complete',
      cleared,
      loaded: result.loaded.length,
      skipped: result.skipped.length,
    });
  };

  const onChange = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      reload().catch(err => {
        logger.error({ err, msg: 'plugin_hot_reload: reload failed' });
      });
    }, debounceMs);
  };

  try {
    watcher = watch(dir, { recursive: true }, onChange);
    logger.info({ msg: 'plugin_hot_reload: watcher installed', pluginsDir: dir });
  } catch (err) {
    // fs.watch can fail on platforms without recursive support
    // (older Linux kernels, some FUSE mounts). Log and stay alive
    // — the user falls back to manual restart.
    logger.warn({
      err,
      pluginsDir: dir,
      msg: 'plugin_hot_reload: fs.watch failed — falling back to no hot-reload',
    });
    return null;
  }

  return {
    stop() {
      if (timer) clearTimeout(timer);
      watcher?.close();
      watcher = null;
    },
    reloadNow: reload,
  };
}
