/**
 * Derive `PluginStepProperty[]` from a zod object schema.
 *
 * Plugin authors who use zod can stop writing the schema twice:
 *
 *   import { z } from 'zod';
 *   import { defineStep, propertiesFromZod } from '@operari/sdk/steps';
 *
 *   const schema = z.object({
 *     webhook: z.string().url().describe('Slack webhook URL'),
 *     message: z.string().describe('Message body'),
 *     severity: z.enum(['info', 'warning', 'error']).default('info'),
 *     verbose: z.boolean().default(false).describe('Include the full payload'),
 *   });
 *
 *   export default defineStep({
 *     type: 'myorg.slack-notify',
 *     configSchema: schema,
 *     properties: propertiesFromZod(schema),  // ← form auto-generated
 *     execute: async (config, context) => { ... },
 *   });
 *
 * Why a duck-typed implementation: we want zod to be an optional peer
 * dep — plugin authors using yup or arktype shouldn't pay the zod
 * install cost. Importing zod at compile time would force it into
 * every consumer's bundle. So we read `_def.typeName` at runtime and
 * leave zod's TypeScript types out of the build entirely.
 *
 * Mappings (zod type → property type):
 *
 *   ZodString          → string
 *   ZodNumber          → number
 *   ZodBoolean         → boolean
 *   ZodEnum            → options (built from .options)
 *   ZodNativeEnum      → options (string-keyed enums only)
 *   ZodLiteral<string> → options (single choice — useful for fixed kinds)
 *   ZodOptional<T>     → unwrap T
 *   ZodNullable<T>     → unwrap T
 *   ZodDefault<T>      → unwrap T + carry default value
 *   ZodEffects<T>      → unwrap T (covers .refine + .transform)
 *
 * Anything else is dropped silently — the editor falls back to its
 * normal JSON textarea fallback for that field. We deliberately do
 * NOT throw on unknown shapes because adding an unsupported zod type
 * (ZodIntersection, ZodUnion of primitives, etc.) shouldn't break a
 * plugin that uses the helper for the supported subset and writes
 * the rest of the form by hand.
 */

import type { PluginStepProperty } from './types';

/** Minimal duck-type for the zod runtime values we touch. */
interface ZodLikeDef {
  typeName?: string;
  innerType?: ZodLike;
  schema?: ZodLike;
  defaultValue?: () => unknown;
  values?: readonly string[];
  value?: unknown;
}

interface ZodLike {
  _def?: ZodLikeDef;
  description?: string;
  shape?: Record<string, ZodLike>;
}

interface ZodLikeObject extends ZodLike {
  shape: Record<string, ZodLike>;
}

function isZodLikeObject(value: unknown): value is ZodLikeObject {
  if (!value || typeof value !== 'object') return false;
  const v = value as ZodLike;
  return v._def?.typeName === 'ZodObject' && typeof v.shape === 'object' && v.shape !== null;
}

function unwrap(schema: ZodLike): { inner: ZodLike; defaultValue: unknown | undefined } {
  let current: ZodLike = schema;
  let defaultValue: unknown | undefined;

  // Unwrap up to a fixed depth — a deeply nested chain like
  // .optional().nullable().default(x).optional() is unusual but the
  // bound stops a malformed schema from looping forever.
  for (let i = 0; i < 8; i++) {
    const def = current._def;
    if (!def) break;
    if (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable') {
      if (def.innerType) {
        current = def.innerType;
        continue;
      }
    }
    if (def.typeName === 'ZodDefault') {
      if (typeof def.defaultValue === 'function') {
        try {
          defaultValue = def.defaultValue();
        } catch {
          // Default factory threw at introspection time — skip it,
          // the runtime parse() will surface the real error.
        }
      }
      if (def.innerType) {
        current = def.innerType;
        continue;
      }
    }
    if (def.typeName === 'ZodEffects') {
      // .refine() / .transform() wrap an inner schema we can read.
      if (def.schema) {
        current = def.schema;
        continue;
      }
    }
    break;
  }

  return { inner: current, defaultValue };
}

function describePropertyType(
  inner: ZodLike
): { type: PluginStepProperty['type']; options?: PluginStepProperty['options'] } | null {
  const typeName = inner._def?.typeName;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum': {
      const values = inner._def?.values ?? [];
      return {
        type: 'options',
        options: values.map(v => ({ name: v, value: v })),
      };
    }
    case 'ZodNativeEnum': {
      // ZodNativeEnum stores the enum object on _def.values. We
      // only support string values here; numeric enums become
      // option pairs with the numeric value coerced to string,
      // which is rarely what an author wants — fall through.
      const dict = (inner._def?.values ?? {}) as Record<string, unknown>;
      const entries = Object.entries(dict).filter(([, v]) => typeof v === 'string');
      if (entries.length === 0) return null;
      return {
        type: 'options',
        options: entries.map(([k, v]) => ({ name: k, value: String(v) })),
      };
    }
    case 'ZodLiteral': {
      const value = inner._def?.value;
      if (typeof value !== 'string') return null;
      return {
        type: 'options',
        options: [{ name: value, value }],
      };
    }
    default:
      return null;
  }
}

/**
 * Convert a zod object schema into a `PluginStepProperty[]` the
 * Operari editor can render as a form. See the file header for the
 * supported zod-type → property-type mapping.
 *
 * Returns an empty array if the input is not a zod object — that
 * makes the function safe to call from any code path without a
 * defensive `if (schema instanceof z.ZodObject)` first.
 */
export function propertiesFromZod(schema: unknown): PluginStepProperty[] {
  if (!isZodLikeObject(schema)) return [];

  const props: PluginStepProperty[] = [];
  for (const [name, field] of Object.entries(schema.shape)) {
    const { inner, defaultValue } = unwrap(field);
    const described = describePropertyType(inner);
    if (!described) continue;

    const property: PluginStepProperty = {
      name,
      displayName: humanize(name),
      type: described.type,
    };
    if (described.options) property.options = described.options;
    if (typeof field.description === 'string' && field.description.length > 0) {
      property.description = field.description;
    } else if (typeof inner.description === 'string' && inner.description.length > 0) {
      // .optional() / .nullable() drop descriptions onto the wrapper;
      // surface the inner description if the wrapper's is empty.
      property.description = inner.description;
    }
    if (defaultValue !== undefined) {
      property.default = defaultValue;
    }
    props.push(property);
  }
  return props;
}

/**
 * Convert a camelCase / snake_case key into a human-readable label.
 * `webhookUrl` → `Webhook url`. Authors who want a different label
 * can override by writing the property by hand instead of using
 * propertiesFromZod, or by post-processing the returned array.
 */
function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
