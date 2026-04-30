import fs from 'fs';
import path from 'path';

import { logger } from '../../config/logger.config';
import { ExecutorContext, ExecutorResult, StepExecutor } from '../types/executor.types';
import { spawnPythonStep } from './python-bridge';

/**
 * Plugin loader — turns user-authored `defineStep(...)` bundles on
 * disk into `StepExecutor` instances the runbook engine can call.
 *
 * Shape of the directory OPERARI_PLUGINS_DIR points at:
 *
 *   <dir>/
 *     some-plugin/
 *       package.json        { "name": "some-plugin", "operari": { "steps": ["./index.js"] } }
 *       index.js            (CommonJS or ESM; default export is the defineStep() descriptor)
 *     another-plugin/
 *       package.json
 *       dist/my-step.js
 *
 * Behavior:
 *   - No dir / empty dir → return [] silently. Self-host users with
 *     no plugins installed should see no log noise.
 *   - Missing `operari.steps` (or legacy `operari.steps`) in package.json
 *     → skip the directory with a warning. A sibling directory being
 *     a leftover npm dep (no manifest) is not an error, just a no-op.
 *   - Plugin fails to load (throw at require, default export missing,
 *     wrong shape, or type collision with a built-in) → skip that one
 *     plugin with an error log and continue. Never crash boot on a
 *     single bad plugin.
 *   - Duplicate type across plugins → first wins, second warns.
 */

/**
 * Reserved type prefixes or exact names that plugins may NOT override.
 * A plugin that tries to claim `shell` or `operari.*` gets skipped.
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

const RESERVED_PREFIXES = ['operari.'];

function isReservedType(type: string): boolean {
  if (RESERVED_EXACT.has(type)) return true;
  return RESERVED_PREFIXES.some(p => type.startsWith(p));
}

interface PluginManifest {
  entries: string[];
  name: string;
  pluginDir: string;
}

/**
 * Visual + form metadata picked up from the plugin descriptor.
 * Plumbed through to a NodeType row so the editor's palette and
 * PropertiesPanel render this plugin like a built-in. Every field is
 * optional — a plugin that doesn't supply any still loads + executes,
 * it just gets a default placeholder appearance.
 */
export interface PluginNodeMetadata {
  type: string;
  source: string;
  label?: unknown;
  description?: unknown;
  icon?: string;
  color?: string;
  category?: string;
  inputs?: unknown[];
  outputs?: unknown[];
  properties?: unknown[];
}

interface LoadedPlugin {
  type: string;
  schema: { parse: (input: unknown) => unknown };
  execute: (config: unknown, context: PluginContextLike) => Promise<PluginResultLike>;
  source: string;
  metadata: PluginNodeMetadata;
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
      operari?: { steps?: unknown };
    };
    const stepsField = json.operari?.steps;
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

/**
 * Standalone Python plugin manifest: `<plugin-dir>/operari.json`.
 *
 * Format:
 * ```json
 * {
 *   "type": "myorg.hello-world",
 *   "language": "python",
 *   "entry": "hello_step.py",
 *   "label": { "en": "Hello world", "es": "Hola mundo" },
 *   "icon": "MessageSquare",
 *   "color": "bg-emerald-500",
 *   "category": "custom",
 *   "properties": [...]
 * }
 * ```
 *
 * Visual + form metadata lives on the manifest (not on the Python
 * descriptor) because the loader can't introspect a Python module
 * without running it. Authors who want auto-form behavior duplicate
 * the metadata between operari.json (for the loader) and the
 * Python `define_step` call (for IDE completion + future
 * --dump-metadata mode). The duplication is small and intentional —
 * decoupling the loader from the Python runtime keeps boot fast
 * and avoids a chicken-and-egg failure when Python is missing.
 */
interface OperariJsonManifest {
  type: string;
  language?: 'python' | 'node';
  entry: string;
  label?: unknown;
  description?: unknown;
  icon?: unknown;
  color?: unknown;
  category?: unknown;
  inputs?: unknown;
  outputs?: unknown;
  properties?: unknown;
  pythonBin?: string;
  timeoutMs?: number;
}

function readOperariJson(pluginDir: string): OperariJsonManifest | null {
  const manifestPath = path.join(pluginDir, 'operari.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const json = JSON.parse(raw) as OperariJsonManifest;
    if (typeof json.type !== 'string' || !json.type) {
      logger.warn({ pluginDir, msg: 'plugin_loader: operari.json missing type' });
      return null;
    }
    if (typeof json.entry !== 'string' || !json.entry) {
      logger.warn({ pluginDir, msg: 'plugin_loader: operari.json missing entry' });
      return null;
    }
    return json;
  } catch (err) {
    logger.warn({
      pluginDir,
      err: err instanceof Error ? err.message : String(err),
      msg: 'plugin_loader: failed to read operari.json',
    });
    return null;
  }
}

/**
 * Build a `LoadedPlugin` for a Python-language plugin. The Python
 * runtime parses + validates the config (the Python `define_step`
 * helper enforces it), so the Node-side schema is a passthrough.
 * `execute` is a thin wrapper around the subprocess bridge.
 */
function loadPythonDescriptor(
  pluginDir: string,
  pluginName: string,
  manifest: OperariJsonManifest
): LoadedPlugin | null {
  const resolvedEntry = path.resolve(pluginDir, manifest.entry);
  if (!fs.existsSync(resolvedEntry)) {
    logger.warn({
      plugin: pluginName,
      entry: manifest.entry,
      msg: 'plugin_loader: python entry file not found',
    });
    return null;
  }

  if (isReservedType(manifest.type)) {
    logger.error({
      plugin: pluginName,
      type: manifest.type,
      msg: 'plugin_loader: type is reserved by core — python plugin rejected',
    });
    return null;
  }

  const source = `${pluginName}:${manifest.entry}`;
  const metadata: PluginNodeMetadata = {
    type: manifest.type,
    source,
    label: manifest.label,
    description: manifest.description,
    icon: typeof manifest.icon === 'string' ? manifest.icon : undefined,
    color: typeof manifest.color === 'string' ? manifest.color : undefined,
    category: typeof manifest.category === 'string' ? manifest.category : undefined,
    inputs: Array.isArray(manifest.inputs) ? manifest.inputs : undefined,
    outputs: Array.isArray(manifest.outputs) ? manifest.outputs : undefined,
    properties: Array.isArray(manifest.properties) ? manifest.properties : undefined,
  };

  return {
    type: manifest.type,
    // Schema is a passthrough — the Python runtime validates and
    // emits an `error` in the RESULT line if the config is bad.
    schema: { parse: (input: unknown) => input },
    execute: async (config, context) => {
      return spawnPythonStep(config, context, {
        entry: resolvedEntry,
        cwd: pluginDir,
        pythonBin: manifest.pythonBin,
        timeoutMs: manifest.timeoutMs,
        env: { OPERARI_PLUGIN_TYPE: manifest.type },
      });
    },
    source,
    metadata,
  };
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
  const candidate = (mod as { default?: unknown })?.default ?? mod;

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
    label?: unknown;
    description?: unknown;
    icon?: unknown;
    color?: unknown;
    category?: unknown;
    inputs?: unknown;
    outputs?: unknown;
    properties?: unknown;
  };

  if (isReservedType(descriptor.type)) {
    logger.error({
      plugin: manifest.name,
      type: descriptor.type,
      msg: 'plugin_loader: type is reserved by core — plugin rejected',
    });
    return null;
  }

  const source = `${manifest.name}:${entry}`;
  const metadata: PluginNodeMetadata = {
    type: descriptor.type,
    source,
    label: descriptor.label,
    description: descriptor.description,
    icon: typeof descriptor.icon === 'string' ? descriptor.icon : undefined,
    color: typeof descriptor.color === 'string' ? descriptor.color : undefined,
    category: typeof descriptor.category === 'string' ? descriptor.category : undefined,
    inputs: Array.isArray(descriptor.inputs) ? descriptor.inputs : undefined,
    outputs: Array.isArray(descriptor.outputs) ? descriptor.outputs : undefined,
    properties: Array.isArray(descriptor.properties) ? descriptor.properties : undefined,
  };

  return {
    type: descriptor.type,
    schema: descriptor.configSchema,
    execute: descriptor.execute,
    source,
    metadata,
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
          emit: event =>
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
  /** Override the plugins directory (defaults to OPERARI_PLUGINS_DIR). */
  pluginsDir?: string;
  /**
   * Types already registered by the core. Used to reject plugin
   * overrides without having to maintain a duplicate RESERVED list.
   */
  registeredTypes?: ReadonlySet<string>;
}

export interface LoadPluginsResult {
  executors: StepExecutor[];
  /**
   * Visual + form metadata for every successfully-loaded plugin,
   * keyed by step type. The boot path passes this to
   * `upsertPluginNodeTypes` so the editor's NodePalette and
   * PropertiesPanel see plugin steps with proper icons + auto-forms.
   */
  manifests: PluginNodeMetadata[];
  /** For logging / diagnostics — not required by the registry. */
  loaded: string[];
  skipped: string[];
}

export function loadPluginsSync(options: LoadPluginsOptions = {}): LoadPluginsResult {
  const dir = options.pluginsDir ?? process.env.OPERARI_PLUGINS_DIR;
  const result: LoadPluginsResult = { executors: [], manifests: [], loaded: [], skipped: [] };

  if (!dir) return result;
  if (!fs.existsSync(dir)) {
    logger.debug({ pluginsDir: dir, msg: 'plugin_loader: dir does not exist, skipping' });
    return result;
  }

  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    logger.warn({ pluginsDir: dir, msg: 'plugin_loader: OPERARI_PLUGINS_DIR is not a directory' });
    return result;
  }

  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => path.join(dir, e.name));

  const claimedTypes = new Set<string>(options.registeredTypes ?? []);

  for (const pluginDir of entries) {
    const pluginName = path.basename(pluginDir);

    // Python (or any non-Node) plugin path: a standalone operari.json
    // declares language + entry + visual metadata. Read it first so a
    // directory that has BOTH operari.json and package.json picks the
    // explicit operari.json declaration.
    const operariJson = readOperariJson(pluginDir);
    if (operariJson) {
      const language = operariJson.language ?? 'node';
      if (language === 'python') {
        const loaded = loadPythonDescriptor(pluginDir, pluginName, operariJson);
        if (!loaded) {
          result.skipped.push(`${pluginName}:${operariJson.entry}`);
          continue;
        }
        if (claimedTypes.has(loaded.type)) {
          logger.warn({
            plugin: pluginName,
            type: loaded.type,
            msg: 'plugin_loader: type already registered — plugin skipped',
          });
          result.skipped.push(`${pluginName}:${operariJson.entry} (dup:${loaded.type})`);
          continue;
        }
        claimedTypes.add(loaded.type);
        result.executors.push(adaptToExecutor(loaded));
        result.manifests.push(loaded.metadata);
        result.loaded.push(`${pluginName}:${loaded.type}`);
        continue;
      }
      // Future: language === 'node' via operari.json. For now fall
      // through to the legacy package.json path below — if the
      // plugin only has operari.json (no package.json), we skip.
    }

    const manifest = readManifest(pluginDir);
    if (!manifest) {
      result.skipped.push(pluginName);
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
      result.manifests.push(loaded.metadata);
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
