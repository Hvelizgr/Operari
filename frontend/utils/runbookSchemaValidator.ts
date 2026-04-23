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
 * in sync by re-copying when the canonical schema changes.
 */
const FALLBACK_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'name', 'steps'],
  properties: {
    version: { const: 1 },
    slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 64 },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 500 },
    category: { type: 'string', maxLength: 64 },
    schedule: { type: 'string' },
    vars: { type: 'object', additionalProperties: true },
    steps: { type: 'array', minItems: 1, items: { $ref: '#/definitions/RunbookStep' } },
  },
  definitions: {
    RunbookStep: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'type'],
      properties: {
        id: { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]*$', maxLength: 64 },
        type: { type: 'string', minLength: 1, maxLength: 128 },
        name: { type: 'string', maxLength: 200 },
        enabled: { type: 'boolean' },
        config: { type: 'object', additionalProperties: true },
        retry: { $ref: '#/definitions/RetryPolicy' },
        runIf: { type: 'string' },
        skipIf: { type: 'string' },
        next: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { oneOf: [{ type: 'string' }, { $ref: '#/definitions/StepConnection' }] },
            },
          ],
        },
        position: {
          type: 'object',
          additionalProperties: false,
          required: ['x', 'y'],
          properties: { x: { type: 'number' }, y: { type: 'number' } },
        },
      },
    },
    RetryPolicy: {
      type: 'object',
      additionalProperties: false,
      required: ['count'],
      properties: {
        count: { type: 'integer', minimum: 1, maximum: 20 },
        backoff: { type: 'string', enum: ['fixed', 'exponential'] },
        delayMs: { type: 'integer', minimum: 0 },
        maxDelayMs: { type: 'integer', minimum: 0 },
      },
    },
    StepConnection: {
      type: 'object',
      additionalProperties: false,
      required: ['to'],
      properties: {
        to: { type: 'string' },
        fromPort: { type: 'integer', minimum: 0 },
        toPort: { type: 'integer', minimum: 0 },
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
