import type { DefineStepOptions, PluginContext, PluginResult, PluginStep } from './types';

/**
 * Author a custom step executor loaded by Operari at boot.
 *
 * Usage:
 *   import { defineStep } from '@operari/sdk/steps';
 *   import { z } from 'zod';
 *
 *   export default defineStep({
 *     type: 'myorg.slack-notify',
 *     configSchema: z.object({
 *       webhook: z.string().url(),
 *       message: z.string(),
 *     }),
 *     async execute(config, context) {
 *       await fetch(config.webhook, {
 *         method: 'POST',
 *         body: JSON.stringify({ text: config.message }),
 *       });
 *       return { success: true, output: { delivered: true } };
 *     },
 *   });
 *
 * What this helper adds on top of a plain object:
 *   - Runtime validation: the backend plugin loader calls
 *     `configSchema.parse(rawConfig)` before invoking `execute`, so
 *     `config` inside `execute` is fully-typed and valid-by-construction.
 *   - A consistent shape the loader can recognize (type + configSchema
 *     + execute all required) — the loader rejects plugins missing any.
 *   - Error wrapping: throws from `execute` are converted into
 *     `{ success: false, error: <message> }` results by the runtime.
 *
 * `defineStep` itself does not execute anything; it only produces the
 * descriptor object. The backend loader reads this descriptor and
 * registers the step in its executor registry at boot.
 */
export function defineStep<TConfig>(options: DefineStepOptions<TConfig>): PluginStep<TConfig> {
  if (!options || typeof options !== 'object') {
    throw new TypeError('defineStep: options object is required');
  }
  if (typeof options.type !== 'string' || options.type.length === 0) {
    throw new TypeError('defineStep: options.type must be a non-empty string');
  }
  if (!options.configSchema || typeof options.configSchema.parse !== 'function') {
    throw new TypeError('defineStep: options.configSchema must have a parse(input) method');
  }
  if (typeof options.execute !== 'function') {
    throw new TypeError('defineStep: options.execute must be a function');
  }

  // Reserved prefixes are enforced at the loader level (so messages
  // include the plugin path), not here. The helper only checks the
  // shape. That keeps defineStep usable in unit tests without a
  // loader attached.

  return {
    type: options.type,
    configSchema: options.configSchema,
    execute: options.execute,
    // Visual + form metadata. All optional. The backend loader picks
    // these up and upserts a NodeType row at boot so the editor's
    // palette + PropertiesPanel render this plugin like a built-in.
    label: options.label,
    description: options.description,
    icon: options.icon,
    color: options.color,
    category: options.category,
    inputs: options.inputs,
    outputs: options.outputs,
    properties: options.properties,
  };
}

export type {
  DefineStepOptions,
  PluginContext,
  PluginResult,
  PluginStep,
  PluginStepLocalized,
  PluginStepMetadata,
  PluginStepProperty,
} from './types';
