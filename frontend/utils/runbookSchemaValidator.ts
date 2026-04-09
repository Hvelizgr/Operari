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
import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let cachedValidator: ValidateFunction | null = null;
let inflight: Promise<ValidateFunction> | null = null;

async function loadValidator(): Promise<ValidateFunction> {
    if (cachedValidator) return cachedValidator;
    if (inflight) return inflight;
    inflight = (async () => {
        const res = await fetch(`${API_BASE}/runbook.schema.json`);
        if (!res.ok) {
            throw new Error(`schema_fetch_failed:${res.status}`);
        }
        const schema = await res.json();
        // strict:false because the canonical schema uses some draft-07
        // keywords (e.g. nullable via `type: ["string", "null"]`) that
        // ajv strict mode trips on. We want forgiving validation here —
        // the goal is to catch real shape errors, not lint the schema.
        const ajv = new Ajv({ allErrors: true, strict: false });
        const compiled = ajv.compile(schema);
        cachedValidator = compiled;
        return compiled;
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
    if (err.keyword === 'enum' && err.params && 'allowedValues' in err.params) {
        return `${path}: ${msg} (allowed: ${(err.params as any).allowedValues.join(', ')})`;
    }
    if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
        return `${path}: missing required field "${(err.params as any).missingProperty}"`;
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
                `(warning) schema validation skipped: ${
                    err instanceof Error ? err.message : 'unknown'
                }`,
            ],
        };
    }
}
