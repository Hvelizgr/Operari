import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger.config';
import {
    StepExecutor,
    ExecutorContext,
    ExecutorResult,
} from '../types/executor.types';

/**
 * Plugin loader — turns user-authored `defineStep(...)` bundles on
 * disk into `StepExecutor` instances the runbook engine can call.
 *
 * Shape of the directory NANORUN_PLUGINS_DIR points at:
 *
 *   <dir>/
 *     some-plugin/
 *       package.json        { "name": "some-plugin", "cairn": { "steps": ["./index.js"] } }
 *       index.js            (CommonJS or ESM; default export is the defineStep() descriptor)
 *     another-plugin/
 *       package.json
 *       dist/my-step.js
 *
 * Behavior:
 *   - No dir / empty dir → return [] silently. Self-host users with
 *     no plugins installed should see no log noise.
 *   - Missing `cairn.steps` in package.json → skip the directory with
 *     a warning. A sibling directory being a leftover npm dep (no
 *     manifest) is not an error, just a no-op.
 *   - Plugin fails to load (throw at require, default export missing,
 *     wrong shape, or type collision with a built-in) → skip that one
 *     plugin with an error log and continue. Never crash boot on a
 *     single bad plugin.
 *   - Duplicate type across plugins → first wins, second warns.
 */

/**
 * Reserved type prefixes or exact names that plugins may NOT override.
 * A plugin that tries to claim `shell` or `nanorun.*` gets skipped.
 */
const RESERVED_EXACT = new Set([
    'shell',
    'approval',
    'notify',
    'wait',
    'ssh',
    'runbook',
    'custom.frame',
    'custom.note',
]);

const RESERVED_PREFIXES = ['nanorun.', 'cairn.core.'];

function isReservedType(type: string): boolean {
    if (RESERVED_EXACT.has(type)) return true;
    return RESERVED_PREFIXES.some((p) => type.startsWith(p));
}

interface PluginManifest {
    entries: string[];
    name: string;
    pluginDir: string;
}

interface LoadedPlugin {
    type: string;
    schema: { parse: (input: unknown) => unknown };
    execute: (config: unknown, context: PluginContextLike) => Promise<PluginResultLike>;
    source: string;
}

/** Structural duck-type of a SDK PluginContext event. */
interface PluginContextLike {
    runId: string;
    stepId: string;
    tenantId: string;
    variables: Record<string, unknown>;
    previousOutputs: Record<string, unknown>;
    secrets: Record<string, string>;
    emit: (event: { type: string; text: string }) => void;
}

interface PluginResultLike {
    success: boolean;
    output?: Record<string, unknown>;
    error?: string;
}

function readManifest(pluginDir: string): PluginManifest | null {
    const manifestPath = path.join(pluginDir, 'package.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
        const raw = fs.readFileSync(manifestPath, 'utf8');
        const json = JSON.parse(raw) as {
            name?: string;
            cairn?: { steps?: unknown };
            nanorun?: { steps?: unknown };
        };
        const stepsField = json.cairn?.steps ?? json.nanorun?.steps;
        if (!Array.isArray(stepsField)) return null;
        const entries = stepsField.filter((e): e is string => typeof e === 'string');
        if (entries.length === 0) return null;
        return {
            entries,
            name: json.name ?? path.basename(pluginDir),
            pluginDir,
        };
    } catch (err) {
        logger.warn({
            pluginDir,
            err: err instanceof Error ? err.message : String(err),
            msg: 'plugin_loader: failed to read package.json',
        });
        return null;
    }
}

function loadDescriptor(manifest: PluginManifest, entry: string): LoadedPlugin | null {
    const resolved = path.resolve(manifest.pluginDir, entry);
    if (!fs.existsSync(resolved)) {
        logger.warn({
            plugin: manifest.name,
            entry,
            msg: 'plugin_loader: entry file not found',
        });
        return null;
    }

    let mod: unknown;
    try {
        /* eslint-disable-next-line @typescript-eslint/no-require-imports */
        mod = require(resolved);
    } catch (err) {
        logger.error({
            plugin: manifest.name,
            entry,
            err: err instanceof Error ? err.message : String(err),
            msg: 'plugin_loader: require() threw',
        });
        return null;
    }

    // Accept: ESM default export, CJS default export, or the module
    // object itself (for CJS `module.exports = defineStep(...)`).
    const candidate =
        (mod as { default?: unknown })?.default ?? mod;

    if (
        !candidate ||
        typeof candidate !== 'object' ||
        typeof (candidate as { type?: unknown }).type !== 'string' ||
        !(candidate as { configSchema?: { parse?: unknown } }).configSchema ||
        typeof (candidate as { configSchema: { parse?: unknown } }).configSchema.parse !== 'function' ||
        typeof (candidate as { execute?: unknown }).execute !== 'function'
    ) {
        logger.error({
            plugin: manifest.name,
            entry,
            msg: 'plugin_loader: default export is not a valid defineStep() descriptor',
        });
        return null;
    }

    const descriptor = candidate as {
        type: string;
        configSchema: { parse: (input: unknown) => unknown };
        execute: (config: unknown, context: PluginContextLike) => Promise<PluginResultLike>;
    };

    if (isReservedType(descriptor.type)) {
        logger.error({
            plugin: manifest.name,
            type: descriptor.type,
            msg: 'plugin_loader: type is reserved by core — plugin rejected',
        });
        return null;
    }

    return {
        type: descriptor.type,
        schema: descriptor.configSchema,
        execute: descriptor.execute,
        source: `${manifest.name}:${entry}`,
    };
}

/**
 * Turn a loaded plugin descriptor into the backend's StepExecutor
 * contract. Catches schema validation failures + execute throws so
 * a buggy plugin never escapes to the engine uncaught.
 */
function adaptToExecutor(plugin: LoadedPlugin): StepExecutor {
    return {
        type: plugin.type,
        async execute(config: unknown, context: ExecutorContext): Promise<ExecutorResult> {
            const startTime = Date.now();
            let parsed: unknown;
            try {
                parsed = plugin.schema.parse(config);
            } catch (err) {
                return {
                    success: false,
                    error: `${plugin.source}: invalid config — ${err instanceof Error ? err.message : String(err)}`,
                    duration: Date.now() - startTime,
                };
            }
            try {
                const result = await plugin.execute(parsed, {
                    runId: context.runId,
                    stepId: context.stepId,
                    tenantId: context.tenantId,
                    variables: context.variables,
                    previousOutputs: context.previousOutputs,
                    secrets: context.secrets ?? {},
                    emit: (event) =>
                        context.emit?.({
                            type: event.type as 'stdout' | 'stderr' | 'log' | 'progress',
                            text: event.text,
                            timestamp: new Date(),
                        }),
                });
                return {
                    success: Boolean(result?.success),
                    output: result?.output,
                    error: result?.error,
                    duration: Date.now() - startTime,
                };
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                    duration: Date.now() - startTime,
                };
            }
        },
    };
}

export interface LoadPluginsOptions {
    /** Override the plugins directory (defaults to NANORUN_PLUGINS_DIR). */
    pluginsDir?: string;
    /**
     * Types already registered by the core. Used to reject plugin
     * overrides without having to maintain a duplicate RESERVED list.
     */
    registeredTypes?: ReadonlySet<string>;
}

export interface LoadPluginsResult {
    executors: StepExecutor[];
    /** For logging / diagnostics — not required by the registry. */
    loaded: string[];
    skipped: string[];
}

export function loadPluginsSync(options: LoadPluginsOptions = {}): LoadPluginsResult {
    const dir = options.pluginsDir ?? process.env.NANORUN_PLUGINS_DIR;
    const result: LoadPluginsResult = { executors: [], loaded: [], skipped: [] };

    if (!dir) return result;
    if (!fs.existsSync(dir)) {
        logger.debug({ pluginsDir: dir, msg: 'plugin_loader: dir does not exist, skipping' });
        return result;
    }

    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
        logger.warn({ pluginsDir: dir, msg: 'plugin_loader: NANORUN_PLUGINS_DIR is not a directory' });
        return result;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(dir, e.name));

    const claimedTypes = new Set<string>(options.registeredTypes ?? []);

    for (const pluginDir of entries) {
        const manifest = readManifest(pluginDir);
        if (!manifest) {
            result.skipped.push(path.basename(pluginDir));
            continue;
        }

        for (const entry of manifest.entries) {
            const loaded = loadDescriptor(manifest, entry);
            if (!loaded) {
                result.skipped.push(`${manifest.name}:${entry}`);
                continue;
            }
            if (claimedTypes.has(loaded.type)) {
                logger.warn({
                    plugin: manifest.name,
                    type: loaded.type,
                    msg: 'plugin_loader: type already registered — plugin skipped',
                });
                result.skipped.push(`${manifest.name}:${entry} (dup:${loaded.type})`);
                continue;
            }
            claimedTypes.add(loaded.type);
            result.executors.push(adaptToExecutor(loaded));
            result.loaded.push(`${manifest.name}:${loaded.type}`);
        }
    }

    if (result.loaded.length > 0 || result.skipped.length > 0) {
        logger.info({
            pluginsDir: dir,
            loaded: result.loaded,
            skipped: result.skipped,
            msg: 'plugin_loader: summary',
        });
    }

    return result;
}
