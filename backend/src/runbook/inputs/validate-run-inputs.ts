import type { RunbookInputDefinition } from '../../types/runbook.types';

/**
 * Validate + normalize the `input` payload a run dispatch carries
 * against the runbook's declared `inputs[]` (Rundeck-style job
 * options).
 *
 * Why this exists: the auto-generated Run dialog form sends values
 * as strings (HTML forms always do), but the runbook author declared
 * `type: 'number'` / `'boolean'` / `'select'` — we need to coerce,
 * reject mismatches, fill defaults, and keep unknown keys out so a
 * typo doesn't silently land in `{{vars.foo}}` as `undefined`.
 *
 * Behavior:
 *   - Returns `{ ok: true, values }` with the coerced, defaulted map.
 *   - Returns `{ ok: false, issues }` on any failure. `issues` is a
 *     flat list `{ field, message }` that the 400 response serializes
 *     straight back to the UI for per-field error messages.
 *   - Required + missing → issue on that field.
 *   - Type mismatch → issue (string that's not a number, bool that's
 *     not "true"/"false"/true/false, select value not in options).
 *   - Unknown input key → issue ("unknown input"). Defensive: keeps
 *     the run's variable namespace clean. A typo-tolerant mode is
 *     a separate feature; the default posture here is strict.
 *
 * When the runbook has no declared inputs, the raw payload is
 * returned as-is. That preserves the historical behavior for
 * runbooks that never opted into typed inputs.
 */

export type RunInputValues = Record<string, string | number | boolean>;

export interface RunInputValidationIssue {
  field: string;
  message: string;
}

export type RunInputValidationResult =
  | { ok: true; values: RunInputValues }
  | { ok: false; issues: RunInputValidationIssue[] };

export function validateRunInputs(
  definitions: RunbookInputDefinition[] | null | undefined,
  provided: Record<string, unknown> | null | undefined
): RunInputValidationResult {
  // No declared inputs — pass the payload through untouched. Runbooks
  // without typed inputs keep accepting free-form `{{vars.x}}` data.
  if (!definitions || definitions.length === 0) {
    return { ok: true, values: (provided ?? {}) as RunInputValues };
  }

  const payload = provided ?? {};
  const issues: RunInputValidationIssue[] = [];
  const values: RunInputValues = {};
  const declaredNames = new Set(definitions.map(d => d.name));

  for (const def of definitions) {
    const raw = payload[def.name];
    const missing = raw === undefined || raw === null || raw === '';

    if (missing) {
      if (def.required) {
        issues.push({ field: def.name, message: `${def.name} is required` });
        continue;
      }
      if (def.default !== undefined) {
        values[def.name] = def.default;
      }
      continue;
    }

    const coerced = coerce(def, raw);
    if (coerced.kind === 'err') {
      issues.push({ field: def.name, message: coerced.message });
      continue;
    }
    values[def.name] = coerced.value;
  }

  // Strict posture: unknown keys are caller mistakes, not a quiet
  // pass-through. Catches typos like `user_id` vs `userId`.
  for (const key of Object.keys(payload)) {
    if (!declaredNames.has(key)) {
      issues.push({ field: key, message: `unknown input "${key}"` });
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, values };
}

type CoerceResult =
  | { kind: 'ok'; value: string | number | boolean }
  | { kind: 'err'; message: string };

function coerce(def: RunbookInputDefinition, raw: unknown): CoerceResult {
  switch (def.type) {
    case 'text': {
      if (typeof raw === 'string') return { kind: 'ok', value: raw };
      if (typeof raw === 'number' || typeof raw === 'boolean') {
        return { kind: 'ok', value: String(raw) };
      }
      return { kind: 'err', message: `${def.name} must be a string` };
    }
    case 'number': {
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return { kind: 'ok', value: raw };
      }
      if (typeof raw === 'string') {
        const n = Number(raw);
        if (Number.isFinite(n)) return { kind: 'ok', value: n };
      }
      return { kind: 'err', message: `${def.name} must be a number` };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { kind: 'ok', value: raw };
      if (raw === 'true') return { kind: 'ok', value: true };
      if (raw === 'false') return { kind: 'ok', value: false };
      return { kind: 'err', message: `${def.name} must be a boolean` };
    }
    case 'select': {
      if (typeof raw !== 'string') {
        return { kind: 'err', message: `${def.name} must be a string` };
      }
      if (!def.options || !def.options.includes(raw)) {
        return {
          kind: 'err',
          message: `${def.name} must be one of: ${(def.options ?? []).join(', ')}`,
        };
      }
      return { kind: 'ok', value: raw };
    }
    default: {
      // Exhaustiveness guard — a new RunbookInputType should fail
      // loud at the validator instead of silently accepting.
      return { kind: 'err', message: `${def.name} has unsupported type` };
    }
  }
}
