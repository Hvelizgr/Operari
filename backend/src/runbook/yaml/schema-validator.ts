import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';

import runbookJsonSchema from './runbook.schema.json';

/**
 * Server-side JSON Schema validator for runbook specs. Pairs with the
 * matching frontend validator in `frontend/utils/runbookSchemaValidator.ts`
 * so the editor catches structural errors at edit time and the API
 * rejects malformed YAML at save time. The frontend can be bypassed
 * by anyone with an API key — this is the defence-in-depth layer.
 *
 * Compiled lazily (on first call) and memoized for the process
 * lifetime; the schema itself is checked into the repo and never
 * mutates at runtime.
 */
let cached: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (cached) return cached;
  const ajv = new Ajv({ allErrors: true, strict: false });
  cached = ajv.compile(runbookJsonSchema);
  return cached;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

function formatError(err: ErrorObject): string {
  const path = err.instancePath || '/';
  const msg = err.message || 'invalid';
  if (err.keyword === 'enum' && err.params && 'allowedValues' in err.params) {
    const allowed = (err.params as { allowedValues: unknown[] }).allowedValues;
    return `${path}: ${msg} (allowed: ${allowed.join(', ')})`;
  }
  if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
    const missing = (err.params as { missingProperty: string }).missingProperty;
    return `${path}: missing required field "${missing}"`;
  }
  return `${path}: ${msg}`;
}

/**
 * Validate a parsed runbook spec object against the canonical schema.
 * Returns the same shape as the frontend validator so the API and the
 * editor can render errors identically. The cap of 10 errors mirrors
 * the frontend — beyond that the operator gets noise, and the first
 * batch is almost always enough to spot the structural problem.
 */
export function validateRunbookSpec(spec: unknown): SchemaValidationResult {
  const validator = getValidator();
  const ok = validator(spec);
  if (ok) return { valid: true, errors: [] };
  const errors = (validator.errors ?? []).slice(0, 10).map(formatError);
  return { valid: false, errors };
}

/** Exposed only for tests so they can reset the memoized validator. */
export const __testHooks = {
  resetCache: () => {
    cached = null;
  },
};
