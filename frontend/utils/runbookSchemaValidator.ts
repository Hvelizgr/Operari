/**
 * Frontend JSON Schema validator for runbook specs.
 *
 * Loads the canonical schema from the backend at /runbook.schema.json
 * (the same file referenced by the VS Code yaml extension via the
 * `# yaml-language-server: $schema=...` directive in the templates).
 * Caches the compiled validator after the first call so subsequent
 * saves are cheap.
 *
 * The validator runs *before* `specToNodes` so the operator gets
 * structural feedback (missing fields, bad enum values, type errors)
 * with line-aware messages, not just the catch-all "Step "x" → unknown
 * step" raised by the legacy semantic checker.
 */
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let cachedValidator: ValidateFunction | null = null;
let inflight: Promise<ValidateFunction> | null = null;

/**
 * Inline fallback schema used when the backend is unreachable. This is
 * a copy of backend/src/runbook/yaml/runbook.schema.json — keep them
 * in sync by re-copying when the canonical schema changes. The
 * drift-guard test in `__tests__/utils/runbookSchemaValidator.test.ts`
 * fails the build if this copy diverges from the canonical.
 */
export const FALLBACK_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://operari.dev/schemas/runbook.schema.json',
  title: 'Operari Runbook',
  description:
    'Canonical YAML/JSON schema for a Operari runbook. Mirrors backend/src/runbook/yaml/runbook-spec.ts. Used by the editor for save-time validation, by the CLI for `operari lint`, and by VS Code via yaml.schemas to power autocomplete + inline diagnostics.',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'name', 'steps'],
  properties: {
    version: {
      description: 'Schema version. Bump on breaking changes.',
      const: 1,
    },
    slug: {
      description:
        'Stable slug used by the CLI/SDK to reference this runbook (e.g. `deploy-frontend`).',
      type: 'string',
      pattern: '^[a-z0-9][a-z0-9-]*$',
      maxLength: 64,
    },
    name: {
      description: 'Human-readable name shown in the editor and run history.',
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    description: {
      description: 'Optional one-line description.',
      type: 'string',
      maxLength: 500,
    },
    category: {
      description: 'Free-form category for organisation, e.g. `deploy`, `migration`, `incident`.',
      type: 'string',
      maxLength: 64,
    },
    schedule: {
      description:
        'Cron expression. Five fields, standard syntax. Validated against the scheduler at save time.',
      type: 'string',
    },
    vars: {
      description:
        'Variables exposed to every step at runtime via {{vars.foo}}. Values are arbitrary YAML — strings, numbers, objects, lists.',
      type: 'object',
      additionalProperties: true,
    },
    steps: {
      description: 'Ordered list of runbook steps. At least one step is required.',
      type: 'array',
      minItems: 1,
      items: { $ref: '#/definitions/RunbookStep' },
    },
  },
  definitions: {
    RunbookStep: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'type'],
      properties: {
        id: {
          description:
            'Unique slug-cased id within the runbook (e.g. `deploy-canary`). Appears in logs, retries, and `operari resume --from <id>`.',
          type: 'string',
          pattern: '^[a-z0-9][a-z0-9_-]*$',
          maxLength: 64,
        },
        type: {
          description:
            'Step type matching a registered executor. The curated catalog ships shell, http, approval, notify, wait, switch, loop, plus the operari.* prefixed integration steps. Unknown types fail at run time, not at save time, so custom executors registered at runtime are still valid here.',
          type: 'string',
          minLength: 1,
          maxLength: 128,
        },
        name: {
          description:
            'Human-readable label shown in the canvas and run timeline. Defaults to `id` if omitted.',
          type: 'string',
          maxLength: 200,
        },
        enabled: {
          description:
            'Whether the step runs. Defaults to true; setting to false disables it without removing it from the YAML.',
          type: 'boolean',
        },
        config: {
          description:
            'Type-specific configuration. The shape depends on the step `type`; the schema does not validate it because executors evolve independently.',
          type: 'object',
          additionalProperties: true,
        },
        retry: { $ref: '#/definitions/RetryPolicy' },
        runIf: {
          description:
            'Template expression evaluated before the step runs. Falsy → step is SKIPPED and execution continues. Mutually exclusive with `skipIf`; if both are set, `skipIf` wins.',
          type: 'string',
        },
        skipIf: {
          description:
            'Inverse of `runIf`. Truthy → step is SKIPPED. Useful for `skip on dry-run` patterns.',
          type: 'string',
        },
        next: {
          description:
            'Successor step id(s). Omit on the final step. Strings reference another step by id. The structured array form preserves source/target port indexes for non-default branching. The object form keys edges by branch label (e.g. `true`/`false` for operari.if, `approved`/`rejected` for approval, `case_1`/`default` for Switch) — value is either a step id string or a StepConnection.',
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { oneOf: [{ type: 'string' }, { $ref: '#/definitions/StepConnection' }] },
            },
            {
              type: 'object',
              additionalProperties: {
                oneOf: [{ type: 'string' }, { $ref: '#/definitions/StepConnection' }],
              },
            },
          ],
        },
        position: {
          description:
            'Editor-only metadata. Preserved on round-trip but YAML authors should never write it by hand.',
          type: 'object',
          additionalProperties: false,
          required: ['x', 'y'],
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
        },
      },
    },
    RetryPolicy: {
      description:
        'Per-step retry policy. Cross-cutting (every step type honours it) so it lives at the step level rather than inside `config`.',
      type: 'object',
      additionalProperties: false,
      required: ['count'],
      properties: {
        count: {
          description:
            'Extra attempts after the first failure (count: 3 ⇒ up to 4 total runs of the step).',
          type: 'integer',
          minimum: 1,
          maximum: 20,
        },
        backoff: {
          description:
            'Strategy for the wait between attempts. `fixed` waits `delayMs` between every retry; `exponential` doubles each retry up to `maxDelayMs`.',
          type: 'string',
          enum: ['fixed', 'exponential'],
        },
        delayMs: {
          description:
            'Base delay in milliseconds. For exponential backoff this is the first delay.',
          type: 'integer',
          minimum: 0,
        },
        maxDelayMs: {
          description:
            'Cap on backoff growth in milliseconds. Only meaningful for exponential backoff.',
          type: 'integer',
          minimum: 0,
        },
      },
    },
    StepConnection: {
      description:
        'Explicit successor edge with port indexes. Use the bare-string form unless you need non-default ports.',
      type: 'object',
      additionalProperties: false,
      required: ['to'],
      properties: {
        to: {
          description: 'Target step id.',
          type: 'string',
        },
        fromPort: {
          description: 'Source port index on this step. Defaults to 0.',
          type: 'integer',
          minimum: 0,
        },
        toPort: {
          description: 'Target port index on the destination step. Defaults to 0.',
          type: 'integer',
          minimum: 0,
        },
      },
    },
  },
};

function compileSchema(schema: Record<string, unknown>): ValidateFunction {
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

async function loadValidator(): Promise<ValidateFunction> {
  if (cachedValidator) return cachedValidator;
  if (inflight) return inflight;
  inflight = (async () => {
    // Try fetching the canonical schema from the backend first.
    // If unreachable, fall back to the bundled copy so validation
    // still works offline / during development without the backend.
    try {
      const res = await fetch(`${API_BASE}/runbook.schema.json`);
      if (res.ok) {
        const schema = await res.json();
        cachedValidator = compileSchema(schema);
        return cachedValidator;
      }
    } catch {
      // Network error — fall through to bundled schema
    }
    cachedValidator = compileSchema(FALLBACK_SCHEMA as unknown as Record<string, unknown>);
    return cachedValidator;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

function formatError(err: ErrorObject): string {
  const path = err.instancePath || '/';
  const msg = err.message || 'invalid';
  // AJV types `err.params` as `Record<string, any>`, but we've already
  // narrowed the keyword above, so the concrete shape is known at each
  // branch. The casts turn `any` into the exact AJV-documented shape
  // for that keyword.
  if (err.keyword === 'enum' && err.params && 'allowedValues' in err.params) {
    const params = err.params as { allowedValues: unknown[] };
    return `${path}: ${msg} (allowed: ${params.allowedValues.join(', ')})`;
  }
  if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
    const params = err.params as { missingProperty: string };
    return `${path}: missing required field "${params.missingProperty}"`;
  }
  return `${path}: ${msg}`;
}

export async function validateRunbookSpec(spec: unknown): Promise<SchemaValidationResult> {
  try {
    const validator = await loadValidator();
    const ok = validator(spec);
    if (ok) return { valid: true, errors: [] };
    const errors = (validator.errors ?? []).slice(0, 10).map(formatError);
    return { valid: false, errors };
  } catch (err) {
    // Network failure or schema unreachable — treat as soft pass
    // and surface a single warning so the operator knows we
    // couldn't reach the schema. Validation is best-effort, not a
    // hard gate.
    return {
      valid: true,
      errors: [
        `(warning) schema validation skipped: ${err instanceof Error ? err.message : 'unknown'}`,
      ],
    };
  }
}
